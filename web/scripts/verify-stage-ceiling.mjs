/**
 * verify-stage-ceiling.mjs — prove the panel's MAX boundary matches the contract.
 *
 * The contract's evolve() guards with `check(cur_stage < sp.max_stage)` and the
 * live spccfgv2 has max_stage = 5 (plus real thresh_5 / yield_5), so stage 5 IS
 * reachable and only stage 5 is terminal. The panel used to hold
 * `maxStage = max_stage − 1`, which showed MAX at stage 4 and hid the player's
 * last evolve — a stage the chain would happily have granted.
 *
 * No creature on testnet is anywhere near stage 4, so waiting for one is not an
 * option. Instead this drives the SAME deployed panel as verify-action-gates,
 * against the SAME live RPC, and rewrites only the `creatrsv2` (and the player's
 * EGG) rows in flight — every other read, and the whole render path, is real.
 *
 * Asserted, per injected creature:
 *   stage 4 → Evolve ENABLED, reason "ok", subtitle "STAGE 4", cost = evolve_cost × 5
 *   stage 5 → Evolve GONE, subtitle "MAX"
 *   the stage-4 growth bar targets thresh_5 (not thresh_4)
 *
 *   node scripts/verify-stage-ceiling.mjs
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

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

const rows = async (table, extra = {}) => {
  const res = await fetch(`${RPC}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: true, code: 'phgamecreatr', scope: 'phgamecreatr', table, limit: 100, ...extra }),
  })
  return (await res.json()).rows
}

// ── 1. Live config + species = the truth the injected rows are built from ────
const info = await fetch(`${RPC}/v1/chain/get_info`).then((r) => r.json())
const headSec = Math.floor(new Date(`${info.head_block_time}Z`).getTime() / 1000)
const cfg = (await rows('configv3', { limit: 1 }))[0]
const species = await rows('spccfgv2')
const real = (await rows('creatrsv2', {
  index_position: 2, key_type: 'i64', lower_bound: ACCOUNT, upper_bound: ACCOUNT,
}))[0]

const sp = species.find((s) => s.template_id === real.template_id)
if (!sp) { bad(`no species row for template ${real.template_id}`); process.exit(1) }
if (sp.max_stage !== 5) bad(`spccfgv2.max_stage is ${sp.max_stage} — this script assumes the live 5`)

const FED_DUR = [cfg.fed_dur_common, cfg.fed_dur_uncommon, cfg.fed_dur_rare,
  cfg.fed_dur_epic, cfg.fed_dur_legendary, cfg.fed_dur_mythic][sp.egg_type]
const cost4 = cfg.evolve_cost * 5      // evolve_cost × (stage + 1), stage 4
const EGG = cost4 + 10_000             // comfortably affordable, so the gate lands on "ok"

// growth ≥ thresh_5 → a stage-4 creature is genuinely ready for its last evolve.
const mk = (id, stage, growth) => ({
  ...real, asset_id: id, owner: ACCOUNT, stage,
  growth_base: growth, fed_growth: 0,
  last_sync: headSec, last_fed: headSec, last_bred: 0,
})
const ID4 = '990000000004'
const ID5 = '990000000005'
const INJECTED = [mk(ID4, 4, sp.thresh_5), mk(ID5, 5, sp.thresh_5 + 50_000)]

console.log(`\nContract truth — max_stage ${sp.max_stage} (terminal stage NUMBER)`)
console.log(`  thresh_4 ${sp.thresh_4} · thresh_5 ${sp.thresh_5} · fed_dur ${FED_DUR}s`)
console.log(`  injected #${ID4} stage 4 growth ${sp.thresh_5} · #${ID5} stage 5`)
console.log(`  stage-4 evolve costs ${cost4} EGG (evolve_cost ${cfg.evolve_cost} × 5), balance faked to ${EGG}\n`)

// ── 2. Render the deployed panel, rewriting ONLY creatrsv2 + the EGG balance ──
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
const ctx = await browser.newContext({ viewport: { width: 1320, height: 1400 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

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

// Real RPC, real response — we only swap the creature list and the EGG balance.
await page.route('**/v1/chain/get_table_rows', async (route) => {
  const req = JSON.parse(route.request().postData() || '{}')
  const res = await route.fetch()
  if (req.code !== 'phgamecreatr' || !['creatrsv2', 'players'].includes(req.table)) return route.fulfill({ response: res })
  const body = await res.json()
  if (req.table === 'creatrsv2') body.rows = INJECTED
  if (req.table === 'players') body.rows = body.rows.map((r) => (r.account === ACCOUNT ? { ...r, egg_balance: EGG } : r))
  route.fulfill({ response: res, body: JSON.stringify(body), contentType: 'application/json' })
})

try {
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()
  await page.waitForFunction(() => /living here/.test(document.body.innerText), { timeout: 25000 })
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /Creatures/i }).first().click()
  await page.waitForFunction(() => /collected/.test(document.body.innerText), { timeout: 15000 })
  await page.waitForTimeout(1500)

  if (errs.length) bad(`JS pageerror: ${errs.join(' | ').slice(0, 200)}`)
  else ok('no JS pageerror on the deployed panel')

  const card = (id) => page.locator(`[data-testid="creature-${id}"]`).first()
  if (await card(ID4).count() && await card(ID5).count()) ok('both injected creatures rendered')
  else { bad('injected creatures did not render — cannot assert the ceiling'); throw new Error('no cards') }

  // ── stage 4: still evolvable, and the button carries the real cost ──
  const ev4 = page.locator(`[data-testid="evolve-${ID4}"]`).first()
  if (await ev4.count()) {
    const reason = await ev4.getAttribute('data-evolve-reason')
    const disabled = await ev4.isDisabled()
    const txt = (await ev4.textContent() || '').trim()
    console.log(`  · stage-4 evolve: "${txt}" [reason=${reason}, disabled=${disabled}]`)
    if (reason === 'ok') ok('stage 4 evolve gate = "ok" — the chain would accept it')
    else bad(`stage 4 evolve gate = "${reason}" — contract allows stage 4 < max_stage 5`)
    if (!disabled) ok('stage 4 Evolve button is ENABLED (the last evolve is reachable)')
    else bad('stage 4 Evolve is disabled — the player loses their final stage')
  } else bad('stage 4 has NO Evolve button — the MAX boundary is still one stage early')

  const c4 = (await card(ID4).innerText()).replace(/\s+/g, ' ')
  if (/STAGE 4/.test(c4)) ok('stage-4 card subtitle reads "STAGE 4"')
  else bad(`stage-4 card subtitle is not "STAGE 4": ${c4.slice(0, 120)}`)
  if (/\bMAX\b/.test(c4)) bad('stage-4 card claims MAX — off-by-one is back')
  else ok('stage-4 card does NOT claim MAX')

  // Growth target must be thresh_5, not thresh_4.
  const t5 = sp.thresh_5.toLocaleString('en-US')
  const t4 = sp.thresh_4.toLocaleString('en-US')
  if (c4.includes(t5)) ok(`stage-4 growth bar targets thresh_5 (${t5})`)
  else if (c4.includes(t4)) bad(`stage-4 growth bar targets thresh_4 (${t4}) — should be thresh_5 (${t5})`)
  else bad(`stage-4 card shows neither thresh_4 nor thresh_5: ${c4.slice(0, 160)}`)

  // ── stage 5: the real ceiling ──
  const c5 = (await card(ID5).innerText()).replace(/\s+/g, ' ')
  const ev5 = page.locator(`[data-testid="evolve-${ID5}"]`).first()
  if (await ev5.count()) {
    const reason = await ev5.getAttribute('data-evolve-reason')
    const disabled = await ev5.isDisabled()
    console.log(`  · stage-5 evolve: [reason=${reason}, disabled=${disabled}]`)
    if (reason === 'max-stage' && disabled) ok('stage 5 Evolve = "max-stage" and disabled — matches "already max stage"')
    else bad(`stage 5 evolve gate = "${reason}" disabled=${disabled} — expected max-stage + disabled`)
  } else bad(`no evolve button for stage-5 card ${ID5}`)
  if (/\bMAX\b/.test(c5)) ok('stage-5 card subtitle reads "MAX"')
  else bad(`stage-5 card does not read MAX: ${c5.slice(0, 120)}`)

  // English-only, same rule as the other gate verify.
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

  const shot = join(outDir, 'stage-ceiling.png')
  await page.screenshot({ path: shot, fullPage: true })
  console.log(`\n  📸 ${shot}`)
} catch (e) {
  bad(`harness error: ${e.message}`)
  await page.screenshot({ path: join(outDir, 'stage-ceiling-error.png'), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(failures === 0
  ? '\n═══ STAGE-CEILING PASS — stage 4 still evolves, stage 5 is MAX (matches cur_stage < max_stage). ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
