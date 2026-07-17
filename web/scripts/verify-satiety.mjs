// Feed-v2 satiety MODEL verification (pure logic — no browser, no chain).
// Imports the real ../src/satiety.ts (Node 24 strips the types) and asserts the
// 6-tier fed_dur decay curve, state tiers, feed cooldown and rarity earn rates.
// This is the deterministic proof that the chain-anchored satiety model
//   satiety% = clamp((last_fed + fed_dur − now)/fed_dur, 0, 1)
// behaves, independent of any wallet or render.
import {
  computeSatiety,
  feedCooldown,
  earnRate,
  satietyState,
  fedDurFor,
  FED_DUR_DEFAULT,
  MOCK_SATIETY_CONFIG,
  PREVIEW_SATIETY_CONFIG,
  RARITY_EARN_MULT,
} from '../src/satiety.ts'

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

const cfg = MOCK_SATIETY_CONFIG
const NOW = 1_800_000_000 // fixed clock — deterministic
const H = 3600

console.log('① fed_dur is 6-tier per rarity (48h / 72h / 120h / 168h / 240h / 336h)')
{
  check('common = 48h', FED_DUR_DEFAULT.common === 48 * H, `${FED_DUR_DEFAULT.common}`)
  check('uncommon = 72h', FED_DUR_DEFAULT.uncommon === 72 * H, `${FED_DUR_DEFAULT.uncommon}`)
  check('rare = 120h', FED_DUR_DEFAULT.rare === 120 * H, `${FED_DUR_DEFAULT.rare}`)
  check('epic = 168h', FED_DUR_DEFAULT.epic === 168 * H, `${FED_DUR_DEFAULT.epic}`)
  check('legendary = 240h', FED_DUR_DEFAULT.legendary === 240 * H, `${FED_DUR_DEFAULT.legendary}`)
  check('mythic = 336h', FED_DUR_DEFAULT.mythic === 336 * H, `${FED_DUR_DEFAULT.mythic}`)
  // Six on-chain tiers (speciescfg.egg_type 0–5), not three — the model tracks the
  // full 6-tier chain rarity range.
  check('exactly 6 rarities', Object.keys(FED_DUR_DEFAULT).length === 6, Object.keys(FED_DUR_DEFAULT).join(','))
  // fedDurFor honors the live chain value when present, else the spec default.
  check('fedDurFor uses live value when given', fedDurFor('common', cfg, 999) === 999)
  check('fedDurFor falls back to rarity default', fedDurFor('rare', cfg) === 120 * H)
  check('fedDurFor honors preview override', fedDurFor('rare', PREVIEW_SATIETY_CONFIG) === 30)
}

console.log('② satiety% = clamp((last_fed + fed_dur − now)/fed_dur, 0, 1) — a Common (48h)')
{
  const d = FED_DUR_DEFAULT.common
  const justFed = computeSatiety(NOW, NOW, d, cfg)
  const half = computeSatiety(NOW - 24 * H, NOW, d, cfg) // 24h of 48h → 50%
  const near = computeSatiety(NOW - 47 * H, NOW, d, cfg) // 1h left → ~2%
  const empty = computeSatiety(NOW - 60 * H, NOW, d, cfg) // past fed_dur → 0
  check('just fed → 100%', Math.round(justFed.percent) === 100, `${justFed.percent}`)
  check('half a Common fed_dur → 50%', Math.abs(half.percent - 50) < 0.5, `${half.percent}`)
  check('near-end is low but positive', near.percent > 0 && near.percent < 5, `${near.percent}`)
  check('floors at 0 (never negative)', empty.percent === 0, `${empty.percent}`)
}

console.log('③ Rarer creatures stay fed longer at the same elapsed time')
{
  const elapsed = 60 * H // 60h since the last feed
  const common = computeSatiety(NOW - elapsed, NOW, FED_DUR_DEFAULT.common, cfg)   // past 48h → 0
  const uncommon = computeSatiety(NOW - elapsed, NOW, FED_DUR_DEFAULT.uncommon, cfg) // 60/72 → ~17%
  const rare = computeSatiety(NOW - elapsed, NOW, FED_DUR_DEFAULT.rare, cfg)       // 60/120 → 50%
  check('common empty after 60h', common.percent === 0, `${common.percent}`)
  check('rare still half-full after 60h', Math.abs(rare.percent - 50) < 0.5, `${rare.percent}`)
  check('rare > uncommon > common at 60h', rare.percent > uncommon.percent && uncommon.percent > common.percent,
    `${rare.percent} / ${uncommon.percent} / ${common.percent}`)
}

console.log('④ State tiers: Full → Hungry → Starving')
{
  check('90% → full', satietyState(90, cfg) === 'full')
  check('40% → hungry', satietyState(40, cfg) === 'hungry')
  check('10% → starving', satietyState(10, cfg) === 'starving')
  const d = FED_DUR_DEFAULT.common
  check('fresh feed reads full', computeSatiety(NOW, NOW, d, cfg).state === 'full')
  check('mid-life reads hungry', computeSatiety(NOW - 30 * H, NOW, d, cfg).state === 'hungry',
    `${Math.round(computeSatiety(NOW - 30 * H, NOW, d, cfg).percent)}%`)
  check('near-empty reads starving', computeSatiety(NOW - 44 * H, NOW, d, cfg).state === 'starving',
    `${Math.round(computeSatiety(NOW - 44 * H, NOW, d, cfg).percent)}%`)
}

console.log('⑤ Never-fed creature is treated as full (no false starving)')
{
  const neverFed = computeSatiety(0, NOW, FED_DUR_DEFAULT.common, cfg)
  check('lastFed=0 → full 100%', neverFed.state === 'full' && neverFed.percent === 100)
}

console.log('⑥ Feed cooldown (anti-spam) counts down and clears')
{
  const fresh = feedCooldown(NOW, NOW, cfg)
  const half = feedCooldown(NOW - cfg.feedCooldownSec / 2, NOW, cfg)
  const done = feedCooldown(NOW - cfg.feedCooldownSec - 1, NOW, cfg)
  check('just fed → on cooldown', fresh.onCooldown && fresh.secondsLeft > 0)
  check('halfway → still on cooldown, less time left', half.onCooldown && half.secondsLeft < fresh.secondsLeft)
  check('after cooldown → ready', !done.onCooldown && done.secondsLeft === 0)
  check('never fed → no cooldown', !feedCooldown(0, NOW, cfg).onCooldown)
}

console.log('⑦ Earn premium is the real on-chain TOTAL (species yield × earn_mult): 1.0 / 1.21 / 1.96')
{
  // The deployed contract's harvest() COMPOUNDS two rarity factors that both live
  // on chain: speciescfg.yield (Fire 662976/7/8 = 100/110/140 → embedded ×1.0/1.1/
  // 1.4) AND configv3.earn_mult (10000/11000/14000 → ×1.0/1.1/1.4). The premium a
  // player actually harvests is the PRODUCT → common 1.0 · uncommon 1.21 · rare 1.96.
  // RARITY_EARN_MULT holds this TOTAL (fallback for demo/preview); real cards read
  // species yield × earn_mult live per creature (play.ts earnFromChain).
  check('common ×1.0', RARITY_EARN_MULT.common === 1.0, `${RARITY_EARN_MULT.common}`)
  check('uncommon ×1.21 (1.1×1.1)', Math.abs(RARITY_EARN_MULT.uncommon - 1.21) < 1e-9, `${RARITY_EARN_MULT.uncommon}`)
  check('rare ×1.96 (1.4×1.4)', Math.abs(RARITY_EARN_MULT.rare - 1.96) < 1e-9, `${RARITY_EARN_MULT.rare}`)
  check('epic ×3.24 (1.8×1.8)', Math.abs(RARITY_EARN_MULT.epic - 3.24) < 1e-9, `${RARITY_EARN_MULT.epic}`)
  check('legendary ×5.76 (2.4×2.4)', Math.abs(RARITY_EARN_MULT.legendary - 5.76) < 1e-9, `${RARITY_EARN_MULT.legendary}`)
  check('mythic ×10.89 (3.3×3.3)', Math.abs(RARITY_EARN_MULT.mythic - 10.89) < 1e-9, `${RARITY_EARN_MULT.mythic}`)
  check('exactly 6 multipliers', Object.keys(RARITY_EARN_MULT).length === 6, Object.keys(RARITY_EARN_MULT).join(','))
  const commonFull = earnRate('common', 3, 'full')
  const rareFull = earnRate('rare', 3, 'full')
  const rareStarving = earnRate('rare', 3, 'starving')
  check('rare base > common base (same stage)', rareFull.base > commonFull.base, `${rareFull.base} vs ${commonFull.base}`)
  check('rare mult = 1.96 (total premium)', rareFull.multiplier === RARITY_EARN_MULT.rare)
  check('full earns more than starving', rareFull.effective > rareStarving.effective,
    `${rareFull.effective} vs ${rareStarving.effective}`)
  check('starving still earns a trickle (>0)', rareStarving.effective > 0)
  check('stage 0 earns nothing', earnRate('common', 0, 'full').base === 0)
  // Raw on-chain yield, NOT ÷100 — must match speciescfg (common stage-3 = 600)
  check('common stage-3 base = 600 (raw yield, not 6)', commonFull.base === 600, `${commonFull.base}`)
  // Chain-truth: rare stage-3 harvest = species yield_2 (840) × earn_mult (1.4) =
  // 1176 = common-base 600 × total premium 1.96. The old "840" assertion assumed
  // premium = earn_mult only and UNDERCOUNTED — corrected to the real compounded pay.
  check('rare stage-3 base = 1176 (600 ×1.96 = 840 yield ×1.4 earn_mult)', Math.round(rareFull.base) === 1176, `${rareFull.base}`)
  // Fallback path parity: earnRate with a live override matches harvest() exactly.
  const liveRare3 = earnRate('rare', 3, 'full', { baseFull: 840 * 1.4, multiplier: (840 * 1.4) / 600 })
  check('live earn override = 1176 (species 840 × earn_mult 1.4)', Math.round(liveRare3.base) === 1176, `${liveRare3.base}`)
}

console.log('⑧ Preview clock decays fast (for the live lab)')
{
  const d = PREVIEW_SATIETY_CONFIG.fedDurSec
  const fed = computeSatiety(NOW, NOW, d, PREVIEW_SATIETY_CONFIG)
  const after15s = computeSatiety(NOW - 15, NOW, d, PREVIEW_SATIETY_CONFIG)
  const after30s = computeSatiety(NOW - 30, NOW, d, PREVIEW_SATIETY_CONFIG)
  check('preview: full at feed', Math.round(fed.percent) === 100)
  check('preview: ~50% after 15s', Math.abs(after15s.percent - 50) < 2, `${after15s.percent}`)
  check('preview: empty by 30s', after30s.percent === 0)
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
