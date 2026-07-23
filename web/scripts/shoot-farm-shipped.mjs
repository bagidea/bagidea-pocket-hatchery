// Proof that the farm is the DEFAULT landing view — not a tab you have to find.
//
// The difference from verify-farm-scene.mjs is the one thing that matters here:
// this script NEVER clicks the Farm tab. It connects and shoots whatever the
// panel decided to show. If the farm isn't the default, this fails rather than
// quietly screenshotting the collection list.
//
// Usage: node shoot-farm-shipped.mjs <baseUrl>
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

// Same account-selection rewrite as verify-farm-scene.mjs: waxwingsuper is the
// account that owns creatures; every chain read below is still the real chain.
await page.route('**/plugin/wax-wallet/cmd', async (route) => {
  let command = ''
  try { command = JSON.parse(route.request().postData() || '{}').cmd } catch { /* ignore */ }
  if (command !== 'status') return route.continue()
  const res = await route.fetch()
  const body = await res.json()
  for (const a of body?.status?.accounts ?? []) {
    a.selected = a.account === 'waxwingsuper' && a.permission === 'active'
  }
  await route.fulfill({ response: res, body: JSON.stringify(body) })
})

await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.click('button:has-text("Connect via waxwing")')

// No tab click anywhere in this script — the farm has to appear on its own.
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
await page.waitForTimeout(1500) // sprites resolve + first frames run

const agents = await page.$$eval('[data-testid="farm-agent"]', (e) => e.length)
const farmTabActive = await page.$$eval('button', (els) => {
  const b = els.find((x) => x.textContent.includes('Farm'))
  return b ? b.className.includes('tabActive') : false
})

await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(400)
await (await page.$('[data-testid="farm-stage"]')).screenshot({ path: join(outDir, 'farm-shipped.png') })

console.log(`farm agents on landing: ${agents}`)
console.log(`Farm tab marked active without being clicked: ${farmTabActive}`)
console.log(`page errors: ${errors.length ? errors.join(' | ') : 'none'}`)
console.log('📸 screenshots → farm-shipped.png')

await browser.close()
const ok = agents > 0 && farmTabActive && errors.length === 0
console.log(ok ? '✅ the farm IS the default view' : '❌ the farm is NOT the default view')
process.exit(ok ? 0 : 1)
