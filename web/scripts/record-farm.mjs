// Record the living farm walking — a still frame cannot prove motion.
//
// Drives the SAME real connected dashboard verify-farm-scene.mjs does (waxwingsuper's
// real on-chain creatures, live chain reads), films the farm stage for ~10s, and
// leaves the clip in web/screenshots/.
//
// Usage: node record-farm.mjs <baseUrl> [seconds]
import { chromium } from 'playwright'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
const tmpDir = join(outDir, '_rec')
await mkdir(tmpDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const SECONDS = Number(process.argv[3] || 10)
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

const browser = await chromium.launch({ headless: true })
// A viewport cropped to the stage: the recording IS the farm, no page chrome.
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1100, height: 720 } },
})
const page = await ctx.newPage()

// Same wallet-status rewrite as the verify script: aim the panel at waxwingsuper
// (the account that owns creatures) without touching the office wallet's real
// selection. Chain reads are untouched — every creature below is on chain.
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
await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
await page.click('button:has-text("Farm")')
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1000)

const n = await page.$$eval('[data-testid="farm-agent"]', (e) => e.length)
console.log(`recording ${SECONDS}s of ${n} real on-chain creatures…`)
await page.waitForTimeout(SECONDS * 1000)

const video = page.video()
await ctx.close()
await browser.close()

const src = await video.path()
const dest = join(outDir, 'farm-walking.webm')
await rm(dest, { force: true })
await rename(src, dest)
await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
console.log(`✅ clip → ${dest}`)
await readdir(outDir)
