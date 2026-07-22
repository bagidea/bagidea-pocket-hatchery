/**
 * verify-harvest-cap-ux.mjs — proves the Harvest "daily cap reached" UX fix.
 *
 * THE BUG (CEO, 2026-07-17): with today's quota spent, the Harvest button read
 * "🌾 0 EGG" + "daily cap reached" floating on its own. Players read that as a
 * broken game — nothing said the 0 meant "you already collected today's full
 * allowance", nor when it would come back.
 *
 * THE FIX (frontend only — no contract change): a Daily Harvest panel showing
 * real progress against today's EFFECTIVE ceiling (players.egg_harvested_today /
 * configv3.daily_egg_cap, rarity-scaled when cap_scales_rarity is set), a warm
 * "Daily cap reached — resets in ~Hh Mm" state counting down to the UTC-midnight
 * reset, and copy stating creatures keep earning meanwhile.
 *
 * THIS TEST mirrors the LIVE chain state that triggered the report (read
 * 2026-07-17 from phgamecreatr on wax-testnet):
 *   officewax123 → egg_harvested_today=240, harvest_day=20650, last_harvest=1784212950
 *   configv3     → daily_egg_cap=240, cap_scales_rarity=1, harvest_cd=3600, offline_cap_h=8
 * One fed common creature IS earning (gross > 0) while the quota is spent
 * (remaining = 0) — the exact "0 EGG but nothing is wrong" state.
 *
 *   node scripts/verify-harvest-cap-ux.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webDir = join(__dirname, '..')
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

// Scenario:
//   (none)     → cap spent, cooldown clear  → the reported state (harvest-cap-after.png)
//   before     → same state on the OLD UI    → harvest-cap-before.png
//   cooldown   → cap spent AND still on the 1h harvest cooldown → both countdowns,
//                shown separately (harvest-cap-cooldown.png)
const TAG = ['before', 'cooldown'].includes(process.argv[2]) ? process.argv[2] : 'after'

// By default the checks run against a throwaway vite dev server (fast source
// feedback). Set PH_URL to hit the DEPLOYED plugin the daemon actually serves —
// PH_URL=http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html — which is
// what proves the shipped bundle, not just the source, renders the fix.
const PORT = 5181
const LIVE_URL = process.env.PH_URL
const URL = LIVE_URL || `http://127.0.0.1:${PORT}/plugin/pocket-hatchery/static/`

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

// "now" inside UTC day 20650 [1784160000, 1784246400). Default sits past
// last_harvest+3600 so the harvest cooldown is clear and the DAILY CAP is the only
// thing gating; the 'cooldown' scenario sits 20 min after the harvest so BOTH the
// cap and the 1h cooldown are live at once (they must read as separate states).
const HEAD_SEC = TAG === 'cooldown' ? 1784212950 + 1200 : 1784220000
const HEAD_ISO = new Date(HEAD_SEC * 1000).toISOString().replace('Z', '')
// Quota rolls over at the next UTC midnight (1784246400).
const EXPECT_RESET = TAG === 'cooldown' ? '8h 57m' : '7h 20m'
// harvest_cd (3600) − 1200 elapsed = 2400s left on the cooldown.
const EXPECT_CD = '40m 0s'

// ── LIVE chain rows (values read from wax-testnet 2026-07-17) ────────────────
const CONFIG = {
  token_contract: 'hatchtokens1', collection: 'phgamecreatr', schema_name: 'creatures',
  fee_account: 'phgamecreatr', paused: 0, hatch_cost: 150, evolve_cost: 300,
  breed_cost: '5.0000 HATCH', feed_cost: 0, feed_cd: 21600, harvest_cd: 3600,
  breed_cd: 86400, feed_daily_cap: 3, daily_egg_cap: 240, offline_cap_h: 8,
  tap_egg_cap: 60, feed_boost: 100, season_index: 4, season_started: 1784060782,
  rng_oracle: 'phgamecreatr', rarity_w_common: 6900, rarity_w_uncommon: 2000,
  rarity_w_rare: 800, rarity_w_epic: 250, rarity_w_legendary: 45, rarity_w_mythic: 5,
  fed_dur_common: 172800, earn_mult_common: 10000, cap_scales_rarity: 1,
  awaken_dur_common: 3600, wake_cost_common: '3.00000000 WAX', wax_contract: 'eosio.token',
}
const SPECIES = {
  template_id: 900001, growth_rate: 1000, thresh_1: 1000, thresh_2: 5000,
  thresh_3: 20000, thresh_4: 100000, yield_0: 50, yield_1: 100, yield_2: 200,
  yield_3: 400, yield_4: 800, max_stage: 5, egg_weight: 100, egg_type: 0, family: 'Fire',
}
// The reported player: today's 240-EGG allowance fully spent.
const PLAYER = {
  account: 'waxwingsuper', created_at: 1782950895, egg_balance: 32,
  last_harvest: 1784212950, harvest_day: 20650, egg_harvested_today: 240,
  feeds_today: 2, feed_day: 20650, total_egg_farmed: 744, total_hatch_burned: 0,
  last_claimed: 0, claimed_season: 0,
}
const GENE = '25b649a90f8201a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf3b9'
// Stage 1 common, fed 20000s ago (still fed: fed_dur_common=172800) → IS earning:
// ws=last_harvest=1784212950, we=now=1784220000 → fed_h=floor(7050/3600)=1 → gross>0.
const CREATURE_FED = {
  asset_id: '1099600000001', owner: 'waxwingsuper', template_id: 900001, stage: 1,
  growth_base: 2000, fed_growth: 500, born_at: HEAD_SEC - 400000, last_sync: HEAD_SEC - 20000,
  last_fed: HEAD_SEC - 20000, last_bred: 0, genetics: GENE,
}

const WAXWING_STATUS = {
  network: { id: 'wax-testnet', kind: 'testnet', name: 'WAX Testnet' },
  networks: [], accounts: [{ account: 'waxwingsuper', permission: 'active',
    publicKey: 'EOS5fake', selected: true }],
  selected: 'waxwingsuper', unlocked: true, unlockedKeys: 1, hasPassword: true,
  pendingIntents: [], intentResults: [],
}
const WAXWING_ACCOUNT = { account_name: 'waxwingsuper', core_liquid_balance: '10.0000 WAX',
  cpu_limit: { used: 1, available: 1000, max: 1001 },
  net_limit: { used: 1, available: 1000, max: 1001 }, ram_usage: 3000, ram_quota: 8000 }

const freezeClockScript = (ms) => `(() => {
  const OD = Date; const F = ${ms};
  class FD extends OD { constructor(...a){ a.length ? super(...a) : super(F); } static now(){ return F; } }
  globalThis.Date = FD;
})()`

async function installRoutes(page) {
  await page.route('**/v1/chain/get_info', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      head_block_time: HEAD_ISO, head_block_num: 1, chain_id: 'f16b', server_version: '0' }) }))

  await page.route('**/v1/chain/get_table_rows', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const rowsByTable = {
      configv3: [CONFIG], players: [PLAYER], creatrsv2: [CREATURE_FED],
      spccfgv2: [SPECIES], rewardpool: [], claims: [],
    }
    route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ rows: rowsByTable[body.table] ?? [], more: false, next_key: '' }) })
  })

  await page.route('**/v1/chain/get_currency_balance', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(['32 HATCH']) }))
  await page.route('**/office/event', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  // Glob BOTH shapes: the dev origin calls /office/plugin/wax-wallet/cmd, the
  // deployed panel (served from the daemon itself) calls /plugin/wax-wallet/cmd.
  // Missing the second one lets the REAL waxwing answer — the test then connects
  // as whatever account is actually selected, and chain.ts filters the mocked
  // creature out by owner (chain.ts:301), silently emptying the collection.
  await page.route('**/plugin/wax-wallet/cmd', async (route) => {
    const { cmd } = JSON.parse(route.request().postData() || '{}')
    const reply = {
      status: { status: WAXWING_STATUS }, account: { account: WAXWING_ACCOUNT },
      setnetwork: { ok: true }, balance: { balance: [] },
    }[cmd] ?? {}
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

// ── main ──
// Against a live PH_URL there is nothing to spawn — the daemon already serves it.
const server = LIVE_URL
  ? null
  : spawn(process.execPath, [join(webDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--port', String(PORT), '--strictPort'], { cwd: webDir, stdio: ['ignore', 'pipe', 'pipe'] })
const waitReady = LIVE_URL
  ? Promise.resolve()
  : new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('vite did not start in 30s')), 30000)
      server.stdout.on('data', (d) => { if (/http:\/\/localhost:/.test(String(d))) { clearTimeout(t); res() } })
      server.stderr.on('data', (d) => process.stderr.write(d))
    })

let browser
try {
  await waitReady
  await new Promise((r) => setTimeout(r, 800))
  browser = await chromium.launch({ headless: true })
  console.log(`\nHarvest daily-cap UX — quota fully spent (240/240), creatures still earning [${TAG}]\n`)

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(freezeClockScript(HEAD_SEC * 1000))
  await installRoutes(page)

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  await page.waitForFunction(() => /🌾/.test(document.body.innerText), { timeout: 15000 })
  await page.waitForTimeout(1500)

  await page.screenshot({ path: join(outDir, `harvest-cap-${TAG}.png`), fullPage: true })
  const text = (await page.innerText('body')).replace(/\s+/g, ' ').trim()

  if (TAG === 'before') {
    console.log(`  ·· old UI captured → harvest-cap-before.png`)
    console.log(`  ·· shows: ${/🌾 0 EGG/.test(text) ? '"🌾 0 EGG"' : '(no 0-EGG headline)'}` +
      `${/daily cap reached/.test(text) ? ' + "daily cap reached"' : ''}`)
    await ctx.close()
  } else if (TAG === 'cooldown') {
    // Both gates live at once: they must read as two SEPARATE countdowns, so a
    // player can tell "quota spent" apart from "wait out the 1h cooldown".
    if (new RegExp(`Daily cap reached — resets in ~${EXPECT_RESET}`).test(text))
      ok(`cap state still explains the quota: "resets in ~${EXPECT_RESET}"`)
    else bad(`cap-reached countdown missing (expected ~${EXPECT_RESET})`)

    if (new RegExp(`Harvest cooldown — next harvest in ${EXPECT_CD}`).test(text))
      ok(`separate cooldown countdown: "Harvest cooldown — next harvest in ${EXPECT_CD}" (last_harvest+3600)`)
    else bad(`cooldown countdown missing (expected ${EXPECT_CD}) — body: ${text.slice(0, 260)}`)

    if (/240 \/ 240 EGG harvested today/.test(text)) ok('progress bar still reads the real chain numbers')
    else bad('progress line missing in the cooldown state')

    if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
    else ok('no JS pageerror')

    await ctx.close()
    console.log(
      failures === 0
        ? '\n═══ COOLDOWN + CAP PASS — the two gates read as separate countdowns. ═══\n'
        : `\n═══ ${failures} CHECK(S) FAILED ═══\n`,
    )
  } else {
    // 1 — progress bar reads the real chain numbers against the effective ceiling.
    if (/240 \/ 240 EGG harvested today/.test(text))
      ok('progress reads "240 / 240 EGG harvested today" (chain: egg_harvested_today / daily_egg_cap)')
    else bad(`progress line missing — body: ${text.slice(0, 260)}`)

    const bar = await page.evaluate(() => {
      const el = document.querySelector('[role="progressbar"]')
      if (!el) return null
      const fill = el.firstElementChild
      return { now: el.getAttribute('aria-valuenow'), max: el.getAttribute('aria-valuemax'),
        width: fill ? fill.style.width : null }
    })
    if (bar && bar.now === '240' && bar.max === '240' && bar.width === '100%')
      ok(`progress bar is a real gauge at 100% (aria-valuenow=240 / aria-valuemax=240)`)
    else bad(`progress bar wrong — got ${JSON.stringify(bar)}`)

    // 2 — friendly cap state with the UTC-midnight countdown, not a bare 0.
    if (new RegExp(`Daily cap reached — resets in ~${EXPECT_RESET}`).test(text))
      ok(`friendly cap state: "Daily cap reached — resets in ~${EXPECT_RESET}" (UTC-midnight countdown)`)
    else bad(`cap-reached countdown missing (expected ~${EXPECT_RESET})`)

    if (!/🌾 0 EGG/.test(text)) ok('the bare "🌾 0 EGG" headline is GONE (now "🌾 Cap reached")')
    else bad('still showing the confusing "🌾 0 EGG" headline')

    // 3 — "earning" is explained as real accrual, not a bug.
    if (/Nothing is broken/.test(text) && /keeps building up EGG|keep building up EGG/.test(text))
      ok('explains earning: "Nothing is broken … creatures keep building up EGG in the meantime"')
    else bad('earning explainer missing')

    // 4 — cooldown is a SEPARATE line; clear here (last_harvest+3600 < now).
    if (!/Harvest cooldown/.test(text))
      ok('no harvest-cooldown line — cooldown is clear, so only the cap gates (states stay separate)')
    else bad('cooldown line shown while the cooldown is actually clear')

    // English-only (global rule): no Thai anywhere in the panel.
    if (!/[฀-๿]/.test(text)) ok('English-only — no Thai characters in the panel')
    else bad('Thai characters found in the UI')

    if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
    else ok('no JS pageerror')

    await ctx.close()
    console.log(
      failures === 0
        ? '\n═══ HARVEST CAP UX PASS — a spent quota reads as "goal hit + countdown", not a broken 0. ═══\n'
        : `\n═══ ${failures} CHECK(S) FAILED ═══\n`,
    )
  }
} catch (e) {
  console.error(e)
  failures++
} finally {
  if (browser) await browser.close()
  if (server) server.kill()
}
process.exit(failures ? 1 : 0)
