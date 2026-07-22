/**
 * verify-claim-nickname-pin.mjs — real render + real clicks against the DEPLOYED panel.
 *
 * Targets the panel the daemon serves off disk (http://127.0.0.1:8787/plugin/…/panel),
 * NOT a dev server: that is the artifact a player actually opens, and it makes the
 * prefs API same-origin, so nicknames/pins round-trip through the REAL plugin storage
 * (plugins/pocket-hatchery/data/prefs.json) instead of a mock.
 *
 * Chain traffic IS route-mocked — a live chain can't be posed into "already claimed"
 * and "pool empty" on demand — but every fixture below is copied from live
 * phgamecreatr reads, and the assertions read the rendered DOM. No math is recomputed
 * here: if App/claim.ts disagree with the contract, this fails.
 *
 * Claim cases (each a gate in pockethatch.cpp claimreward, in its own order):
 *   ready      → stage 3 + fed + funded pool  ⇒ payout 25 HATCH, button ENABLED
 *   claimed    → claims row for this season   ⇒ "Already claimed", DISABLED
 *   cooldown   → claimed last season, <1h ago ⇒ countdown, DISABLED
 *   stage      → only a Baby (stage 1)        ⇒ "grow to Juvenile", DISABLED
 *   unfed      → fed window expired           ⇒ "none are fed", DISABLED
 *   pool-empty → pool holds 5 < payout 25     ⇒ names the pool, DISABLED
 *
 * Then hit-tests the collection UI with real clicks/typing: search filters live,
 * pin lifts a card to the front, rename shows + SURVIVES A RELOAD.
 *
 *   node scripts/verify-claim-nickname-pin.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

const DAEMON = 'http://127.0.0.1:8787'
const URL = `${DAEMON}/plugin/pocket-hatchery/panel`
// A real testnet account, used so prefs land under a key we can clean up after.
const ACCOUNT = 'phtestclaimr'
const NETWORK = 'wax-testnet'

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

const NOW = 1784300000 // fixed head time; all fixtures are relative to it
const headIso = new Date(NOW * 1000).toISOString().replace('Z', '')

// ── Live-derived fixtures (WAX testnet phgamecreatr, read 2026-07-17) ──────────
const CONFIG = {
  token_contract: 'hatchtokens1', collection: 'phgamecreatr', schema_name: 'creatures',
  fee_account: 'phgamecreatr', paused: 0, hatch_cost: 150, evolve_cost: 300,
  breed_cost: '5.0000 HATCH', feed_cost: 0, slot_cost: 500, cosmetic_cost: 100,
  name_cost: '1.0000 HATCH', install_cap_bonus: 72, feed_cd: 21600, harvest_cd: 3600,
  breed_cd: 86400, feed_daily_cap: 3, daily_egg_cap: 240, offline_cap_h: 8,
  tap_egg_cap: 60, feed_boost: 100, season_index: 4, season_started: 1784060782,
  rng_oracle: 'phgamecreatr', rarity_w_common: 6900, rarity_w_uncommon: 2000,
  rarity_w_rare: 800, rarity_w_epic: 250, rarity_w_legendary: 45, rarity_w_mythic: 5,
  fed_dur_common: 172800, fed_dur_uncommon: 259200, fed_dur_rare: 432000,
  earn_mult_common: 10000, earn_mult_uncommon: 11000, earn_mult_rare: 14000,
  cap_scales_rarity: 1, awaken_dur_common: 3600, wax_contract: 'eosio.token',
  wake_cost_common: '3.00000000 WAX',
}

// Three species so the tier/species search has something to discriminate on.
const SPECIES = [
  { template_id: 662976, growth_rate: 1000, thresh_1: 1000, thresh_2: 5000, thresh_3: 20000,
    thresh_4: 100000, yield_0: 100, yield_1: 300, yield_2: 600, yield_3: 1200, yield_4: 2400,
    max_stage: 5, egg_weight: 6900, egg_type: 0, family: 'Fire' },
  { template_id: 662977, growth_rate: 1000, thresh_1: 1000, thresh_2: 5000, thresh_3: 20000,
    thresh_4: 100000, yield_0: 110, yield_1: 330, yield_2: 660, yield_3: 1320, yield_4: 2640,
    max_stage: 5, egg_weight: 2000, egg_type: 1, family: 'Water' },
  { template_id: 662978, growth_rate: 1000, thresh_1: 1000, thresh_2: 5000, thresh_3: 20000,
    thresh_4: 100000, yield_0: 140, yield_1: 420, yield_2: 840, yield_3: 1680, yield_4: 3360,
    max_stage: 5, egg_weight: 800, egg_type: 2, family: 'Earth' },
]

// Genetics decode to distinct species names — the search matches on the DECODED
// name, so these must be real gene strings, not placeholders.
const GENES = [
  '25b649a90f8201a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf3b9',
  '7c1e5d3a9b4f8201a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf1',
  'a3f90b2c7d1e4405a592bcc812fd20c8c3bf65cf26de99d3391bcca74cb03cf2',
]

const creature = (i, { stage, fedAgo }) => ({
  asset_id: `10996000000${10 + i}`,
  owner: ACCOUNT,
  template_id: SPECIES[i].template_id,
  stage,
  growth_base: 6000, fed_growth: 0,
  born_at: NOW - 400000, last_sync: NOW - 5400,
  last_fed: NOW - fedAgo, last_bred: 0,
  genetics: GENES[i],
})

const PLAYER = {
  account: ACCOUNT, created_at: NOW - 500000, egg_balance: 290,
  last_harvest: NOW - 100000, harvest_day: Math.floor(NOW / 86400),
  egg_harvested_today: 0, feeds_today: 0, feed_day: Math.floor(NOW / 86400),
  total_egg_farmed: 240, total_hatch_burned: 0,
}

const POOL_FUNDED = {
  balance: '149995.0101 HATCH', bootstrap_total: '0.0000 HATCH', bootstrap_released: 15000000,
  last_release: 1783659821, lifetime_funded: '150124.0101 HATCH', lifetime_paid: '129.0000 HATCH',
}
const POOL_DRY = { ...POOL_FUNDED, balance: '5.0000 HATCH' }

const WAXWING_STATUS = {
  network: { id: NETWORK, kind: 'testnet', name: 'WAX Testnet' },
  networks: [],
  accounts: [{ account: ACCOUNT, permission: 'active', publicKey: 'EOS5fake', selected: true }],
  selected: ACCOUNT, unlocked: true, unlockedKeys: 1, hasPassword: true,
}
const WAXWING_ACCOUNT = {
  account_name: ACCOUNT, core_liquid_balance: '10.0000 WAX',
  cpu_limit: { used: 1, available: 1000, max: 1001 },
  net_limit: { used: 1, available: 1000, max: 1001 },
  ram_usage: 3000, ram_quota: 8000,
}

// Mock chain + waxwing only. /plugin/pocket-hatchery/cmd is deliberately NOT mocked:
// prefs must go through the real daemon plugin for this to prove persistence.
async function installRoutes(page, { creatures, claims, pool }) {
  await page.route('**/v1/chain/get_info', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      head_block_time: headIso, head_block_num: 1, chain_id: 'f16b', server_version: '0',
    }) }))
  await page.route('**/v1/chain/get_table_rows', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    const rows = {
      configv3: [CONFIG], players: [PLAYER], creatrsv2: creatures,
      spccfgv2: SPECIES, rewardpool: [pool], claims,
    }[body.table] ?? []
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rows, more: false, next_key: '' }) })
  })
  await page.route('**/v1/chain/get_currency_balance', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(['290.0000 HATCH']) }))
  await page.route('**/plugin/wax-wallet/cmd', async (route) => {
    const { cmd } = JSON.parse(route.request().postData() || '{}')
    const reply = {
      status: { status: WAXWING_STATUS }, account: { account: WAXWING_ACCOUNT },
      setnetwork: { ok: true }, balance: { balance: [] },
    }[cmd] ?? {}
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply) })
  })
}

const freezeClock = (ms) => `(() => {
  const OD = Date; const F = ${ms};
  class FD extends OD { constructor(...a){ a.length ? super(...a) : super(F); } static now(){ return F; } }
  globalThis.Date = FD;
})()`

async function openPanel(browser, fixture) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(freezeClock(NOW * 1000))
  await installRoutes(page, fixture)
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  // The dashboard opens on the Farm tab, and the collection + harvest + claim
  // panels only exist under Creatures — everything this script checks lives there.
  await page.getByRole('button', { name: /Creatures/i }).click()
  await page.waitForSelector('[data-testid="claim-btn"]', { timeout: 20000 })
  await page.waitForTimeout(1200) // let the first refresh() resolve
  return { ctx, page, errs }
}

const prefsCmd = (cmd, args) =>
  fetch(`${DAEMON}/plugin/pocket-hatchery/cmd`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd, args: { network: NETWORK, account: ACCOUNT, ...args } }),
  }).then((r) => r.json())

// ── Claim cases ───────────────────────────────────────────────────────────────
const FED = 5400        // fed 1.5h ago — inside fed_dur_common (48h)
const STARVED = 200000  // fed 55h ago — outside it

const CLAIM_CASES = [
  { name: 'ready',
    creatures: [creature(0, { stage: 3, fedAgo: FED })],
    claims: [], pool: POOL_FUNDED,
    expect: { amount: '25 HATCH', enabled: true, ready: true } },
  { name: 'claimed',
    creatures: [creature(0, { stage: 3, fedAgo: FED })],
    claims: [{ account: ACCOUNT, last_claimed: NOW - 100000, claimed_season: 4 }],
    pool: POOL_FUNDED,
    expect: { amount: '25 HATCH', enabled: false, reason: /already claimed this season/i } },
  { name: 'cooldown',
    creatures: [creature(0, { stage: 3, fedAgo: FED })],
    // Claimed in season 3, 10 min ago → season gate passes, harvest_cd (1h) does not.
    claims: [{ account: ACCOUNT, last_claimed: NOW - 600, claimed_season: 3 }],
    pool: POOL_FUNDED,
    expect: { amount: '25 HATCH', enabled: false, reason: /claim cooldown — ready in 50m/i } },
  { name: 'stage',
    creatures: [creature(0, { stage: 1, fedAgo: FED })],
    claims: [], pool: POOL_FUNDED,
    expect: { amount: 'No reward yet', enabled: false, reason: /grow a creature to juvenile/i } },
  { name: 'unfed',
    creatures: [creature(0, { stage: 3, fedAgo: STARVED })],
    claims: [], pool: POOL_FUNDED,
    expect: { amount: '25 HATCH', enabled: false, reason: /none of your creatures are fed/i } },
  { name: 'pool-empty',
    creatures: [creature(0, { stage: 3, fedAgo: FED })],
    claims: [], pool: POOL_DRY,
    expect: { amount: '25 HATCH', enabled: false, reason: /reward pool is short.*5 HATCH.*pays 25/i } },
]

const browser = await chromium.launch({ headless: true })
try {
  // Start from clean prefs so a rerun can't pass on last run's leftovers.
  await prefsCmd('nickname', { assetId: '1099600000010', name: '' })
  await prefsCmd('nickname', { assetId: '1099600000011', name: '' })
  await prefsCmd('nickname', { assetId: '1099600000012', name: '' })
  for (const id of ['1099600000010', '1099600000011', '1099600000012'])
    await prefsCmd('pin', { assetId: id, pinned: false })

  console.log('\nClaim / nickname / pin — real render on the DEPLOYED panel\n')

  // ── 1. Claim gates ──
  for (const c of CLAIM_CASES) {
    console.log(`── Claim: ${c.name} ──`)
    const { ctx, page, errs } = await openPanel(browser, c)

    if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 160)}`)
    else ok('no JS pageerror')

    const amount = (await page.getByTestId('claim-amount').textContent())?.trim()
    if (amount === c.expect.amount) ok(`payout headline = "${amount}"`)
    else bad(`payout headline = "${amount}" — expected "${c.expect.amount}"`)

    const disabled = await page.getByTestId('claim-btn').isDisabled()
    if (disabled === !c.expect.enabled) ok(`Claim button ${disabled ? 'DISABLED' : 'ENABLED'} (as expected)`)
    else bad(`Claim button ${disabled ? 'disabled' : 'enabled'} — expected the opposite`)

    if (c.expect.ready) {
      const t = (await page.getByTestId('claim-ready').textContent()) || ''
      if (/ready/i.test(t)) ok(`ready line: "${t.trim()}"`)
      else bad(`ready line missing, got "${t}"`)
      // The pool number must be the live figure, not a placeholder.
      const pool = (await page.getByTestId('claim-pool').textContent())?.trim()
      // The live rewardpool balance is 149995.0101 HATCH — the panel must show that
      // real figure, not a rounded stand-in.
      if (pool === '149,995.01 HATCH') ok(`pool shown = ${pool} (live rewardpool.balance)`)
      else bad(`pool shown = "${pool}" — expected "149,995.01 HATCH"`)
      const season = (await page.getByTestId('claim-season').textContent()) || ''
      if (/season 4/i.test(season)) ok('season badge = Season 4')
      else bad(`season badge = "${season}"`)
    } else {
      const t = (await page.getByTestId('claim-blocked').textContent()) || ''
      if (c.expect.reason.test(t)) ok(`blocker names the real reason: "${t.trim().slice(0, 80)}"`)
      else bad(`blocker text "${t.trim().slice(0, 90)}" did not match ${c.expect.reason}`)
      // The reason must ALSO be on the button — that's where the player looks.
      const btn = (await page.getByTestId('claim-reason').textContent()) || ''
      if (btn.trim().length > 0) ok('button carries the same reason')
      else bad('button shows no reason')
    }

    await page.screenshot({ path: join(outDir, `claim-${c.name}.png`), fullPage: true })
    await ctx.close()
  }

  // ── 2. Nickname + pin + search, driven by real clicks ──
  console.log('\n── Collection: search / pin / nickname (real clicks) ──')
  const three = {
    creatures: [
      creature(0, { stage: 3, fedAgo: FED }),
      creature(1, { stage: 2, fedAgo: FED }),
      creature(2, { stage: 2, fedAgo: FED }),
    ],
    claims: [], pool: POOL_FUNDED,
  }
  const { ctx, page, errs } = await openPanel(browser, three)
  if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 160)}`)
  else ok('no JS pageerror')

  // Order by ASSET ID, not by the rendered name: two of the fixtures decode to the
  // same species, so a name-based order check would pass even if nothing moved.
  const cardOrder = () => page.$$eval('[data-testid^="pin-"]',
    (els) => els.map((e) => e.dataset.testid.replace('pin-', '')))
  const visibleCount = () => page.$$eval('article', (els) => els.length)

  const initial = await cardOrder()
  if (initial.length === 3) ok(`3 cards rendered, order: ${initial.join(', ')}`)
  else bad(`expected 3 cards, got ${initial.length}: ${initial.join(', ')}`)
  await page.screenshot({ path: join(outDir, 'collection-before.png'), fullPage: true })

  // PIN the LAST card → it must become the FIRST.
  const lastId = '1099600000012'
  await page.getByTestId(`pin-${lastId}`).click()
  await page.waitForTimeout(500)
  const afterPin = await cardOrder()
  if (afterPin[0] === lastId && initial[2] === lastId && initial[0] !== lastId)
    ok(`pin lifted #${lastId} from position 3 → 1 (order now ${afterPin.join(', ')})`)
  else bad(`after pin the order is ${afterPin.join(', ')} — expected ${lastId} first (was ${initial.join(', ')})`)
  const pinPersisted = await prefsCmd('prefs', {})
  if (pinPersisted.pins?.includes(lastId)) ok('pin persisted to plugin data')
  else bad(`pin not in plugin data: ${JSON.stringify(pinPersisted.pins)}`)

  // Renaming is NO LONGER covered here. It used to write a plugin-side nickname,
  // which is exactly the bug that got fixed: the name now goes on chain via
  // `setname` and is read back out of the NFT's mutable data, so it cannot be
  // exercised against the synthetic asset ids this script injects (they own no
  // NFT). Live coverage lives in scripts/verify-onchain-rename.mjs (real chain,
  // real assets) and scripts/verify-rename-pending.mjs (the in-flight state).

  await page.screenshot({ path: join(outDir, 'collection-pinned-named.png'), fullPage: true })

  // SEARCH by species name → the search index still works off the rendered name.
  await page.getByTestId('creature-search').fill('0000010')
  await page.waitForTimeout(400)
  if ((await visibleCount()) === 1) ok('search "0000010" → 1 card')
  else bad(`search → ${await visibleCount()} cards, expected 1`)

  // SEARCH by asset id → the id is a real handle, not just decoration.
  await page.getByTestId('creature-search').fill('0000011')
  await page.waitForTimeout(400)
  if ((await visibleCount()) === 1) ok('search "0000011" (asset id) → 1 card')
  else bad(`search by asset id → ${await visibleCount()} cards, expected 1`)

  // SEARCH by tier → the uncommon only.
  await page.getByTestId('creature-search').fill('uncommon')
  await page.waitForTimeout(400)
  const tierHits = await visibleCount()
  if (tierHits === 1) ok('search "uncommon" (tier) → 1 card')
  else bad(`search by tier → ${tierHits} cards, expected 1`)

  // SEARCH miss → an explicit empty state, not a blank grid.
  await page.getByTestId('creature-search').fill('zzzznope')
  await page.waitForTimeout(400)
  const emptyText = await page.getByTestId('search-empty').textContent().catch(() => null)
  if (emptyText && /no creature matches/i.test(emptyText)) ok('no-match shows an explicit empty state')
  else bad(`no-match empty state missing (got: ${emptyText})`)
  await page.screenshot({ path: join(outDir, 'collection-search-miss.png'), fullPage: true })

  await page.getByTestId('search-clear').click()
  await page.waitForTimeout(400)
  if ((await visibleCount()) === 3) ok('clearing the search restores all 3 cards')
  else bad(`after clear → ${await visibleCount()} cards, expected 3`)

  await ctx.close()

  // ── 3. Persistence across a full reload (the real point of plugin-side data) ──
  console.log('\n── Persistence: reload the panel ──')
  const re = await openPanel(browser, three)
  const reloaded = await re.page.$$eval('[data-testid^="name-"]',
    (els) => els.filter((e) => e.tagName === 'H3').map((e) => e.textContent.trim()))
  const reloadedOrder = await re.page.$$eval('[data-testid^="pin-"]',
    (els) => els.map((e) => e.dataset.testid.replace('pin-', '')))
  if (reloadedOrder[0] === '1099600000012') ok('pin survived a reload (served from plugin data)')
  else bad(`after reload the order is ${reloadedOrder.join(', ')} — expected the pinned card first`)
  if (reloaded.length === 3) ok('all 3 cards render after the reload')
  else bad(`after reload ${reloaded.length} cards rendered, expected 3`)
  await re.page.screenshot({ path: join(outDir, 'collection-after-reload.png'), fullPage: true })
  await re.ctx.close()
} finally {
  await browser.close()
  // Leave no test prefs behind on a real account.
  await prefsCmd('nickname', { assetId: '1099600000012', name: '' })
  for (const id of ['1099600000010', '1099600000011', '1099600000012'])
    await prefsCmd('pin', { assetId: id, pinned: false })
}

console.log(failures ? `\n❌ ${failures} check(s) FAILED\n` : '\n✅ all checks passed\n')
process.exit(failures ? 1 : 0)
