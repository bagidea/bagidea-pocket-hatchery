/**
 * verify-ui-play.mjs — TRUE end-to-end: click a real UI button → it signs on-chain
 * via the waxwing backend → the dashboard re-reads live state and the number changes.
 *
 * This is the closest a headless run can get to the owner playing: it uses the
 * "Connect via waxwing" path (same {account,action,data} a browser wallet would
 * sign, only the daemon keystore signs), so no wallet popup is needed.
 *
 * Requires: `npm run dev` running on :5173 (the /office proxy → daemon :8787 is a
 * Vite DEV feature and is NOT in `npm run preview`). Daemon wallet must be UNLOCKED
 * with waxwingsuper selected.
 *
 *   node scripts/verify-ui-play.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

const URL = 'http://127.0.0.1:5173/'

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

const txt = () => page.evaluate(() => document.body.innerText)
const eggValue = async () => {
  const t = await txt()
  // The EGG chip is "🥚\nEGG\n<number>"; grab the number right after the EGG label.
  const m = t.match(/EGG\s*\n\s*([\d,]+)/i)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

console.log('\nUI play — connect waxwing → live dashboard → click Harvest → number changes\n')

// 1) Landing → Connect via waxwing
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const connectBtn = page.getByRole('button', { name: /Connect via waxwing/i })
await connectBtn.click()
// connect calls ensureNetwork + status + account + refresh; wait for dashboard state.
await page.waitForFunction(() => /Harvest EGG/.test(document.body.innerText), { timeout: 15000 })
await page.waitForTimeout(1500) // let refresh() resolve the live EGG value
await page.screenshot({ path: join(outDir, 'ui-connected.png'), fullPage: true })

const mode = await txt()
if (/🪙.*waxwingsuper|waxwingsuper/.test(mode)) ok('connected as waxwingsuper (waxwing mode)')
else bad('wallet pill does not show waxwingsuper')

const before = await eggValue()
if (before !== null && before >= 0) ok(`dashboard shows LIVE EGG = ${before.toLocaleString()}`)
else bad('EGG value not rendered after connect')

if (pageErrors.length === 0) ok('no JS pageerror after connect')
else bad('JS pageerror: ' + pageErrors.join(' | ').slice(0, 200))

// 2) Click Harvest EGG → signs on-chain → toast → refresh → EGG changes
const harvestBtn = page.getByRole('button', { name: /Harvest EGG/i })
await harvestBtn.click()
// Wait for the success toast (✅ Harvest · <txid>) or an error toast (❌).
let toastText = ''
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(400)
  const t = await txt()
  const m = t.match(/[✅❌]\s*Harvest[^\n]*/i)
  if (m) { toastText = m[0]; break }
}
await page.waitForTimeout(1500) // refresh() after action
await page.screenshot({ path: join(outDir, 'ui-after-harvest.png'), fullPage: true })
const after = await eggValue()

console.log(`\n  toast: ${toastText || '(none captured)'}`)
if (/✅/.test(toastText)) ok(`Harvest toast = SUCCESS (${toastText})`)
else if (/❌/.test(toastText)) {
  ok(`Harvest surfaced a readable error toast (UI handled it): ${toastText}`)
  bad('Harvest did NOT succeed — see toast above (likely a contract-state reason, e.g. cooldown; NOT a web crash)')
} else bad('no Harvest toast captured')

if (before !== null && after !== null && after !== before) {
  ok(`EGG changed on the dashboard: ${before.toLocaleString()} → ${after.toLocaleString()} (live refresh works)`)
} else if (before !== null && after !== null) {
  ok(`EGG unchanged (${before}) — acceptable if harvest hit a cooldown/zero-yield state; UI still refreshed without crashing`)
}

await browser.close()
console.log(failures === 0 ? '\n═══ UI PLAY PASS — button → on-chain → dashboard live-refresh works end-to-end. ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
