/**
 * On-chain data layer for Pocket Hatchery on WAX testnet.
 * Reads tables directly from the RPC node and normalizes rows into UI shapes.
 */

// All three follow the active network (dev switcher ?network=wax-mainnet, default
// wax-testnet). testnet contract = `phgamecreatr` (live configv3 post Feed-v2 deploy);
// mainnet contract is NOT deployed yet (Kevin) → network.ts sets it to '' and the
// play layer blocks connect. See network.ts for the single source of truth.
import { getActiveNetwork } from './network'

const ACTIVE_NET = getActiveNetwork()

export const CONTRACT_ACCOUNT = ACTIVE_NET.contract
export const RPC_ENDPOINTS = ACTIVE_NET.rpc
export const CHAIN_ID = ACTIVE_NET.chainId

// Hard cap per attempt so a dead node fails fast instead of stalling the UI ~17s.
export const RPC_TIMEOUT_MS = 7000

// Seconds per on-chain day — mirrors the contract's DAY_SEC (pockethatch.cpp).
const DAY_SEC = 86400

// ── configv3 — the config table name (Feed v2, deployed 2026-07-09) ──────────
// Live on phgamecreatr since Feed v2 deploy. Reads fed_dur + earn_mult directly
// from chain; satiety.ts FED_DUR_DEFAULT is the fallback.
export const CONFIG_TABLE = 'configv3'

export interface ChainConfig {
  token_contract: string
  collection: string
  schema_name: string
  fee_account: string
  paused: number
  // EGG costs are uint64 (raw counts); only breed/name are asset strings.
  hatch_cost: number
  evolve_cost: number
  breed_cost: string
  feed_cost: number
  slot_cost?: number
  cosmetic_cost?: number
  name_cost?: string
  install_cap_bonus?: number
  feed_cd: number
  harvest_cd: number
  breed_cd: number
  feed_daily_cap: number
  daily_egg_cap: number
  offline_cap_h: number
  /** Scale the daily EGG ceiling by the best owned rarity's earn_mult (configv3). */
  cap_scales_rarity?: number
  tap_egg_cap: number
  feed_boost: number
  season_index: number
  season_started: number
  rng_oracle: string
  // Hatch rarity roll weights — the contract rolls the tier server-side with these
  // (pockethatch.cpp roll_egg_type). Cost is flat (hatch_cost); only the OUTCOME
  // rarity varies. Optional so older config tables without them fall back to spec.
  rarity_w_common?: number
  rarity_w_uncommon?: number
  rarity_w_rare?: number
  rarity_w_epic?: number
  rarity_w_legendary?: number
  rarity_w_mythic?: number
  // Feed v2 satiety durations (seconds) per rarity — configv3. Optional because
  // configv2 does not carry them; when absent, satiety.ts FED_DUR_DEFAULT applies.
  fed_dur_common?: number
  fed_dur_uncommon?: number
  fed_dur_rare?: number
  fed_dur_epic?: number
  fed_dur_legendary?: number
  fed_dur_mythic?: number
  // Feed v2 harvest-yield multiplier (basis points, ×10000) per rarity — configv3.
  // The contract's harvest() multiplies the SPECIES' own yield_for(stage) by this
  // on top (pockethatch.cpp: `gross += yield_for(idx) * fed_h * mult/10000 * …`), so
  // the true per-creature earn = speciescfg.yield × earn_mult. Optional (configv2
  // lacks them); when absent, satiety.ts RARITY_EARN_MULT is the fallback.
  earn_mult_common?: number
  earn_mult_uncommon?: number
  earn_mult_rare?: number
  earn_mult_epic?: number
  earn_mult_legendary?: number
  earn_mult_mythic?: number
  // Awaken v2 — how long a freshly-hatched creature sleeps (stage 0) before it can
  // be harvested awake (seconds), per rarity — configv3.awaken_dur_*. The contract
  // auto-awakens stage 0→1 on the next harvest once `born_at + awaken_dur` elapses
  // (pockethatch.cpp harvest loop), OR the player pays WAX to wake it early.
  awaken_dur_common?: number
  awaken_dur_uncommon?: number
  awaken_dur_rare?: number
  awaken_dur_epic?: number
  awaken_dur_legendary?: number
  awaken_dur_mythic?: number
  // Awaken v2 — WAX cost to skip the sleep timer, per rarity (asset strings, e.g.
  // "3.00000000 WAX"). The player sends this to the game contract via
  // wax_contract::transfer with memo "wake:<asset_id>" (on_wax_transfer). Only
  // valid WHILE sleeping; once the timer elapses the contract rejects it ("already
  // awake — just harvest instead") and the harvest auto-awaken is free.
  wake_cost_common?: string
  wake_cost_uncommon?: string
  wake_cost_rare?: string
  wake_cost_epic?: string
  wake_cost_legendary?: string
  wake_cost_mythic?: string
  // The token contract WAX wake payments go through (configv3.wax_contract =
  // eosio.token on WAX). The wake transfer targets this contract, not the game one.
  wax_contract?: string
}

export interface PlayerRow {
  account: string
  created_at: number
  egg_balance: number
  last_harvest: number
  harvest_day: number
  egg_harvested_today: number
  feeds_today: number
  feed_day: number
  total_egg_farmed: number
  total_hatch_burned: number
}

/**
 * Mirror the contract's reset_daily_if_new_day (pockethatch.cpp) on the READ side.
 *
 * The chain resets the per-day counters LAZILY — egg_harvested_today / feeds_today
 * only zero out the next time an action runs on a new UTC day, so a player who last
 * acted yesterday still has yesterday's spent quota / depleted energy sitting in the
 * raw table until they act again. Reading those raw fields makes the HUD show a
 * stale "cap reached" / "0 energy" for today. Recompute the EFFECTIVE counters here
 * exactly as the contract would on the next action (two independent day fields:
 * harvest_day gates egg_harvested_today; feed_day gates feeds_today).
 *
 * `now` MUST be the chain head time (getChainTime) — never client Date.now(). The
 * day boundary decides today's free energy and harvest quota, and a player must not
 * be able to shift it forward by setting their device clock ahead.
 */
export function effectiveDailyCounters(
  player: PlayerRow | null,
  now: number,
): { eggHarvestedToday: number; feedsToday: number } {
  if (!player) return { eggHarvestedToday: 0, feedsToday: 0 }
  const today = Math.floor(now / DAY_SEC)
  return {
    eggHarvestedToday: today !== player.harvest_day ? 0 : player.egg_harvested_today,
    feedsToday: today !== player.feed_day ? 0 : player.feeds_today,
  }
}

export interface CreatureRow {
  asset_id: string
  owner: string
  template_id: number
  stage: number
  growth_base: number
  fed_growth: number
  born_at: number
  last_sync: number
  last_fed: number
  last_bred: number
  genetics: string
}

export interface RewardPoolRow {
  balance: string
  bootstrap_total: string
  bootstrap_released: number
  last_release: number
  lifetime_funded: string
  lifetime_paid: string
}

// One player's claim record (contract: claims_t, primary key = account.value).
// The claim clock does NOT live on the player row — claimreward keeps it here.
export interface ClaimRow {
  account: string
  last_claimed: number    // unix seconds of the last successful claimreward
  claimed_season: number  // season index that claim was made in (0 = never claimed)
}

// One creature species/template. thresh_1..4 are the growth totals needed to
// reach stage 1..4; yield_0..4 is the EGG/hr rate (×10⁴) at each stage.
export interface SpeciesRow {
  template_id: number
  growth_rate: number
  thresh_1: number
  thresh_2: number
  thresh_3: number
  thresh_4: number
  yield_0: number
  yield_1: number
  yield_2: number
  yield_3: number
  yield_4: number
  max_stage: number
  egg_weight: number
  egg_type: number
  family: string
}

export interface GameState {
  config: ChainConfig | null
  player: PlayerRow | null
  creatures: CreatureRow[]
  rewardPool: RewardPoolRow | null
  species: SpeciesRow[]
  /** This player's claim record (claims table) — null when they never claimed. */
  claim: ClaimRow | null
  /** Chain head time in unix seconds — the authoritative "now" for the daily
   *  reset (effectiveDailyCounters). Falls back to the client clock only if the
   *  head-time read fails on every node. */
  now: number
}

// POST to the chain, trying each endpoint in turn with a hard timeout per try.
// Fails fast (RPC_TIMEOUT_MS) on a dead/slow node rather than hanging ~17s.
async function rpc<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  let lastError: unknown = null
  for (const base of RPC_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        // e.g. 500 "Table X is not specified in the ABI" — same on every node, so
        // surface it rather than silently fall through to the next endpoint.
        throw new Error(`RPC ${path} @ ${base} failed: ${res.status} ${await res.text()}`)
      }
      return (await res.json()) as T
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      // network/abort/timeout → try the next endpoint
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`All RPC endpoints failed for ${path} (${detail}). Last tried.`)
}

interface TableRowsResponse<T> {
  rows: T[]
  more: boolean
  next_key?: string
}

/**
 * Chain head time in unix seconds (get_info.head_block_time). This is the
 * authoritative clock for the daily reset — using it instead of the browser's
 * Date.now() keeps the HUD honest against a device clock the player controls.
 * head_block_time is UTC with no zone suffix, so we append 'Z' before parsing.
 */
export async function getChainTime(): Promise<number> {
  const info = await rpc<{ head_block_time: string }>('/v1/chain/get_info', {})
  return Math.floor(Date.parse(`${info.head_block_time}Z`) / 1000)
}

export async function getConfig(): Promise<ChainConfig | null> {
  const data = await rpc<TableRowsResponse<ChainConfig>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: CONFIG_TABLE,
    json: true,
    limit: 1,
  })
  return data.rows[0] ?? null
}

export async function getPlayer(account: string): Promise<PlayerRow | null> {
  const data = await rpc<TableRowsResponse<PlayerRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'players',
    json: true,
    limit: 1,
    lower_bound: account,
    upper_bound: account,
  })
  return data.rows[0] ?? null
}

export async function getCreatures(owner: string): Promise<CreatureRow[]> {
  // The creatures table is keyed by asset_id. We read the whole table and
  // filter client-side by owner. For a production game with many creatures
  // you'd add a secondary index; this contract exposes only the primary key.
  // NOTE: the Feed-v2 deploy (configv3, 2026-07-09) RENAMED this table
  // `creatures` → `creatrsv2` (verified against the live ABI). The old name is
  // no longer in the ABI and 3060003s.
  const data = await rpc<TableRowsResponse<CreatureRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'creatrsv2',
    json: true,
    limit: 1000,
  })
  return data.rows.filter((row) => row.owner === owner)
}

export async function getRewardPool(): Promise<RewardPoolRow | null> {
  const data = await rpc<TableRowsResponse<RewardPoolRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'rewardpool',
    json: true,
    limit: 1,
  })
  return data.rows[0] ?? null
}

export async function getSpecies(): Promise<SpeciesRow[]> {
  // Feed-v2 deploy renamed this table `speciescfg` → `spccfgv2` (live ABI).
  const data = await rpc<TableRowsResponse<SpeciesRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'spccfgv2',
    json: true,
    limit: 100,
  })
  return data.rows
}

/**
 * This player's claim record, or null when they have never claimed.
 *
 * The `claims` table is scoped to the CONTRACT (claims_t(get_self(), get_self().value)),
 * not to the player — and it is keyed by account.value, so a lower_bound on the account
 * name lands on that player's row (or the next one, hence the identity check). Reading it
 * with scope=account returns an empty set, which silently reads as "never claimed" and
 * makes the Claim button offer a reward the contract will reject with
 * "already claimed this season".
 */
export async function getClaim(account: string): Promise<ClaimRow | null> {
  const data = await rpc<TableRowsResponse<ClaimRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'claims',
    json: true,
    lower_bound: account,
    limit: 1,
  })
  const row = data.rows[0]
  return row && row.account === account ? row : null
}

// Fungible-token balance (e.g. $HATCH on hatchtokens1). Returns the numeric
// amount; symbol precision is dropped (the UI shows whole units).
export async function getTokenBalance(
  tokenContract: string,
  account: string,
  symbol = 'HATCH',
): Promise<number> {
  const arr = await rpc<string[]>('/v1/chain/get_currency_balance', {
    code: tokenContract,
    account,
    symbol,
  })
  if (!Array.isArray(arr) || arr.length === 0) return 0
  return Number(arr[0].split(' ')[0]) || 0
}

export async function fetchGameState(account: string): Promise<GameState> {
  // Read every table in parallel, but DON'T let one failure sink the whole
  // dashboard. A 3060003 "Table X is not specified in the ABI" (e.g. after a
  // contract redeploy that renames/drops a table) would otherwise reject the
  // Promise.all and empty every chip at once. allSettled keeps the reads that
  // succeeded; a per-table failure becomes a null/[] + a console.warn so it's
  // diagnosable. Only when EVERY read fails (all RPC nodes down) do we throw,
  // so play.ts can surface a toast instead of rendering a silent empty state.
  const reads = {
    config: getConfig(),
    player: getPlayer(account),
    creatures: getCreatures(account),
    rewardPool: getRewardPool(),
    species: getSpecies(),
    claim: getClaim(account),
    now: getChainTime(),
  } as const
  const keys = Object.keys(reads) as (keyof typeof reads)[]
  const settled = await Promise.allSettled(Object.values(reads))

  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[chain] ${keys[i]} read failed:`, String(r.reason))
    }
  })

  if (settled.every((r) => r.status === 'rejected')) {
    const first = settled[0] as PromiseRejectedResult
    throw first.reason instanceof Error ? first.reason : new Error(String(first.reason))
  }

  const or = <T>(i: number, fallback: T): T =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<T>).value : fallback

  return {
    config: or<ChainConfig | null>(0, null),
    player: or<PlayerRow | null>(1, null),
    creatures: or<CreatureRow[]>(2, []),
    rewardPool: or<RewardPoolRow | null>(3, null),
    species: or<SpeciesRow[]>(4, []),
    claim: or<ClaimRow | null>(5, null),
    // Fall back to the client clock only if EVERY node failed the head-time read
    // (the reset then degrades to Date.now(); the contract still enforces truth).
    now: or<number>(6, Math.floor(Date.now() / 1000)),
  }
}
