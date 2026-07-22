/**
 * Claim Reward — a read-side mirror of the contract's `claimreward` action
 * (contract/pockethatch/pockethatch.cpp).
 *
 * The contract runs seven gates in order and aborts on the first failure. A tap that
 * fails on chain costs the player a wallet round-trip and tells them nothing, so this
 * evaluates the same gates against live chain state BEFORE the tap and returns the one
 * reason the claim is blocked — plus the exact payout the claim would pay right now.
 *
 * Every number here is read from chain, never assumed:
 *   payout  ← the contract's base[] table (the only hard-coded scale, see PAYOUT_BY_STAGE)
 *   season  ← configv3.season_index
 *   cooldown← configv3.harvest_cd
 *   claimed ← claims row (last_claimed / claimed_season)
 *   pool    ← rewardpool.balance
 *   fed gate← creature.last_fed + fed_dur(rarity) vs chain head time
 */

/**
 * HATCH paid per claim, indexed by the player's HIGHEST creature stage.
 *
 * Mirrors `uint64_t base[] = {0, 0, 15, 25, 45, 85}` in claimreward (the contract
 * multiplies by 10^4 for HATCH's precision; the UI shows whole tokens). Stage is
 * clamped to 5 exactly as the contract does with std::min((int)highest_stage, 5).
 *
 * NOTE: the payout does NOT scale with rarity — earn_mult applies to EGG yield only.
 */
export const PAYOUT_BY_STAGE = [0, 0, 15, 25, 45, 85] as const

/** The stage the contract requires before a claim qualifies (2 = Juvenile). */
export const MIN_CLAIM_STAGE = 2

/** Why a claim is blocked. `null` in ClaimState.blocked means it is claimable now. */
export type ClaimBlock =
  | 'paused'          // config.paused — game halted
  | 'no-season'       // config.season_index == 0, no active season
  | 'claimed'         // already claimed this season (one claim per season)
  | 'cooldown'        // within harvest_cd of the last claim
  | 'stage'           // no creature at stage >= 2
  | 'unfed'           // owns a Juvenile+ but nothing is currently fed
  | 'pool-empty'      // rewardpool.balance < payout

export interface ClaimCreature {
  stage: number
  /** Unix seconds of the last feed (0 = never fed). */
  lastFed: number
  /** fed_dur (seconds) for this creature's rarity — configv3.fed_dur_*. */
  fedDur: number
}

export interface ClaimInput {
  creatures: ClaimCreature[]
  /** Chain head time in unix seconds — never client Date.now() for the gates. */
  now: number
  /** configv3.season_index (0 = no active season). */
  currentSeason: number
  /** claims.claimed_season for this player (0 = never claimed). */
  claimedSeason: number
  /** claims.last_claimed for this player (0 = never claimed). */
  lastClaimed: number
  /** configv3.harvest_cd — the cooldown claimreward shares with harvest. */
  harvestCd: number
  /** rewardpool.balance in whole HATCH. */
  poolBalance: number
  /** configv3.paused. */
  paused: boolean
}

export interface ClaimState {
  /** Whole HATCH this claim pays right now (0 when no qualifying creature). */
  payout: number
  /** The highest stage across owned creatures — what the payout is priced on. */
  highestStage: number
  /** How many creatures are currently fed (the satiety gate). */
  fedCount: number
  /** Seconds until the cooldown clears (0 when not on cooldown). */
  cooldownLeft: number
  /** The single reason a claim is blocked, or null when claimable. */
  blocked: ClaimBlock | null
  /** True when every gate passes — the button may broadcast. */
  claimable: boolean
  /** HATCH the pool still holds — surfaced so "pool empty" is never a guess. */
  poolBalance: number
  /** The payout at the NEXT stage up, for the "grow to earn more" hint (0 at max). */
  nextStagePayout: number
}

/**
 * Evaluate every claimreward gate in the contract's own order, so the reason the UI
 * shows is the reason the chain would give.
 */
export function computeClaim(input: ClaimInput): ClaimState {
  const { creatures, now, currentSeason, claimedSeason, lastClaimed, harvestCd, poolBalance, paused } = input

  const highestStage = creatures.reduce((max, c) => Math.max(max, c.stage), 0)
  const fedCount = creatures.filter((c) => c.lastFed > 0 && now < c.lastFed + c.fedDur).length

  const payIdx = Math.min(highestStage, PAYOUT_BY_STAGE.length - 1)
  const payout = PAYOUT_BY_STAGE[payIdx] ?? 0
  const nextStagePayout = payIdx < PAYOUT_BY_STAGE.length - 1 ? PAYOUT_BY_STAGE[payIdx + 1] : 0

  // Already claimed this season → no cooldown to count down; the season is the gate.
  const claimedThisSeason = currentSeason > 0 && claimedSeason >= currentSeason
  const cooldownLeft = claimedThisSeason
    ? 0
    : Math.max(0, lastClaimed + (harvestCd || 0) - now)

  // Contract gate order — first failure wins, so the player fixes the real blocker.
  let blocked: ClaimBlock | null = null
  if (paused) blocked = 'paused'
  else if (currentSeason <= 0) blocked = 'no-season'
  else if (claimedThisSeason) blocked = 'claimed'
  else if (cooldownLeft > 0) blocked = 'cooldown'
  else if (highestStage < MIN_CLAIM_STAGE) blocked = 'stage'
  else if (fedCount === 0) blocked = 'unfed'
  else if (poolBalance < payout) blocked = 'pool-empty'

  return {
    payout,
    highestStage,
    fedCount,
    cooldownLeft,
    blocked,
    claimable: blocked === null,
    poolBalance,
    nextStagePayout,
  }
}
