/**
 * playflow-panel.mjs — walk the REAL deployed plugin panel (daemon :8787),
 * connect via waxwing, then exercise every gameplay action and prove each one
 * opens the amber Sign sheet with the correct on-chain {action, account,
 * contract, data}. We CANCEL every sign (never broadcast) because Kevin is
 * running the chain loop on waxwingsuper live — this proves the play path is
 * wired end-to-end, short of the by-design unlock/broadcast gate.
 *
 *   cd web && node scripts/playflow-panel.mjs
 *
 * Output: screenshots/playflow/*.png  + a PASS/FAIL log per action.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots', 'playflow')
mkdirSync(outDir, { recursive: true })

const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel'

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)
const shot = (n) => page.screenshot({ path: join(outDir, n), fullPage: true }).then(() => console.log(`     📸 ${n}`))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

// Read the visible Sign-sheet rows (Action / Account / Contract / Data / Network)
async function readSignSheet() {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]')
    if (!dlg) return null
    const rows = {}
    dlg.querySelectorAll('div').forEach((d) => {
      const kids = d.children
      if (kids.length === 2) {
        const k = kids[0].textContent?.trim()
        const v = kids[1].textContent?.trim()
        if (['Action', 'Account', 'Contract', 'Data', 'Network'].includes(k)) rows[k] = v
      }
    })
    const ga = dlg.querySelector('h3')?.textContent?.trim()
    return { title: ga, ...rows }
  })
}

// Click the first ENABLED button whose accessible name matches `re`, waiting up
// to `timeout`ms for one to become enabled (the dashboard re-renders after each
// Cancel, so buttons can flicker disabled for a beat).
async function clickFirstEnabled(re, timeout = 9000) {
  const loc = page.getByRole('button', { name: re })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const n = await loc.count()
    for (let i = 0; i < n; i++) {
      const b = loc.nth(i)
      if (await b.isEnabled().catch(() => false)) { await b.click(); return true }
    }
    await page.waitForTimeout(300)
  }
  return false
}

// click an action button → expect the Sign sheet → capture → Cancel
async function signStep(label, clickFn, expectAction, file) {
  console.log(`\n▶ ${label}`)
  try {
    await page.waitForTimeout(600) // let the dashboard settle after the previous step
    const clicked = await clickFn()
    if (!clicked) { bad(`${label}: no enabled button found`); return }
    // Sign sheet builds an intent via the daemon; give it a beat.
    await page.waitForSelector('[role="dialog"]', { timeout: 12000 })
    await page.waitForTimeout(400)
    const s = await readSignSheet()
    if (!s) { bad(`${label}: dialog opened but no rows`); return }
    console.log(`     action=${s.Action}  account=${s.Account}  contract=${s.Contract}`)
    console.log(`     data=${(s.Data || '').slice(0, 90)}`)
    if (expectAction.test(s.Action || '')) ok(`${label}: Sign sheet action = "${s.Action}" ✓`)
    else bad(`${label}: expected ${expectAction}, got "${s.Action}"`)
    if (/waxwingsuper/.test(s.Account || '')) ok(`${label}: account = waxwingsuper`)
    else bad(`${label}: account = "${s.Account}"`)
    if (/phgamecreatr/.test(s.Contract || '')) ok(`${label}: contract = phgamecreatr`)
    else bad(`${label}: contract = "${s.Contract}"`)
    await shot(file)
    // Cancel — never broadcast.
    await page.getByRole('button', { name: /^Cancel$/ }).click()
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 })
    ok(`${label}: Cancel closed the sheet cleanly (no broadcast)`)
  } catch (e) {
    bad(`${label}: ${e.message.split('\n')[0]}`)
    await shot(`ERR-${file}`)
  }
}

console.log(`\nPlay-flow on the DEPLOYED panel: ${URL}\n${'='.repeat(60)}`)

// 1) Landing
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await shot('01-landing.png')
const landing = await page.evaluate(() => document.body.innerText)
if (/Connect via waxwing/i.test(landing)) ok('landing shows "Connect via waxwing"')
else bad('no "Connect via waxwing" on landing')

// 2) Connect via waxwing → dashboard
console.log('\n▶ Connect via waxwing')
await page.getByRole('button', { name: /Connect via waxwing/i }).click()
// The dashboard SHELL ("Harvest EGG") renders before the chain reads resolve, so
// wait for the live creature inventory to actually populate (N collected > 0).
await page.waitForFunction(
  () => /([1-9]\d*)\s+collected/.test(document.body.innerText),
  { timeout: 25000 },
)
await page.waitForTimeout(1200) // let the EGG/rewardpool chips settle too
await shot('02-dashboard.png')
const dash = await page.evaluate(() => document.body.innerText)
if (/waxwingsuper/.test(dash)) ok('connected as waxwingsuper')
else bad('wallet pill not showing waxwingsuper')
const nCards = await page.locator('button:has-text("Evolve")').count()
console.log(`     creature cards (Evolve buttons) = ${nCards}`)
const eggM = dash.match(/EGG\s*\n?\s*([\d,]+)/i)
console.log(`     EGG balance on dashboard = ${eggM ? eggM[1] : '?'}`)

// 3) Hatch
await signStep('Hatch', () => clickFirstEnabled(/Hatch Egg/i), /hatch/i, '03-hatch-sign.png')

// 4) Feed (first card with an enabled Feed button)
await signStep('Feed', () => clickFirstEnabled(/Feed/i), /feed/i, '04-feed-sign.png')

// 5) Evolve (first enabled Evolve button; MAX-stage cards have none)
await signStep('Evolve', () => clickFirstEnabled(/Evolve/i), /evolve/i, '05-evolve-sign.png')

// 6) Harvest
await signStep('Harvest', () => clickFirstEnabled(/Harvest EGG/i), /harvest/i, '06-harvest-sign.png')

// 7) Claim Reward
await signStep('Claim Reward', () => clickFirstEnabled(/Claim Reward/i), /claim/i, '07-claim-sign.png')

console.log(`\n${'='.repeat(60)}`)
if (pageErrors.length) { console.log('page errors:'); pageErrors.forEach((e) => console.log('  - ' + e)) }
console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
