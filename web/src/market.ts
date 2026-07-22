/**
 * market.ts — the game's OWN AtomicMarket client (In-Game Marketplace).
 *
 * Read side: the public AtomicMarket indexer API (test.wax.api.atomicassets.io),
 * fetched directly from the game — no waxwing plugin involved. Every listing is
 * one of our creatures: the NFT's decoded data carries the on-chain truth
 * [genetics, stage, growth, name, rarity] the game contract writes at hatch and
 * on every feed/evolve, so the marketplace shows the creature's OWN rolled
 * rarity (same rule as the collection: rarity comes from the asset, never the
 * template).
 *
 * Write side: pure action BUILDERS for the AtomicMarket lifecycle, grounded in
 * the live contract ABI (same shapes waxwing's Light Marketplace broadcasts —
 * the pattern is borrowed, the code is ours):
 *   list   → atomicmarket::announcesale + atomicassets::createoffer  (one tx)
 *   buy    → eosio.token::transfer memo "deposit" + atomicmarket::purchasesale
 *   delist → atomicmarket::cancelsale
 * Who signs is play.ts's business (unified GameSigner, both backends); nothing
 * in this module ever touches a wallet.
 */
import { getActiveNetwork } from './network'
import type { Rarity } from './components/CreatureCard'

// ── Constants ────────────────────────────────────────────────────────────────

export const ATOMICMARKET_CONTRACT = 'atomicmarket'
export const ATOMICASSETS_CONTRACT = 'atomicassets'
/** WAX core token: 8-decimals precision — announcesale rejects anything else. */
const WAX_PRECISION = 8
const WAX_SYMBOL = 'WAX'
const WAX_TOKEN_CONTRACT = 'eosio.token'

// AtomicAssets/AtomicMarket indexer per network (public pink.network API, CORS *).
const ATOMIC_API: Record<string, string> = {
  'wax-testnet': 'https://test.wax.api.atomicassets.io',
  'wax-mainnet': 'https://wax.api.atomicassets.io',
}

function apiBase(): string {
  return ATOMIC_API[getActiveNetwork().id] ?? ATOMIC_API['wax-testnet']
}

/** The game collection — same account as the game contract (phgamecreatr). */
export function marketCollection(): string {
  return getActiveNetwork().contract
}

const API_TIMEOUT_MS = 10000

async function apiGet<T>(path: string): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${apiBase()}${path}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`atomic API HTTP ${res.status}`)
    const json = (await res.json()) as { success?: boolean; data?: T; message?: string }
    if (json.success === false) throw new Error(json.message || 'atomic API error')
    return json.data as T
  } finally {
    clearTimeout(timer)
  }
}

// ── Read types (normalized to what the marketplace UI renders) ───────────────

const RARITY_BY_INDEX: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export interface MarketPrice {
  /** Decimal amount in whole tokens (e.g. 8.5). */
  amount: number
  symbol: string
  precision: number
  tokenContract: string
}

/** One listed sale, flattened to its (single) creature asset. */
export interface MarketListing {
  saleId: string
  /** AtomicMarket sale state — 1 = LISTED. */
  state: number
  seller: string
  price: MarketPrice
  assetId: string
  templateId: string | null
  /** Mint number within the template ("45"), '' when unknown. */
  templateMint: string
  /** Player-given name from the NFT mutable data, or '' (UI falls back to species). */
  name: string
  /** The creature's OWN rolled rarity (asset data `rarity` 0–5). */
  rarity: Rarity
  stage: number
  growth: number
  /** 64-char hex gene — drives the same sprite renderer as the collection. */
  genetics: string
  /** Unix ms the sale was listed. */
  listedAt: number
}

/** Indexer sale row (the fields we read). */
interface RawSale {
  sale_id: string
  state: number
  seller: string
  price?: {
    amount?: string
    token_symbol?: string
    token_precision?: number
    token_contract?: string
  }
  assets?: RawAsset[]
  created_at_time?: string
  updated_at_time?: string
}

interface RawAsset {
  asset_id: string
  name?: string
  template_mint?: string
  template?: { template_id?: string }
  data?: Record<string, unknown>
  minted_at_time?: string
}

function toPrice(p: RawSale['price']): MarketPrice {
  const precision = Number(p?.token_precision ?? WAX_PRECISION)
  return {
    amount: Number(p?.amount ?? 0) / Math.pow(10, precision),
    symbol: String(p?.token_symbol ?? WAX_SYMBOL),
    precision,
    tokenContract: String(p?.token_contract ?? WAX_TOKEN_CONTRACT),
  }
}

function toListing(s: RawSale): MarketListing | null {
  const a = s.assets?.[0]
  if (!a) return null
  const data = a.data ?? {}
  const rarityIdx = Math.min(Math.max(Number(data.rarity ?? 0), 0), 5)
  return {
    saleId: String(s.sale_id),
    state: Number(s.state),
    seller: String(s.seller),
    price: toPrice(s.price),
    assetId: String(a.asset_id),
    templateId: a.template?.template_id ? String(a.template.template_id) : null,
    templateMint: a.template_mint ? String(a.template_mint) : '',
    name: typeof data.name === 'string' ? data.name : '',
    rarity: RARITY_BY_INDEX[rarityIdx],
    stage: Number(data.stage ?? 0),
    growth: Number(data.growth ?? 0),
    genetics: typeof data.genetics === 'string' ? data.genetics : '',
    listedAt: Number(s.created_at_time ?? 0),
  }
}

/** Active (state=1) listings of the game collection, cheapest first by default. */
export async function fetchListings(opts: {
  sort?: 'price' | 'created' | 'template_mint'
  order?: 'asc' | 'desc'
  limit?: number
} = {}): Promise<MarketListing[]> {
  const q = new URLSearchParams({
    state: '1',
    collection_name: marketCollection(),
    limit: String(Math.min(opts.limit ?? 100, 100)),
    page: '1',
    sort: opts.sort ?? 'price',
    order: opts.order ?? (opts.sort === 'created' ? 'desc' : 'asc'),
  })
  const rows = await apiGet<RawSale[]>(`/atomicmarket/v1/sales?${q.toString()}`)
  return (rows ?? []).map(toListing).filter((l): l is MarketListing => l !== null)
}

/** One sale by id (any state) — the buy/cancel pre-check reads the live row. */
export async function fetchSale(saleId: string): Promise<MarketListing | null> {
  const row = await apiGet<RawSale | null>(`/atomicmarket/v1/sales/${encodeURIComponent(saleId)}`)
  return row ? toListing(row) : null
}

// ── Market stats (mock stats bar, computed from live data) ───────────────────

export interface MarketStats {
  listings: number
  /** Cheapest active WAX listing, null when the board is empty. */
  floor: number | null
  median: number | null
  mythicFloor: number | null
  vol24h: number
  sales24h: number
}

/** Floor/median from the active set + 24h volume from recently SOLD sales. */
export async function fetchStats(active: MarketListing[]): Promise<MarketStats> {
  const wax = active
    .filter((l) => l.price.symbol === WAX_SYMBOL)
    .map((l) => l.price.amount)
    .sort((a, b) => a - b)
  const mythic = active
    .filter((l) => l.rarity === 'mythic' && l.price.symbol === WAX_SYMBOL)
    .map((l) => l.price.amount)
    .sort((a, b) => a - b)

  // Sold in the last 24h — state=3, newest first. One page is plenty for a
  // per-collection board; a busier day than 100 sales just reads as "100+".
  let vol24h = 0
  let sales24h = 0
  try {
    const q = new URLSearchParams({
      state: '3',
      collection_name: marketCollection(),
      limit: '100',
      page: '1',
      sort: 'updated',
      order: 'desc',
    })
    const sold = await apiGet<RawSale[]>(`/atomicmarket/v1/sales?${q.toString()}`)
    const cutoff = Date.now() - 24 * 3600 * 1000
    for (const s of sold ?? []) {
      if (Number(s.updated_at_time ?? 0) < cutoff) break // sorted desc — done
      sales24h += 1
      vol24h += toPrice(s.price).amount
    }
  } catch {
    /* stats stay 0 — the board itself still renders */
  }

  return {
    listings: active.length,
    floor: wax[0] ?? null,
    median: wax.length ? wax[Math.floor(wax.length / 2)] : null,
    mythicFloor: mythic[0] ?? null,
    vol24h,
    sales24h,
  }
}

// ── Asset detail extras (meta + ownership history, all live) ─────────────────

export interface AssetMeta {
  mintedAt: number
  templateMint: string
  owner: string
  burned: boolean
}

export async function fetchAssetMeta(assetId: string): Promise<AssetMeta | null> {
  const a = await apiGet<
    (RawAsset & { owner?: string; is_burnable?: boolean; burned_by_account?: string | null }) | null
  >(`/atomicassets/v1/assets/${encodeURIComponent(assetId)}`)
  if (!a) return null
  return {
    mintedAt: Number(a.minted_at_time ?? 0),
    templateMint: a.template_mint ? String(a.template_mint) : '',
    owner: String(a.owner ?? ''),
    burned: !!a.burned_by_account,
  }
}

export interface HistoryRow {
  event: 'Mint' | 'Transfer' | 'Sale'
  from: string
  to: string
  /** "8.50 WAX" for sales, '' otherwise. */
  price: string
  /** Unix ms. */
  at: number
}

/**
 * Real ownership history: past SOLD sales of this asset + raw transfers + the
 * mint. Transfers that settle a sale are folded into the Sale rows (the market
 * moves the asset within the same second the sale closes).
 */
export async function fetchAssetHistory(assetId: string, mintedAt: number): Promise<HistoryRow[]> {
  const rows: HistoryRow[] = []
  try {
    const sold = await apiGet<RawSale[]>(
      `/atomicmarket/v1/sales?asset_id=${encodeURIComponent(assetId)}&state=3&sort=updated&order=desc&limit=20`,
    )
    for (const s of sold ?? []) {
      const p = toPrice(s.price)
      rows.push({
        event: 'Sale',
        from: String(s.seller),
        to: String((s as RawSale & { buyer?: string }).buyer ?? ''),
        price: `${p.amount.toFixed(2)} ${p.symbol}`,
        at: Number(s.updated_at_time ?? 0),
      })
    }
  } catch { /* history is best-effort */ }
  try {
    const transfers = await apiGet<
      { sender_name: string; recipient_name: string; created_at_time: string }[]
    >(`/atomicassets/v1/transfers?asset_id=${encodeURIComponent(assetId)}&limit=20&order=desc`)
    for (const t of transfers ?? []) {
      const at = Number(t.created_at_time ?? 0)
      // Market-settlement transfers duplicate the Sale row within ~the same block.
      if (rows.some((r) => r.event === 'Sale' && Math.abs(r.at - at) < 5000)) continue
      rows.push({ event: 'Transfer', from: t.sender_name, to: t.recipient_name, price: '', at })
    }
  } catch { /* best-effort */ }
  if (mintedAt) rows.push({ event: 'Mint', from: marketCollection(), to: '', price: '', at: mintedAt })
  return rows.sort((a, b) => b.at - a.at)
}

// ── Write side: pure AtomicMarket action builders ────────────────────────────

export interface EosioAction {
  account: string
  name: string
  authorization: { actor: string; permission: string }[]
  data: Record<string, unknown>
}

/** "12.5" | 12.5 → "12.50000000 WAX" (8-dec core precision, announcesale-exact). */
export function formatWax(amount: number | string): string {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) throw new Error('price must be a positive WAX amount')
  return `${n.toFixed(WAX_PRECISION)} ${WAX_SYMBOL}`
}

const auth = (actor: string, permission = 'active') => [{ actor, permission }]

/**
 * List one creature for sale — TWO actions, ONE atomic tx:
 *   1) atomicmarket::announcesale — declare the sale + price
 *   2) atomicassets::createoffer  — escrow-offer the asset to the market
 * announcesale must precede createoffer so the sale exists when the offer's
 * lognewoffer notification reaches the market contract.
 */
export function buildListActions(seller: string, assetId: string, priceWax: number): EosioAction[] {
  const listingPrice = formatWax(priceWax)
  return [
    {
      account: ATOMICMARKET_CONTRACT,
      name: 'announcesale',
      authorization: auth(seller),
      data: {
        seller,
        asset_ids: [assetId],
        listing_price: listingPrice,
        settlement_symbol: `${WAX_PRECISION},${WAX_SYMBOL}`,
        maker_marketplace: '',
      },
    },
    {
      account: ATOMICASSETS_CONTRACT,
      name: 'createoffer',
      authorization: auth(seller),
      data: {
        sender: seller,
        recipient: ATOMICMARKET_CONTRACT,
        sender_asset_ids: [assetId],
        recipient_asset_ids: [],
        memo: 'sale',
      },
    },
  ]
}

/**
 * Buy a listed sale — TWO actions, ONE atomic tx:
 *   1) <token>::transfer buyer→atomicmarket memo "deposit" (fund the balance)
 *   2) atomicmarket::purchasesale                          (spend it on the sale)
 * intended_delphi_median = 0: our sales settle directly in WAX, no Delphi pair.
 */
export function buildBuyActions(buyer: string, sale: MarketListing): EosioAction[] {
  const quantity = `${sale.price.amount.toFixed(sale.price.precision)} ${sale.price.symbol}`
  return [
    {
      account: sale.price.tokenContract,
      name: 'transfer',
      authorization: auth(buyer),
      data: { from: buyer, to: ATOMICMARKET_CONTRACT, quantity, memo: 'deposit' },
    },
    {
      account: ATOMICMARKET_CONTRACT,
      name: 'purchasesale',
      authorization: auth(buyer),
      data: { buyer, sale_id: sale.saleId, intended_delphi_median: 0, taker_marketplace: '' },
    },
  ]
}

/** Delist — atomicmarket::cancelsale releases the offer back to the seller. */
export function buildCancelActions(seller: string, saleId: string): EosioAction[] {
  return [
    {
      account: ATOMICMARKET_CONTRACT,
      name: 'cancelsale',
      authorization: auth(seller),
      data: { sale_id: saleId },
    },
  ]
}
