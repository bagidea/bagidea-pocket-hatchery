/**
 * verify-action-gates.mjs — hit-test the DEPLOYED panel with REAL chain data.
 *
 * Loads the plugin panel the daemon actually serves
 * (http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html) in a headless browser
 * and reads the rendered DOM. Chain reads are NOT mocked — they hit the live WAX
 * testnet RPC, so every number on screen is officewax123's real on-chain state.
 * Only the waxwing wallet is stubbed, so the run can "connect" as officewax123
 * without unlocking a keystore (reads are unsigned; nothing is broadcast).
 *
 * What it proves (the CEO's two bugs):
 *   1. Feed  — the account-wide daily quota is on the card ("Feeds today 3/3" +
 *              reset countdown) and the Feed button is DISABLED, so no tap can
 *              reach "assertion failure with message: feed daily cap reached".
 *   2. Evolve — the button names the real blocker in EGG (the currency the
 *              contract charges: evolve_cost × (stage+1)), never "50 HATCH", and
 *              is disabled while unaffordable.
 *   3. English-only copy in the game's own UI.
 *
 * The expected numbers are derived from the live tables at run time (not baked),
 * so this stays honest when the chain state moves.
 *
 *   node scripts/verify-action-gates.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

const PANEL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const RPC = 'https://wax-testnet.eosphere.io'
const ACCOUNT = 'officewax123'
const DAY_SEC = 86400

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

const rpc = async (path, body) => {
  const res = await fetch(`${RPC}/v1/chain/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.json()
}
const rows = (table, extra = {}) =>
  rpc('get_table_rows', { json: true, code: 'phgamecreatr', scope: 'phgamecreatr', table, limit: 100, ...extra })
    .then((r) => r.rows)

// ── 1. Read the live truth we will assert the DOM against ────────────────────
const info = await fetch(`${RPC}/v1/chain/get_info`).then((r) => r.json())
const headSec = Math.floor(new Date(`${info.head_block_time}Z`).getTime() / 1000)
const cfg = (await rows('configv3', { limit: 1 }))[0]
const player = (await rows('players', { lower_bound: ACCOUNT, limit: 1 }))[0]
const species = await rows('spccfgv2')
const creatures = await rows('creatrsv2', {
  index_position: 2, key_type: 'i64', lower_bound: ACCOUNT, upper_bound: ACCOUNT,
})
const hatch = await fetch(`${RPC}/v1/chain/get_currency_balance`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: cfg.token_contract, account: ACCOUNT, symbol: 'HATCH' }),
}).then((r) => r.json())

if (player.account !== ACCOUNT) { bad(`players row is ${player.account}, not ${ACCOUNT}`); process.exit(1) }

const today = Math.floor(headSec / DAY_SEC)
// Mirror reset_daily_if_new_day: a stale feed_day means the chain would zero it.
const feedsToday = player.feed_day === today ? player.feeds_today : 0
const feedsLeft = Math.max(0, cfg.feed_daily_cap - feedsToday)
const eggBalance = player.egg_balance
const hatchWhole = Number(String(hatch[0] ?? '0').split(' ')[0])
const capReached = feedsToday >= cfg.feed_daily_cap

// The evolve gate for the FIRST creature the collection renders. play.ts sorts by
// pins then chain order, so any card is a valid probe — we assert per-asset-id.
const probe = creatures[0]
const sp = species.find((s) => s.template_id === probe.template_id)
const evolveCost = cfg.evolve_cost * (probe.stage + 1)
const growth = probe.growth_base + probe.fed_growth
const growthNeeded = [sp.thresh_1, sp.thresh_2, sp.thresh_3, sp.thresh_4, sp.thresh_5][probe.stage]
const FED_DUR = [cfg.fed_dur_common, cfg.fed_dur_uncommon, cfg.fed_dur_rare,
  cfg.fed_dur_epic, cfg.fed_dur_legendary, cfg.fed_dur_mythic][sp.egg_type]
const hungry = headSec >= probe.last_fed + FED_DUR

console.log(`\nLive chain truth — ${ACCOUNT} @ head ${info.head_block_time}`)
console.log(`  EGG ${eggBalance} · HATCH ${hatchWhole} · feeds_today ${feedsToday}/${cfg.feed_daily_cap} (day ${player.feed_day} vs ${today})`)
console.log(`  probe #${probe.asset_id} stage ${probe.stage} · evolve costs ${evolveCost} EGG (evolve_cost ${cfg.evolve_cost} × ${probe.stage + 1})`)
console.log(`  growth ${growth}/${growthNeeded} · hungry=${hungry}\n`)

// ── 2. Render the deployed panel against that same live chain ────────────────
const WAXWING_STATUS = {
  network: { id: 'wax-testnet', kind: 'testnet', name: 'WAX Testnet' },
  networks: [],
  accounts: [{ account: ACCOUNT, permission: 'active', publicKey: 'EOS5stub', selected: true }],
  selected: ACCOUNT, unlocked: true, unlockedKeys: 1, hasPassword: true,
}
const WAXWING_ACCOUNT = {
  account_name: ACCOUNT, core_liquid_balance: '10.0000 WAX',
  cpu_limit: { used: 1, available: 1000, max: 1001 },
  net_limit: { used: 1, available: 1000, max: 1001 },
  ram_usage: 3000, ram_quota: 8000,
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1320, height: 1100 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

// Stub ONLY the wallet — never a chain read. Any gameplay push is refused loudly
// so a bug in the panel can't broadcast a tx from a verify run.
await page.route('**/plugin/wax-wallet/cmd', async (route) => {
  const { cmd } = JSON.parse(route.request().postData() || '{}')
  if (['buildaction', 'pushaction', 'confirm'].includes(cmd)) {
    bad(`panel tried to broadcast (${cmd}) during a read-only verify`)
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"blocked by verify"}' })
  }
  const reply = {
    status: { status: WAXWING_STATUS }, account: { account: WAXWING_ACCOUNT },
    setnetwork: { ok: true }, balance: { balance: [] },
  }[cmd] ?? {}
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(reply) })
})

try {
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  // The farm is the landing view; the cards live behind the Creatures tab.
  await page.waitForFunction(() => /living here/.test(document.body.innerText), { timeout: 25000 })
  await page.waitForTimeout(2500) // let the first live read settle
  await page.getByRole('button', { name: /Creatures/i }).first().click()
  await page.waitForFunction(() => /collected/.test(document.body.innerText), { timeout: 15000 })
  await page.waitForTimeout(1500)

  if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
  else ok('no JS pageerror on the deployed panel')

  // ── Resource chips: EGG and $HATCH read as separate currencies ──
  const chip = async (id) => (await page.locator(`[data-testid="${id}"]`).first().textContent() || '').trim()
  const egg = await chip('chip-egg')
  const hatchTxt = await chip('chip-hatch')
  const feedsChip = await chip('chip-feeds')
  if (egg === eggBalance.toLocaleString('en-US')) ok(`EGG chip = ${egg} (chain ${eggBalance})`)
  else bad(`EGG chip = "${egg}" — chain says ${eggBalance}`)
  if (hatchTxt === hatchWhole.toLocaleString('en-US')) ok(`$HATCH chip = ${hatchTxt} (chain ${hatchWhole})`)
  else bad(`$HATCH chip = "${hatchTxt}" — chain says ${hatchWhole}`)
  if (feedsChip.replace(/\s/g, '') === `${feedsLeft}/${cfg.feed_daily_cap}`)
    ok(`Feeds Left chip = ${feedsChip} (chain ${feedsLeft}/${cfg.feed_daily_cap})`)
  else bad(`Feeds Left chip = "${feedsChip}" — expected ${feedsLeft}/${cfg.feed_daily_cap}`)

  const body = await page.evaluate(() => document.body.innerText)
  // The $HATCH chip must list only what the contract actually burns HATCH for
  // (breed_cost + accelerate). setname never charges name_cost, so "Rename" on
  // this chip would price a free action.
  for (const label of ['Hatch · Evolve', 'Breed · Accelerate']) {
    if (body.includes(label)) ok(`currency chip says what it pays for: "${label}"`)
    else bad(`missing currency purpose label "${label}"`)
  }
  if (/Breed · Rename|Breed and naming/.test(body)) bad('the $HATCH chip still claims renaming costs HATCH — it is free')
  else ok('no copy claims a rename costs $HATCH')

  // ── 1. Feed quota on the card + a disabled Feed button ──
  const quota = await page.locator('[data-testid="feed-quota"]').first()
  if (await quota.count()) {
    const txt = (await quota.textContent() || '').replace(/\s/g, '')
    if (txt === `${feedsToday}/${cfg.feed_daily_cap}`) ok(`card shows "Feeds today ${txt}"`)
    else bad(`card feed quota = "${txt}" — chain says ${feedsToday}/${cfg.feed_daily_cap}`)
  } else bad('no feed-quota row rendered on any card')

  if (/resets in \d/i.test(body)) ok('feed quota shows the reset countdown')
  else bad('feed quota has no reset countdown')

  const feedBtns = page.locator('[data-testid="feed-btn"]')
  const nFeed = await feedBtns.count()
  if (nFeed === 0) bad('no Feed buttons rendered')
  if (capReached) {
    let allDisabled = true
    let labelled = 0
    for (let i = 0; i < nFeed; i++) {
      if (!(await feedBtns.nth(i).isDisabled())) allDisabled = false
      if (/Daily feed limit/i.test((await feedBtns.nth(i).textContent()) || '')) labelled++
    }
    if (allDisabled) ok(`daily cap reached → all ${nFeed} Feed buttons disabled (no tx can be fired)`)
    else bad('daily cap reached but a Feed button is still enabled')
    if (labelled === nFeed) ok(`all ${nFeed} Feed buttons say "Daily feed limit ${feedsToday}/${cfg.feed_daily_cap} — resets in …"`)
    else bad(`only ${labelled}/${nFeed} Feed buttons name the daily limit`)
  } else {
    ok(`quota not spent (${feedsToday}/${cfg.feed_daily_cap}) — cap-reached path not exercised this run`)
  }

  // ── 2. Evolve names the real blocker, in EGG ──
  const ev = page.locator(`[data-testid="evolve-${probe.asset_id}"]`).first()
  if (await ev.count()) {
    const txt = (await ev.textContent() || '').trim()
    const reason = await ev.getAttribute('data-evolve-reason')
    const disabled = await ev.isDisabled()
    console.log(`  · evolve button #${probe.asset_id}: "${txt}" [reason=${reason}, disabled=${disabled}]`)

    const expected = hungry ? 'hungry'
      : growth < growthNeeded ? 'growth'
        : eggBalance < evolveCost ? 'egg' : 'ok'
    if (reason === expected) ok(`evolve gate = "${reason}" — matches the contract's first failing check`)
    else bad(`evolve gate = "${reason}" — contract order says "${expected}"`)

    if (expected !== 'ok' && disabled) ok('blocked Evolve is disabled (cannot fire a tx)')
    else if (expected !== 'ok') bad('Evolve is blocked on chain but the button is still clickable')

    if (expected === 'egg') {
      const wantsCost = txt.includes(evolveCost.toLocaleString('en-US')) && /EGG/.test(txt)
      const showsHave = txt.includes(eggBalance.toLocaleString('en-US'))
      if (wantsCost && showsHave) ok(`Evolve says "Requires ${evolveCost} EGG — you have ${eggBalance}"`)
      else bad(`Evolve label "${txt}" does not state cost ${evolveCost} EGG vs balance ${eggBalance}`)
      const hint = await page.locator(`[data-testid="evolve-hint-${probe.asset_id}"]`).first().textContent()
      if (/paid in EGG, not \$HATCH/i.test(hint || '')) ok('hint spells out that Evolve is paid in EGG, not $HATCH')
      else bad(`evolve hint does not separate EGG from $HATCH: "${hint}"`)
    }
  } else bad(`no evolve button for probe asset ${probe.asset_id}`)

  // The old hardcoded lie must be gone everywhere.
  if (/Evolve\s*·\s*50 HATCH/i.test(body)) bad('the hardcoded "Evolve · 50 HATCH" label is still rendered')
  else ok('no hardcoded "Evolve · 50 HATCH" anywhere in the DOM')

  // ── 3. English-only game copy ──
  // Thai / CJK / Hangul / Cyrillic in the panel's own text would be a regression.
  const foreign = await page.evaluate(() => {
    const re = /[฀-๿一-鿿가-힯Ѐ-ӿ]/
    const hits = []
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = (n.textContent || '').trim()
      if (t && re.test(t)) hits.push(t.slice(0, 60))
    }
    return hits
  })
  if (foreign.length === 0) ok('English-only: no Thai/CJK/Hangul/Cyrillic text rendered')
  else bad(`non-English copy rendered: ${foreign.slice(0, 5).join(' | ')}`)

  const shot = join(outDir, 'action-gates-live.png')
  await page.screenshot({ path: shot, fullPage: true })
  console.log(`\n  📸 ${shot}`)
} catch (e) {
  bad(`harness error: ${e.message}`)
  await page.screenshot({ path: join(outDir, 'action-gates-error.png'), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(failures === 0
  ? '\n═══ ACTION-GATES PASS — Feed quota + Evolve cost are on screen, blocked buttons cannot fire. ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
