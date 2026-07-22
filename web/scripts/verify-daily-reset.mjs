/**
 * verify-daily-reset.mjs — TRUE end-to-end render of the daily-reset mirror.
 *
 * Proves the web mirror of the contract's reset_daily_if_new_day (chain.ts
 * effectiveDailyCounters → play.ts toResources → App HUD) by loading the REAL
 * built app in a headless browser and reading the rendered DOM — no math is
 * recomputed here. All chain + waxwing traffic is route-mocked so we can feed a
 * player row whose day fields sit in the past (a real chain can't be rewound),
 * and freeze the browser clock to prove the reset follows CHAIN HEAD TIME, not
 * the device clock a player controls.
 *
 * Three cases:
 *   (a) today, honest clock       → raw counters PRESERVED (no regress)
 *   (b) new UTC day (rollover)    → counters RESET (energy full, quota fresh)
 *   (c) device clock pushed +1d   → head time still today ⇒ NO reset (anti-cheat)
 *
 * Requires vite; the script starts + stops its own dev server.
 *   node scripts/verify-daily-reset.mjs
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

const PORT = 5178
// vite.config sets base=/plugin/pocket-hatchery/static/ — it applies in dev too.
const URL = `http://127.0.0.1:${PORT}/plugin/pocket-hatchery/static/`
const DAY_SEC = 86400

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

// A day index → a head_block_time at noon UTC (floor(sec/DAY_SEC) === day).
const headTimeFor = (day) => {
  const sec = day * DAY_SEC + 43200
  return { sec, iso: new Date(sec * 1000).toISOString().replace('Z', '') }
}

// Live-derived fixtures (WAX testnet phgamecreatr, pulled 2026-07-15).
const CONFIG = {
  token_contract: 'hatchtokens1', collection: 'phgamecreatr', schema_name: 'creatures',
  fee_account: 'phgamecreatr', paused: 0, hatch_cost: 150, evolve_cost: 300,
  breed_cost: '5.0000 HATCH', feed_cost: 0, slot_cost: 500, cosmetic_cost: 100,
  name_cost: '1.0000 HATCH', install_cap_bonus: 72, feed_cd: 21600, harvest_cd: 3600,
  breed_cd: 86400, feed_daily_cap: 3, daily_egg_cap: 240, offline_cap_h: 8,
  tap_egg_cap: 60, feed_boost: 100, season_index: 4, season_started: 1784060782,
  rng_oracle: 'phgamecreatr', rarity_w_common: 6900, rarity_w_uncommon: 2000,
  rarity_w_rare: 800, rarity_w_epic: 250, rarity_w_legendary: 45, rarity_w_mythic: 5,
  fed_dur_common: 172800, earn_mult_common: 10000, cap_scales_rarity: 1,
  awaken_dur_common: 3600, wax_contract: 'eosio.token',
}

// One crafted, awake, recently-fed common at stage 2 → earnFull = yield_1 (100).
// Low yield on purpose so its windowed gross (~98) sits UNDER the 240 daily cap:
// that makes "capped" flip between case (a) (quota spent) and case (b) (quota reset).
const SPECIES = {
  template_id: 900001, growth_rate: 1000, thresh_1: 1000, thresh_2: 5000,
  thresh_3: 20000, thresh_4: 100000, yield_0: 50, yield_1: 100, yield_2: 200,
  yield_3: 400, yield_4: 800, max_stage: 5, egg_weight: 100, egg_type: 0, family: 'Fire',
}
const creatureFor = (headSec) => ({
  asset_id: '1099600000001', owner: 'waxwingsuper', template_id: 900001, stage: 2,
  growth_base: 6000, fed_growth: 0, born_at: headSec - 200000, last_sync: headSec - 5400,
  last_fed: headSec - 5400, last_bred: 0,
  genetics: '25b649a90f8201a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf3b9',
})

// Player row: raw counters ALWAYS spent (feeds_today=2, egg_harvested_today=432).
// Only the day fields change per case; the mirror decides whether they reset.
const playerFor = (headSec, day) => ({
  account: 'waxwingsuper', created_at: headSec - 500000, egg_balance: 86246,
  last_harvest: headSec - 100000, harvest_day: day, egg_harvested_today: 432,
  feeds_today: 2, feed_day: day, total_egg_farmed: 101440, total_hatch_burned: 140101,
})

const WAXWING_STATUS = {
  network: { id: 'wax-testnet', kind: 'testnet', name: 'WAX Testnet' },
  networks: [], accounts: [{ account: 'waxwingsuper', permission: 'active',
    publicKey: 'EOS5fake', selected: true }],
  selected: 'waxwingsuper', unlocked: true, unlockedKeys: 1, hasPassword: true,
}
const WAXWING_ACCOUNT = { account_name: 'waxwingsuper', core_liquid_balance: '10.0000 WAX',
  cpu_limit: { used: 1, available: 1000, max: 1001 },
  net_limit: { used: 1, available: 1000, max: 1001 },
  ram_usage: 3000, ram_quota: 8000 }

// Route-mock every chain + waxwing call so the render is fully controlled.
async function installRoutes(page, headIso, player, creature) {
  await page.route('**/v1/chain/get_info', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      head_block_time: headIso, head_block_num: 1, chain_id: 'f16b', server_version: '0',
    }) }))
  await page.route('**/v1/chain/get_table_rows', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const rowsByTable = {
      configv3: [CONFIG], players: [player], creatrsv2: [creature],
      spccfgv2: [SPECIES], rewardpool: [], claims: [],
    }
    const rows = rowsByTable[body.table] ?? []
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rows, more: false, next_key: '' }) })
  })
  await page.route('**/v1/chain/get_currency_balance', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(['86246 HATCH']) }))
  await page.route('**/office/plugin/wax-wallet/cmd', async (route) => {
    const { cmd } = JSON.parse(route.request().postData() || '{}')
    const reply = {
      status: { status: WAXWING_STATUS }, account: { account: WAXWING_ACCOUNT },
      setnetwork: { ok: true }, balance: { balance: [] },
    }[cmd] ?? {}
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

// Freeze the browser clock so App.tsx's Date.now()-based harvest window + cooldowns
// are deterministic AND so we can drive the clock independently of chain head time.
const freezeClockScript = (ms) => `(() => {
  const OD = Date; const F = ${ms};
  class FD extends OD { constructor(...a){ a.length ? super(...a) : super(F); } static now(){ return F; } }
  globalThis.Date = FD;
})()`

// Read the rendered feeds chip "⚡ Feeds Left <n>/<max>" from the real DOM.
// (Labelled "Energy" before the feed-quota pass — the value is the same on-chain
// number: feed_daily_cap − feeds_today.)
const readEnergy = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="chip-feeds"]')
  const m = el?.textContent?.trim().match(/(\d+)\s*\/\s*(\d+)/)
  return m ? { energy: Number(m[1]), max: Number(m[2]) } : null
})
const bodyText = (page) => page.evaluate(() => document.body.innerText)

async function runCase(browser, { name, headDay, clockDay, expect }) {
  const head = headTimeFor(headDay)
  const clockMs = (clockDay * DAY_SEC + 43200) * 1000
  // Raw counters are spent; only the day fields (harvest_day/feed_day) vary per case.
  const player = playerFor(head.sec, expect.playerDay)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[console.${m.type()}] ${m.text()}`) })
  await page.addInitScript(freezeClockScript(clockMs))
  await installRoutes(page, head.iso, player, creatureFor(head.sec))

  console.log(`\n── Case ${name} ──`)
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  // Connected dashboard shows Disconnect immediately; wait for the FIRST refresh()
  // to resolve the live read — the creature roster ("N collected") appears then.
  try {
    await page.waitForFunction(() => /🌾/.test(document.body.innerText), { timeout: 15000 })
  } catch (e) {
    console.log('  DEBUG body:', (await bodyText(page)).replace(/\n+/g, ' | ').slice(0, 700))
    console.log('  DEBUG errs:', errs.slice(0, 6).join(' :: ').slice(0, 500))
    throw e
  }
  await page.waitForTimeout(1500) // let refresh() resolve the live read
  await page.screenshot({ path: join(outDir, `daily-reset-${name}.png`), fullPage: true })

  if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
  else ok('no JS pageerror')

  const en = await readEnergy(page)
  if (en && en.energy === expect.energy && en.max === expect.max)
    ok(`Energy chip = ${en.energy}/${en.max} (expected ${expect.energy}/${expect.max})`)
  else bad(`Energy chip = ${en ? `${en.energy}/${en.max}` : 'not found'} — expected ${expect.energy}/${expect.max}`)

  if (expect.capped !== undefined) {
    // The Daily Harvest quota lives under the Creatures tab; the farm is the
    // landing view, so click through before reading its copy.
    await page.getByRole('button', { name: /Creatures/i }).first().click()
    await page.waitForTimeout(600)
    const t = await bodyText(page)
    // Case-insensitive: the harvest-cap-UX pass rewrote this line to
    // "✅ Daily cap reached — resets in ~…", which a case-sensitive grep misses.
    const capped = /daily cap reached/i.test(t)
    if (capped === expect.capped)
      ok(`harvest "daily cap reached" ${capped ? 'shown' : 'absent'} (expected ${expect.capped ? 'shown' : 'absent'})`)
    else bad(`harvest capped=${capped} — expected ${expect.capped}`)
  }
  await ctx.close()
}

// ── main ──
const viteBin = join(webDir, 'node_modules', 'vite', 'bin', 'vite.js')
const server = spawn(process.execPath, [viteBin, '--port', String(PORT), '--strictPort'],
  { cwd: webDir, stdio: ['ignore', 'pipe', 'pipe'] })
const waitReady = new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start in 30s')), 30000)
  server.stdout.on('data', (d) => { if (/http:\/\/localhost:/.test(String(d))) { clearTimeout(t); res() } })
  server.stderr.on('data', (d) => process.stderr.write(d))
})

let browser
try {
  await waitReady
  await new Promise((r) => setTimeout(r, 800))
  browser = await chromium.launch({ headless: true })
  console.log('\nDaily-reset mirror — real render, 3 cases (chain head time authoritative)\n')

  // (a) chain today, honest clock, player last acted today → PRESERVE.
  await runCase(browser, { name: 'a-today', headDay: 20649, clockDay: 20649,
    expect: { playerDay: 20649, energy: 1, max: 3, capped: true } })
  // (b) chain rolled to a new day, player last acted yesterday → RESET.
  await runCase(browser, { name: 'b-newday', headDay: 20650, clockDay: 20650,
    expect: { playerDay: 20649, energy: 3, max: 3, capped: false } })
  // (c) device clock pushed +1 day but chain head still today → NO reset (anti-cheat).
  await runCase(browser, { name: 'c-clockcheat', headDay: 20649, clockDay: 20650,
    expect: { playerDay: 20649, energy: 1, max: 3, capped: true } })
} catch (e) {
  bad(`harness error: ${e.message}`)
} finally {
  if (browser) await browser.close()
  server.kill()
  // ensure the port is freed even if kill lagged
  setTimeout(() => { try { server.kill('SIGKILL') } catch {} }, 500)
}

console.log(failures === 0
  ? '\n═══ DAILY-RESET PASS — mirror re-renders correctly; head time is authoritative. ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
