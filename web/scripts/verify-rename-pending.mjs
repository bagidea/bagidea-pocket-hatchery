// Rename "saving on chain" state — proves the player is told the name is being
// written to the chain, instead of the card silently swapping to a name that has
// not landed yet (which is what a local-only rename used to do).
//
// The page is the REAL connected dashboard reading live chain state. The ONLY
// thing intercepted is the waxwing `buildaction` call: it is held open, which
// parks the rename mid-flight so the in-flight UI can be captured. Nothing is
// signed and nothing is broadcast by this script.
//
// Usage: node verify-rename-pending.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const ASSET = '1099603751834' // "Ember Queen" on chain

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

// Hold `buildaction` open so the rename stays in flight. Every other wallet
// command (status/account/balance) passes through to the real daemon.
let heldSetname = false
await page.route('**/plugin/wax-wallet/cmd', async (route) => {
  let body = {}
  try { body = JSON.parse(route.request().postData() || '{}') } catch {}
  if (body.cmd === 'buildaction' && body.args?.action === 'setname') {
    heldSetname = true
    return // never fulfilled → the tx never resolves, the UI stays "saving"
  }
  await route.continue()
})

try {
  console.log(`\n═══ Rename in-flight state — ${PANEL} ═══`)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.click('button:has-text("🐾 Creatures")')
  await page.waitForSelector(`[data-testid="name-${ASSET}"]`, { timeout: 15000 })

  // Open the inline editor and commit a new name.
  await page.hover(`[data-testid="name-${ASSET}"]`)
  await page.click(`[data-testid="rename-${ASSET}"]`)
  await page.fill(`[data-testid="name-input-${ASSET}"]`, 'Cinderpaw')
  await page.press(`[data-testid="name-input-${ASSET}"]`, 'Enter')
  await page.waitForTimeout(1500)

  check('① the rename reached the wallet as a setname action', heldSetname)

  const saving = await page
    .textContent(`[data-testid="name-saving-${ASSET}"]`)
    .catch(() => null)
  check('② the card shows the on-chain saving state', /Saving name on chain/i.test(saving ?? ''), String(saving))

  // While saving, the name must still read as what the CHAIN says — the new name
  // is not shown until the chain confirms it.
  const shown = await page.$eval(`[data-testid="name-${ASSET}"] span`, (e) => e.textContent.trim())
  check('③ the name still reads the confirmed on-chain value while saving', shown === 'Ember Queen', shown)

  const renameBtn = await page.$(`[data-testid="rename-${ASSET}"]`)
  check('④ the rename control is withdrawn while the tx is in flight', renameBtn === null)

  await page.screenshot({
    path: join(outDir, 'onchain-rename-saving.png'),
    clip: await page.$eval(`[data-testid="name-${ASSET}"]`, (el) => {
      const card = el.closest('article').getBoundingClientRect()
      return { x: card.x, y: card.y, width: card.width, height: card.height }
    }),
  })
  console.log('  📸 onchain-rename-saving.png')
} catch (e) {
  fail++
  console.log(`  ❌ threw: ${e.message}`)
  await page.screenshot({ path: join(outDir, 'onchain-rename-saving-ERR.png'), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
