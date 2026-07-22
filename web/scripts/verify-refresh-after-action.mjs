/**
 * verify-refresh-after-action.mjs — proves the post-action auto-refresh fix.
 *
 * THE BUG (CEO, 2026-07-16): after a wake tx succeeds on-chain, the panel stayed
 * frozen on the old state (creature still shown "😴 Sleeping", cooldown wrong) —
 * it looked like the wake never happened. Root cause: play.ts run() did ONE
 * refresh() right after broadcast, which hit an RPC read node still a block or two
 * behind → it read the PRE-action rows (stage 0) → HUD stuck. The 20s background
 * poll only caught up much later.
 *
 * THE FIX: play.ts now polls (refreshUntilChanged) a few spaced refreshes after a
 * successful action until the on-chain signature actually changes from the
 * pre-action snapshot — so the panel updates ITSELF the moment the node catches up,
 * with no manual reload.
 *
 * THIS TEST reproduces the exact failure condition in a real headless render: the
 * creatrsv2 mock returns the STALE stage-0 creature for the first N reads AFTER the
 * wake is signed (simulated RPC lag), then flips to stage 1. If the app only did a
 * single refresh it would freeze on "Sleeping"; because it polls, the card flips to
 * "🐣 Baby" on its own. We assert the flip happens WITHOUT any page.reload().
 *
 *   node scripts/verify-refresh-after-action.mjs
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

const PORT = 5179
const URL = `http://127.0.0.1:${PORT}/plugin/pocket-hatchery/static/`

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

// Head time = fixed "now"; the creature sleeps (born recently, inside awaken window).
const HEAD_SEC = 20649 * 86400 + 43200 // noon on day 20649
const HEAD_ISO = new Date(HEAD_SEC * 1000).toISOString().replace('Z', '')

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
const PLAYER = {
  account: 'waxwingsuper', created_at: HEAD_SEC - 500000, egg_balance: 86246,
  last_harvest: HEAD_SEC - 100000, harvest_day: 20649, egg_harvested_today: 0,
  feeds_today: 0, feed_day: 20649, total_egg_farmed: 101440, total_hatch_burned: 140101,
  last_claimed: 0, claimed_season: 0,
}
const GENE = '25b649a90f8201a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf3b9'
// Stage 0 = sleeping (born 100s ago → well inside the 3600s awaken window → Wake allowed).
const CREATURE_ASLEEP = {
  asset_id: '1099600000001', owner: 'waxwingsuper', template_id: 900001, stage: 0,
  growth_base: 0, fed_growth: 0, born_at: HEAD_SEC - 100, last_sync: HEAD_SEC - 100,
  last_fed: 0, last_bred: 0, genetics: GENE,
}
// Same creature, awoken by the contract (stage 0 → 1). This is what a caught-up node returns.
const CREATURE_AWAKE = { ...CREATURE_ASLEEP, stage: 1 }

const WAXWING_STATUS = {
  network: { id: 'wax-testnet', kind: 'testnet', name: 'WAX Testnet' },
  networks: [], accounts: [{ account: 'waxwingsuper', permission: 'active',
    publicKey: 'EOS5fake', selected: true }],
  selected: 'waxwingsuper', unlocked: true, unlockedKeys: 1, hasPassword: true,
  pendingIntents: [],
  // The wake intent resolves instantly (simulates the player signing in waxwing).
  intentResults: [{ id: 'wakeintent1', at: HEAD_SEC, ok: true, txid: 'deadbeefcafe0001', action: 'transfer', label: 'Wake' }],
}
const WAXWING_ACCOUNT = { account_name: 'waxwingsuper', core_liquid_balance: '10.0000 WAX',
  cpu_limit: { used: 1, available: 1000, max: 1001 },
  net_limit: { used: 1, available: 1000, max: 1001 }, ram_usage: 3000, ram_quota: 8000 }

// Freeze the browser clock to HEAD_SEC so the awaken-window guard is deterministic.
const freezeClockScript = (ms) => `(() => {
  const OD = Date; const F = ${ms};
  class FD extends OD { constructor(...a){ a.length ? super(...a) : super(F); } static now(){ return F; } }
  globalThis.Date = FD;
})()`

// Simulated RPC lag: after the wake is signed, the read node stays behind for
// LAG_READS creatrsv2 reads (returns stale stage 0), then serves the awoken row.
const LAG_READS = 2

async function installRoutes(page, state) {
  await page.route('**/v1/chain/get_info', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      head_block_time: HEAD_ISO, head_block_num: 1, chain_id: 'f16b', server_version: '0' }) }))

  await page.route('**/v1/chain/get_table_rows', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    let creature = CREATURE_ASLEEP
    if (body.table === 'creatrsv2') {
      if (state.waked) {
        state.postWakeReads++
        creature = state.postWakeReads > LAG_READS ? CREATURE_AWAKE : CREATURE_ASLEEP
      }
    }
    const rowsByTable = {
      configv3: [CONFIG], players: [PLAYER], creatrsv2: [creature],
      spccfgv2: [SPECIES], rewardpool: [], claims: [],
    }
    route.fulfill({ contentType: 'application/json',
      body: JSON.stringify({ rows: rowsByTable[body.table] ?? [], more: false, next_key: '' }) })
  })

  await page.route('**/v1/chain/get_currency_balance', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(['86246 HATCH']) }))

  // Opening the waxwing panel POSTs a window.open event — swallow it.
  await page.route('**/office/event', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))

  await page.route('**/office/plugin/wax-wallet/cmd', async (route) => {
    const { cmd } = JSON.parse(route.request().postData() || '{}')
    if (cmd === 'buildaction') {
      // The wake action was "signed" — mark the chain as advancing (with lag).
      state.waked = true
      state.postWakeReads = 0
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        confirmRequired: true,
        intent: { id: 'wakeintent1', kind: 'action', action: 'transfer', contract: 'eosio.token',
          data: {}, label: 'Wake', owner: 'waxwingsuper', network: 'WAX Testnet',
          networkId: 'wax-testnet', chainKind: 'testnet', expiresAt: HEAD_SEC + 300 } }) })
    }
    const reply = {
      status: { status: WAXWING_STATUS }, account: { account: WAXWING_ACCOUNT },
      setnetwork: { ok: true }, balance: { balance: [] },
    }[cmd] ?? {}
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

const cardState = (page) => page.evaluate(() => {
  const card = document.querySelector('article[data-asleep]')
  if (!card) return null
  return { asleep: card.getAttribute('data-asleep'), text: card.innerText.replace(/\s+/g, ' ').trim() }
})

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
  console.log('\nPost-action auto-refresh — wake a sleeping egg, RPC read node lags, panel must self-refresh\n')

  const state = { waked: false, postWakeReads: 0 }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(freezeClockScript(HEAD_SEC * 1000))
  await installRoutes(page, state)

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  await page.waitForFunction(() => /🌾/.test(document.body.innerText), { timeout: 15000 })
  await page.waitForTimeout(1200) // let the first refresh resolve
  // The panel opens on the Farm tab — the creature cards live under Creatures.
  await page.getByRole('button', { name: /Creatures/i }).first().click()
  await page.waitForSelector('article[data-asleep]', { timeout: 10000 })

  // ── BEFORE: creature is asleep (stage 0) ──
  const before = await cardState(page)
  await page.screenshot({ path: join(outDir, 'refresh-before-wake.png'), fullPage: true })
  if (before && before.asleep === '1' && /Sleeping|Egg/i.test(before.text))
    ok(`before: card is ASLEEP (data-asleep=1, "😴 Sleeping / 🥚 Egg")`)
  else bad(`before: expected asleep card — got ${JSON.stringify(before)}`)

  const wakeBtn = page.getByRole('button', { name: /Wake now/i })
  if (await wakeBtn.count()) ok('Wake button present on the sleeping card')
  else bad('Wake button NOT found on the sleeping card')

  // ── ACT: tap Wake (signs instantly via mocked waxwing) ──
  await wakeBtn.first().click()

  // Immediately after broadcast the node is still stale (stage 0). A single refresh
  // would freeze here. Confirm the app does NOT reload — it must poll on its own.
  await page.waitForTimeout(600)
  const midway = await cardState(page)
  if (midway && midway.asleep === '1')
    ok('midway (~0.6s): still ASLEEP as the read node lags — a single refresh would be stuck here')
  else console.log(`  ·· midway state: ${JSON.stringify(midway)} (node may have already caught up)`)

  // ── AFTER: the poll should catch the awoken row and flip the card, no reload ──
  await page.waitForFunction(
    () => document.querySelector('article[data-asleep]')?.getAttribute('data-asleep') === '0',
    { timeout: 15000 },
  ).catch(() => {})
  await page.waitForTimeout(400)
  const after = await cardState(page)
  await page.screenshot({ path: join(outDir, 'refresh-after-wake.png'), fullPage: true })

  if (after && after.asleep === '0' && /Baby/i.test(after.text))
    ok(`after: card SELF-REFRESHED to AWAKE (data-asleep=0, "🐣 Baby") — no manual reload`)
  else bad(`after: card did not flip to awake — got ${JSON.stringify(after)}`)

  if (state.postWakeReads > 1)
    ok(`polled ${state.postWakeReads} creatrsv2 reads after wake (proves multi-poll, not a single stale read)`)
  else bad(`only ${state.postWakeReads} post-wake read(s) — poll loop did not engage`)

  if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
  else ok('no JS pageerror')

  await ctx.close()
} catch (e) {
  bad(`harness error: ${e.message}`)
} finally {
  if (browser) await browser.close()
  server.kill()
  setTimeout(() => { try { server.kill('SIGKILL') } catch {} }, 500)
}

console.log(failures === 0
  ? '\n═══ AUTO-REFRESH PASS — panel re-fetches after the action and updates itself despite RPC lag. ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
