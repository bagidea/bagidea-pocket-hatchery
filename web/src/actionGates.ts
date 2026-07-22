/**
 * actionGates.ts — client-side mirrors of the contract's feed() and evolve()
 * pre-checks, so the UI can say WHY a button is blocked instead of letting the
 * player fire a tx and read a raw chain assertion.
 *
 * Every gate here maps 1:1 to a `check(...)` in pockethatch.cpp. Verified against
 * the deployed source + live configv3 on phgamecreatr (2026-07-19):
 *
 *   feed()   pockethatch.cpp:431
 *     check(!cfg.paused)                              → "game paused"
 *     check(now >= last_fed + cfg.feed_cd)            → "feed on cooldown"       (feed_cd 21600)
 *     check(p.feeds_today < cfg.feed_daily_cap)       → "feed daily cap reached" (cap 3, PLAYER-wide)
 *
 *   evolve() pockethatch.cpp:490
 *     check(!cfg.paused)                              → "game paused"
 *     check(now < last_fed + fed_dur(rarity))         → "creature is hungry — feed before evolving"
 *     check(cur_stage < sp.max_stage)                 → "already max stage"
 *     check(growth >= sp.threshold_for(cur_stage))    → "insufficient growth to evolve"
 *     check(egg_balance >= cfg.evolve_cost*(stage+1)) → "insufficient EGG to evolve"
 *
 * ⚠️ Evolve is paid in **EGG**, not HATCH — cfg.evolve_cost is a raw uint64 EGG
 * count (like hatch_cost/slot_cost), and the deduction comes off
 * `player_row.egg_balance`. Only breed_cost / name_cost / burn_base_hatch are
 * HATCH asset strings. The cost also SCALES with the current stage:
 * `evolve_cost × (stage + 1)` — a stage-1 creature costs 600 EGG at evolve_cost 300.
 *
 * Pure logic — no React, no chain calls. Feed it live numbers; it returns what to
 * show. `now` should be chain head time where available (chain.ts getChainTime).
 */

/** Seconds per on-chain day — mirrors the contract's DAY_SEC. */
export const DAY_SEC = 86400

/** Unix seconds of the next UTC-midnight daily reset (feeds_today / harvest quota). */
export function nextDailyResetAt(now: number): number {
  return (Math.floor(now / DAY_SEC) + 1) * DAY_SEC
}

/** Seconds until the daily counters roll over. */
export function secondsToDailyReset(now: number): number {
  return Math.max(0, nextDailyResetAt(now) - now)
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export type FeedBlock = 'ok' | 'paused' | 'asleep' | 'cooldown' | 'daily-cap'

export interface FeedGate {
  allowed: boolean
  /** The ONE blocker the chain would hit first, in the contract's own order. */
  reason: FeedBlock
  /** Seconds left on this creature's feed cooldown (0 = ready). */
  cooldownLeft: number
  /** players.feeds_today, day-reset applied (chain.ts effectiveDailyCounters). */
  feedsToday: number
  /** configv3.feed_daily_cap. */
  feedDailyCap: number
  /** Feeds left today, account-wide. */
  feedsLeft: number
  /** Seconds until the daily feed quota resets (UTC midnight). */
  resetIn: number
}

export interface FeedGateInput {
  now: number
  /** creature_row.last_fed (0 = never). */
  lastFed: number
  /** configv3.feed_cd (seconds between feeds on ONE creature). */
  feedCd: number
  /** Stage 0 = still asleep; the contract has no feed path that helps it yet. */
  stage: number
  feedsToday: number
  feedDailyCap: number
  paused?: boolean
}

export function computeFeedGate(i: FeedGateInput): FeedGate {
  const cap = Math.max(0, i.feedDailyCap)
  const used = Math.max(0, i.feedsToday)
  const cooldownLeft = i.lastFed > 0 ? Math.max(0, i.lastFed + i.feedCd - i.now) : 0
  const base = {
    cooldownLeft,
    feedsToday: used,
    feedDailyCap: cap,
    feedsLeft: Math.max(0, cap - used),
    resetIn: secondsToDailyReset(i.now),
  }
  const blocked = (reason: FeedBlock): FeedGate => ({ allowed: false, reason, ...base })

  if (i.paused) return blocked('paused')
  if (i.stage === 0) return blocked('asleep')
  // Contract order: cooldown is checked before the daily cap.
  if (cooldownLeft > 0) return blocked('cooldown')
  if (cap > 0 && used >= cap) return blocked('daily-cap')
  return { allowed: true, reason: 'ok', ...base }
}

// ── Evolve ───────────────────────────────────────────────────────────────────
export type EvolveBlock = 'ok' | 'paused' | 'max-stage' | 'hungry' | 'growth' | 'egg'

export interface EvolveGate {
  allowed: boolean
  reason: EvolveBlock
  /** EGG the contract deducts: configv3.evolve_cost × (stage + 1). NOT HATCH. */
  cost: number
  eggBalance: number
  /** EGG still missing (0 when affordable). */
  eggShort: number
  growth: number
  /** speciescfg.threshold_for(stage) — the growth needed for the next stage. */
  growthNeeded: number
  growthShort: number
  /** Seconds of satiety left; 0 = hungry, which the contract refuses. */
  fedLeft: number
}

export interface EvolveGateInput {
  now: number
  stage: number
  /**
   * Terminal stage — speciescfg.max_stage VERBATIM (it is a stage NUMBER, not a
   * count). The contract allows evolve while `stage < max_stage`, so with
   * max_stage = 5 a stage-4 creature still evolves and only stage 5 is MAX.
   */
  maxStage: number
  growth: number
  /** creature.growthToNext — speciescfg.threshold_for(stage). */
  growthToNext: number
  lastFed: number
  /** fed_dur for this creature's rarity (configv3.fed_dur_*). */
  fedDur: number
  /** Player's EGG balance (players.egg_balance). */
  egg: number
  /** configv3.evolve_cost — the PER-STAGE-1 base, multiplied by (stage + 1). */
  evolveCost: number
  paused?: boolean
}

export function computeEvolveGate(i: EvolveGateInput): EvolveGate {
  const cost = Math.max(0, i.evolveCost) * (i.stage + 1)
  const fedUntil = i.lastFed > 0 ? i.lastFed + i.fedDur : 0
  const fedLeft = Math.max(0, fedUntil - i.now)
  const base = {
    cost,
    eggBalance: i.egg,
    eggShort: Math.max(0, cost - i.egg),
    growth: i.growth,
    growthNeeded: i.growthToNext,
    growthShort: Math.max(0, i.growthToNext - i.growth),
    fedLeft,
  }
  const blocked = (reason: EvolveBlock): EvolveGate => ({ allowed: false, reason, ...base })

  if (i.paused) return blocked('paused')
  // Max stage is checked BEFORE the satiety gate here (the contract checks satiety
  // first). Deliberate: a terminal creature can never evolve, so telling the player
  // to feed it would send them down a road that ends nowhere.
  if (i.stage >= i.maxStage) return blocked('max-stage')
  if (fedLeft <= 0) return blocked('hungry')
  if (i.growth < i.growthToNext) return blocked('growth')
  if (i.egg < cost) return blocked('egg')
  return { allowed: true, reason: 'ok', ...base }
}

// ── Copy ─────────────────────────────────────────────────────────────────────
// English-only: Pocket Hatchery ships to a global audience. One source of truth
// for the blocked-reason wording so the button label, the tooltip and the toast
// never drift apart.

/** Short duration for player-facing copy ("6h 12m", "45s"). */
export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function feedBlockMessage(g: FeedGate): string {
  switch (g.reason) {
    case 'ok':
      return 'Ready to feed'
    case 'paused':
      return 'The game is paused on chain — no actions can run right now'
    case 'asleep':
      return 'This creature is still asleep — wake it first'
    case 'cooldown':
      return `This creature was fed recently — you can feed it again in ${fmtDuration(g.cooldownLeft)}`
    case 'daily-cap':
      return `Daily feed limit reached (${g.feedsToday}/${g.feedDailyCap} feeds used across your account) — resets in ${fmtDuration(g.resetIn)}`
  }
}

export function evolveBlockMessage(g: EvolveGate): string {
  switch (g.reason) {
    case 'ok':
      return `Ready to evolve — costs ${g.cost.toLocaleString()} EGG`
    case 'paused':
      return 'The game is paused on chain — no actions can run right now'
    case 'max-stage':
      return 'Already at max stage — this creature cannot evolve further'
    case 'hungry':
      return 'Too hungry to evolve — feed it first, then evolve while it is still fed'
    case 'growth':
      return `Needs ${g.growthNeeded.toLocaleString()} growth to evolve — it has ${g.growth.toLocaleString()}`
    case 'egg':
      return `Requires ${g.cost.toLocaleString()} EGG — you have ${g.eggBalance.toLocaleString()} EGG (EGG is the farm currency; $HATCH cannot pay for Evolve)`
  }
}

/**
 * Longest creature name the contract will accept:
 *
 *   setname() pockethatch.cpp
 *     check(new_name.size() <= 32)                    → "name too long (max 32 bytes)"
 *
 * `std::string::size()` counts BYTES, not characters. A `maxLength={32}` input
 * counts UTF-16 units, so "🐉" (4 bytes) or a Thai name would sail past the UI
 * and get bounced by the chain after the player had already signed. Mirrored
 * here in bytes so the cap is the same one the contract enforces.
 */
export const MAX_CREATURE_NAME_BYTES = 32

const nameEncoder = new TextEncoder()

/** UTF-8 byte length — the unit `setname` actually limits. */
export function creatureNameBytes(name: string): number {
  return nameEncoder.encode(name).length
}

/**
 * Trim a name to what `setname` will take. Cuts whole code points (Array.from
 * iterates by code point, so an emoji's surrogate pair is never split into two
 * broken halves) and therefore never produces a mangled trailing character.
 */
export function clampCreatureName(name: string): string {
  if (creatureNameBytes(name) <= MAX_CREATURE_NAME_BYTES) return name
  let out = ''
  for (const cp of Array.from(name)) {
    if (creatureNameBytes(out + cp) > MAX_CREATURE_NAME_BYTES) break
    out += cp
  }
  return out
}
