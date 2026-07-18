import { useCallback, useEffect, useState } from 'react'
import { useGameActions, hatchOddsFromConfig, type ConnectMode, type LastAction, type PendingSign, type HatchOdds } from './play'
import { getActiveNetwork, isPlayable } from './network'
import { CreatureCard, type Creature } from './components/CreatureCard'
import { BreedingPage } from './components/BreedingPage'
import { FarmScene } from './components/FarmScene'
import { useDemoGame } from './demoGame'
import { openWaxwingPanel } from './waxwing'
import { speciesIdFromGene } from './geneDecoder'
import { PREVIEW_SATIETY_CONFIG, BASE_EARN_BY_STAGE, RARITY_EARN_MULT } from './satiety'
import { summarizeHarvest } from './harvest'
import { computeClaim, type ClaimState } from './claim'
import { useCreaturePrefs, matchesQuery, sortPinnedFirst } from './prefs'
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
// Display labels for the six on-chain rarity tiers (egg_type 0–5).
const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic',
}
// Format a rarity chance for display: whole numbers stay bare (69), fractional
// tiers keep up to 2 decimals with trailing zeros trimmed (2.5 / 0.45 / 0.05).
function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
// Spec-default odds for the demo hero (wallet-free). ConnectedDashboard passes the
// LIVE configv3 weights instead; defaults here mirror the LOCKED 6-tier numbers
// (69/20/8/2.5/0.45/0.05, ×1.0/1.1/1.4/2.0/3.2/5.0).
const DEMO_HATCH_ODDS = hatchOddsFromConfig(null)

// Flat cost every hatch; only the ROLLED rarity varies. Surfaces the odds + the
// harvest earn premium (rarer = more EGG farmed) plus the free-to-start path.
function HatchOddsPanel({ odds }: { odds: HatchOdds[] }) {
  return (
    <>
      <div className={styles.hatchOdds}>
        <span className={styles.oddsLabel}>Same price every hatch · roll for rarity</span>
        <div className={styles.oddsRow} data-testid="hatch-odds">
          {odds.map((o) => (
            <div
              key={o.rarity}
              className={`${styles.oddChip} ${styles[`odd_${o.rarity}`]}`}
              data-rarity={o.rarity}
            >
              <span className={styles.oddRarity}>{RARITY_LABEL[o.rarity]}</span>
              <span className={styles.oddPct}>{fmtPct(o.pct)}%</span>
              <span className={styles.oddMult}>farm ×{o.earnMult.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <span className={styles.oddsHint}>Rarer creatures farm more EGG — Mythic pays best ✨</span>
      </div>
      <p className={styles.freePath} data-testid="free-path">
        <span className={styles.freeBadge}>Free start</span>
        200 EGG → hatch your first → harvest to farm EGG → claim HATCH
      </p>
    </>
  )
}
const IS_DEMO = new URLSearchParams(window.location.search).has('demo')
// Art-verify lab (?artverify): hardcodes exactly one Foxling + one Flicker card so
// reviewers can confirm the upgraded SVG art + SMIL/CSS animations render correctly
// without depending on the random demo species picker.
const IS_ARTVERIFY = new URLSearchParams(window.location.search).has('artverify')
// Feed-v2 preview lab (?feedlab): renders satiety cards on the FAST preview clock
// (30s full→empty) so the decaying bar + stateful Feed button can be seen/verified
// live, independent of a wallet or the chain. Internal dev/QA surface only.
const IS_FEEDLAB = new URLSearchParams(window.location.search).has('feedlab')
// Awaken-v2 preview lab (?awakenlab): renders stage-0 sleeping cards on a FAST
// sleep clock (30s to auto-ready) so the AwakenMeter's timer bar + WAX "Wake now"
// button + the ready/auto-awaken state can be seen/verified live, wallet-free.
const IS_AWAKENLAB = new URLSearchParams(window.location.search).has('awakenlab')

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
  if (IS_ARTVERIFY) return <ArtVerifyLab />
  if (IS_FEEDLAB) return <FeedLab />
  if (IS_AWAKENLAB) return <AwakenLab />
  if (IS_DEMO) return <DemoDashboard />
  return <ConnectedDashboard />
}

// ── Art Verify Lab (?artverify) ───────────────────────────────────────────
// Hardcodes exactly one Foxling (species-index 0) and one Flicker (index 5) so
// art-upgrade screenshots reliably show the upgraded SVG creatures — not the
// random species the demo picker might choose.
// Gene encoding per GENE-SPEC.md §2: bits 0–3 = species index (little-endian hex).
// foxling sid=0 → lowest nibble 0 → "0000000000000000" + 48×'0'
// flicker sid=5 → lowest nibble 5 → "0000000000000005" + 48×'0'
function ArtVerifyLab() {
  const now = Math.floor(Date.now() / 1000)
  const FOXLING_GENE = '0000000000000000' + '0'.repeat(48)
  const FLICKER_GENE = '0000000000000005' + '0'.repeat(48)

  const creatures: Creature[] = [
    {
      assetId: '3001',
      name: 'Foxling',
      species: 'Fire',
      stage: 1,
      maxStage: 4,
      rarity: 'common',
      growth: 500,
      growthToNext: 4000,
      genetics: FOXLING_GENE,
      lastFed: 0, // never fed → Feed button enabled for animation verify
    },
    {
      assetId: '3002',
      name: 'Flicker',
      species: 'Fire',
      stage: 2,
      maxStage: 4,
      rarity: 'rare',
      growth: 8000,
      growthToNext: 15000,
      genetics: FLICKER_GENE,
      lastFed: now - 7200, // 2h ago → hungry state
    },
  ]

  const [feedState, setFeedState] = useState<Creature[]>(creatures)

  const feed = useCallback((assetId: string) => {
    setFeedState((prev) =>
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
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className={styles.chainDot} style={{ background: '#EF4444' }} />
            🎨 Art Verify Lab
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <section>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Art Upgrade Verification</h2>
            <span className={styles.sectionCount}>Foxling (Common Baby) · Flicker (Rare Juvenile)</span>
          </div>
          <div className={styles.grid} data-testid="artverify-grid">
            {feedState.map((c) => (
              <CreatureCard
                key={c.assetId}
                creature={c}
                onFeed={() => feed(c.assetId)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Awaken v2 Preview Lab (?awakenlab) ──────────────────────────────────────
// Wallet-free harness for the sleep/wake mechanic. Two freshly-hatched (stage 0)
// creatures sleep on a fast 30s clock — one mid-sleep (Wake-now WAX button live),
// one already elapsed (auto-awaken "harvest to awaken" state) — so both AwakenMeter
// paths render without a wallet or chain. This is the surface verify-awaken-render
// drives headlessly. Wake costs mirror configv3 (common 3 WAX, rare 10 WAX).
function AwakenLab() {
  const GENE = '0000000000000000' + '0'.repeat(48)
  const now = Math.floor(Date.now() / 1000)
  const AWAKEN_SEC = 30 // fast preview sleep clock
  const seed: Creature[] = [
    {
      assetId: '2001', name: 'Foxling', species: 'Fire', stage: 0, maxStage: 4,
      rarity: 'common', growth: 0, growthToNext: 1000, genetics: GENE,
      lastFed: now, bornAt: now, awakenDur: AWAKEN_SEC, wakeCostWax: 3, // mid-sleep → Wake now
    },
    {
      assetId: '2002', name: 'Dracling', species: 'Void', stage: 0, maxStage: 4,
      rarity: 'rare', growth: 0, growthToNext: 1000, genetics: GENE,
      lastFed: now, bornAt: now - 40, awakenDur: AWAKEN_SEC, wakeCostWax: 10, // elapsed → ready/auto-awaken
    },
  ]
  const [creatures, setCreatures] = useState<Creature[]>(seed)

  // Wake flips the sleeper to a Baby (stage 1) so the card swaps AwakenMeter →
  // SatietyMeter — proving the hatch → wake → feed handoff on screen.
  const wake = useCallback((assetId: string) => {
    setCreatures((prev) =>
      prev.map((c) =>
        c.assetId === assetId && c.stage === 0
          ? { ...c, stage: 1, growth: 0, growthToNext: 4000, lastFed: 0 } // never fed yet → feed available
          : c,
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
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <span className={styles.chainDot} style={{ background: '#6366F1' }} />
            💤 Awaken v2 Lab
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <section>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Awaken Preview</h2>
            <span className={styles.sectionCount}>fast clock · 30s to auto-ready</span>
          </div>
          <div className={styles.grid} data-testid="awakenlab-grid">
            {creatures.map((c) => (
              <CreatureCard
                key={c.assetId}
                creature={c}
                onWake={() => wake(c.assetId)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Feed v2 Preview Lab (?feedlab) ──────────────────────────────────────────
// A wallet-free harness for the new satiety mechanic. Three creatures across the
// rarity range start at different points on the decay curve so you can watch one
// slide Full → Hungry → Starving in real time (fast preview clock), and clicking
// Feed refills its bar. This is the surface the verify script drives headlessly.
function FeedLab() {
  // Deterministic per-species gene: species id in bits 0–3 (so decodeGeneRender
  // resolves the RIGHT species SVG) + a distinct body/accent hue so each card
  // shows its own gene-tinted art — same pipeline the live cards use, no mock art.
  const labGene = (sid: number, bodyHue: number, accentHue: number): string => {
    let g = BigInt(0)
    g |= BigInt(sid & 0xf) << 0n
    g |= BigInt(bodyHue & 0xff) << 4n
    g |= BigInt(accentHue & 0xff) << 12n
    g |= BigInt(6) << 24n // patternHue
    g |= BigInt(9) << 32n // saturation
    g |= BigInt(8) << 36n // brightness
    g |= BigInt(4) << 40n // eyeColor
    const rendering = g.toString(16).padStart(16, '0').toUpperCase()
    return rendering + '0'.repeat(48)
  }
  const now = Math.floor(Date.now() / 1000)
  // sid map (gene species_id): foxling0 owlet1 droplet2 pebblit3 sproutling4
  // flicker5 glimmer6 wisp7 fluffle8 shellby9 dracling10 buzzle11
  const seed: Creature[] = [
    {
      assetId: '1001', name: 'Foxling', species: 'Fire', stage: 2, maxStage: 4,
      rarity: 'common', growth: 6000, growthToNext: 20000, genetics: labGene(0, 20, 200),
      lastFed: now, // full
    },
    {
      assetId: '1002', name: 'Owlet', species: 'Air', stage: 3, maxStage: 4,
      rarity: 'uncommon', growth: 22000, growthToNext: 100000, genetics: labGene(1, 150, 60),
      lastFed: now - 12, // ~40% → hungry soon (preview clock)
    },
    {
      assetId: '1003', name: 'Dracling', species: 'Fire', stage: 3, maxStage: 4,
      rarity: 'rare', growth: 30000, growthToNext: 100000, genetics: labGene(10, 200, 90),
      lastFed: now - 24, // ~20% → starving
    },
    // Higher tiers — exercise the 6-tier CreatureCard visuals (icon/gradient/sparkle).
    {
      assetId: '1004', name: 'Glimmer', species: 'Crystal', stage: 3, maxStage: 4,
      rarity: 'epic', growth: 40000, growthToNext: 100000, genetics: labGene(6, 210, 30),
      lastFed: now, // full
    },
    {
      assetId: '1005', name: 'Wisp', species: 'Shadow', stage: 3, maxStage: 4,
      rarity: 'legendary', growth: 55000, growthToNext: 100000, genetics: labGene(7, 180, 240),
      lastFed: now, // full
    },
    {
      assetId: '1006', name: 'Fluffle', species: 'Air', stage: 3, maxStage: 4,
      rarity: 'mythic', growth: 70000, growthToNext: 100000, genetics: labGene(8, 120, 300),
      lastFed: now, // full
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

// Stage number → the word the rest of the game uses for it (CreatureCard's stage
// pill vocabulary), so the claim copy names the creature the payout is priced on.
const STAGE_WORDS = ['Egg', 'Baby', 'Juvenile', 'Adult', 'Elite', 'Primal'] as const

function stageWord(stage: number): string {
  return STAGE_WORDS[Math.min(Math.max(stage, 0), STAGE_WORDS.length - 1)]
}

/** "a Juvenile" / "an Adult" — every stage word starts with a plain consonant or vowel. */
function aStage(stage: number): string {
  const word = stageWord(stage)
  return `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`
}

/**
 * Turn a claim blocker into the line the player reads.
 *
 * Every branch answers "why can't I claim, and what do I do about it" — a countdown
 * where the wait is the answer, an action where the player's own collection is. The
 * cooldown uses the live 1s ticker so the number moves while they watch it.
 */
function claimBlockCopy(claim: ClaimState, cooldownLeft: number): { icon: string; text: string } | null {
  switch (claim.blocked) {
    case null:
      return null
    case 'paused':
      return { icon: '⏸️', text: 'The game is paused on chain — claiming is closed until it resumes.' }
    case 'no-season':
      return { icon: '🗓️', text: 'No season is running yet — rewards open when the next season starts.' }
    case 'claimed':
      return { icon: '✅', text: 'Already claimed this season. Your next reward unlocks when a new season starts.' }
    case 'cooldown':
      return { icon: '⏳', text: `Claim cooldown — ready in ${formatCooldown(cooldownLeft)}.` }
    case 'stage':
      return {
        icon: '🔒',
        text: 'Grow a creature to Juvenile (stage 2) to qualify — feed it to reach the next stage.',
      }
    case 'unfed':
      return { icon: '🍽️', text: 'None of your creatures are fed right now — feed one, then claim.' }
    case 'pool-empty':
      return {
        icon: '🫙',
        text: `The reward pool is short — it holds ${claim.poolBalance.toLocaleString()} HATCH but your claim pays ${claim.payout}. It refills from hatch, breed and burn fees.`,
      }
  }
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
  // The farm is the home view: a connected player lands on their living habitat,
  // not on a list. The collection is one click away for acting on a creature.
  const [tab, setTab] = useState<'creatures' | 'farm' | 'breeding'>('farm')
  // Live collection filter — matches nickname / asset id / species / tier.
  const [query, setQuery] = useState('')
  // Nicknames + pins live plugin-side (prefs.ts) — the contract can't hold them yet.
  const { prefs, persisted: prefsPersisted, setNickname, togglePin } = useCreaturePrefs(game.connectedAs)

  // ── Cooldown timers (live-updating every 1s so the player sees the countdown
  //     tick down in the button subtitle without having to click first). ──────
  const [harvestCdLeft, setHarvestCdLeft] = useState(0)
  const [claimCdLeft, setClaimCdLeft] = useState(0)
  // Seconds until the daily EGG quota rolls over. The contract buckets the quota
  // by UTC day (harvest_day = now/86400) and resets it lazily on the next action,
  // so the ceiling frees up exactly at the next UTC midnight.
  const [dailyResetLeft, setDailyResetLeft] = useState(0)

  useEffect(() => {
    const r = game.resources
    function tick() {
      const now = Math.floor(Date.now() / 1000)
      const cd = r.harvestCd || 0
      setHarvestCdLeft(Math.max(0, r.lastHarvest + cd - now))
      setDailyResetLeft((Math.floor(now / 86400) + 1) * 86400 - now)
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
    const result = await game.hatch()
    if (!result.ok) return
    setShowHatch(true)
    setTimeout(() => setShowHatch(false), 2800)
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

  // Live harvest summary — the REAL accumulated EGG a Harvest tap pays right now,
  // mirroring the contract's per-creature fed-window math (harvest.ts). Recomputes
  // every 1s because the cooldown tick above re-renders the dashboard.
  const nowSec = Math.floor(Date.now() / 1000)
  const harvestSummary = summarizeHarvest(
    game.creatures.map((c) => ({
      assetId: c.assetId,
      stage: c.stage,
      lastFed: c.lastFed,
      fedDur: c.fedDur,
      earnFull: c.earnFull ?? 0,
      earnMult: c.earnMult ?? 1,
    })),
    {
      now: nowSec,
      lastHarvest: r.lastHarvest,
      offlineCapH: r.offlineCapH,
      dailyEggCap: r.dailyEggCap,
      capScalesRarity: r.capScalesRarity,
      eggHarvestedToday: r.eggHarvestedToday,
    },
  )

  // Claim eligibility — every gate the contract's claimreward runs, evaluated in the
  // contract's own order against live chain state (claim.ts). The button leads with
  // the real payout and, when locked, names the ONE blocker the chain would hit.
  const claimState = computeClaim({
    creatures: game.creatures.map((c) => ({ stage: c.stage, lastFed: c.lastFed, fedDur: c.fedDur })),
    now: nowSec,
    currentSeason: r.currentSeason,
    claimedSeason: r.claimedSeason,
    lastClaimed: r.lastClaimed,
    harvestCd: r.harvestCd,
    poolBalance: r.poolBalance,
    paused: r.paused,
  })
  const claimReason = claimBlockCopy(claimState, claimCdLeft)

  // The collection as the player sees it: pins float to the top, then the live query
  // filters. Filtering AFTER pinning keeps a pinned card first among the matches
  // rather than pinning only reordering the unfiltered list.
  const visibleCreatures = sortPinnedFirst(game.creatures, prefs.pins).filter((c) =>
    matchesQuery(c, prefs.nicknames[c.assetId], query),
  )

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

            {/* Rarity odds + free-to-start path (live configv3 weights). */}
            <HatchOddsPanel odds={game.hatchOdds} />
          </div>
        </section>

        {/* Dashboard tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'farm' ? styles.tabActive : ''}`}
            onClick={() => setTab('farm')}
          >
            🌾 Farm
          </button>
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

        {tab === 'farm' ? (
          // Clicking a creature in the farm hands the player back to its card —
          // the farm is where you SEE them, the collection is where you act.
          <FarmScene creatures={game.creatures} onSelect={() => setTab('creatures')} />
        ) : tab === 'creatures' ? (
          <>
            {/* Creature inventory */}
            <section>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Your Creatures</h2>
                <span className={styles.sectionCount}>
                  {query.trim() && visibleCreatures.length !== game.creatures.length
                    ? `${visibleCreatures.length} of ${game.creatures.length} shown`
                    : `${game.creatures.length} collected`}
                  {prefs.pins.length > 0 && (
                    <span className={styles.sectionCountLabel}> · {prefs.pins.length} pinned</span>
                  )}
                </span>
              </div>

              {/* Search — a big collection is unusable without it. Filters live over
                  the four things a player remembers: nickname, asset id, species and
                  tier. Hidden while the collection is empty (nothing to search). */}
              {game.creatures.length > 0 && (
                <div className={styles.searchRow}>
                  <span className={styles.searchIcon} aria-hidden="true">🔍</span>
                  <input
                    className={styles.searchInput}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by nickname, asset id, species or tier…"
                    aria-label="Search your creatures"
                    data-testid="creature-search"
                  />
                  {query && (
                    <button
                      type="button"
                      className={styles.searchClear}
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      data-testid="search-clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Prefs are cosmetic, but silently dropping a rename is still a lie —
                  say when the daemon isn't storing them. */}
              {!prefsPersisted && game.creatures.length > 0 && (
                <p className={styles.prefsWarn} data-testid="prefs-warn">
                  ⚠️ Nicknames and pins can't be saved right now — they'll last for this
                  session only.
                </p>
              )}

              {game.creatures.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🪹</div>
                  <p className={styles.emptyText}>
                    No creatures yet. Hatch your first egg to begin your collection!
                  </p>
                </div>
              ) : visibleCreatures.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔍</div>
                  <p className={styles.emptyText} data-testid="search-empty">
                    No creature matches “{query}”. Try a nickname, an asset id, a species
                    or a tier.
                  </p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {visibleCreatures.map((c) => (
                    <CreatureCard
                      key={c.assetId}
                      creature={c}
                      disabled={game.animating}
                      onFeed={() => game.feed(c.assetId)}
                      onWake={() => game.awaken(c.assetId)}
                      onEvolve={() => game.evolve(c.assetId)}
                      onBurn={() => game.burn(c.assetId)}
                      nickname={prefs.nicknames[c.assetId]}
                      onRename={(name) => setNickname(c.assetId, name)}
                      pinned={prefs.pins.includes(c.assetId)}
                      onTogglePin={() => togglePin(c.assetId)}
                      staticSprite
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Daily harvest quota — the headline fix for "daily cap reached · 0 EGG"
                reading as a broken game. Shows the REAL progress against today's
                ceiling (players.egg_harvested_today / configv3.daily_egg_cap, the
                latter rarity-scaled when cap_scales_rarity is set — harvest.ts
                returns the effective number), and when the quota is spent it says
                so warmly with a countdown to the UTC-midnight reset instead of a
                bare 0. Creatures keep accruing EGG the whole time; the cap only
                gates what a tap can PAY OUT today, which the copy spells out. */}
            <section
              className={styles.harvestQuota}
              data-cap-reached={harvestSummary.capReached ? 1 : 0}
            >
              <div className={styles.quotaHead}>
                <h3 className={styles.quotaTitle}>Daily Harvest</h3>
                <span className={styles.quotaCount}>
                  {harvestSummary.harvestedToday.toLocaleString()} / {harvestSummary.cap.toLocaleString()} EGG
                  <span className={styles.quotaCountLabel}> harvested today</span>
                </span>
              </div>

              <div
                className={styles.quotaTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={harvestSummary.cap}
                aria-valuenow={harvestSummary.harvestedToday}
                aria-label="EGG harvested today against the daily cap"
              >
                <div
                  className={styles.quotaFill}
                  style={{
                    width: `${harvestSummary.cap > 0 ? Math.min(100, (harvestSummary.harvestedToday / harvestSummary.cap) * 100) : 0}%`,
                  }}
                />
              </div>

              {harvestSummary.capReached ? (
                <p className={styles.quotaNote}>
                  <strong className={styles.quotaDone}>
                    ✅ Daily cap reached — resets in ~{formatCooldown(dailyResetLeft)}
                  </strong>
                  <span className={styles.quotaExplain}>
                    Nothing is broken: you have collected today's full {harvestSummary.cap.toLocaleString()} EGG.
                    {harvestSummary.earningCount > 0
                      ? ` Your ${harvestSummary.earningCount} earning ${harvestSummary.earningCount === 1 ? 'creature keeps' : 'creatures keep'} building up EGG in the meantime — harvest it after the reset.`
                      : ' Keep your creatures fed so they build up EGG for tomorrow.'}
                  </span>
                </p>
              ) : (
                <p className={styles.quotaNote}>
                  <strong className={styles.quotaLeft}>
                    {harvestSummary.remaining.toLocaleString()} EGG left to harvest today
                  </strong>
                  <span className={styles.quotaExplain}>
                    {harvestSummary.earningCount > 0
                      ? `${harvestSummary.earningCount} ${harvestSummary.earningCount === 1 ? 'creature is' : 'creatures are'} earning — they build up EGG while fed, and you can collect up to ${harvestSummary.cap.toLocaleString()} EGG per day. Resets in ~${formatCooldown(dailyResetLeft)}.`
                      : `Feed your creatures so they start earning EGG. Resets in ~${formatCooldown(dailyResetLeft)}.`}
                  </span>
                </p>
              )}

              {harvestCdLeft > 0 && (
                <p className={styles.quotaCooldown}>
                  ⏳ Harvest cooldown — next harvest in {formatCooldown(harvestCdLeft)}
                </p>
              )}
            </section>

            {/* Season Reward — the "what am I even tapping" panel for Claim.
                A player could see the button but not what it paid, where the HATCH
                came from, or why it was refusing them. This states all three from
                live chain data: the payout priced on their best creature, the pool
                that funds it (rewardpool.balance), and the exact blocker. */}
            <section className={styles.claimPanel} data-claimable={claimState.claimable ? 1 : 0}>
              <div className={styles.quotaHead}>
                <h3 className={styles.quotaTitle}>Season Reward</h3>
                <span className={styles.quotaCount} data-testid="claim-season">
                  Season {r.currentSeason}
                  <span className={styles.quotaCountLabel}> · one claim each</span>
                </span>
              </div>

              <div className={styles.claimHeadline}>
                <span className={styles.claimAmount} data-testid="claim-amount">
                  {claimState.payout > 0 ? `${claimState.payout} HATCH` : 'No reward yet'}
                </span>
                <span className={styles.claimAmountSub}>
                  {claimState.payout > 0
                    ? `priced on your best creature — ${aStage(claimState.highestStage)} (stage ${claimState.highestStage})`
                    : 'grow a creature to Juvenile (stage 2) to unlock a reward'}
                </span>
              </div>

              {claimReason ? (
                <p className={styles.claimBlocked} data-testid="claim-blocked">
                  <span className={styles.claimBlockIcon}>{claimReason.icon}</span>
                  {claimReason.text}
                </p>
              ) : (
                <p className={styles.claimReady} data-testid="claim-ready">
                  ✅ Ready — tap Claim Reward to collect it.
                </p>
              )}

              <p className={styles.quotaNote}>
                <span className={styles.quotaExplain}>
                  Rewards are paid from a shared pool that every player funds: a slice of
                  each hatch, breed and burn goes back into it.{' '}
                  {/* Real balance, not a promise — an unfunded pool is the difference
                      between "claim later" and "claim never", so the number is shown. */}
                  <strong className={styles.claimPool} data-testid="claim-pool">
                    {claimState.poolBalance.toLocaleString()} HATCH
                  </strong>{' '}
                  is in the pool right now. Grow your best creature to raise your payout
                  {claimState.nextStagePayout > 0
                    ? ` — ${aStage(claimState.highestStage + 1)} claims ${claimState.nextStagePayout} HATCH.`
                    : ' — you are already at the top payout.'}
                </span>
              </p>
            </section>

            {/* Quick actions */}
            <div className={styles.quickActions}>
              {/* Harvest — leads with the REAL accumulated EGG a tap pays right now
                  (harvest.ts, chain-mirrored), then the earning breakdown. Sleeping
                  and out-of-food creatures show as "not earning" and are excluded
                  from the total. Stays tappable off-cooldown so a ready egg still
                  auto-wakes for free even when the pending EGG is 0. */}
              <button
                className={styles.quickBtn}
                onClick={() => game.harvest()}
                disabled={harvestCdLeft > 0 || game.animating}
              >
                <span className={styles.harvestValue}>
                  {harvestSummary.capReached
                    ? '🌾 Cap reached'
                    : `🌾 ${harvestSummary.pending.toLocaleString()} EGG`}
                </span>
                <span className={styles.quickCost}>
                  {harvestCdLeft > 0 ? (
                    `⏳ Harvest ready in ${formatCooldown(harvestCdLeft)}`
                  ) : harvestSummary.capReached ? (
                    // Quota spent — say WHY the payout is 0 and when it comes back,
                    // instead of a bare "0 EGG" that reads as a broken game.
                    `All ${harvestSummary.cap.toLocaleString()} EGG collected today · resets in ~${formatCooldown(dailyResetLeft)}`
                  ) : harvestSummary.earningCount > 0 ? (
                    <>
                      Ready to harvest · {harvestSummary.earningCount} earning
                      {harvestSummary.idleCount + harvestSummary.sleepingCount > 0 && (
                        <span className={styles.quickIdle}>
                          {' · '}
                          {harvestSummary.idleCount + harvestSummary.sleepingCount} not earning
                        </span>
                      )}
                      {harvestSummary.capped && ` · trimmed to today's cap`}
                    </>
                  ) : harvestSummary.sleepingCount > 0 ? (
                    <span className={styles.quickIdle}>Creatures still sleeping — harvest to wake them</span>
                  ) : harvestSummary.idleCount > 0 ? (
                    <span className={styles.quickIdle}>Not earning — feed your creatures to farm EGG</span>
                  ) : (
                    'No creatures to harvest from'
                  )}
                </span>
              </button>
              {/* Claim — one HATCH reward per season. Leads with the exact payout the
                  chain would pay right now; when locked it shows the one blocker the
                  contract would hit, so a tap never fails silently. The full "where
                  this comes from" story lives in the Season Reward panel below. */}
              <button
                className={`${styles.quickBtn} ${claimState.blocked === 'claimed' ? styles.quickBtnClaimed : ''}`}
                onClick={() => game.claimReward()}
                disabled={!claimState.claimable || game.animating}
                data-testid="claim-btn"
              >
                <span className={styles.harvestValue}>
                  {claimState.claimable ? `🎁 +${claimState.payout} HATCH` : '🎁 Claim Reward'}
                </span>
                <span className={styles.quickCost}>
                  {claimReason ? (
                    <span className={styles.quickIdle} data-testid="claim-reason">
                      {claimReason.icon} {claimReason.text}
                    </span>
                  ) : (
                    `Ready to claim · priced on your ${stageWord(claimState.highestStage)} (stage ${claimState.highestStage})`
                  )}
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
            <HatchOddsPanel odds={DEMO_HATCH_ODDS} />
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
                  onWake={() => demo.wake(c.assetId)}
                  onEvolve={() => demo.evolve(c.assetId)}
                  staticSprite
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
                // Live contract payout scale (pockethatch.cpp claimreward): stage
                // 2=15, 3=25, 4=45, 5=85 HATCH.
                const highest = s.creatures.reduce((max, c) => Math.max(max, c.stage), 0)
                const payout = [0, 0, 15, 25, 45, 85][Math.min(highest, 5)] ?? 0
                return payout > 0 ? `+${payout} HATCH (stage ${highest})` : 'Need Juvenile+ to claim'
              })()}
            </span>
          </button>
        </div>
      </main>
    </div>
  )
}
