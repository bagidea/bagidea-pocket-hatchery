import type { Rarity } from './components/CreatureCard'

/**
 * satiety.ts — the Feed v2 mechanics seam (PURE LOGIC — no JSX, no CSS).
 *
 * Everything the "ความอิ่ม" (satiety) system needs to reason about time lives
 * here so the UI (SatietyMeter) just renders what these functions return, and
 * the chain layer (play.ts `toCreature`) just supplies the inputs.
 *
 * ── THE MODEL (3-tier, chain-anchored) ───────────────────────────────────────
 * A creature is FULL right after you feed it (creatures.last_fed = now) and its
 * satiety runs down linearly over `fed_dur` — a duration that depends on the
 * creature's rarity (speciescfg.egg_type → common/uncommon/rare):
 *
 *     satiety% = clamp((last_fed + fed_dur − now) / fed_dur, 0, 1) × 100
 *
 * fed_dur comes from configv3.fed_dur_{common|uncommon|rare} (48h / 72h / 120h).
 * Low satiety throttles the creature's EGG earn rate — that is the whole reason a
 * player comes back to feed. Rarer creatures both stay fed longer AND earn more
 * per hour, so a Rare is worth far more attention than a Common.
 *
 * ── RARITY (must match chain) ─────────────────────────────────────────────────
 * On chain there are exactly THREE rarities, from speciescfg.egg_type:
 *     0 = Common · 1 = Uncommon · 2 = Rare
 * (GENETICS-SPEC.md §"Rarity อยู่ที่ species level เท่านั้น"). No epic/legendary/
 * mythic exist on chain — those were mock tiers and are gone.
 *
 * ── BINDING STATUS (2026-07-08) ──────────────────────────────────────────────
 * `last_fed` is REAL and already on chain (creature_row.last_fed, parsed in
 * chain.ts → CreatureRow.last_fed), and `egg_type` → rarity is REAL too. Both are
 * wired through today. The earn multipliers below are now the REAL on-chain ratios
 * (verified from speciescfg — see RARITY_EARN_MULT). The one remaining unknown is
 * the exact fed_dur decay durations (satiety bar), which land with Kevin's spec;
 * until then FED_DUR_DEFAULT stands in and flows automatically once the chain
 * fields exist — see chain.ts CONFIG_TABLE + play.ts fedDur threading.
 */

export type SatietyState = 'full' | 'hungry' | 'starving'

// ── configv3 SWAP POINT ① — fed_dur per rarity (seconds) ─────────────────────
// SOURCE: configv3.fed_dur_{common|uncommon|rare}. These spec defaults (48h /
// 72h / 120h) are used until configv3 is live; chain.ts then reads the real
// fields and play.ts threads them down (overriding these). Edit here only if the
// spec durations themselves change.
export const FED_DUR_DEFAULT: Record<Rarity, number> = {
  common: 48 * 3600,   // 48h
  uncommon: 72 * 3600, // 72h
  rare: 120 * 3600,    // 120h
}

// ── earn multiplier per rarity — REAL on-chain ratios ────────────────────────
// VERIFIED from speciescfg on phgamecreatr (2026-07-09): every rarer species'
// yield_n is a CONSTANT multiple of the common one at every stage —
//   common  662976: 100/300/600/1200/2400  → ×1.00
//   uncommon 662977: 110/330/660/1320/2640  → ×1.10
//   rare    662978: 140/420/840/1680/3360  → ×1.40
// So earn is driven by STAGE (the 100→2400 curve in BASE_EARN_BY_STAGE); rarity
// is only a modest nudge. The old {1.5, 2.5} were mock. If Kevin re-tunes the
// yields, update these three numbers HERE (one place) and rebuild.
// ⚠️ LIMITATION: this "common-base × ratio" model assumes the ratio is CONSTANT
// across stages — true only because the sole deployed family (Fire) holds
// 1.0/1.1/1.4 at every stage. If a future family ships a per-stage yield curve
// that is NOT a fixed multiple of common, this reconstruction drifts; then read
// the species' own yield[] from speciescfg directly instead of a scalar mult.
export const RARITY_EARN_MULT: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.1,
  rare: 1.4,
}

export interface SatietyConfig {
  /**
   * Optional fed-duration override (seconds) applied to EVERY rarity. Used by the
   * preview lab (?feedlab) to run a fast clock so a human can watch the bar fall.
   * When absent, fed_dur comes from the creature's rarity (chain / FED_DUR_DEFAULT).
   */
  fedDurSec?: number
  /** Minimum seconds between two feeds (anti-spam cooldown). */
  feedCooldownSec: number
  /** percent ≥ this → "full". */
  fullAt: number
  /** percent ≥ this → "hungry"; below → "starving". */
  hungryAt: number
}

/**
 * Real dashboard config: no fedDurSec override (each creature uses its rarity's
 * fed_dur), a 1h feed cooldown, and the state thresholds. Replace nothing here
 * when configv3 lands — durations live in FED_DUR_DEFAULT / chain.
 */
export const MOCK_SATIETY_CONFIG: SatietyConfig = {
  feedCooldownSec: 60 * 60, // 1h between feeds
  fullAt: 60,
  hungryAt: 25,
}

/**
 * A tuned config for the live preview (?feedlab) so a human can SEE the bar fall
 * in seconds instead of hours: fed_dur is forced to 30s for every card. Same
 * shape, faster clock — never used by the real dashboard.
 */
export const PREVIEW_SATIETY_CONFIG: SatietyConfig = {
  fedDurSec: 30, // full → empty in 30 seconds
  feedCooldownSec: 5,
  fullAt: 60,
  hungryAt: 25,
}

export interface SatietyReading {
  /** Current satiety as a 0..100 percentage (drives the bar width). */
  percent: number
  state: SatietyState
  /** Seconds until the state drops to the next lower tier (0 if already lowest). */
  secondsToNextTier: number
  /** Seconds until satiety hits 0 (0 if already empty / never-fed reads Infinity-safe 0). */
  secondsToEmpty: number
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/**
 * Resolve the fed_dur (seconds) a creature should use, honoring — in order — a
 * preview override, a live chain value (configv3.fed_dur_*), then the per-rarity
 * spec default. This is the single place the three fed_dur sources reconcile.
 */
export function fedDurFor(
  rarity: Rarity,
  config: SatietyConfig = MOCK_SATIETY_CONFIG,
  liveFedDur?: number,
): number {
  if (config.fedDurSec && config.fedDurSec > 0) return config.fedDurSec // preview fast clock
  if (liveFedDur && liveFedDur > 0) return liveFedDur                    // chain configv3
  return FED_DUR_DEFAULT[rarity] ?? FED_DUR_DEFAULT.common               // spec default
}

/**
 * Current satiety for a creature: 100% right after `lastFed`, decaying linearly to
 * 0% at `lastFed + fedDurSec`. `now`/`lastFed` are unix SECONDS.
 *
 *     satiety% = clamp((lastFed + fedDur − now) / fedDur, 0, 1) × 100
 *
 * A never-fed creature (lastFed 0/undefined) reads full, so a freshly hatched
 * creature doesn't show "starving" before its first feed.
 */
export function computeSatiety(
  lastFed: number,
  now: number,
  fedDurSec: number,
  config: SatietyConfig = MOCK_SATIETY_CONFIG,
): SatietyReading {
  if (fedDurSec <= 0 || !lastFed || lastFed <= 0) {
    return tierReading(100, fedDurSec, config)
  }
  const frac = clamp((lastFed + fedDurSec - now) / fedDurSec, 0, 1)
  return tierReading(frac * 100, fedDurSec, config)
}

function tierReading(percent: number, fedDurSec: number, config: SatietyConfig): SatietyReading {
  const state = satietyState(percent, config)
  // percent falls at a constant 100/fedDur points per second → invert to seconds.
  const perSec = fedDurSec > 0 ? 100 / fedDurSec : 0
  const target = state === 'full' ? config.fullAt : state === 'hungry' ? config.hungryAt : 0
  const secondsToNextTier = perSec > 0 ? Math.max(0, Math.round((percent - target) / perSec)) : 0
  const secondsToEmpty = perSec > 0 ? Math.max(0, Math.round(percent / perSec)) : 0
  return { percent, state, secondsToNextTier, secondsToEmpty }
}

/** Map a 0..100 percentage to a state using the config thresholds. */
export function satietyState(percent: number, config: SatietyConfig = MOCK_SATIETY_CONFIG): SatietyState {
  if (percent >= config.fullAt) return 'full'
  if (percent >= config.hungryAt) return 'hungry'
  return 'starving'
}

export interface FeedCooldown {
  onCooldown: boolean
  secondsLeft: number
}

/** Whether the anti-spam feed cooldown is active. `now`/`lastFed` in seconds. */
export function feedCooldown(
  lastFed: number,
  now: number,
  config: SatietyConfig = MOCK_SATIETY_CONFIG,
): FeedCooldown {
  if (!lastFed || lastFed <= 0 || config.feedCooldownSec <= 0) {
    return { onCooldown: false, secondsLeft: 0 }
  }
  const left = Math.max(0, lastFed + config.feedCooldownSec - now)
  return { onCooldown: left > 0, secondsLeft: left }
}

// ── Rarity → earn rate ──────────────────────────────────────────────────────
// Base EGG/hr a Common creature earns at each life stage. VERIFIED against the
// deployed contract: harvest() skips stage 0 (egg) and reads yield[stage-1], so
// stage1→yield_0(100), 2→yield_1(300), 3→600, 4→1200, 5→2400. The contract has
// NO token precision here — harvest does `egg_balance += yield` on the RAW
// integer, and every other EGG number in the panel is raw too (hatch 150 /
// reset 200 / tap 60 = configv2). So show the raw yield, NOT ÷100 — a divided
// value reads 100× smaller than the chain and clashes with 150/200/60 in the
// same panel. Index by creature.stage directly (0 = egg = 0 earn).
export const BASE_EARN_BY_STAGE: number[] = [0, 100, 300, 600, 1200, 2400]

/**
 * Satiety throttles earning: a full creature earns at 100%, a hungry one at half,
 * a starving one barely earns. This is the pull back to feed.
 */
export function satietyEarnFactor(state: SatietyState): number {
  switch (state) {
    case 'full': return 1.0
    case 'hungry': return 0.5
    case 'starving': return 0.1
  }
}

export interface EarnRate {
  /** EGG/hr at full satiety for this rarity + stage. */
  base: number
  /** EGG/hr right now, after the satiety throttle. */
  effective: number
  /** The rarity multiplier applied (for display, e.g. "×2.50"). */
  multiplier: number
}

/** Earn rate for a creature given its rarity, stage and current satiety state. */
export function earnRate(rarity: Rarity, stage: number, state: SatietyState): EarnRate {
  const stageBase = BASE_EARN_BY_STAGE[clamp(stage, 0, BASE_EARN_BY_STAGE.length - 1)] ?? 0
  const multiplier = RARITY_EARN_MULT[rarity] ?? 1.0
  const base = stageBase * multiplier
  const effective = base * satietyEarnFactor(state)
  return { base, effective, multiplier }
}

/** Human labels for a state — used by the meter + button. */
export const STATE_LABEL: Record<SatietyState, string> = {
  full: 'Full',
  hungry: 'Hungry',
  starving: 'Starving',
}
