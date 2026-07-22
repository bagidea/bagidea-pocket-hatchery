import type { Rarity } from './components/CreatureCard'

/**
 * awaken.ts — the Awaken v2 mechanics seam (PURE LOGIC — no JSX, no CSS).
 *
 * Sibling of satiety.ts. Everything the awaken (wake) system needs to reason
 * about a freshly-hatched creature's sleep timer lives here, so the UI
 * (AwakenMeter) just renders what these functions return and the chain layer
 * (play.ts `toCreature`) supplies the inputs.
 *
 * ── THE MODEL (chain-anchored) ───────────────────────────────────────────────
 * A creature hatches ASLEEP at stage 0. It cannot earn until it wakes to stage 1.
 * There are two ways to wake it, both driven by `born_at + awaken_dur`:
 *
 *   1. FREE / AUTO — once `now ≥ born_at + awaken_dur`, the next `harvest`
 *      auto-awakens it (stage 0 → 1) at no cost (pockethatch.cpp harvest loop).
 *   2. PAID / EARLY — WHILE `now < born_at + awaken_dur`, the player can wake it
 *      immediately by sending WAX to the game contract:
 *          wax_contract::transfer{ from, to: game, quantity: wake_cost, memo: "wake:<asset_id>" }
 *      (pockethatch.cpp on_wax_transfer). Once the timer has elapsed the contract
 *      REJECTS the WAX wake ("already awake — just harvest instead") — paying then
 *      would waste WAX, so the UI only offers the paid wake while still sleeping.
 *
 * awaken_dur (seconds) and wake_cost (WAX) both come from configv3, per rarity
 * (speciescfg.egg_type → 0=common … 5=mythic). Rarer creatures sleep longer AND
 * cost more WAX to skip — the constants below are the spec fallback; the live
 * chain values flow through play.ts (chain.ts ChainConfig.awaken_dur_* / wake_cost_*).
 */

export type AwakenState = 'sleeping' | 'awake'

// ── configv3 SWAP POINT ① — awaken_dur per rarity (seconds) ──────────────────
// SOURCE: configv3.awaken_dur_{common..mythic}. These mirror the on-chain
// defaults (pockethatch.hpp §1.2); the live chain values override via play.ts
// awakenDurFromConfig. Edit here only if the spec durations themselves change.
export const AWAKEN_DUR_DEFAULT: Record<Rarity, number> = {
  common: 3600,      // 1h
  uncommon: 5400,    // 1.5h
  rare: 7200,        // 2h
  epic: 9000,        // 2.5h
  legendary: 10800,  // 3h
  mythic: 10800,     // 3h
}

// ── configv3 SWAP POINT ② — wake_cost per rarity (whole WAX) ─────────────────
// SOURCE: configv3.wake_cost_{common..mythic} (asset strings on chain). Whole-WAX
// FALLBACK only, for demo/preview where no live asset string is threaded. Real
// cards read the live asset straight from configv3 (play.ts wakeCostFromConfig),
// which is also what the transfer quantity must be to satisfy the contract's
// `quantity >= required` check exactly.
export const WAKE_COST_WAX_DEFAULT: Record<Rarity, number> = {
  common: 3,
  uncommon: 5,
  rare: 10,
  epic: 20,
  legendary: 40,
  mythic: 80,
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/**
 * Resolve the awaken_dur (seconds) a creature should use: a live chain value
 * (configv3.awaken_dur_*) when present, else the per-rarity spec default. Single
 * place the two awaken_dur sources reconcile (mirrors satiety.ts fedDurFor).
 */
export function awakenDurFor(rarity: Rarity, liveAwakenDur?: number): number {
  if (liveAwakenDur && liveAwakenDur > 0) return liveAwakenDur
  return AWAKEN_DUR_DEFAULT[rarity] ?? AWAKEN_DUR_DEFAULT.common
}

export interface AwakenReading {
  state: AwakenState
  /** stage 0 (has not woken yet), regardless of whether the timer has elapsed. */
  sleeping: boolean
  /**
   * Timer has elapsed while still stage 0 → the next harvest auto-awakens it FREE.
   * Paying WAX is pointless (and the contract rejects it) once this is true.
   */
  canAutoAwaken: boolean
  /** Seconds until `born_at + awaken_dur` (0 if elapsed / already awake). */
  secondsToAwaken: number
  /** 0..100 how far through the sleep timer (100 = ready / awake). */
  progressPct: number
}

/**
 * Awaken reading for a creature. `now`/`bornAt` are unix SECONDS.
 *
 *   stage > 0            → awake (progress 100).
 *   stage 0, timer left  → sleeping, secondsToAwaken > 0, WAX wake available.
 *   stage 0, timer done  → sleeping but canAutoAwaken (harvest wakes it free).
 *
 * A creature with no born_at (0/undefined) reads as still sleeping with the full
 * timer ahead, so a just-hatched egg shows the sleep bar rather than "ready".
 */
export function computeAwaken(
  stage: number,
  bornAt: number,
  now: number,
  awakenDurSec: number,
): AwakenReading {
  if (stage > 0) {
    return { state: 'awake', sleeping: false, canAutoAwaken: false, secondsToAwaken: 0, progressPct: 100 }
  }
  const dur = awakenDurSec > 0 ? awakenDurSec : AWAKEN_DUR_DEFAULT.common
  // No born_at yet → treat as freshly laid: full timer ahead.
  const born = bornAt && bornAt > 0 ? bornAt : now
  const elapsed = now - born
  const remaining = born + dur - now
  if (remaining <= 0) {
    return { state: 'sleeping', sleeping: true, canAutoAwaken: true, secondsToAwaken: 0, progressPct: 100 }
  }
  return {
    state: 'sleeping',
    sleeping: true,
    canAutoAwaken: false,
    secondsToAwaken: remaining,
    progressPct: clamp(elapsed / dur, 0, 1) * 100,
  }
}

/**
 * Parse a WAX asset string ("3.00000000 WAX") into whole WAX units (3) for
 * display. Precision is dropped — the button shows "3 WAX", the transfer uses the
 * full asset string verbatim.
 */
export function waxWhole(asset: string | undefined): number {
  if (!asset) return 0
  const m = asset.match(/([0-9.]+)\s/)
  return m ? Number(m[1]) : 0
}
