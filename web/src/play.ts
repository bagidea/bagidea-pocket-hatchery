import { speciesNameFromGene } from './geneDecoder'

/**
 * play.ts — the gameplay logic seam for Pocket Hatchery.
 *
 * This is the ONE module the UI imports (App.tsx: `const game = useGameActions()`).
 * It owns three things and nothing else:
 *   1. wallet connect/disconnect   → TWO backends:
 *        'wcw'     — WAX Cloud Wallet / Anchor via @wharfkit/session (a public
 *                    player signs in their own browser wallet).
 *        'waxwing' — the office daemon wallet via waxwing.ts (internal: the game
 *                    drives waxwing status/account/balance + pushaction).
 *   2. gameplay actions             → a unified GameSigner (both backends build the
 *                                      exact same {account, action, data}; only the
 *                                      signer differs) signs + broadcasts to the
 *                                      game contract on the active network.
 *   3. re-reading live chain state  → chain.ts (RPC reads → resources + creatures),
 *                                      reused by both connect modes for consistency.
 *
 * This is PURE LOGIC — no JSX, no CSS, no layout. Monanisa owns presentation; she
 * calls these functions and renders the returned state. Keep that seam clean.
 *
 * Contract: phgamecreatr @ wax-testnet (RPC eosphere.io), table configv3. The
 * active network follows ?network= (default wax-testnet). ABI-verified 2026-07-02
 * — every action signature matches the deployed ABI exactly. Live proof in
 * scripts/verify-play.mjs (WCW shape) + scripts/verify-waxwing-connect.mjs
 * (waxwing round-trip).
 *
 * STATUS (2026-07-02): initplayer + harvest work LIVE (real txids). hatch is
 * blocked by a CONTRACT bug (mint_creature reads back an inline-minted asset
 * before the inline action runs) — web layer is correct; see
 * docs/HATCH-RESOLVE-ROOT-CAUSE.md. Kevin owns the source fix.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@wharfkit/session'
import { login, restore, logout } from './wallet'
import { getContract } from './contract'
import { isPlayable, getActiveNetwork } from './network'
import { waxwingStatus, ensureNetwork, waxwingAccount, waxwingBuildAction, waxwingWaitForIntent, waxwingCancel, openWaxwingPanel, type WaxwingIntent } from './waxwing'
import {
  fetchGameState,
  getTokenBalance,
  effectiveDailyCounters,
  type ChainConfig,
  type ClaimRow,
  type CreatureRow,
  type PlayerRow,
  type RewardPoolRow,
  type SpeciesRow,
} from './chain'
import { fedDurFor, BASE_EARN_BY_STAGE } from './satiety'
import { awakenDurFor, waxWhole } from './awaken'
import {
  computeFeedGate,
  computeEvolveGate,
  feedBlockMessage,
  evolveBlockMessage,
  clampCreatureName,
} from './actionGates'

export type ConnectMode = 'wcw' | 'waxwing'

// ── UI-facing shapes (must match what App.tsx + CreatureCard consume) ─────────
export interface Resources {
  egg: number
  energy: number
  maxEnergy: number
  hatch: number
  /** Unix seconds of last harvest (0 = never). */
  lastHarvest: number
  /** Unix seconds of last claimreward (0 = never). */
  lastClaimed: number
  /** Cooldown in seconds between harvest / claimreward actions. */
  harvestCd: number
  /** Season index the player last claimed in (0 = never). */
  claimedSeason: number
  /** Current season index from config. */
  currentSeason: number
  /** Max hours of offline earning credited per harvest (configv3.offline_cap_h). */
  offlineCapH: number
  /** Base daily EGG ceiling (configv3.daily_egg_cap). */
  dailyEggCap: number
  /** Whether the daily ceiling scales by best owned rarity (configv3.cap_scales_rarity). */
  capScalesRarity: boolean
  /** EGG already harvested toward today's cap (player.egg_harvested_today). */
  eggHarvestedToday: number
  /** HATCH left in the shared reward pool (rewardpool.balance) — claimreward pays from it. */
  poolBalance: number
  /** Whether the game is halted on chain (configv3.paused) — every action is refused. */
  paused: boolean
  /** Feeds already spent today, account-wide (players.feeds_today, day-reset applied). */
  feedsToday: number
  /** configv3.feed_daily_cap — the account-wide feed ceiling per UTC day. */
  feedDailyCap: number
  /** configv3.evolve_cost — base EGG per evolve; the chain charges × (stage + 1). NOT HATCH. */
  evolveCost: number
  /** Chain head time (unix seconds) from the last read — authoritative for day boundaries. */
  now: number
}

// On-chain rarity = speciescfg.egg_type (0–5). Six tiers.
// 0=common, 1=uncommon, 2=rare, 3=epic, 4=legendary, 5=mythic.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface Creature {
  assetId: string
  name: string
  /**
   * The player-given name, read from the NFT's own MUTABLE data (what `setname`
   * writes via atomicassets::setassetdata) — NOT a local preference. Absent =
   * never named; every surface then falls back to `name` (the species).
   *
   * Because it lives on the asset, it is the same on the card, in the farm, in a
   * wallet, and on a marketplace listing — and it follows the creature on trade.
   */
  nickname?: string
  species: string
  stage: number
  maxStage: number
  rarity: Rarity
  growth: number
  growthToNext: number
  /** 64-char hex genetics string (checksum256 from chain) */
  genetics: string
  /** Unix seconds of the last feed (chain: creature_row.last_fed). 0 = never. Feed-v2 satiety clock. */
  lastFed: number
  /** Unix seconds of the parent's last breed; 0 = never bred. */
  lastBred: number
  /** Breed cooldown duration in seconds (from config.breed_cd). */
  breedCooldown: number
  /** fed_dur (seconds) for this creature's rarity — configv3.fed_dur_* (or spec default). */
  fedDur: number
  /** Min seconds between feeds (configv3.feed_cd) — the SatietyMeter cooldown. */
  feedCd: number
  /** Unix seconds the creature hatched (chain: creature_row.born_at). Awaken-v2 sleep clock. */
  bornAt: number
  /** awaken_dur (seconds) for this rarity — configv3.awaken_dur_* (or spec default). Sleep length. */
  awakenDur: number
  /** WAX wake cost as an asset string ("3.00000000 WAX") — configv3.wake_cost_*. The transfer quantity. */
  wakeCost?: string
  /** WAX wake cost in whole units (3, 5, 10…) for the button label. */
  wakeCostWax?: number
  /** Chain-real full-satiety earn (EGG/hr): speciescfg.yield_for(stage) × configv3.earn_mult. */
  earnFull?: number
  /** Total rarity earn premium vs a common at this stage (for the "×N" badge). */
  earnMult?: number
}

export interface LastAction {
  ok: boolean
  label: string
  error?: string
  /** true when waxwing wallet is locked — UI should open waxwing panel instead of showing an error toast. */
  needsUnlock?: boolean
}

/**
 * A sign-intent awaiting the player's tap. In 'waxwing' mode, every gameplay
 * action first builds an intent (NO broadcast); the UI shows this summary in an
 * amber Sign popup, and only `confirmPending()` (player taps Sign) broadcasts.
 * `cancelPending()` drops it. WCW mode needs no popup — the browser wallet
 * pops its own. This is the CEO rule: no player action broadcasts without a tap.
 */
export interface PendingSign {
  intent: WaxwingIntent
  label: string
}

// Human-readable summary per action for the Sign popup. Costs follow the live
// config (hatch/evolve); shown as a hint, the on-chain truth is the action data.
const ACTION_LABEL: Record<string, string> = {
  initplayer: 'Init Player',
  hatch: 'Hatch Egg',
  firsthatch: 'First Hatch',
  feed: 'Feed',
  evolve: 'Evolve',
  breed: 'Breed',
  accelerate: 'Accelerate Growth',
  harvest: 'Harvest EGG',
  claimreward: 'Claim HATCH Reward',
  burncreature: 'Burn Creature',
  setname: 'Rename Creature (on chain)',
  transfer: 'Wake Creature (WAX)',
}


/**
 * What a gameplay action resolves to. Every action calls `run(...)`, which returns
 * `{ ok, txid? }`; the ones gated by a client-side pre-check (cooldown, missing
 * creature) also resolve `void` on the early-return path. Callers may inspect `ok`
 * (hatch does) or fire-and-forget — the value is optional. Typed honestly rather
 * than as `Promise<void>`: the actions genuinely return a result, and leaning on
 * the void-return leniency proved brittle under this module's import cycle +
 * strictFunctionTypes (it silently flipped once a second action — hatch — was
 * typed honestly, turning every remaining `Promise<void>` action into an error).
 */
export type ActionResult = { ok: boolean; txid?: string } | void

export interface GameActions {
  connectWallet: (mode?: ConnectMode) => Promise<void>
  disconnectWallet: () => Promise<void>
  hatch: (eggType?: number) => Promise<{ ok: boolean; txid?: string }>
  feed: (assetId: string) => Promise<ActionResult>
  /** Wake a sleeping (stage 0) creature early by paying WAX (Awaken v2). */
  awaken: (assetId: string) => Promise<ActionResult>
  evolve: (assetId: string) => Promise<ActionResult>
  breed: (parentA: string, parentB: string) => Promise<ActionResult>
  accelerate: (assetId: string, amount: string) => Promise<ActionResult>
  /** Permanently destroy a creature (burncreature). Irreversible — gate behind a UI confirm. */
  burn: (assetId: string) => Promise<ActionResult>
  /** Write a creature's name into its NFT mutable data on chain (setname). '' clears it. */
  rename: (assetId: string, newName: string) => Promise<ActionResult>
  /** assetId whose rename tx is in flight (signing + post-action poll), else null. */
  renamingId: string | null
  harvest: () => Promise<ActionResult>
  claimReward: () => Promise<ActionResult>
  refresh: () => Promise<void>
  confirmPending: () => Promise<void>
  cancelPending: () => void
  resources: Resources
  creatures: Creature[]
  animating: boolean
  lastAction: LastAction | null
  pendingSign: PendingSign | null
  connectMode: ConnectMode | null
  connectedAs: string | null
  /** Live hatch cost in whole EGG units (from config.hatch_cost). */
  hatchCost: number | null
  /** Live breed cost in whole HATCH units (parsed from config.breed_cost). */
  breedCost: number | null
  /** Live rarity odds + earn premium for one hatch (from configv3 weights). */
  hatchOdds: HatchOdds[]
}

const EMPTY_RESOURCES: Resources = { egg: 0, energy: 0, maxEnergy: 0, hatch: 0, lastHarvest: 0, lastClaimed: 0, harvestCd: 0, claimedSeason: 0, currentSeason: 0, offlineCapH: 0, dailyEggCap: 0, capScalesRarity: false, eggHarvestedToday: 0, poolBalance: 0, paused: false, feedsToday: 0, feedDailyCap: 0, evolveCost: 0, now: 0 }

// speciescfg.egg_type (0–5) → display rarity. Matches CreatureCard's union.
const RARITY_BY_EGG_TYPE: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

/** Resolve the live fed_dur (seconds) for a rarity from configv3, or spec default. */
function fedDurFromConfig(cfg: ChainConfig | null, rarity: Rarity): number {
  const live: Record<Rarity, number | undefined> = {
    common: cfg?.fed_dur_common,
    uncommon: cfg?.fed_dur_uncommon,
    rare: cfg?.fed_dur_rare,
    epic: cfg?.fed_dur_epic,
    legendary: cfg?.fed_dur_legendary,
    mythic: cfg?.fed_dur_mythic,
  }
  return fedDurFor(rarity, undefined, live[rarity])
}

/** Resolve the live awaken_dur (seconds) for a rarity from configv3, or spec default. */
function awakenDurFromConfig(cfg: ChainConfig | null, rarity: Rarity): number {
  const live: Record<Rarity, number | undefined> = {
    common: cfg?.awaken_dur_common,
    uncommon: cfg?.awaken_dur_uncommon,
    rare: cfg?.awaken_dur_rare,
    epic: cfg?.awaken_dur_epic,
    legendary: cfg?.awaken_dur_legendary,
    mythic: cfg?.awaken_dur_mythic,
  }
  return awakenDurFor(rarity, live[rarity])
}

/**
 * Resolve the live WAX wake cost for a rarity from configv3. Returns the asset
 * string ("3.00000000 WAX") the transfer quantity must equal exactly, plus the
 * whole-WAX number for the button. Undefined config → spec fallback string.
 */
function wakeCostFromConfig(cfg: ChainConfig | null, rarity: Rarity): { asset: string; wax: number } {
  const live: Record<Rarity, string | undefined> = {
    common: cfg?.wake_cost_common,
    uncommon: cfg?.wake_cost_uncommon,
    rare: cfg?.wake_cost_rare,
    epic: cfg?.wake_cost_epic,
    legendary: cfg?.wake_cost_legendary,
    mythic: cfg?.wake_cost_mythic,
  }
  const asset = live[rarity]
  if (asset) return { asset, wax: waxWhole(asset) }
  // Fallback (configv3 lacks the field): mirror WAKE_COST_WAX_DEFAULT as a WAX-8
  // asset string so a wake built off the fallback still validates on chain.
  const fallback: Record<Rarity, number> = { common: 3, uncommon: 5, rare: 10, epic: 20, legendary: 40, mythic: 80 }
  const wax = fallback[rarity] ?? 3
  return { asset: `${wax.toFixed(8)} WAX`, wax }
}

// Fallback total premium when a creature has no species row / is at egg stage —
// mirrors satiety.ts RARITY_EARN_MULT so demo and edge cases stay consistent.
const RARITY_MULT_FALLBACK: Record<Rarity, number> = {
  common: 1.0, uncommon: 1.21, rare: 1.96, epic: 3.24, legendary: 5.76, mythic: 10.89
}

// Hatch odds shown on the CTA. Every hatch costs the same flat EGG (hatch_cost);
// what varies is the rarity you ROLL. Surfacing the odds + the harvest premium is
// what makes chasing Rare worth it (higher earn_mult = more EGG farmed per feed).
export interface HatchOdds {
  rarity: Rarity
  pct: number      // % chance of rolling this tier (may be fractional, e.g. 0.45)
  earnMult: number // harvest EGG yield multiplier vs common (×)
}

// On-chain governance defaults — LOCKED 6-tier numbers (RARITY-6TIER-SPEC §1):
// rarity_w 6900/2000/800/250/45/5 (bp, /10000) · earn_mult ×1.0/1.1/1.4/2.0/3.2/5.0.
// These stand in until chain configv3 carries the 6-tier fields; the connected
// dashboard overrides per-field from live configv3 where present.
const RARITY_WEIGHT_DEFAULT: Record<Rarity, number> = {
  common: 6900, uncommon: 2000, rare: 800, epic: 250, legendary: 45, mythic: 5
}
const EARN_MULT_DEFAULT: Record<Rarity, number> = {
  common: 1.0, uncommon: 1.1, rare: 1.4, epic: 2.0, legendary: 3.2, mythic: 5.0
}

/** Build the hatch-odds list live from configv3, falling back to spec defaults. */
export function hatchOddsFromConfig(cfg: ChainConfig | null): HatchOdds[] {
  const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
  const weight: Record<Rarity, number> = {
    common: cfg?.rarity_w_common ?? RARITY_WEIGHT_DEFAULT.common,
    uncommon: cfg?.rarity_w_uncommon ?? RARITY_WEIGHT_DEFAULT.uncommon,
    rare: cfg?.rarity_w_rare ?? RARITY_WEIGHT_DEFAULT.rare,
    epic: cfg?.rarity_w_epic ?? RARITY_WEIGHT_DEFAULT.epic,
    legendary: cfg?.rarity_w_legendary ?? RARITY_WEIGHT_DEFAULT.legendary,
    mythic: cfg?.rarity_w_mythic ?? RARITY_WEIGHT_DEFAULT.mythic,
  }
  const total = Object.values(weight).reduce((a, b) => a + b, 0) || 1
  const earnBp: Record<Rarity, number | undefined> = {
    common: cfg?.earn_mult_common,
    uncommon: cfg?.earn_mult_uncommon,
    rare: cfg?.earn_mult_rare,
    epic: cfg?.earn_mult_epic,
    legendary: cfg?.earn_mult_legendary,
    mythic: cfg?.earn_mult_mythic,
  }
  return RARITIES.map((r) => ({
    rarity: r,
    // Keep fractional precision — the rare top tiers are sub-1% (Legendary 0.45%,
    // Mythic 0.05%) and Epic is 2.5%; rounding to whole percent would erase them.
    pct: (weight[r] * 100) / total,
    earnMult: earnBp[r] != null ? earnBp[r]! / 10000 : EARN_MULT_DEFAULT[r],
  }))
}

/** configv3.earn_mult_{rarity} in basis points (×10000). Defaults to ×1.00. */
function earnMultBp(cfg: ChainConfig | null, rarity: Rarity): number {
  const map: Record<Rarity, number | undefined> = {
    common: cfg?.earn_mult_common,
    uncommon: cfg?.earn_mult_uncommon,
    rare: cfg?.earn_mult_rare,
    epic: cfg?.earn_mult_epic,
    legendary: cfg?.earn_mult_legendary,
    mythic: cfg?.earn_mult_mythic,
  }
  const bp = map[rarity]
  return bp && bp > 0 ? bp : 10000
}

/**
 * Chain-real full-satiety earn (EGG/hr) for one creature, mirroring the deployed
 * harvest() exactly: `speciescfg.yield_for(stage) × configv3.earn_mult / 10000`.
 * The species yields already carry a per-tier ratio AND earn_mult multiplies on
 * top (compounding — see satiety.ts RARITY_EARN_MULT). Reading the species' OWN
 * yields here (not a common-base reconstruction) keeps the card correct even for
 * per-stage yield curves or on-chain retunes. Stage 0 (egg) earns nothing.
 *
 * Returns { earnFull, earnMult } where earnMult is the total premium vs a common
 * at the same stage (BASE_EARN_BY_STAGE), for the "×N" badge.
 */
function earnFromChain(sp: SpeciesRow | undefined, stage: number, cfg: ChainConfig | null, rarity: Rarity): { earnFull: number; earnMult: number } {
  if (!sp || stage <= 0) return { earnFull: 0, earnMult: RARITY_MULT_FALLBACK[rarity] }
  // harvest() does `idx_yield = stage − 1; yield_for(idx_yield)`, so stage 1 pays
  // yield_0 … stage 5 pays yield_4. sp.yield_5 is deliberately NOT in this array:
  // it would only ever be read at stage 6, which max_stage = 5 forbids.
  const yields = [sp.yield_0, sp.yield_1, sp.yield_2, sp.yield_3, sp.yield_4]
  const stageYield = yields[Math.min(stage, yields.length) - 1] ?? 0 // stage 1 → yield_0
  const earnFull = (stageYield * earnMultBp(cfg, rarity)) / 10000
  const commonBase = BASE_EARN_BY_STAGE[Math.min(stage, BASE_EARN_BY_STAGE.length - 1)] ?? 0
  const earnMult = commonBase > 0 ? earnFull / commonBase : RARITY_MULT_FALLBACK[rarity]
  return { earnFull, earnMult }
}

/**
 * Pull a readable message out of a WharfKit/contract/waxwing error. EOSIO
 * assertion failures arrive wrapped as `assertion failure with message: <msg>`;
 * unwrap that so the UI can show e.g. "insufficient EGG to hatch" not a stack.
 */
function readableError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/assertion failure with message:\s*(.+?)["']?\s*$/i)
  if (m) return m[1].replace(/^["']|["']$/g, '')
  return msg.split('\n')[0].slice(0, 160)
}

// ── Mapping: on-chain rows → UI shapes ────────────────────────────────────────
// Mirrors species_row::threshold_for(idx) — the growth needed to leave `stage`
// for stage+1. idx 0 → thresh_1 … idx 4 → thresh_5, so a stage-4 creature needs
// thresh_5 (NOT thresh_4) to reach its terminal stage 5.
function thresholdForStage(sp: SpeciesRow | undefined, stage: number): number {
  if (!sp) return 0
  const thresholds = [sp.thresh_1, sp.thresh_2, sp.thresh_3, sp.thresh_4, sp.thresh_5]
  return thresholds[Math.min(stage, thresholds.length - 1)] ?? 0
}

function toCreature(
  row: CreatureRow,
  species: SpeciesRow[],
  breedCd: number,
  cfg: ChainConfig | null,
  nftName?: string,
): Creature {
  const sp = species.find((s) => s.template_id === row.template_id)
  const growth = row.growth_base + row.fed_growth
  // max_stage on chain is the TERMINAL stage NUMBER, not a count: evolve()
  // guards with `check(cur_stage < max_stage)`, so with max_stage = 5 a stage-4
  // creature can still evolve and stage 5 is the real ceiling (thresh_5/yield_5
  // exist on chain for exactly that). Treating it as a count showed MAX one
  // stage early and cost the player their last evolve.
  const isMax = sp ? row.stage >= sp.max_stage : false
  // Real species name from the gene's species_id (bits 0–3), falling back to
  // the chain's speciescfg.family or the old hardcoded default.
  const name = speciesNameFromGene(row.genetics)
  const rarity = RARITY_BY_EGG_TYPE[Math.min(Math.max(sp?.egg_type ?? 0, 0), 5)]
  const earn = earnFromChain(sp, row.stage, cfg, rarity)
  const wake = wakeCostFromConfig(cfg, rarity)
  return {
    assetId: row.asset_id,
    name,
    nickname: nftName || undefined,
    species: sp?.family ?? name,
    stage: row.stage,
    maxStage: Math.max(0, sp?.max_stage ?? 5),
    rarity,
    growth,
    // At max stage the progress UI is hidden; keep growthToNext sane otherwise.
    growthToNext: isMax ? growth : thresholdForStage(sp, row.stage),
    genetics: row.genetics,
    lastFed: row.last_fed ?? 0,
    lastBred: row.last_bred ?? 0,
    breedCooldown: breedCd,
    fedDur: fedDurFromConfig(cfg, rarity),
    feedCd: cfg?.feed_cd ?? 21600,
    bornAt: row.born_at ?? 0,
    awakenDur: awakenDurFromConfig(cfg, rarity),
    wakeCost: wake.asset,
    wakeCostWax: wake.wax,
    earnFull: earn.earnFull,
    earnMult: earn.earnMult,
  }
}

/**
 * The clock the action gates run on: chain head time from the last read (refreshed
 * on the 20s poll, so at most ~20s stale) and only the device clock when nothing
 * has been read yet. Head time is authoritative for the UTC day boundary that
 * decides today's feed quota — a device clock set a day forward must not unlock it.
 */
function chainNow(r: Resources): number {
  return r.now > 0 ? r.now : Math.floor(Date.now() / 1000)
}

/**
 * Parse an Antelope asset string (e.g. "50.0000 HATCH") into a numeric amount.
 * Returns the whole units the UI displays (50), ignoring precision.
 */
function parseAssetAmount(asset: string | undefined): number {
  if (!asset) return 0
  const m = asset.match(/([0-9.]+)\s/)
  return m ? Number(m[1]) : 0
}

/**
 * A compact signature of the mutable on-chain state we render, so a post-action
 * poll can tell when the RPC read node has actually caught up to the block the
 * action landed in (vs. reading the pre-action state from a lagging node). Covers
 * every field an action mutates: player counters/balances, per-creature
 * stage/growth/timers (wake flips stage 0→1, feed bumps last_fed/fed_growth,
 * evolve bumps stage, harvest bumps last_harvest, hatch adds a creature), and the
 * HATCH balance (claimreward). Creatures are sorted by asset_id so ordering from
 * the RPC never changes the signature.
 *
 * NFT names are in here too: `setname` writes ONLY to the NFT's mutable data and
 * touches no contract table, so without them a rename moves nothing in this
 * signature and the post-action poll would spin out its whole budget on every
 * rename instead of stopping the moment the node catches up.
 */
function stateSignature(
  creatures: CreatureRow[],
  player: PlayerRow | null,
  claim: ClaimRow | null,
  hatch: number,
  nftNames: Record<string, string>,
): string {
  const p = player
    ? [
        player.egg_balance,
        player.last_harvest,
        player.harvest_day,
        player.egg_harvested_today,
        player.feeds_today,
        player.feed_day,
        // The claim clock is a separate table — without it a successful claimreward
        // moves nothing in this signature and the post-action poll never settles.
        claim?.last_claimed ?? 0,
        claim?.claimed_season ?? 0,
      ].join(',')
    : 'none'
  const cs = creatures
    .slice()
    .sort((a, b) => (a.asset_id < b.asset_id ? -1 : a.asset_id > b.asset_id ? 1 : 0))
    .map(
      (c) =>
        `${c.asset_id}:${c.stage}:${c.growth_base}:${c.fed_growth}:${c.born_at}:${c.last_fed}:${c.last_bred}:${nftNames[c.asset_id] ?? ''}`,
    )
    .join('|')
  return `${creatures.length}#${p}#${cs}#${hatch}`
}

function toResources(
  cfg: ChainConfig | null,
  player: PlayerRow | null,
  claim: ClaimRow | null,
  rewardPool: RewardPoolRow | null,
  hatchBalance: number,
  now: number,
): Resources {
  // "Energy" = feeds remaining today (feed_daily_cap − feeds_today). This is
  // the on-chain analogue of action energy and matches the live 99/100 read.
  // Both per-day counters are read through effectiveDailyCounters so a UTC-day
  // rollover shows today's fresh quota — the contract resets them lazily, so the
  // raw table still holds yesterday's values until the player next acts. `now` is
  // chain head time (chain.ts fetchGameState), never client Date.now().
  const cap = cfg?.feed_daily_cap ?? 0
  const { eggHarvestedToday, feedsToday } = effectiveDailyCounters(player, now)
  return {
    egg: player?.egg_balance ?? 0,
    energy: Math.max(0, cap - feedsToday),
    maxEnergy: cap,
    hatch: hatchBalance,
    lastHarvest: player?.last_harvest ?? 0,
    // The claim clock lives in the contract-scoped `claims` table, NOT on the player
    // row — reading it off the player silently reads as "never claimed".
    lastClaimed: claim?.last_claimed ?? 0,
    harvestCd: cfg?.harvest_cd ?? 0,
    claimedSeason: claim?.claimed_season ?? 0,
    currentSeason: cfg?.season_index ?? 0,
    offlineCapH: cfg?.offline_cap_h ?? 8,
    dailyEggCap: cfg?.daily_egg_cap ?? 0,
    capScalesRarity: !!cfg?.cap_scales_rarity,
    eggHarvestedToday,
    poolBalance: rewardPool ? parseAssetAmount(rewardPool.balance) : 0,
    paused: !!cfg?.paused,
    feedsToday,
    feedDailyCap: cap,
    evolveCost: cfg?.evolve_cost ?? 0,
    now,
  }
}

// ── Unified signer: both connect backends expose { actor, push } ──────────────
// The action data built by hatch/feed/evolve/... is IDENTICAL for both backends
// ({owner: actor, ...}); only who signs differs. This keeps the play logic blind
// to the wallet choice.
interface GameSigner {
  actor: string
  // `opts.contract` targets a non-game contract (Awaken pays via eosio.token::transfer);
  // `opts.label` overrides the Sign-popup summary. Both default to the game contract /
  // the action's ACTION_LABEL when omitted, so every existing call is unchanged.
  push(
    action: string,
    data: Record<string, unknown>,
    opts?: { contract?: string; label?: string },
  ): Promise<{ txid?: string }>
}

// ── The hook ─────────────────────────────────────────────────────────────────
export function useGameActions(): GameActions {
  // WCW session (only set in 'wcw' mode).
  const [session, setSession] = useState<Session | undefined>(undefined)
  // Waxwing actor (only set in 'waxwing' mode).
  const [waxwingActor, setWaxwingActor] = useState<string | undefined>(undefined)
  const [connectMode, setConnectMode] = useState<ConnectMode | null>(null)
  const [resources, setResources] = useState<Resources>(EMPTY_RESOURCES)
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [animating, setAnimating] = useState(false)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSign | null>(null)
  // The creature whose setname tx is in flight — the card shows "Saving on chain…"
  // until the read node returns the new NFT name (not merely until it broadcasts).
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [breedCost, setBreedCost] = useState<number | null>(null)
  const [hatchCost, setHatchCost] = useState<number | null>(null)
  const [hatchOdds, setHatchOdds] = useState<HatchOdds[]>(() => hatchOddsFromConfig(null))

  // Track the currently-pending intent so cancel/disconnect can drop it.
  // No deferred promise needed — waxwingWaitForIntent polls the daemon, and
  // waxwingCancel + clearing pendingIntentRef is enough to abort the wait.
  const pendingIntentRef = useRef<WaxwingIntent | null>(null)

  // Live refs for creatures/resources so action callbacks read the current state
  // without recreating themselves on every state change.
  const resourcesRef = useRef<Resources>(EMPTY_RESOURCES)
  const creaturesRef = useRef<Creature[]>([])
  const feedBoostRef = useRef<number>(100)
  const configRef = useRef<ChainConfig | null>(null)
  // Signature of the last chain state we successfully read (stateSignature). A
  // post-action poll compares against this to know when the read node has caught
  // up to the block the action landed in.
  const stateSigRef = useRef<string>('')
  resourcesRef.current = resources
  creaturesRef.current = creatures

  // Live refs so async callbacks read the current connection without it being a
  // dependency that re-creates them on every connect.
  const sessionRef = useRef<Session | undefined>(undefined)
  const waxwingActorRef = useRef<string | undefined>(undefined)
  const modeRef = useRef<ConnectMode | null>(null)
  sessionRef.current = session
  waxwingActorRef.current = waxwingActor
  modeRef.current = connectMode

  // The connected actor (the on-chain account we read state for + sign as),
  // regardless of which backend is connected.
  const currentActor = (): string | undefined => {
    if (modeRef.current === 'wcw') {
      const s = sessionRef.current
      return s ? String(s.actor) : undefined
    }
    if (modeRef.current === 'waxwing') return waxwingActorRef.current
    return undefined
  }

  const refresh = useCallback(async () => {
    const actor = currentActor()
    if (!actor) return
    try {
      // Pass the collection we already know (if any) so the NFT-name read filters
      // to OUR assets; on the very first read it falls back to the contract account,
      // which is the collection this game deployed under.
      const state = await fetchGameState(actor, configRef.current?.collection)
      const token = state.config?.token_contract ?? 'hatchtokens1'
      const hatch = await getTokenBalance(token, actor, 'HATCH')
      if (state.config) {
        feedBoostRef.current = state.config.feed_boost || 100
        configRef.current = state.config
        // Keep null when the config field is missing so the UI can show "—"
        // instead of implying a zero-cost action.
        setBreedCost(state.config.breed_cost ? parseAssetAmount(state.config.breed_cost) : null)
        setHatchCost(state.config.hatch_cost ?? null)
        setHatchOdds(hatchOddsFromConfig(state.config))
      }
      setResources(toResources(state.config, state.player, state.claim, state.rewardPool, hatch, state.now))
      const breedCd = state.config?.breed_cd ?? 86400
      setCreatures(
        state.creatures.map((c) =>
          toCreature(c, state.species, breedCd, state.config, state.nftNames[c.asset_id]),
        ),
      )
      // Record the on-chain signature so a post-action poll can detect when the
      // read node has advanced past the pre-action state.
      stateSigRef.current = stateSignature(
        state.creatures,
        state.player,
        state.claim,
        hatch,
        state.nftNames,
      )
    } catch (err) {
      // A read hiccup must not crash the dashboard; surface it softly.
      setLastAction({ ok: false, label: 'Refresh', error: readableError(err) })
    }
  }, [])

  // After an action broadcasts, the RPC read node can still be a block or two
  // behind: a single immediate refresh may read the PRE-action state and leave the
  // HUD stale (looks like the wake/feed/harvest never happened, cooldowns wrong).
  // Poll a few spaced refreshes until the on-chain signature changes from what it
  // was before the action — then stop early — or until the budget (~11s) is spent
  // (the 20s background poll is the final backstop). Each refresh repaints the UI,
  // so the panel updates itself the moment the node catches up.
  const POST_ACTION_POLL_MS = [500, 1200, 2000, 3000, 4000] // cumulative ~10.7s
  const refreshUntilChanged = useCallback(
    async (before: string) => {
      for (const delay of POST_ACTION_POLL_MS) {
        await new Promise((r) => setTimeout(r, delay))
        await refresh()
        if (stateSigRef.current !== before) return // read node caught up — HUD fresh
      }
    },
    [refresh],
  )

  // Live-poll while connected so the HUD reflects on-chain changes (and the
  // result of actions signed from another device/wallet).
  useEffect(() => {
    if (!currentActor()) return
    void refresh()
    const id = setInterval(() => void refresh(), 20000)
    return () => clearInterval(id)
  }, [session, waxwingActor, connectMode, refresh])

  // Build the signer for the active backend. Throws (readably) if not connected.
  const buildSigner = useCallback((): GameSigner => {
    const mode = modeRef.current
    if (mode === 'wcw') {
      const s = sessionRef.current
      if (!s) throw new Error('wallet not connected')
      const c = getContract(s)
      return {
        actor: String(s.actor),
        push: (action, data, opts) => c.push(action, data, opts?.contract).then((r) => ({ txid: r.txid })),
      }
    }
    if (mode === 'waxwing') {
      const actor = waxwingActorRef.current
      if (!actor) throw new Error('wallet not connected')
      // Intent-gated: build an intent (NO broadcast), open the waxwing panel so
      // the player unlocks + signs THERE (not in the game), then poll the daemon
      // until the intent is resolved. The player's tap IN WAXWING is the only
      // thing that ever broadcasts a gameplay action.
      return {
        actor,
        push: async (action, data, opts) => {
          const label = opts?.label ?? ACTION_LABEL[action] ?? action
          const intent = await waxwingBuildAction(action, data, actor, { label, contract: opts?.contract })
          pendingIntentRef.current = intent
          setPendingSign({ intent, label })
          // Open waxwing so the player can unlock + sign in the wallet UI.
          openWaxwingPanel()
          try {
            const result = await waxwingWaitForIntent(intent.id)
            return result
          } finally {
            pendingIntentRef.current = null
            setPendingSign(null)
          }
        },
      }
    }
    throw new Error('wallet not connected')
  }, [])

  // Run one signed gameplay action through the active backend, then refresh
  // state. Catches contract/wallet errors into `lastAction` instead of throwing
  // — the UI shows the message; the game stays usable.
  const run = useCallback(
    async (label: string, fn: (s: GameSigner) => Promise<{ txid?: string }>) => {
      setAnimating(true)
      try {
        const signer = buildSigner() // throws if not connected → caught below
        // Snapshot the chain state BEFORE broadcasting so the post-action poll can
        // detect the exact block the action lands in (guards against a lagging RPC
        // read node returning stale rows on the first refresh).
        const beforeSig = stateSigRef.current
        const r = await fn(signer)
        const tail = r.txid ? ` · ${r.txid.slice(0, 10)}…` : ''
        setLastAction({ ok: true, label: `${label}${tail}` })
        // Poll until the read node reflects the tx (not a single stale read).
        await refreshUntilChanged(beforeSig)
        return { ok: true as const, txid: r.txid }
      } catch (err) {
        const msg = readableError(err)
        if (msg === 'cancelled') {
          setLastAction({ ok: false, label: `${label} — Cancelled` })
        } else if (/locked|LOCKED/.test(msg) && modeRef.current === 'waxwing') {
          // Wallet locked → signal the UI to open waxwing panel instead of showing an error toast.
          setLastAction({ ok: false, label, error: msg, needsUnlock: true })
        } else if (/fetch|network|ECONN|timeout|ENOTFOUND/i.test(msg)) {
          // waxwing daemon unreachable → show a clear error (the real error case).
          setLastAction({ ok: false, label, error: 'Cannot reach waxwing — please open the waxwing wallet panel first' })
        } else {
          setLastAction({ ok: false, label, error: msg })
        }
        return { ok: false as const }
      } finally {
        setAnimating(false)
      }
    },
    [refreshUntilChanged, buildSigner],
  )

  const connectWallet = useCallback(
    async (mode: ConnectMode = 'wcw') => {
      // Mainnet is wired in config but the game contract is not deployed there
      // yet (Kevin). Block connect with a clear message — testnet only for now.
      if (!isPlayable()) {
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'mainnet game contract not deployed yet — use ?network=wax-testnet',
        })
        return
      }

      if (mode === 'wcw') {
        // restore() re-attaches an existing session; login() pops WCW/Anchor and
        // must run inside the user gesture App.tsx wires to the Connect button.
        let s = await restore()
        if (!s) s = await login()
        sessionRef.current = s
        setSession(s)
        setConnectMode('wcw')
        await refresh()
        return
      }

      // waxwing backend: sync the daemon wallet to the game's network, then read
      // status + the selected account. The wallet MUST be unlocked to sign later;
      // we only check that here and surface a readable message if it's locked
      // (CEO rule: if locked during a sign test, stop and report — never silently
      // fail). The connect itself still succeeds for read-only use.
      await ensureNetwork()
      const st = await waxwingStatus()
      const actor =
        st.accounts.find((a) => a.selected)?.account ?? st.accounts[0]?.account
      if (!actor) {
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'waxwing has no account on this network — import one in the wallet panel',
        })
        return
      }
      // Prove the read path: pull the account info through waxwing (discard for
      // now — the dashboard reads game state via chain.ts for both modes).
      await waxwingAccount(actor)
      waxwingActorRef.current = actor
      setWaxwingActor(actor)
      setConnectMode('waxwing')
      if (!st.unlocked) {
        // Wallet locked → signal UI to open waxwing, not show an error.
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'waxwing wallet is LOCKED',
          needsUnlock: true,
        })
      }
      await refresh()
    },
    [refresh],
  )

  const disconnectWallet = useCallback(async () => {
    // Never leave a signable intent behind on disconnect.
    const intent = pendingIntentRef.current
    if (intent) void waxwingCancel(intent.id)
    pendingIntentRef.current = null
    setPendingSign(null)
    if (connectMode === 'wcw') {
      try {
        await logout()
      } catch {
        // ignore — clear local state regardless
      }
    }
    sessionRef.current = undefined
    waxwingActorRef.current = undefined
    modeRef.current = null
    setSession(undefined)
    setWaxwingActor(undefined)
    setConnectMode(null)
    setResources(EMPTY_RESOURCES)
    setCreatures([])
  }, [connectMode])

  // hatch: per Kevin's source (pockethatch.cpp:44), initplayer grants 200
  // starter EGG specifically so players use `hatch` (egg_type 0) and bypass the
  // broken `firsthatch`. So hatch() calls `hatch` directly — no firsthatch route.
  const hatch = useCallback(
    (eggType = 0) =>
      run('Hatch', (s) => s.push('hatch', { owner: s.actor, egg_type: eggType })),
    [run],
  )
  const feed = useCallback(
    (assetId: string) => {
      // Mirror the contract's feed() pre-checks (actionGates.ts) BEFORE broadcasting.
      // Without this the player taps a live button and the chain answers with a raw
      // "assertion failure with message: feed daily cap reached".
      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Feed', error: 'Creature not found' })
        return Promise.resolve()
      }
      const r = resourcesRef.current
      const gate = computeFeedGate({
        now: chainNow(r),
        lastFed: c.lastFed,
        feedCd: c.feedCd,
        stage: c.stage,
        feedsToday: r.feedsToday,
        feedDailyCap: r.feedDailyCap,
        paused: r.paused,
      })
      if (!gate.allowed) {
        setLastAction({ ok: false, label: 'Feed', error: feedBlockMessage(gate) })
        return Promise.resolve()
      }
      return run('Feed', async (s) => {
        // Optimistically bump the creature's growth so the green bar drops
        // immediately, and reset its satiety clock (lastFed → now) so the Feed-v2
        // meter refills at once; refresh() reconciles with on-chain truth after.
        const nowSec = Math.floor(Date.now() / 1000)
        setCreatures((prev) =>
          prev.map((c) =>
            c.assetId === assetId
              ? { ...c, growth: c.growth + feedBoostRef.current, lastFed: nowSec }
              : c,
          ),
        )
        return s.push('feed', { owner: s.actor, asset_id: assetId })
      })
    },
    [run],
  )
  // Awaken — wake a sleeping (stage 0) creature EARLY by paying WAX. This is NOT
  // a game-contract action: the contract's on_wax_transfer wakes the creature when
  // it receives `wax_contract::transfer{ owner → game, wake_cost, memo:"wake:<id>" }`
  // (pockethatch.cpp:1205). So we push a `transfer` to the WAX token contract via
  // the unified signer's contract override, through the same Sign-intent gate as
  // every other action. Once the sleep timer elapses the contract REJECTS a paid
  // wake (harvest auto-awakens for free), so we guard that client-side too.
  const awaken = useCallback(
    (assetId: string) => {
      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Wake', error: 'Creature not found' })
        return Promise.resolve()
      }
      if (c.stage > 0) {
        setLastAction({ ok: false, label: 'Wake', error: 'Already awake' })
        return Promise.resolve()
      }
      const now = Math.floor(Date.now() / 1000)
      if (c.bornAt > 0 && c.awakenDur > 0 && now >= c.bornAt + c.awakenDur) {
        setLastAction({ ok: false, label: 'Wake', error: 'Timer elapsed — harvest to awaken for free' })
        return Promise.resolve()
      }
      const cfg = configRef.current
      const wake = wakeCostFromConfig(cfg, c.rarity)
      const waxContract = cfg?.wax_contract ?? 'eosio.token'
      const gameContract = getActiveNetwork().contract // wake WAX is sent TO the game contract
      return run('Wake', (s) =>
        s.push(
          'transfer',
          { from: s.actor, to: gameContract, quantity: wake.asset, memo: `wake:${assetId}` },
          { contract: waxContract, label: `Wake ${c.name} · ${wake.wax} WAX` },
        ),
      )
    },
    [run],
  )

  const evolve = useCallback(
    (assetId: string) => {
      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Evolve', error: 'Creature not found' })
        return Promise.resolve()
      }
      // Mirror every evolve() check the contract runs (actionGates.ts) — including
      // the EGG cost, which scales as evolve_cost × (stage + 1) and is paid in EGG,
      // not HATCH. Blocking here is what keeps a raw chain assertion off the screen.
      const r = resourcesRef.current
      const gate = computeEvolveGate({
        now: chainNow(r),
        stage: c.stage,
        maxStage: c.maxStage,
        growth: c.growth,
        growthToNext: c.growthToNext,
        lastFed: c.lastFed,
        fedDur: c.fedDur,
        egg: r.egg,
        evolveCost: r.evolveCost,
        paused: r.paused,
      })
      if (!gate.allowed) {
        setLastAction({ ok: false, label: 'Evolve', error: evolveBlockMessage(gate) })
        return Promise.resolve()
      }
      return run('Evolve', (s) => s.push('evolve', { owner: s.actor, asset_id: assetId }))
    },
    [run],
  )

  // Burn — permanently destroy a creature (burncreature). Same single-action
  // sign-intent shape as evolve; the contract retires the AtomicAssets NFT under
  // its own authority, so the player's top-level authorization is all that's
  // needed — no inline transfer, no eosio.code. Irreversible: the destructive
  // confirm lives in the UI (CreatureCard), this only guards that the creature
  // still exists before opening the Sign gate.
  const burn = useCallback(
    (assetId: string) => {
      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Burn', error: 'Creature not found' })
        return Promise.resolve()
      }
      return run('Burn', (s) => s.push('burncreature', { owner: s.actor, asset_id: assetId }))
    },
    [run],
  )

  /**
   * Rename a creature ON CHAIN (`setname`). The contract writes the name into the
   * NFT's mutable data via atomicassets::setassetdata, so it is not a local label
   * — it ships with the asset and shows up wherever the NFT is read.
   *
   * `''` clears the name back to the species default. `renamingId` drives the
   * card's "Saving on chain…" state; it stays set through run()'s post-action
   * poll, so it only clears once the read node actually returns the new name.
   *
   * NOTE (deliberate): configv3 carries a `name_cost` (1 HATCH) but the deployed
   * contract does NOT charge it — a verified rename left the balance untouched.
   * So the UI charges nothing either. Deducting here would put the HUD out of
   * step with the chain; if the fee is ever enforced, the balance read picks it
   * up on the next refresh with no change needed here.
   */
  const rename = useCallback(
    (assetId: string, newName: string) => {
      const clean = clampCreatureName(newName.trim())

      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Rename', error: 'Creature not found' })
        return Promise.resolve()
      }
      // Nothing to sign — don't make the player pay CPU for a no-op.
      if (clean === (c.nickname ?? '')) return Promise.resolve()
      setRenamingId(assetId)
      return run('Rename', (s) =>
        s.push('setname', { owner: s.actor, asset_id: assetId, new_name: clean }),
      ).finally(() => setRenamingId(null))
    },
    [run],
  )

  const breed = useCallback(
    (parentA: string, parentB: string) => {
      if (parentA === parentB) {
        setLastAction({ ok: false, label: 'Breed', error: 'Must select two different creatures' })
        return Promise.resolve()
      }
      const a = creaturesRef.current.find((c) => c.assetId === parentA)
      const b = creaturesRef.current.find((c) => c.assetId === parentB)
      if (!a || !b) {
        setLastAction({ ok: false, label: 'Breed', error: 'Selected creature not found' })
        return Promise.resolve()
      }
      const now = Math.floor(Date.now() / 1000)
      const cd = a.breedCooldown || 86400
      const aReady = a.lastBred === 0 || now >= a.lastBred + cd
      const bReady = b.lastBred === 0 || now >= b.lastBred + cd
      if (!aReady || !bReady) {
        setLastAction({ ok: false, label: 'Breed', error: 'Parent is on breeding cooldown' })
        return Promise.resolve()
      }
      const cfg = configRef.current
      const cost = parseAssetAmount(cfg?.breed_cost)
      if (cost > 0 && resourcesRef.current.hatch < cost) {
        setLastAction({
          ok: false,
          label: 'Breed',
          error: `Need ${cost} HATCH (have ${resourcesRef.current.hatch})`,
        })
        return Promise.resolve()
      }
      // Breed emits player-funded inline HATCH transfers (40% burn + 60% → pool)
      // plus contract-authorized AtomicAssets mint/setassetdata. Route it through
      // the unified signer's SIGN-INTENT path (s.push) — same confirm-before-
      // broadcast gate as every other action — NOT an immediate pushAction.
      //
      // Why the intent path is correct here (the inline-authorization fix):
      // the single top-level `breed` action carries authorization
      // [{ owner, active }]. Antelope PROPAGATES that authorization to the
      // contract's inline `hatchtokens1::transfer{owner→contract}`, so the burn
      // + pool transfers are covered by the player's own signature — no separate
      // transfer action, and no `phgamecreatr@eosio.code` on the player is needed.
      // Verified on-chain: `waxwingsuper` burned 4.0000 HATCH + funded the pool
      // while its `active` permission holds ZERO accounts (no eosio.code). The old
      // "buildaction can't sign" note was stale — confirm() signs with the player's
      // own key. (Needs one live Sign-test after unlock to reconfirm end-to-end.)
      return run('Breed', (s) =>
        s.push('breed', {
          owner: s.actor,
          parent_a: parentA,
          parent_b: parentB,
        }),
      )
    },
    [run],
  )

  // Accelerate — burn HATCH to convert directly into growth. Same inline-auth
  // shape as breed: one top-level `accelerate` action authorized by owner@active;
  // the contract's inline `hatchtokens1::transfer{owner→contract}` (burn_hatch) is
  // covered by authorization propagation from that single action — no explicit
  // transfer action, no eosio.code. Goes through the unified Sign-intent gate.
  const accelerate = useCallback(
    (assetId: string, amount: string) =>
      run('Accelerate', (s) =>
        s.push('accelerate', { owner: s.actor, asset_id: assetId, amount }),
      ),
    [run],
  )

  const harvest = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const cd = resourcesRef.current.harvestCd || 0
    if (cd > 0 && now < resourcesRef.current.lastHarvest + cd) {
      setLastAction({ ok: false, label: 'Harvest', error: 'Harvest on cooldown' })
      return Promise.resolve()
    }
    return run('Harvest', (s) => s.push('harvest', { owner: s.actor }))
  }, [run])
  const claimReward = useCallback(() => {
    const r = resourcesRef.current
    const now = Math.floor(Date.now() / 1000)
    // Season gate: if already claimed this season, block with a clear message.
    if (r.currentSeason > 0 && r.claimedSeason >= r.currentSeason) {
      setLastAction({ ok: false, label: 'Claim reward', error: `Already claimed for season ${r.currentSeason}` })
      return Promise.resolve()
    }
    // Cooldown gate: within harvest_cd window since last claim.
    const cd = r.harvestCd || 0
    if (cd > 0 && now < r.lastClaimed + cd) {
      setLastAction({ ok: false, label: 'Claim reward', error: 'Claim on cooldown' })
      return Promise.resolve()
    }
    return run('Claim reward', (s) => s.push('claimreward', { owner: s.actor }))
  }, [run])

  // In the current flow, signing happens IN WAXWING (the player unlocks + taps
  // Sign in the wallet panel), not in the game's SignSheet. The game detects the
  // outcome via waxwingWaitForIntent polling. confirmPending opens the waxwing
  // panel so the player can sign there — use when the player dismisses the
  // SignSheet and needs to re-open waxwing to complete the action.
  const confirmPending = useCallback(async () => {
    openWaxwingPanel()
  }, [])

  // The player dismissed the popup — drop the intent (the daemon discards it)
  // and clear pendingSign. The waxwingWaitForIntent poll will detect the intent
  // is gone and throw 'cancelled', which run() catches and shows "Cancelled".
  const cancelPending = useCallback(() => {
    const intent = pendingIntentRef.current
    pendingIntentRef.current = null
    setPendingSign(null)
    if (intent) void waxwingCancel(intent.id)
  }, [])

  return {
    connectWallet,
    disconnectWallet,
    hatch,
    feed,
    awaken,
    evolve,
    breed,
    accelerate,
    burn,
    rename,
    renamingId,
    harvest,
    claimReward,
    refresh,
    confirmPending,
    cancelPending,
    resources,
    creatures,
    animating,
    lastAction,
    pendingSign,
    connectMode,
    connectedAs: connectMode === 'wcw' ? (session ? String(session.actor) : null) : waxwingActor ?? null,
    hatchCost,
    breedCost,
    hatchOdds,
  }
}
