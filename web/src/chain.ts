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
  tap_egg_cap: number
  feed_boost: number
  season_index: number
  season_started: number
  rng_oracle: string
  // Feed v2 satiety durations (seconds) per rarity — configv3. Optional because
  // configv2 does not carry them; when absent, satiety.ts FED_DUR_DEFAULT applies.
  fed_dur_common?: number
  fed_dur_uncommon?: number
  fed_dur_rare?: number
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
  last_claimed: number      // last claimreward timestamp (unix seconds)
  claimed_season: number    // season index last claimed in
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

export interface ClaimRow {
  season_index: number
  claimed_at: number
  amount: string
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
  claims: ClaimRow[]
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
  const data = await rpc<TableRowsResponse<CreatureRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'creatures',
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
  const data = await rpc<TableRowsResponse<SpeciesRow>>('/v1/chain/get_table_rows', {
    code: CONTRACT_ACCOUNT,
    scope: CONTRACT_ACCOUNT,
    table: 'speciescfg',
    json: true,
    limit: 100,
  })
  return data.rows
}

export async function getClaims(account: string): Promise<ClaimRow[]> {
  try {
    const data = await rpc<TableRowsResponse<ClaimRow>>('/v1/chain/get_table_rows', {
      code: CONTRACT_ACCOUNT,
      scope: account,
      table: 'claims',
      json: true,
      limit: 50,
    })
    return data.rows
  } catch {
    // claims table may not exist yet on-chain — fall back to PlayerRow.claimed_season
    return []
  }
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
    claims: getClaims(account),
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
    claims: or<ClaimRow[]>(5, []),
  }
}
