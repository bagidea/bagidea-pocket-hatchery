// Connected-view Awaken verification — drives the REAL connected dashboard (the
// surface the CEO plays via "Connect via waxwing" as waxwingsuper), NOT ?awakenlab.
//
// Why an intercept: waxwingsuper currently has ZERO stage-0 creatures on chain
// (all 12 are already awake) — so a live read can't show the sleeping/ready
// states the boss hit. We therefore intercept ONLY the `creatrsv2` table read and
// inject three creatures (sleeping / elapsed / awake). Every OTHER table
// (configv3, spccfgv2, players, rewardpool) passes through to the REAL chain, so
// all awaken_dur / wake_cost / feed_cd numbers are the live configv3 values —
// nothing about the timing/costs is faked, only the existence of a stage-0 egg.
//
// Usage: node verify-connected-awaken.mjs <baseUrl> <tag>
//   e.g. node verify-connected-awaken.mjs http://127.0.0.1:8787/plugin/pocket-hatchery/ after
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const TAG = process.argv[3] || 'after'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

// Real genetics cloned from an on-chain waxwingsuper creature so the sprite/DNA
// decode path runs for real.
const GENE = '036b0eacc068ea55c4270ae4a036821fcf234ad54c6572154d5765baed2ab965'
const now = Math.floor(Date.now() / 1000)

// Three creatures covering the three states. template_id → live spccfgv2 row
// (egg_type drives rarity → awaken_dur/wake_cost from live configv3).
const CRAFT = [
  { // A — SLEEPING, common (egg_type 0): mid-timer → live countdown + ⚡ ปลุกเลย · 3 WAX
    asset_id: '1150000000001', owner: 'waxwingsuper', template_id: 662889, stage: 0,
    growth_base: 0, fed_growth: 0, born_at: now - 900, last_sync: now, last_fed: 0, last_bred: 0, genetics: GENE,
  },
  { // B — ELAPSED, epic (egg_type 3): born long ago → 🌅 พร้อมตื่น, harvest free, NO WAX button (the boss's case)
    asset_id: '1150000000002', owner: 'waxwingsuper', template_id: 663046, stage: 0,
    growth_base: 0, fed_growth: 0, born_at: now - 99999, last_sync: now, last_fed: 0, last_bred: 0, genetics: GENE,
  },
  { // C — AWAKE, rare (egg_type 2): stage 1 → SatietyMeter (Feed) takes over
    asset_id: '1150000000003', owner: 'waxwingsuper', template_id: 662978, stage: 1,
    growth_base: 1500, fed_growth: 100, born_at: now - 200000, last_sync: now, last_fed: now - 3600, last_bred: 0, genetics: GENE,
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

// Intercept ONLY creatrsv2; everything else hits the real chain.
await page.route('**/v1/chain/get_table_rows', async (route) => {
  let table = ''
  try { table = (JSON.parse(route.request().postData() || '{}')).table } catch {}
  if (table === 'creatrsv2') {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ rows: CRAFT, more: false, next_key: '' }) })
  } else {
    await route.continue()
  }
})

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

try {
  console.log(`\n═══ CONNECTED view (${TAG}) — ${PANEL} ═══`)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  // Real connect as waxwingsuper via the office daemon wallet (read-only path).
  await page.click('button:has-text("Connect via waxwing")')
  // Give connect + fetchGameState + first render time.
  await page.waitForSelector('[data-asleep]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)

  const cards = await page.$$eval('[data-asleep]', (els) =>
    els.map((e) => e.getAttribute('data-asleep')))
  console.log(`① Connected dashboard rendered ${cards.length} creature cards (as waxwingsuper)`)
  check('at least 3 creature cards rendered', cards.length >= 3, `got ${cards.length}`)

  // Sleep state visible: 😴 หลับอยู่ veil on the two stage-0 cards.
  const veils = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /😴\s*หลับอยู่/.test(e.textContent)).length)
  check('② sleep veil "😴 หลับอยู่" shown on the asleep cards', veils >= 2, `got ${veils}`)

  // Countdown clock HH:MM:SS present (sleeping card).
  const clock = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /ตื่นอัตโนมัติใน/.test(e.textContent)).length)
  const clockVal = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /^\d{2}:\d{2}:\d{2}$/.test(e.textContent.trim())).map((e) => e.textContent.trim()))
  check('③ "ตื่นอัตโนมัติใน" countdown label present', clock >= 1, `got ${clock}`)
  check('③ a live HH:MM:SS clock is shown', clockVal.length >= 1, JSON.stringify(clockVal))

  // Buttons: sleeping → ⚡ ปลุกเลย · N WAX (enabled); elapsed → พร้อมตื่น/ปลุกฟรี (disabled, NO WAX).
  const btns = await page.$$eval('button', (els) =>
    els.filter((b) => /ปลุกเลย|ปลุกฟรี/.test(b.textContent))
      .map((b) => ({ text: b.textContent.trim().replace(/\s+/g, ' '), disabled: b.disabled })))
  const sleeping = btns.find((b) => /ปลุกเลย/.test(b.text))
  const ready = btns.find((b) => /ปลุกฟรี/.test(b.text))
  check('④ sleeping card → "⚡ ปลุกเลย · N WAX" enabled', !!sleeping && /WAX/.test(sleeping.text) && !sleeping.disabled, JSON.stringify(sleeping))
  check('⑤ ELAPSED card → "🌅 พร้อมตื่น — กด Harvest เพื่อปลุกฟรี" disabled', !!ready && ready.disabled, JSON.stringify(ready))
  check('⑤ ELAPSED card shows NO pay-WAX button', !(ready && /WAX/.test(ready.text)), JSON.stringify(ready))

  // Awake card → SatietyMeter (Feed) present.
  const satiety = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /🍽️\s*Satiety/.test(e.textContent)).length)
  check('⑥ awake (stage≥1) card → 🍽️ Satiety meter shown', satiety >= 1, `got ${satiety}`)

  check('⑦ no runtime errors on the page', errors.length === 0, errors.join(' | '))

  await page.screenshot({ path: join(outDir, `connected-awaken-${TAG}.png`), fullPage: true })
  console.log(`  📸 screenshots → connected-awaken-${TAG}.png`)
} catch (e) {
  fail++
  console.log(`  ❌ threw: ${e.message}`)
  await page.screenshot({ path: join(outDir, `connected-awaken-${TAG}-ERR.png`), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed  (${TAG})`)
process.exit(fail === 0 ? 0 : 1)
