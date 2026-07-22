/**
 * MarketPage — the In-Game Marketplace, built to the approved mock
 * (art/marketplace-mock/marketplace.html) with LIVE data end to end:
 *
 *   browse  → active AtomicMarket sales of the game collection (market.ts reads
 *             the public indexer directly — no other plugin involved), each card
 *             rendered from the NFT's own decoded data (genetics → the same
 *             sprite renderer as the collection; rarity → the creature's OWN
 *             rolled tier, never the template's).
 *   detail  → live sale + asset meta + real ownership history; the seller's
 *             creature row is read off the chain for the satiety/growth bars.
 *   actions → Buy / List / Delist wired into play.ts's market actions (the
 *             game's unified signer: waxwing intent gate or the WCW browser
 *             wallet). A `?view` spectator sees everything, signs nothing —
 *             play.ts's buildSigner refuses and this page hides the buttons.
 *
 * All copy is English-only (CEO rule).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CreatureSprite, type Creature, type Rarity } from './CreatureCard'
import {
  fetchListings,
  fetchStats,
  fetchSale,
  fetchAssetMeta,
  fetchAssetHistory,
  marketCollection,
  type MarketListing,
  type MarketStats,
  type AssetMeta,
  type HistoryRow,
} from '../market'
import { getConfig, getCreatures, type ChainConfig } from '../chain'
import { speciesIdFromGene, speciesNameFromGene } from '../geneDecoder'
import { computeSatiety, fedDurFor } from '../satiety'
import type { HatchOdds } from '../play'
import styles from './MarketPage.module.css'

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
// Same stage canon as App.tsx's STAGE_WORDS — the game's naming, not the mock's.
const STAGE_WORDS = ['Egg', 'Baby', 'Juvenile', 'Adult', 'Elite', 'Primal'] as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function stageLabel(stage: number): string {
  return `Stage ${stage} · ${STAGE_WORDS[Math.min(Math.max(stage, 0), 5)]}`
}

function timeAgo(ms: number): string {
  if (!ms) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtWaxShort(n: number): string {
  return n >= 100 ? n.toFixed(0) : n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
}

/** Species display name from the gene; the chain species field is the FAMILY. */
function speciesOf(genetics: string): string {
  try {
    return speciesNameFromGene(genetics)
  } catch {
    return 'Creature'
  }
}
function speciesSlugOf(genetics: string): string {
  try {
    return speciesIdFromGene(genetics)
  } catch {
    return 'foxling'
  }
}

type SortKey = 'price-asc' | 'price-desc' | 'newest' | 'stage' | 'rarity'
type View =
  | { kind: 'browse' }
  | { kind: 'listing'; saleId: string }
  | { kind: 'sell'; assetId: string }

interface DetailExtras {
  meta: AssetMeta | null
  history: HistoryRow[]
  /** Satiety % from the seller's live creature row, null when unreadable. */
  satiety: number | null
  /** Age in whole days from the row's born_at, null when unreadable. */
  ageDays: number | null
}

export interface MarketPageProps {
  /** Connected (or spectated) account, for "My Listing" badges. */
  actor: string | null
  /** `?view` spectator — pure display, no Buy/List/Delist controls. */
  readOnly: boolean
  /** A gameplay action is in flight — market buttons disable alongside. */
  animating: boolean
  /** Live configv3 odds + earn premium per rarity (chips + detail panel). */
  hatchOdds: HatchOdds[]
  /** The player's own collection — feeds the "Sell Your Creatures" strip. */
  creatures: Creature[]
  onList: (assetId: string, priceWax: number) => Promise<{ ok: boolean } | void>
  onBuy: (saleId: string) => Promise<{ ok: boolean } | void>
  onCancel: (saleId: string) => Promise<{ ok: boolean } | void>
}

export function MarketPage({
  actor,
  readOnly,
  animating,
  hatchOdds,
  creatures,
  onList,
  onBuy,
  onCancel,
}: MarketPageProps) {
  const [listings, setListings] = useState<MarketListing[] | null>(null)
  const [stats, setStats] = useState<MarketStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'browse' })
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('any')
  const [sort, setSort] = useState<SortKey>('price-asc')
  const [priceInput, setPriceInput] = useState('')
  const [editingPrice, setEditingPrice] = useState(false)
  const [extras, setExtras] = useState<DetailExtras | null>(null)
  // The one sale opened in detail when it is not in the browse page (direct id).
  const [detailSale, setDetailSale] = useState<MarketListing | null>(null)
  const configRef = useRef<ChainConfig | null>(null)
  const aliveRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchListings({ sort: 'price', order: 'asc', limit: 100 })
      if (!aliveRef.current) return
      setListings(rows)
      setError(null)
      // Stats need a second indexer call (sold sales) — best-effort after the board.
      const s = await fetchStats(rows)
      if (aliveRef.current) setStats(s)
    } catch (err) {
      if (!aliveRef.current) return
      setError(String((err as Error)?.message ?? err))
    }
  }, [])

  // Live board: load on mount, re-poll every 30s (marketplace state is global —
  // someone else's buy/list should appear without a manual reload).
  useEffect(() => {
    aliveRef.current = true
    void refresh()
    const id = setInterval(() => void refresh(), 30000)
    return () => {
      aliveRef.current = false
      clearInterval(id)
    }
  }, [refresh])

  // After a signed action, the indexer can lag the chain by a few seconds —
  // refetch now and again shortly after so the board catches up on its own.
  const refetchSoon = useCallback(() => {
    void refresh()
    setTimeout(() => void refresh(), 4000)
    setTimeout(() => void refresh(), 10000)
  }, [refresh])

  // ── Detail data (live sale row + asset meta + history + seller's chain row) ──
  const openSale =
    view.kind === 'listing'
      ? (listings?.find((l) => l.saleId === view.saleId) ?? detailSale)
      : null

  useEffect(() => {
    if (view.kind !== 'listing') {
      setExtras(null)
      setDetailSale(null)
      return
    }
    let cancelled = false
    const saleId = view.saleId
    void (async () => {
      // The sale itself (when the board doesn't carry it yet/anymore).
      let sale = listings?.find((l) => l.saleId === saleId) ?? null
      if (!sale) {
        try {
          sale = await fetchSale(saleId)
        } catch { /* detail shows what it has */ }
        if (cancelled) return
        setDetailSale(sale)
      }
      if (!sale) return
      const [meta, history] = await Promise.all([
        fetchAssetMeta(sale.assetId).catch(() => null),
        fetchAssetHistory(sale.assetId, 0).catch(() => [] as HistoryRow[]),
      ])
      // Seller's live creature row → satiety + age (the asset stays with the
      // seller while listed; AtomicMarket escrows an OFFER, not the NFT).
      let satiety: number | null = null
      let ageDays: number | null = null
      try {
        if (!configRef.current) configRef.current = await getConfig()
        const rows = await getCreatures(sale.seller)
        const row = rows.find((r) => String(r.asset_id) === sale.assetId)
        if (row) {
          const cfg = configRef.current
          const liveFedDur = cfg?.[`fed_dur_${sale.rarity}` as keyof ChainConfig] as number | undefined
          const fedDur = fedDurFor(sale.rarity, undefined, liveFedDur)
          const now = Math.floor(Date.now() / 1000)
          satiety = Math.round(computeSatiety(row.last_fed ?? 0, now, fedDur).percent)
          if (row.born_at) ageDays = Math.max(0, Math.floor((now - row.born_at) / 86400))
        }
      } catch { /* bars show "—" */ }
      if (cancelled) return
      const mintedAt = meta?.mintedAt ?? 0
      const fullHistory = mintedAt
        ? [...history.filter((h) => h.event !== 'Mint'), { event: 'Mint' as const, from: marketCollection(), to: '', price: '', at: mintedAt }]
        : history
      setExtras({ meta, history: fullHistory.sort((a, b) => b.at - a.at), satiety, ageDays })
    })()
    return () => {
      cancelled = true
    }
  }, [view, listings])

  // ── Derived board data ───────────────────────────────────────────────────────
  const oddsByRarity = useMemo(() => {
    const m = new Map<Rarity, HatchOdds>()
    for (const o of hatchOdds) m.set(o.rarity, o)
    return m
  }, [hatchOdds])

  const tierPrices = useMemo(() => {
    const m = new Map<Rarity, { floor: number; median: number }>()
    for (const tier of RARITY_ORDER) {
      const prices = (listings ?? [])
        .filter((l) => l.rarity === tier && l.price.symbol === 'WAX')
        .map((l) => l.price.amount)
        .sort((a, b) => a - b)
      if (prices.length) m.set(tier, { floor: prices[0], median: prices[Math.floor(prices.length / 2)] })
    }
    return m
  }, [listings])

  const speciesOptions = useMemo(() => {
    const names = new Set<string>()
    for (const l of listings ?? []) names.add(speciesOf(l.genetics))
    return [...names].sort()
  }, [listings])

  const visible = useMemo(() => {
    let rows = [...(listings ?? [])]
    if (rarityFilter !== 'all') rows = rows.filter((l) => l.rarity === rarityFilter)
    if (speciesFilter !== 'all') rows = rows.filter((l) => speciesOf(l.genetics) === speciesFilter)
    if (stageFilter !== 'any') rows = rows.filter((l) => l.stage === Number(stageFilter))
    switch (sort) {
      case 'price-asc': rows.sort((a, b) => a.price.amount - b.price.amount); break
      case 'price-desc': rows.sort((a, b) => b.price.amount - a.price.amount); break
      case 'newest': rows.sort((a, b) => b.listedAt - a.listedAt); break
      case 'stage': rows.sort((a, b) => b.stage - a.stage); break
      case 'rarity':
        rows.sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))
        break
    }
    return rows
  }, [listings, rarityFilter, speciesFilter, stageFilter, sort])

  const listedAssetIds = useMemo(
    () => new Set((listings ?? []).filter((l) => l.seller === actor).map((l) => l.assetId)),
    [listings, actor],
  )
  const sellable = useMemo(
    () => creatures.filter((c) => !listedAssetIds.has(c.assetId)),
    [creatures, listedAssetIds],
  )

  // ── Action wrappers (navigate home + refetch on success) ─────────────────────
  const doBuy = useCallback(
    async (saleId: string) => {
      const r = await onBuy(saleId)
      if (r && r.ok) setView({ kind: 'browse' })
      refetchSoon()
    },
    [onBuy, refetchSoon],
  )
  const doCancel = useCallback(
    async (saleId: string) => {
      const r = await onCancel(saleId)
      if (r && r.ok) setView({ kind: 'browse' })
      refetchSoon()
    },
    [onCancel, refetchSoon],
  )
  const doList = useCallback(
    async (assetId: string, price: number) => {
      const r = await onList(assetId, price)
      if (r && r.ok) {
        setView({ kind: 'browse' })
        setPriceInput('')
      }
      refetchSoon()
    },
    [onList, refetchSoon],
  )
  /** Edit Price = delist, then relist at the new price — two signatures. */
  const doReprice = useCallback(
    async (sale: MarketListing, price: number) => {
      const r1 = await onCancel(sale.saleId)
      if (!(r1 && r1.ok)) {
        refetchSoon()
        return
      }
      const r2 = await onList(sale.assetId, price)
      if (r2 && r2.ok) {
        setView({ kind: 'browse' })
        setEditingPrice(false)
        setPriceInput('')
      }
      refetchSoon()
    },
    [onCancel, onList, refetchSoon],
  )

  const priceNum = Number(priceInput)
  const priceValid = Number.isFinite(priceNum) && priceNum > 0

  // ── Shared bits ──────────────────────────────────────────────────────────────
  const rarityChip = (tier: Rarity) => {
    const odds = oddsByRarity.get(tier)
    return (
      <button
        key={tier}
        type="button"
        className={`${styles.chip} ${styles[`chip${cap(tier)}`]} ${rarityFilter === tier ? styles.chipSel : ''}`}
        onClick={() => setRarityFilter(rarityFilter === tier ? 'all' : tier)}
        data-testid={`market-chip-${tier}`}
      >
        ● {cap(tier)}{' '}
        {odds ? <span className={styles.chipPct}>{odds.pct}%</span> : null}
      </button>
    )
  }

  const sprite = (genetics: string, assetId: string, rarity: Rarity, bake: boolean) =>
    genetics ? (
      <CreatureSprite
        genetics={genetics}
        species={speciesSlugOf(genetics)}
        assetId={assetId}
        rarity={rarity}
        bakeUntilActive={bake}
      />
    ) : (
      <span style={{ fontSize: 42 }}>🥚</span>
    )

  // ── Detail: one LISTED sale ──────────────────────────────────────────────────
  if (view.kind === 'listing' && openSale) {
    const l = openSale
    const mine = actor != null && l.seller === actor
    const tier = tierPrices.get(l.rarity)
    const odds = oddsByRarity.get(l.rarity)
    const displayName = l.name || speciesOf(l.genetics)
    const busy = animating
    return (
      <div className={styles.page} data-testid="market-detail">
        <button type="button" className={styles.backBtn} onClick={() => { setView({ kind: 'browse' }); setEditingPrice(false) }}>
          ← Marketplace
        </button>
        <div className={styles.dLayout}>
          <div>
            <div className={`${styles.dCardWrap} ${styles[`dWrap${cap(l.rarity)}`]}`}>
              {sprite(l.genetics, l.assetId, l.rarity, false)}
            </div>
            <div className={styles.dMeta}>
              <div className={styles.metaRow}><span className={styles.mkey}>Collection</span><span className={styles.mval}>{marketCollection()}</span></div>
              <div className={styles.metaRow}><span className={styles.mkey}>Asset ID</span><span className={styles.mvalMono}>{l.assetId}</span></div>
              <div className={styles.metaRow}><span className={styles.mkey}>Template</span><span className={styles.mvalMono}>{l.templateId ? `#${l.templateId}` : '—'}</span></div>
              <div className={styles.metaRow}><span className={styles.mkey}>Schema</span><span className={styles.mval}>creatures</span></div>
              <div className={styles.metaRow}>
                <span className={styles.mkey}>Minted</span>
                <span className={styles.mval}>
                  {extras?.meta?.mintedAt ? new Date(extras.meta.mintedAt).toISOString().slice(0, 10) : '—'}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.mkey}>Mint #</span>
                <span className={styles.mval}>{l.templateMint || extras?.meta?.templateMint || '—'}</span>
              </div>
            </div>
          </div>

          <div className={styles.dPanel}>
            <div className={styles.dName}>
              <span>{displayName}</span>
              <span className={styles.dNameId}>#{l.assetId.slice(-4)}</span>
            </div>
            <div className={styles.badges}>
              <span className={`${styles.rbadge} ${styles.badgeLg} ${styles[`rbadge${cap(l.rarity)}`]}`}>
                ✦ {l.rarity.toUpperCase()}
              </span>
              <span className={styles.badgeStage}>{stageLabel(l.stage)}</span>
            </div>

            <div className={styles.priceLabel}>Listing Price</div>
            <div className={styles.priceBig}>
              <span data-testid="detail-price">{fmtWaxShort(l.price.amount)}</span>
              <span className={styles.priceBigSym}>{l.price.symbol}</span>
            </div>
            <div className={styles.floorLine}>
              Floor <b>{tier ? `${fmtWaxShort(tier.floor)} WAX` : '—'}</b> · Median{' '}
              <b>{tier ? `${fmtWaxShort(tier.median)} WAX` : '—'}</b>
            </div>
            <div className={styles.sellerLine}>
              Listed by <span className={styles.sellerName}>{l.seller}</span> · {timeAgo(l.listedAt)} · Sale #{l.saleId}
            </div>

            {/* Buy · Edit Price · Delist — hidden for the read-only spectator. */}
            {!readOnly && (
              mine ? (
                <>
                  {editingPrice && (
                    <div className={styles.priceInputRow}>
                      <input
                        className={styles.priceInput}
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="New price"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        data-testid="reprice-input"
                      />
                      <span className={styles.priceInputSym}>WAX</span>
                    </div>
                  )}
                  {editingPrice && (
                    <p className={styles.noteLine}>
                      Updating the price delists first, then relists — two signatures.
                    </p>
                  )}
                  <div className={styles.btnRow}>
                    {editingPrice ? (
                      <button
                        type="button"
                        className={styles.btnList}
                        disabled={busy || !priceValid}
                        onClick={() => void doReprice(l, priceNum)}
                        data-testid="reprice-confirm"
                      >
                        Relist at {priceValid ? `${fmtWaxShort(priceNum)} WAX` : '…'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnList}
                        disabled={busy}
                        onClick={() => { setEditingPrice(true); setPriceInput(String(l.price.amount)) }}
                        data-testid="edit-price-btn"
                      >
                        Edit Price
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.btnCancel}
                      disabled={busy}
                      onClick={() => void doCancel(l.saleId)}
                      data-testid="delist-btn"
                    >
                      Delist
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.btnRow}>
                  <button
                    type="button"
                    className={`${styles.btnBuy} ${styles[`buy${cap(l.rarity)}`]}`}
                    disabled={busy}
                    onClick={() => void doBuy(l.saleId)}
                    data-testid="buy-btn"
                  >
                    Buy Now · {fmtWaxShort(l.price.amount)} {l.price.symbol}
                  </button>
                </div>
              )
            )}

            <div className={styles.divider} />

            <div className={styles.secTitle}>Creature Stats — Mutable · On-chain</div>
            <div className={styles.dataGrid} style={{ marginBottom: 14 }}>
              <div className={styles.dcell}><div className={styles.dkey}>Stage</div><div className={styles.dval}>{stageLabel(l.stage).replace('Stage ', '')}</div></div>
              <div className={styles.dcell}><div className={styles.dkey}>Age</div><div className={styles.dval}>{extras?.ageDays != null ? `${extras.ageDays} days` : '—'}</div></div>
              <div className={styles.dcell}><div className={styles.dkey}>Growth</div><div className={styles.dval}>{l.growth} / 100</div></div>
              <div className={styles.dcell}><div className={styles.dkey}>Owner</div><div className={styles.dval} style={{ fontSize: 12 }}>{extras?.meta?.owner || l.seller}</div></div>
            </div>
            <div className={styles.sbarWrap}>
              <div className={styles.sbarHdr}><span>Satiety</span><b>{extras?.satiety != null ? `${extras.satiety}%` : '—'}</b></div>
              <div className={styles.sbarTrack}>
                <div className={`${styles.sbarFill} ${styles.sbarSatiety}`} style={{ width: `${extras?.satiety ?? 0}%` }} />
              </div>
            </div>
            <div className={styles.sbarWrap}>
              <div className={styles.sbarHdr}><span>Growth Progress</span><b>{l.growth} / 100</b></div>
              <div className={styles.sbarTrack}>
                <div className={`${styles.sbarFill} ${styles.sbarGrowth}`} style={{ width: `${Math.min(l.growth, 100)}%` }} />
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.secTitle}>Creature Data — On-chain · Permanent</div>
            <div className={styles.dataGrid}>
              <div className={styles.dcell}><div className={styles.dkey}>Species</div><div className={styles.dval}>{speciesOf(l.genetics)}</div></div>
              <div className={styles.dcell}>
                <div className={styles.dkey}>Rarity (egg_type)</div>
                <div className={`${styles.dval} ${styles[`rarity${cap(l.rarity)}`]}`}>
                  {cap(l.rarity)} ({RARITY_ORDER.indexOf(l.rarity)})
                </div>
              </div>
              <div className={styles.dcell}>
                <div className={styles.dkey}>Earn Multiplier</div>
                <div className={styles.dval}>{odds ? `× ${odds.earnMult.toFixed(1)}` : '—'}</div>
              </div>
              <div className={styles.dcell}>
                <div className={styles.dkey}>Drop Rate</div>
                <div className={styles.dval}>{odds ? `${odds.pct}%` : '—'}</div>
              </div>
            </div>
            <div className={styles.geneCell}>
              <div className={styles.dkey} style={{ marginBottom: 4 }}>Genetics Hash</div>
              <div className={styles.dvalMono}>{l.genetics || '—'}</div>
            </div>

            <div className={styles.divider} />

            <div className={styles.secTitle}>Ownership History</div>
            {extras && extras.history.length > 0 ? (
              <table className={styles.htable}>
                <thead>
                  <tr><th>Event</th><th>From</th><th>To</th><th>Price</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {extras.history.map((h, i) => (
                    <tr key={i}>
                      <td className={h.event === 'Mint' ? styles.evMint : undefined}>{h.event}</td>
                      <td>{h.from || '—'}</td>
                      <td>{h.to || '—'}</td>
                      <td className={h.price ? styles.hPrice : undefined}>{h.price || '—'}</td>
                      <td>{h.at ? new Date(h.at).toISOString().slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.noteLine}>{extras ? 'No recorded events yet.' : 'Loading history…'}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Detail: list one of YOUR creatures (owner-unlisted state) ────────────────
  if (view.kind === 'sell') {
    const c = creatures.find((x) => x.assetId === view.assetId)
    if (!c) {
      // Sold/burned mid-flow — fall back to the board.
      setTimeout(() => setView({ kind: 'browse' }), 0)
      return null
    }
    const rarity = (c.rarity || 'common') as Rarity
    const tier = tierPrices.get(rarity)
    const odds = oddsByRarity.get(rarity)
    const displayName = c.nickname || c.name
    const busy = animating
    return (
      <div className={styles.page} data-testid="market-sell">
        <button type="button" className={styles.backBtn} onClick={() => setView({ kind: 'browse' })}>
          ← Marketplace
        </button>
        <div className={styles.dLayout}>
          <div>
            <div className={`${styles.dCardWrap} ${styles[`dWrap${cap(rarity)}`]}`}>
              {sprite(c.genetics, c.assetId, rarity, false)}
            </div>
            <div className={styles.dMeta}>
              <div className={styles.metaRow}><span className={styles.mkey}>Collection</span><span className={styles.mval}>{marketCollection()}</span></div>
              <div className={styles.metaRow}><span className={styles.mkey}>Asset ID</span><span className={styles.mvalMono}>{c.assetId}</span></div>
              <div className={styles.metaRow}><span className={styles.mkey}>Schema</span><span className={styles.mval}>creatures</span></div>
            </div>
          </div>
          <div className={styles.dPanel}>
            <div className={styles.dName}>
              <span>{displayName}</span>
              <span className={styles.dNameId}>#{c.assetId.slice(-4)}</span>
            </div>
            <div className={styles.badges}>
              <span className={`${styles.rbadge} ${styles.badgeLg} ${styles[`rbadge${cap(rarity)}`]}`}>
                ✦ {rarity.toUpperCase()}
              </span>
              <span className={styles.badgeStage}>{stageLabel(c.stage)}</span>
            </div>

            <div className={styles.priceLabel}>Your Asking Price</div>
            <div className={styles.priceInputRow}>
              <input
                className={styles.priceInput}
                type="number"
                min="0"
                step="0.1"
                placeholder="Price"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                data-testid="list-price-input"
              />
              <span className={styles.priceInputSym}>WAX</span>
            </div>
            <div className={styles.floorLine}>
              {cap(rarity)} floor <b>{tier ? `${fmtWaxShort(tier.floor)} WAX` : 'no listings yet'}</b>
              {odds ? <> · earns <b>× {odds.earnMult.toFixed(1)}</b></> : null}
            </div>
            <p className={styles.noteLine}>
              Listing signs one atomic transaction (announce the sale + escrow the offer).
              The creature stays yours until someone buys it — you can delist any time.
            </p>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.btnList}
                disabled={busy || !priceValid}
                onClick={() => void doList(c.assetId, priceNum)}
                data-testid="list-confirm-btn"
              >
                List for Sale{priceValid ? ` · ${fmtWaxShort(priceNum)} WAX` : ''}
              </button>
              {tier && (
                <button
                  type="button"
                  className={styles.btnSell}
                  disabled={busy}
                  onClick={() => void doList(c.assetId, tier.floor)}
                  data-testid="list-floor-btn"
                >
                  Sell at Floor · {fmtWaxShort(tier.floor)} WAX
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Browse ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="market-browse">
      <div className={styles.pgTitle}>🏪 Marketplace</div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.chip} ${styles.chipAll} ${rarityFilter === 'all' ? styles.chipAllSel : ''}`}
          onClick={() => setRarityFilter('all')}
          data-testid="market-chip-all"
        >
          All
        </button>
        {RARITY_ORDER.map(rarityChip)}
        <div className={styles.fsep} />
        <select className={styles.fsel} value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} aria-label="Filter by species">
          <option value="all">All Species</option>
          {speciesOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={styles.fsel} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Filter by stage">
          <option value="any">Stage: Any</option>
          {STAGE_WORDS.map((w, i) => (
            <option key={w} value={String(i)}>Stage {i} — {w}</option>
          ))}
        </select>
        <select
          className={`${styles.fsel} ${styles.fselRight}`}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort listings"
        >
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="newest">Newest First</option>
          <option value="stage">Highest Stage</option>
          <option value="rarity">Rarity</option>
        </select>
      </div>

      <div className={styles.stats} data-testid="market-stats">
        <div className={styles.stItem}><span className={styles.stVal}>{stats?.listings ?? '…'}</span><span className={styles.stLabel}>listings</span></div>
        <span className={styles.stDot}>·</span>
        <div className={styles.stItem}><span className={styles.stLabel}>Floor</span> <span className={styles.stVal}>{stats?.floor != null ? `${fmtWaxShort(stats.floor)} WAX` : '—'}</span></div>
        <span className={styles.stDot}>·</span>
        <div className={styles.stItem}><span className={styles.stLabel}>Median</span> <span className={styles.stVal}>{stats?.median != null ? `${fmtWaxShort(stats.median)} WAX` : '—'}</span></div>
        <span className={styles.stDot}>·</span>
        <div className={styles.stItem}>
          <span className={styles.stLabel}>Mythic floor</span>{' '}
          <span className={styles.stValMythic}>{stats?.mythicFloor != null ? `${fmtWaxShort(stats.mythicFloor)} WAX` : '—'}</span>
        </div>
        <span className={styles.stDot}>·</span>
        <div className={styles.stItem}><span className={styles.stLabel}>24h vol</span> <span className={styles.stVal}>{stats ? `${fmtWaxShort(stats.vol24h)} WAX` : '—'}</span></div>
        <span className={styles.stDot}>·</span>
        <div className={styles.stItem}><span className={styles.stLabel}>24h sales</span> <span className={styles.stVal}>{stats?.sales24h ?? '—'}</span></div>
      </div>

      {error && listings == null ? (
        <div className={styles.boardState} data-testid="market-error">
          <span className={styles.boardStateIcon}>📡</span>
          Could not reach the market indexer — {error}
          <div style={{ marginTop: 12 }}>
            <button type="button" className={styles.btnCancel} onClick={() => void refresh()}>Retry</button>
          </div>
        </div>
      ) : listings == null ? (
        <div className={styles.boardState} data-testid="market-loading">
          <span className={styles.boardStateIcon}>⏳</span>
          Loading live listings…
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.boardState} data-testid="market-empty">
          <span className={styles.boardStateIcon}>🪺</span>
          {listings.length === 0
            ? 'No creatures listed yet — the market is wide open.'
            : 'No listing matches these filters.'}
          {listings.length === 0 && !readOnly && sellable.length > 0 && (
            <div style={{ marginTop: 6 }}>Be the first: list one of your creatures below!</div>
          )}
        </div>
      ) : (
        <div className={styles.grid} data-testid="market-grid">
          {visible.map((l) => {
            const mine = actor != null && l.seller === actor
            const tier = tierPrices.get(l.rarity)
            const displayName = l.name || speciesOf(l.genetics)
            return (
              <button
                type="button"
                key={l.saleId}
                className={`${styles.lcard} ${styles[`lcard${cap(l.rarity)}`]}`}
                onClick={() => setView({ kind: 'listing', saleId: l.saleId })}
                data-testid={`market-card-${l.assetId}`}
                data-rarity={l.rarity}
              >
                {mine && <div className={styles.mineBadge}>My Listing</div>}
                <div className={styles.cardArt}>{sprite(l.genetics, l.assetId, l.rarity, true)}</div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardHdr}>
                    <span className={styles.cardName}>{displayName} #{l.assetId.slice(-4)}</span>
                    <span className={`${styles.rbadge} ${styles[`rbadge${cap(l.rarity)}`]}`}>{l.rarity.toUpperCase()}</span>
                  </div>
                  <div className={styles.stageRow}>
                    <span className={`${styles.sdot} ${styles[`sdot${cap(l.rarity)}`]}`} />
                    {stageLabel(l.stage)}
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.pAmt}>{fmtWaxShort(l.price.amount)}</span>
                    <span className={styles.pSym}>{l.price.symbol}</span>
                  </div>
                  <div className={styles.floorRow}>
                    Floor <b>{tier ? `${fmtWaxShort(tier.floor)} W` : '—'}</b> · Med{' '}
                    <b>{tier ? `${fmtWaxShort(tier.median)} W` : '—'}</b>
                  </div>
                  {/* Spectators browse without action controls (play.ts refuses to sign anyway). */}
                  {!readOnly && (
                    <span
                      role="button"
                      className={`${styles.buyBtn} ${styles[`buy${cap(l.rarity)}`]}`}
                      style={{ display: 'block', textAlign: 'center', pointerEvents: animating ? 'none' : undefined, opacity: animating ? 0.5 : undefined }}
                      onClick={(e) => {
                        e.stopPropagation()
                        void (mine ? doCancel(l.saleId) : doBuy(l.saleId))
                      }}
                      data-testid={mine ? `card-cancel-${l.assetId}` : `card-buy-${l.assetId}`}
                    >
                      {mine ? 'Cancel Listing' : 'Buy Now'}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Live drop rates (configv3 weights — the same odds the hatch panel shows). */}
      <div className={styles.oddsBar}>
        <span className={styles.oddsBarLabel}>Drop Rates</span>
        {RARITY_ORDER.map((tier) => {
          const o = oddsByRarity.get(tier)
          return (
            <span key={tier} style={{ display: 'contents' }}>
              <span className={styles.oddSep}>·</span>
              <span className={`${styles.odd} ${tier === 'mythic' ? styles.oddMythic : ''}`}>
                <span className={`${styles.oddDot} ${styles[`sdot${cap(tier)}`]}`} />
                <span className={styles[`rarity${cap(tier)}`]}>{cap(tier)}</span>
                <span className={styles.oddPct}>{o ? `${o.pct}%` : '—'}</span>
              </span>
            </span>
          )
        })}
      </div>

      {/* Sell strip — the player's own unlisted creatures. Spectators never see it. */}
      {!readOnly && sellable.length > 0 && (
        <section className={styles.sellSection} data-testid="market-sell-strip">
          <div className={styles.sellHead}>
            <h3 className={styles.sellTitle}>💰 Sell Your Creatures</h3>
            <span className={styles.sellHint}>Pick one to list it on the market</span>
          </div>
          <div className={styles.sellStrip}>
            {sellable.map((c) => {
              const rarity = (c.rarity || 'common') as Rarity
              return (
                <button
                  type="button"
                  key={c.assetId}
                  className={styles.sellCard}
                  onClick={() => { setView({ kind: 'sell', assetId: c.assetId }); setPriceInput('') }}
                  data-testid={`sell-card-${c.assetId}`}
                >
                  <div className={styles.sellArt}>{sprite(c.genetics, c.assetId, rarity, true)}</div>
                  <div className={styles.sellInfo}>
                    <div className={styles.sellName}>{c.nickname || c.name}</div>
                    <div className={styles.sellMeta}>
                      {cap(rarity)} · {STAGE_WORDS[Math.min(Math.max(c.stage, 0), 5)]}
                    </div>
                    <span className={styles.sellListBtn}>List for Sale</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
