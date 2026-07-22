/**
 * harvest.ts — Feed-v2 harvest-yield math (PURE LOGIC — no JSX, no CSS).
 *
 * Mirrors the deployed contract's harvest() (pockethatch.cpp) EXACTLY so the
 * dashboard can show the REAL accumulated EGG a Harvest tap will pay — not a
 * hand-wavy earn/hr. Per creature the contract credits EGG over the window it was
 * ACTUALLY fed AND that falls inside the offline cap:
 *
 *   ws     = max(last_harvest, last_fed, now − offline_cap_h·3600)
 *   we     = min(now, last_fed + fed_dur)
 *   fed_h  = floor((we − ws) / 3600)                    // whole hours only
 *   avg_sat = mean satiety over [ws,we] in bp (100%→0% linear across fed_dur)
 *   egg    = yield_for(stage) · fed_h · earn_mult/10000 · avg_sat/10000
 *
 * `earnFull` (EGG/hr at full satiety, from play.ts) already folds
 * yield_for(stage) × earn_mult, so per-creature pending = earnFull · fed_h ·
 * avg_sat/10000. The player-wide total is then trimmed by the remaining daily
 * allowance (daily_egg_cap, optionally scaled by the best owned rarity when
 * cap_scales_rarity is set) — same order the contract applies.
 *
 * A sleeping creature (stage 0) earns nothing until it wakes, and a creature whose
 * food ran out before the window earns nothing — both surface as "not earning".
 * The math floors once at the end, so the shown total never OVER-states the payout.
 */

export interface HarvestCreatureInput {
  assetId: string
  stage: number
  /** Unix seconds of the last feed (creature_row.last_fed). */
  lastFed: number
  /** fed_dur (seconds) for this creature's rarity (configv3.fed_dur_*). */
  fedDur: number
  /** EGG/hr at full satiety (species yield × earn_mult) — play.ts Creature.earnFull. */
  earnFull: number
  /** Total rarity earn premium vs a common at this stage (== earn_mult/10000). */
  earnMult: number
}

/** Why a creature isn't contributing EGG right now. '' = it is earning. */
export type NotEarningReason = '' | 'sleeping' | 'empty'

export interface CreatureHarvest {
  assetId: string
  /** Whole EGG this creature contributes to the pending harvest. */
  pending: number
  earning: boolean
  reason: NotEarningReason
}

export interface HarvestContext {
  /** now, unix seconds. */
  now: number
  /** player.last_harvest (0 = never). */
  lastHarvest: number
  /** configv3.offline_cap_h. */
  offlineCapH: number
  /** configv3.daily_egg_cap. */
  dailyEggCap: number
  /** configv3.cap_scales_rarity (scale the daily ceiling by best owned rarity). */
  capScalesRarity: boolean
  /** player.egg_harvested_today (already spent against today's cap). */
  eggHarvestedToday: number
}

export interface HarvestSummary {
  /** EGG a Harvest tap pays right now (windowed sum, trimmed by the daily cap). */
  pending: number
  /** Uncapped windowed sum before the daily ceiling (drives the "capped" hint). */
  gross: number
  /** Today's EFFECTIVE ceiling — daily_egg_cap, scaled by the best earning rarity
   *  when cap_scales_rarity is set. This (not the raw config number) is the
   *  denominator the player is actually farming against. */
  cap: number
  /** EGG already harvested against today's ceiling (chain: egg_harvested_today,
   *  read through effectiveDailyCounters so a UTC-day rollover reads 0). */
  harvestedToday: number
  /** Ceiling left for today (cap − harvestedToday, floored at 0). */
  remaining: number
  /** Today's ceiling is fully spent — the payout is 0 because the quota is gone,
   *  NOT because the creatures stopped earning. Drives the friendly cap state. */
  capReached: boolean
  /** Creatures actually contributing EGG this harvest. */
  earningCount: number
  /** Creatures that COULD earn (stage ≥ 1) but aren't right now (out of food). */
  idleCount: number
  /** Creatures still asleep (stage 0) — they wake and start earning after harvest. */
  sleepingCount: number
  /** True when the daily cap trimmed the payout below the windowed sum. */
  capped: boolean
  perCreature: CreatureHarvest[]
}

/** Per-creature pending EGG, mirroring the contract's harvest() loop. */
export function creaturePending(c: HarvestCreatureInput, ctx: HarvestContext): CreatureHarvest {
  // Stage 0 = asleep; it earns nothing until it wakes (auto on harvest once its
  // sleep timer elapses, or by paying WAX). Never counts toward the pending EGG.
  if (c.stage <= 0) return { assetId: c.assetId, pending: 0, earning: false, reason: 'sleeping' }
  if (c.earnFull <= 0 || c.fedDur <= 0) return { assetId: c.assetId, pending: 0, earning: false, reason: 'empty' }

  const capStart = ctx.now > ctx.offlineCapH * 3600 ? ctx.now - ctx.offlineCapH * 3600 : 0
  const fedUntil = c.lastFed + c.fedDur
  const ws = Math.max(Math.max(ctx.lastHarvest, c.lastFed), capStart)
  const we = Math.min(ctx.now, fedUntil)
  if (we <= ws) return { assetId: c.assetId, pending: 0, earning: false, reason: 'empty' }

  const fedH = Math.floor((we - ws) / 3600)
  if (fedH === 0) return { assetId: c.assetId, pending: 0, earning: false, reason: 'empty' }

  // avg satiety over [ws,we] in basis points (100%→0% linear across fed_dur)
  const satWs = ((fedUntil - ws) * 10000) / c.fedDur
  const satWe = ((fedUntil - we) * 10000) / c.fedDur
  const avgSat = (satWs + satWe) / 2
  const pending = Math.floor((c.earnFull * fedH * avgSat) / 10000)
  return { assetId: c.assetId, pending, earning: pending > 0, reason: pending > 0 ? '' : 'empty' }
}

/** Whole-collection harvest summary: the real EGG a tap pays + earning breakdown. */
export function summarizeHarvest(creatures: HarvestCreatureInput[], ctx: HarvestContext): HarvestSummary {
  const perCreature = creatures.map((c) => creaturePending(c, ctx))
  const gross = perCreature.reduce((s, h) => s + h.pending, 0)
  // best rarity multiplier among creatures that actually earned (contract: starts
  // at common ×1.0 and takes the max), used to scale the daily ceiling.
  const bestMult = perCreature.reduce(
    (m, h, i) => (h.earning ? Math.max(m, creatures[i].earnMult || 1) : m),
    1,
  )
  const cap = ctx.capScalesRarity ? Math.floor(ctx.dailyEggCap * bestMult) : ctx.dailyEggCap
  const remaining = Math.max(0, cap - ctx.eggHarvestedToday)
  const pending = Math.min(gross, remaining)

  const earningCount = perCreature.filter((h) => h.earning).length
  const sleepingCount = perCreature.filter((h) => h.reason === 'sleeping').length
  const idleCount = creatures.filter((c) => c.stage >= 1).length - earningCount
  return {
    pending,
    gross,
    cap,
    harvestedToday: ctx.eggHarvestedToday,
    remaining,
    capReached: remaining === 0,
    earningCount,
    idleCount,
    sleepingCount,
    capped: gross > remaining,
    perCreature,
  }
}
