import { useCallback, useEffect, useState } from 'react'
import { useGameActions, type ConnectMode, type LastAction, type PendingSign } from './play'
import { getActiveNetwork, isPlayable } from './network'
import { CreatureCard, type Creature } from './components/CreatureCard'
import { BreedingPage } from './components/BreedingPage'
import { useDemoGame } from './demoGame'
import { openWaxwingPanel } from './waxwing'
import { speciesIdFromGene } from './geneDecoder'
import { PREVIEW_SATIETY_CONFIG, BASE_EARN_BY_STAGE, RARITY_EARN_MULT } from './satiety'
import styles from './App.module.css'

// Production base path so raw-string <img src> resolves inside the plugin static dir.
// Vite's `base` is set to `/plugin/pocket-hatchery/static/` in vite.config.ts.
const BASE = import.meta.env.BASE_URL

// Hero art is gene-driven, just like CreatureCard's sprite: decode the species
// slug from the creature's genetics (gene bits 0–3) instead of trusting
// `creature.species`, which on chain is the elemental FAMILY ("Fire"/"Water"…)
// and would 404 the hero SVG. Falls back to foxling when there are no creatures
// or the gene is unreadable.
function heroSlug(genetics: string | undefined): string {
  if (genetics) {
    try {
      return speciesIdFromGene(genetics)
    } catch {
      /* malformed/short gene → foxling */
    }
  }
  return 'foxling'
}

/** Format seconds into a human-readable countdown (e.g. "2h 34m", "5m 12s", "42s"). */
function formatCooldown(seconds: number): string {
  if (seconds <= 0) return 'Ready'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// The active network (dev switcher: ?network=wax-mainnet, default wax-testnet).
// Internal-only — there is NO public toggle; this just reflects the URL param.
const NETWORK = getActiveNetwork()
const IS_DEMO = new URLSearchParams(window.location.search).has('demo')
// Feed-v2 preview lab (?feedlab): renders satiety cards on the FAST preview clock
// (30s full→empty) so the decaying bar + stateful Feed button can be seen/verified
// live, independent of a wallet or the chain. Internal dev/QA surface only.
const IS_FEEDLAB = new URLSearchParams(window.location.search).has('feedlab')

// ── Toast ──────────────────────────────────────────────────────────
function Toast({ action, onDone }: { action: LastAction; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className={`${styles.toast} ${!action.ok ? styles.toastError : ''}`}>
      {action.ok ? '✅' : '❌'} {action.label}
      {action.error ? ` — ${action.error}` : ''}
    </div>
  )
}

// ── Hatch Overlay ──────────────────────────────────────────────────
// Shows the egg cracking → sparkle → baby reveal sequence.
// Accepts species info so the correct species SVG + name are shown
// instead of the old hardcoded Foxling.
function HatchOverlay({
  speciesId,
  speciesName,
  onDone,
}: {
  speciesId: string
  speciesName: string
  onDone: () => void
}) {
  const [phase, setPhase] = useState<'shaking' | 'sparkle' | 'baby'>('shaking')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('sparkle'), 1600)
    const t2 = setTimeout(() => setPhase('baby'), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={styles.hatchOverlay} onClick={onDone}>
      <div className={styles.hatchScene}>
        {phase !== 'baby' && (
          <img className={styles.hatchEgg} src={`${BASE}assets/creature-egg.png`} alt="" />
        )}
        {phase !== 'shaking' && <div className={styles.hatchSparkle}>✨</div>}
        {phase === 'baby' && (
          <>
            <img
              className={styles.hatchBaby}
              src={`${BASE}assets/creatures/${speciesId}.svg`}
              alt={`Baby ${speciesName}`}
            />
            <span className={styles.hatchMsg}>🎉 A {speciesName} is born!</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sign Sheet (the amber moment) ──────────────────────────────────
// In waxwing mode every gameplay action builds a sign-intent first; this is the
// popup the player reads before anything broadcasts. Sign → confirmPending
// (broadcast); Cancel → cancelPending (drop). WCW mode never reaches here —
// the browser wallet pops its own sheet.
function SignSheet({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingSign
  onConfirm: () => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const i = pending.intent
  const isMainnet = i.chainKind === 'mainnet'
  const dataStr = i.data && Object.keys(i.data).length ? JSON.stringify(i.data) : '—'
  const doSign = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.signOverlay} role="dialog" aria-modal="true">
      <div className={styles.signCard}>
        <div className={styles.signTitleRow}>
          <span className={styles.signSeal} />
          <h3 className={styles.signTitle}>Confirm Action</h3>
        </div>
        <p className={styles.signSub}>
          waxwing will sign and broadcast the real transaction when you tap Sign — nothing goes on-chain until then.
        </p>
        <div className={styles.signHeadline}>
          <div className={styles.signHeadlineLabel}>Game action</div>
          <div className={styles.signHeadlineValue}>{pending.label}</div>
        </div>
        <div className={styles.signRows}>
          <div className={styles.signRow}>
            <span className={styles.signRowKey}>Action</span>
            <span className={styles.signRowVal}>{i.action}</span>
          </div>
          <div className={styles.signRow}>
            <span className={styles.signRowKey}>Account</span>
            <span className={styles.signRowVal}>{i.owner}</span>
          </div>
          <div className={styles.signRow}>
            <span className={styles.signRowKey}>Contract</span>
            <span className={styles.signRowVal}>{i.contract}</span>
          </div>
          <div className={styles.signRow}>
            <span className={styles.signRowKey}>Data</span>
            <span className={styles.signRowVal}>{dataStr}</span>
          </div>
          <div className={styles.signRow}>
            <span className={styles.signRowKey}>Network</span>
            <span className={styles.signRowVal}>
              {i.network}
              <span className={`${styles.signPill} ${isMainnet ? styles.signPillMain : styles.signPillTest}`}>
                {i.chainKind}
              </span>
            </span>
          </div>
        </div>
        {isMainnet && <div className={styles.signBanner}>⚠️ Mainnet — Real Value</div>}
        <button className={styles.signBtn} onClick={doSign} disabled={busy}>
          {busy ? 'Signing…' : '🔏 Sign'}
        </button>
        <button className={styles.signCancel} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── App ─────────────────────────────────────────────────────────────
// Router: demo mode is wallet-free; otherwise render the real wallet-driven
// dashboard. Splitting into separate components means `useGameActions` (and
// every other hook) is only called on the connected path, so there is no chance
// of a rules-of-hooks violation across the demo/connected branches.
export default function App() {
  if (IS_FEEDLAB) return <FeedLab />
  if (IS_DEMO) return <DemoDashboard />
  return <ConnectedDashboard />
}

// ── Feed v2 Preview Lab (?feedlab) ──────────────────────────────────────────
// A wallet-free harness for the new satiety mechanic. Three creatures across the
// rarity range start at different points on the decay curve so you can watch one
// slide Full → Hungry → Starving in real time (fast preview clock), and clicking
// Feed refills its bar. This is the surface the verify script drives headlessly.
function FeedLab() {
  // Foxling gene (species bits 0–3 = 0) so the sprite resolves; the satiety
  // mechanic itself is gene-independent.
  const GENE = '0000000000000000' + '0'.repeat(48)
  const now = Math.floor(Date.now() / 1000)
  const seed: Creature[] = [
    {
      assetId: '1001', name: 'Foxling', species: 'Fire', stage: 2, maxStage: 4,
      rarity: 'common', growth: 6000, growthToNext: 20000, genetics: GENE,
      lastFed: now, // full
    },
    {
      assetId: '1002', name: 'Owlet', species: 'Water', stage: 3, maxStage: 4,
      rarity: 'uncommon', growth: 22000, growthToNext: 100000, genetics: GENE,
      lastFed: now - 12, // ~40% → hungry soon (preview clock)
    },
    {
      assetId: '1003', name: 'Dracling', species: 'Void', stage: 3, maxStage: 4,
      rarity: 'rare', growth: 30000, growthToNext: 100000, genetics: GENE,
      lastFed: now - 24, // ~20% → starving
    },
  ]
  const [creatures, setCreatures] = useState<Creature[]>(seed)

  const feed = useCallback((assetId: string) => {
    setCreatures((prev) =>
      prev.map((c) =>
        c.assetId === assetId ? { ...c, lastFed: Math.floor(Date.now() / 1000) } : c,
      ),
    )
  }, [])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logoImg} src={`${BASE}assets/creature-egg.png`} alt="" />
          <h1 className={styles.title}>Pocket Hatchery</h1>
        </div>
        <div className={styles.headerRight}>
          <div
            className={styles.chainBadge}
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <span className={styles.chainDot} style={{ background: '#F59E0B' }} />
            🍽️ Feed v2 Lab
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <section>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Satiety Preview</h2>
            <span className={styles.sectionCount}>fast clock · 30s full→empty</span>
          </div>
          <div className={styles.grid} data-testid="feedlab-grid">
            {creatures.map((c) => (
              <CreatureCard
                key={c.assetId}
                creature={c}
                satietyConfig={PREVIEW_SATIETY_CONFIG}
                onFeed={() => feed(c.assetId)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Connected Dashboard (WCW / waxwing wallet required) ─────────────
function ConnectedDashboard() {
  const game = useGameActions()
  const [connected, setConnected] = useState(
    () => new URLSearchParams(window.location.search).has('dash')
  )
  const [connecting, setConnecting] = useState<ConnectMode | null>(null)
  const [showHatch, setShowHatch] = useState(false)
  const [hatchSpecies, setHatchSpecies] = useState<{ speciesId: string; speciesName: string }>({
    speciesId: 'foxling',
    speciesName: 'Foxling',
  })
  const [toast, setToast] = useState<LastAction | null>(null)
  const [tab, setTab] = useState<'creatures' | 'breeding'>('creatures')

  // ── Cooldown timers (live-updating every 1s so the player sees the countdown
  //     tick down in the button subtitle without having to click first). ──────
  const [harvestCdLeft, setHarvestCdLeft] = useState(0)
  const [claimCdLeft, setClaimCdLeft] = useState(0)

  useEffect(() => {
    const r = game.resources
    function tick() {
      const now = Math.floor(Date.now() / 1000)
      const cd = r.harvestCd || 0
      setHarvestCdLeft(Math.max(0, r.lastHarvest + cd - now))
      // Claim cooldown: only tick if not already claimed this season.
      if (r.currentSeason > 0 && r.claimedSeason >= r.currentSeason) {
        setClaimCdLeft(0)
      } else {
        setClaimCdLeft(Math.max(0, r.lastClaimed + cd - now))
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [game.resources.lastHarvest, game.resources.lastClaimed, game.resources.harvestCd, game.resources.claimedSeason, game.resources.currentSeason])

  // Track lastAction changes as toast
  useEffect(() => {
    if (game.lastAction) {
      // Wallet locked → auto-open waxwing panel instead of showing an error toast
      if (game.lastAction.needsUnlock) {
        openWaxwingPanel()
        return // don't show error toast for locked wallet
      }
      setToast(game.lastAction)
    }
  }, [game.lastAction])

  const connect = useCallback(async (mode: ConnectMode) => {
    setConnecting(mode)
    try {
      await game.connectWallet(mode)
      // Connected for read/dashboard use even when waxwing is locked (sign will
      // surface "wallet LOCKED" then). Only the mainnet-not-deployed guard leaves
      // us on the landing screen.
      if (isPlayable()) setConnected(true)
    } catch { /* stay on landing */ }
    finally { setConnecting(null) }
  }, [game])

  const onHatch = useCallback(async () => {
    // Pick a random species for the hatch animation — the card will update
    // to the real species once the chain tx lands and refresh runs.
    const SPECIES = [
      { speciesId: 'foxling', speciesName: 'Foxling' },
      { speciesId: 'owlet', speciesName: 'Owlet' },
      { speciesId: 'droplet', speciesName: 'Droplet' },
      { speciesId: 'pebblit', speciesName: 'Pebblit' },
      { speciesId: 'sproutling', speciesName: 'Sproutling' },
      { speciesId: 'flicker', speciesName: 'Flicker' },
      { speciesId: 'glimmer', speciesName: 'Glimmer' },
      { speciesId: 'wisp', speciesName: 'Wisp' },
      { speciesId: 'fluffle', speciesName: 'Fluffle' },
      { speciesId: 'shellby', speciesName: 'Shellby' },
      { speciesId: 'dracling', speciesName: 'Dracling' },
      { speciesId: 'buzzle', speciesName: 'Buzzle' },
    ]
    const pick = SPECIES[Math.floor(Math.random() * SPECIES.length)]
    setHatchSpecies(pick)
    try {
      await game.hatch()
      setShowHatch(true)
      setTimeout(() => setShowHatch(false), 2800)
    } catch { /* toast handles */ }
  }, [game])

  // ── LANDING ───────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className={styles.app}>
        <img className={styles.bgOverlay} src={`${BASE}assets/bg-farm-v2.png`} alt="" aria-hidden="true" />
        <div className={styles.landing}>
          <div className={styles.landingCard}>
            <img className={styles.landingLogo} src={`${BASE}assets/creature-egg.png`} alt="" />
            <h1 className={styles.landingTitle}>Pocket Hatchery</h1>
            <p className={styles.landingSub}>
              Hatch, raise, and evolve magical creatures on the WAX blockchain.
              Every creature is a unique NFT that grows with your care.
            </p>
            <div className={styles.connectRow}>
              <button
                className={styles.hatchBtn}
                onClick={() => connect('wcw')}
                disabled={!!connecting}
              >
                {connecting === 'wcw' ? 'Connecting…' : '☁️ Connect WAX Cloud Wallet'}
              </button>
              {/* Connect #2 (internal): drive the office waxwing daemon wallet instead of
                  popping a browser wallet. Same game actions, the daemon keystore signs.
                  Reads waxwing status/account/balance; signs via waxwing pushaction. */}
              <button
                className={styles.connectSecondary}
                onClick={() => connect('waxwing')}
                disabled={!!connecting}
              >
                <span className={styles.connectSecondaryIcon}>🪙</span>
                {connecting === 'waxwing' ? 'Connecting…' : 'Connect via waxwing'}
              </button>
            </div>
            <span className={styles.landingFooter}>Free to play · {NETWORK.label}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────
  const r = game.resources

  return (
    <div className={styles.app}>
      <img className={styles.bgOverlay} src={`${BASE}assets/bg-farm-v2.png`} alt="" aria-hidden="true" />
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logoImg} src={`${BASE}assets/creature-egg.png`} alt="" />
          <h1 className={styles.title}>Pocket Hatchery</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.chainBadge}>
            <span className={styles.chainDot} />
            {NETWORK.label}
          </div>
          {/* Which connect backend + account is live — needed to verify a waxwing
              sign test uses the right account (switch OFF pockethatch1 before sign). */}
          {game.connectMode && (
            <div className={styles.walletPill} title={`Connected via ${game.connectMode}`}>
              <span className={styles.walletMode}>{game.connectMode === 'waxwing' ? '🪙' : '☁️'}</span>
              <span className={styles.walletAccount}>{game.connectedAs}</span>
              {game.connectMode === 'waxwing' && (
                <button
                  className={styles.walletDisconnect}
                  onClick={() => openWaxwingPanel()}
                  title="Open waxwing to unlock wallet"
                >
                  🔓
                </button>
              )}
              <button
                className={styles.walletDisconnect}
                onClick={async () => {
                  await game.disconnectWallet()
                  setConnected(false)
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {/* Resource chips */}
        <div className={styles.resourceRow}>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconEgg}`}>🥚</div>
            <div>
              <div className={styles.chipLabel}>EGG</div>
              <div className={styles.chipValue}>{r.egg.toLocaleString()}</div>
            </div>
          </div>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconEnergy}`}>⚡</div>
            <div>
              <div className={styles.chipLabel}>Energy</div>
              <div className={styles.chipValue}>
                {r.energy}<span className={styles.chipMax}>/{r.maxEnergy}</span>
              </div>
            </div>
          </div>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconHatch}`}>💎</div>
            <div>
              <div className={styles.chipLabel}>$HATCH</div>
              <div className={styles.chipValue}>{r.hatch.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Hero + Hatch CTA */}
        <section className={styles.hero}>
          <img
            className={styles.heroImg}
            src={game.creatures.length > 0
              ? `${BASE}assets/creatures/${heroSlug(game.creatures[0]?.genetics)}.svg`
              : `${BASE}assets/creature-egg.png`}
            alt={game.creatures[0]?.name || 'Creature Egg'}
          />
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>
              Hatch your <span className={styles.heroAccent}>magical</span> creature
            </h2>
            <button
              className={styles.hatchBtn}
              onClick={onHatch}
              disabled={game.animating}
            >
              <span className={styles.hatchBtnIcon}>🥚</span>
              Hatch Egg
              <span className={styles.hatchCost}>({game.hatchCost ?? '—'} EGG)</span>
            </button>
          </div>
        </section>

        {/* Dashboard tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'creatures' ? styles.tabActive : ''}`}
            onClick={() => setTab('creatures')}
          >
            🐾 Creatures
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'breeding' ? styles.tabActive : ''}`}
            onClick={() => setTab('breeding')}
          >
            🧬 Breeding
          </button>
        </div>

        {tab === 'creatures' ? (
          <>
            {/* Creature inventory */}
            <section>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Your Creatures</h2>
                <span className={styles.sectionCount}>
                  {game.creatures.length} collected
                </span>
              </div>

              {game.creatures.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🪹</div>
                  <p className={styles.emptyText}>
                    No creatures yet. Hatch your first egg to begin your collection!
                  </p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {game.creatures.map((c) => (
                    <CreatureCard
                      key={c.assetId}
                      creature={c}
                      disabled={game.animating}
                      onFeed={() => game.feed(c.assetId)}
                      onEvolve={() => game.evolve(c.assetId)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Quick actions */}
            <div className={styles.quickActions}>
              <button
                className={styles.quickBtn}
                onClick={() => game.harvest()}
                disabled={harvestCdLeft > 0 || game.animating}
              >
                🌾 Harvest EGG
                <span className={styles.quickCost}>
                  {harvestCdLeft > 0 ? (
                    `⏳ ${formatCooldown(harvestCdLeft)}`
                  ) : (() => {
                    // Real EGG/hr from speciescfg: per-stage base (BASE_EARN_BY_STAGE)
                    // × the creature's rarity ratio (common 1.0 / uncommon 1.1 / rare 1.4).
                    // Single source of truth = satiety.ts; stage 0 (egg) earns nothing.
                    const n = game.creatures.filter(c => c.stage > 0).length
                    const total = game.creatures.reduce(
                      (s, c) => s + (BASE_EARN_BY_STAGE[c.stage] ?? 0) * (RARITY_EARN_MULT[c.rarity] ?? 1),
                      0,
                    )
                    return total > 0
                      ? `+${Math.round(total).toLocaleString()} EGG/hr · ${n} creature${n !== 1 ? 's' : ''}`
                      : 'No creatures to harvest from'
                  })()}
                </span>
              </button>
              <button
                className={`${styles.quickBtn} ${r.currentSeason > 0 && r.claimedSeason >= r.currentSeason ? styles.quickBtnClaimed : ''}`}
                onClick={() => game.claimReward()}
                disabled={claimCdLeft > 0 || game.animating || (r.currentSeason > 0 && r.claimedSeason >= r.currentSeason)}
              >
                🎁 Claim Reward
                <span className={styles.quickCost}>
                  {r.currentSeason > 0 && r.claimedSeason >= r.currentSeason ? (
                    '✅ Claimed this season'
                  ) : claimCdLeft > 0 ? (
                    `⏳ ${formatCooldown(claimCdLeft)}`
                  ) : (() => {
                    // phgamecreatr claimreward: highest stage → payout (stage 2=20, 3=30, 4=50 HATCH)
                    const highest = game.creatures.reduce((max, c) => Math.max(max, c.stage), 0)
                    const payout = [0, 0, 20, 30, 50, 100][Math.min(highest, 5)] ?? 0
                    return payout > 0
                      ? `+${payout} HATCH (stage ${highest})`
                      : 'Need Juvenile+ to claim'
                  })()}
                </span>
              </button>
            </div>
          </>
        ) : (
          <BreedingPage
            creatures={game.creatures}
            resources={game.resources}
            breedCost={game.breedCost}
            disabled={game.animating}
            onBreed={(a, b) => game.breed(a, b)}
          />
        )}
      </main>

      {/* Overlays */}
      {showHatch && (
        <HatchOverlay
          speciesId={hatchSpecies.speciesId}
          speciesName={hatchSpecies.speciesName}
          onDone={() => setShowHatch(false)}
        />
      )}
      {game.pendingSign && (
        <SignSheet
          pending={game.pendingSign}
          onConfirm={game.confirmPending}
          onCancel={game.cancelPending}
        />
      )}
      {toast && <Toast action={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

// ── Demo Dashboard (wallet-free, ?demo mode) ────────────────────────
function DemoDashboard() {
  const demo = useDemoGame()
  const s = demo.state

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logoImg} src={`${BASE}assets/creature-egg.png`} alt="" />
          <h1 className={styles.title}>Pocket Hatchery</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.chainBadge} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className={styles.chainDot} style={{ background: '#F59E0B' }} />
            🎮 Demo
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Resource chips */}
        <div className={styles.resourceRow}>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconEgg}`}>🥚</div>
            <div>
              <div className={styles.chipLabel}>EGG</div>
              <div className={styles.chipValue}>{s.egg.toLocaleString()}</div>
            </div>
          </div>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconHatch}`}>💎</div>
            <div>
              <div className={styles.chipLabel}>$HATCH</div>
              <div className={styles.chipValue}>{s.hatch.toLocaleString()}</div>
            </div>
          </div>
          <div className={styles.chip}>
            <div className={`${styles.chipIcon} ${styles.iconHatch}`}>🐾</div>
            <div>
              <div className={styles.chipLabel}>Creatures</div>
              <div className={styles.chipValue}>{s.creatures.length}</div>
            </div>
          </div>
        </div>

        {/* Hero + quick actions */}
        <section className={styles.hero}>
          <img
            className={styles.heroImg}
            src={s.creatures.length > 0
              ? `${BASE}assets/creatures/${heroSlug(s.creatures[0]?.genetics)}.svg`
              : `${BASE}assets/creature-egg.png`}
            alt={s.creatures[0]?.name || 'Creature Egg'}
          />
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>
              <span className={styles.heroAccent}>Demo</span> Hatchery
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={styles.hatchBtn} onClick={demo.harvest}>
                🌾 Harvest (+60 EGG)
              </button>
              <button className={styles.hatchBtn} onClick={demo.hatch} style={{ background: '#EAB308', color: '#0F1119' }}>
                🥚 Hatch (150 EGG)
              </button>
              <button className={styles.hatchBtn} onClick={demo.initplayer} style={{ background: '#8B5CF6' }}>
                👋 Reset (200 EGG)
              </button>
            </div>
          </div>
        </section>

        {/* Creature inventory */}
        <section>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Your Creatures</h2>
            <span className={styles.sectionCount}>{s.creatures.length} collected</span>
          </div>
          {s.creatures.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🪹</div>
              <p className={styles.emptyText}>Hatch an egg to see your creature card!</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {s.creatures.map((c) => (
                <CreatureCard
                  key={c.assetId}
                  creature={c}
                  onFeed={() => demo.feed(c.assetId)}
                  onEvolve={() => demo.evolve(c.assetId)}
                />
              ))}
            </div>
          )}
        </section>

        <div className={styles.quickActions}>
          <button className={styles.quickBtn} onClick={demo.harvest}>
            🌾 Harvest EGG
            <span className={styles.quickCost}>
              {(() => {
                const n = s.creatures.filter(c => c.stage > 0).length
                if (n === 0) return 'No creatures to harvest from'
                const total = s.creatures.reduce(
                  (sum, c) => sum + (BASE_EARN_BY_STAGE[c.stage] ?? 0) * (RARITY_EARN_MULT[c.rarity] ?? 1),
                  0,
                )
                return `+${Math.round(total).toLocaleString()} EGG/hr · ${n} creature${n !== 1 ? 's' : ''}`
              })()}
            </span>
          </button>
          <button className={styles.quickBtn} onClick={demo.claimReward}>
            🎁 Claim Reward
            <span className={styles.quickCost}>
              {(() => {
                const highest = s.creatures.reduce((max, c) => Math.max(max, c.stage), 0)
                const payout = [0, 0, 20, 30, 50, 100][Math.min(highest, 5)] ?? 0
                return payout > 0 ? `+${payout} HATCH (stage ${highest})` : 'Need Juvenile+ to claim'
              })()}
            </span>
          </button>
        </div>
      </main>
    </div>
  )
}
