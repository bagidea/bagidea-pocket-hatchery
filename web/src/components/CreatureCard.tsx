import { useEffect, useMemo, useState } from 'react'
import { decodeGeneCSS, decodeGeneRender } from '../geneDecoder'
import { fetchSpeciesSvg, renderCreatureCached } from '../creatureRender'
import { SatietyMeter } from './SatietyMeter'
import { AwakenMeter } from './AwakenMeter'
import type { SatietyConfig } from '../satiety'
import { MAX_NICKNAME } from '../prefs'
import styles from './CreatureCard.module.css'

const BASE = import.meta.env.BASE_URL

// On-chain rarity — six tiers (speciescfg.egg_type 0–5).
// 0=common, 1=uncommon, 2=rare, 3=epic, 4=legendary, 5=mythic.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

/** Tier order — index doubles as the numeric rarity the renderer takes. */
const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export interface Creature {
  assetId: string
  name: string
  species: string
  stage: number
  maxStage: number
  rarity: Rarity
  growth: number
  growthToNext: number
  /** 64-char hex genetics string (checksum256 from chain) */
  genetics: string
  /** Unix seconds of the last feed (chain: creature_row.last_fed). 0 = never. */
  lastFed?: number
  /** Live fed_dur (seconds) for this creature's rarity (configv3.fed_dur_*). */
  fedDur?: number
  /** Live feed cooldown (seconds) — configv3.feed_cd. Overrides the SatietyMeter fallback. */
  feedCd?: number
  /** Unix seconds the creature hatched (chain: creature_row.born_at). Awaken-v2 sleep clock. */
  bornAt?: number
  /** Live awaken_dur (seconds) for this rarity — configv3.awaken_dur_*. Sleep length before free auto-awaken. */
  awakenDur?: number
  /** WAX wake cost as an asset string ("3.00000000 WAX") — configv3.wake_cost_*. */
  wakeCost?: string
  /** WAX wake cost in whole units for the button label. */
  wakeCostWax?: number
  /**
   * Live full-satiety earn rate (EGG/hr) from chain: speciescfg.yield_for(stage)
   * × configv3.earn_mult. Absent for demo/preview creatures (they fall back to
   * satiety.ts's common-base × RARITY_EARN_MULT reconstruction).
   */
  earnFull?: number
  /** Total rarity earn premium vs a common at the same stage (for the "×N" badge). */
  earnMult?: number
}

interface CreatureCardProps {
  creature: Creature
  onFeed?: () => void
  /** Wake a sleeping (stage 0) creature by paying WAX (Awaken v2). */
  onWake?: () => void
  onEvolve?: () => void
  /** Permanently destroy this creature. Omit to hide the Burn control entirely. */
  onBurn?: () => void
  disabled?: boolean
  /** Feed-v2 decay clock override (preview uses a fast one). Defaults to MOCK. */
  satietyConfig?: SatietyConfig
  /** Player-set nickname (prefs.ts). Empty/absent → the card shows the species name. */
  nickname?: string
  /** Commit a nickname; '' clears it. Omit to hide the rename control. */
  onRename?: (name: string) => void
  /** Whether this creature is pinned to the top of the collection. */
  pinned?: boolean
  /** Toggle the pin. Omit to hide the pin control. */
  onTogglePin?: () => void
}

// ── Visual constants ───────────────────────────────────────────────────
// Dark-card stage vocabulary — emoji + word per on-chain stage number (0–5).
// The subtitle (STAGE n / MAX) is the REAL chain stage; the word is cosmetic.
const STAGE_META: Record<number, { emoji: string; word: string }> = {
  0: { emoji: '🥚', word: 'EGG' },
  1: { emoji: '🐣', word: 'BABY' },
  2: { emoji: '🌿', word: 'JUVENILE' },
  3: { emoji: '✨', word: 'ADULT' },
  4: { emoji: '👑', word: 'ELITE' },
  5: { emoji: '☄️', word: 'PRIMAL' },
}

const RARITY_ICON: Record<string, string> = {
  common: 'C', uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L', mythic: 'M',
}

// Species roster number ("#N SP") — a stable 1-based index over the 12 species,
// alphabetical, derived from the real decoded species name. Purely an identifier
// (not a stat), so alphabetical order is fine and deterministic.
const SPECIES_NO: Record<string, number> = Object.fromEntries(
  Object.keys({
    buzzle: 0, dracling: 0, droplet: 0, flicker: 0, fluffle: 0, foxling: 0,
    glimmer: 0, owlet: 0, pebblit: 0, shellby: 0, sproutling: 0, wisp: 0,
  })
    .sort()
    .map((k, i) => [k, i + 1]),
)

const RARITY_GRADIENT: Record<string, string> = {
  common: 'linear-gradient(135deg, #22C55E, #16A34A)',
  uncommon: 'linear-gradient(135deg, #06B6D4, #0891B2)',
  rare: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  epic: 'linear-gradient(135deg, #A855F7, #7C3AED)',
  legendary: 'linear-gradient(135deg, #F59E0B, #D97706)',
  mythic: 'linear-gradient(135deg, #EF4444, #DC2626)',
}

// Elemental family → color (on-chain speciescfg.family values). text colors are
// tuned bright for the dark card. bg is retained for API compatibility (unused).
const FAMILY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Fire:      { bg: '#FEF2F2', text: '#FB7185', icon: '🔥' },
  Water:     { bg: '#EFF6FF', text: '#60A5FA', icon: '💧' },
  Earth:     { bg: '#F7FEE7', text: '#A3B85C', icon: '🪨' },
  Air:       { bg: '#F0F9FF', text: '#67C6F0', icon: '💨' },
  Void:      { bg: '#FAF5FF', text: '#C084FC', icon: '🌑' },
  Mythical:  { bg: '#FFF7ED', text: '#FBBF24', icon: '✨' },
  Nature:    { bg: '#F0FDF4', text: '#4ADE80', icon: '🌿' },
  Crystal:   { bg: '#F5F3FF', text: '#A78BFA', icon: '💎' },
  Shadow:    { bg: '#F8FAFC', text: '#94A3B8', icon: '🌙' },
}

function familyBadge(family: string | undefined): { bg: string; text: string; icon: string } | null {
  if (!family) return null
  // Case-insensitive match
  const key = Object.keys(FAMILY_COLORS).find(k => k.toLowerCase() === family.toLowerCase())
  return key ? FAMILY_COLORS[key] : null
}

// Species base stats (pow/charm per species — from species-registry.js common tier)
const SPECIES_STATS: Record<string, { pow: number; charm: number; sciName: string }> = {
  foxling:    { pow: 5,  charm: 7,  sciName: 'Vulpes magica' },
  owlet:      { pow: 4,  charm: 8,  sciName: 'Strigis rotundus' },
  droplet:    { pow: 3,  charm: 10, sciName: 'Aqua vivens' },
  pebblit:    { pow: 10, charm: 3,  sciName: 'Lithos vivens' },
  sproutling: { pow: 3,  charm: 9,  sciName: 'Herba ambulans' },
  flicker:    { pow: 7,  charm: 5,  sciName: 'Ignis animatus' },
  glimmer:    { pow: 6,  charm: 6,  sciName: 'Crystallus vivens' },
  wisp:       { pow: 2,  charm: 12, sciName: 'Umbra ludens' },
  fluffle:    { pow: 3,  charm: 11, sciName: 'Nubes mollis' },
  shellby:    { pow: 8,  charm: 4,  sciName: 'Cochlea margarita' },
  dracling:   { pow: 8,  charm: 6,  sciName: 'Draco parvus' },
  buzzle:     { pow: 5,  charm: 7,  sciName: 'Bombus rotundus' },
}

function stageMeta(stage: number): { emoji: string; word: string } {
  return STAGE_META[stage] ?? { emoji: '✨', word: `STAGE ${stage}` }
}

// ── Sparkle particles config ─────────────────────────────────────────────
// Rare+ gets sparkles — higher tiers get more.
const SPARKLE_COLORS: Record<string, string> = {
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
}
const SPARKLE_COUNTS: Record<string, number> = {
  rare: 5,
  epic: 7,
  legendary: 9,
  mythic: 12,
}

// ── Gene color helpers ─────────────────────────────────────────────────
function geneToHsl(hueBits: number): string {
  // 0–255 → 0°–360° hue, fixed sat/light for vibrant display
  const h = Math.round((hueBits / 255) * 360)
  return `hsl(${h}, 65%, 55%)`
}

// Six genome dots, each a REAL decoded gene field mapped to a hue. body/accent/
// pattern hues are 0–255; eye/saturation/brightness are 0–15 nibbles scaled to
// the same 0–360 hue wheel. Two creatures with different genes → different dots.
function decodeGeneForDisplay(genetics: string): string[] | null {
  try {
    const { gene } = decodeGeneCSS(genetics)
    const from15 = (n: number) => geneToHsl(Math.round((n / 15) * 255))
    return [
      geneToHsl(gene.bodyHue),
      geneToHsl(gene.accentHue),
      geneToHsl(gene.patternHue),
      from15(gene.eyeColor),
      from15(gene.saturation),
      from15(gene.brightness),
    ]
  } catch {
    return null
  }
}

// ── Creature sprite (gene-driven inline SVG) ──────────────────────────
// The species SVG is Monanisa's art; creatureRender.ts composites the per-creature
// pass over it — namespaced ids (so 20 inline sprites don't share one gradient),
// a gene palette re-mapped into the artist's own gradients, markings, contact
// shadow, AO, rim light, tier accessory, and a deterministic pose seeded from the
// asset id. Same creature → byte-identical sprite, every render.
export function CreatureSprite({ genetics, species, assetId, rarity, anim }: {
  genetics: string
  species: string
  /** seeds the deterministic pose/marking layout. Falls back to the gene alone. */
  assetId?: string
  /** on-chain rarity name — drives the tier accessory. */
  rarity?: string
  anim?: 'feed' | 'evolve' | null
}) {
  const [svgContent, setSvgContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const rarityIdx = rarity ? RARITY_ORDER.indexOf(rarity.toLowerCase() as Rarity) : -1

    const loadFromGenetics = async () => {
      const { speciesId } = decodeGeneRender(genetics)
      const text = await fetchSpeciesSvg(BASE, speciesId)
      const svg = renderCreatureCached(text, {
        assetId: assetId ?? genetics.slice(0, 12),
        genetics,
        rarity: rarityIdx >= 0 ? rarityIdx : undefined,
      })
      if (!cancelled) setSvgContent(svg)
    }

    const loadFromSpecies = async () => {
      const svg = await fetchSpeciesSvg(BASE, species.toLowerCase())
      if (!cancelled) setSvgContent(svg)
    }

    if (genetics) {
      loadFromGenetics().catch(() => {
        if (species && !cancelled) loadFromSpecies().catch(() => {})
      })
    } else if (species) {
      loadFromSpecies().catch(() => {})
    }

    return () => {
      cancelled = true
    }
  }, [genetics, species, assetId, rarity])

  if (!svgContent) return null
  return <div className={styles.svgWrap} data-anim={anim ?? undefined} dangerouslySetInnerHTML={{ __html: svgContent }} />
}

// ── Gene dots row ──────────────────────────────────────────────────────
function GeneDots({ genetics }: { genetics: string }) {
  const colors = useMemo(() => {
    return decodeGeneForDisplay(genetics)
      // Fallback (undecodable gene): a fixed 6-swatch palette so the row still reads.
      ?? ['#F59E0B', '#F43F5E', '#8B5CF6', '#3B82F6', '#22C55E', '#EC4899']
  }, [genetics])

  return (
    <div className={styles.geneRow}>
      <span className={styles.geneLabel}>🧬 DNA</span>
      <span className={styles.geneDots}>
        {colors.map((c, i) => (
          <span key={i} className={styles.geneDot} style={{ background: c }} />
        ))}
      </span>
    </div>
  )
}

// ── Main card ──────────────────────────────────────────────────────────
export function CreatureCard({
  creature,
  onFeed,
  onWake,
  onEvolve,
  onBurn,
  disabled = false,
  satietyConfig,
  nickname,
  onRename,
  pinned = false,
  onTogglePin,
}: CreatureCardProps) {
  const [confirmingBurn, setConfirmingBurn] = useState(false)
  // Inline rename: null = not editing. Opening seeds the field with the current
  // nickname so an edit is a tweak, not a retype.
  const [draftName, setDraftName] = useState<string | null>(null)
  // Reaction animation states — each clears after its animation duration
  const [creatureAnim, setCreatureAnim] = useState<'feed' | 'evolve' | null>(null)

  const triggerAnim = (anim: 'feed' | 'evolve', durationMs: number) => {
    setCreatureAnim(anim)
    setTimeout(() => setCreatureAnim(null), durationMs)
  }
  // Use creature.name (decoded from genetics) NOT creature.species (chain
  // family "Fire") — species is the on-chain category, name is the real species.
  const speciesKey = (creature.name || creature.species).toLowerCase()
  const speciesInfo = SPECIES_STATS[speciesKey] ?? { pow: 1, charm: 1, sciName: creature.species }

  const progress = useMemo(() => {
    if (creature.growthToNext <= 0) return 100
    return Math.min(100, Math.round((creature.growth / creature.growthToNext) * 100))
  }, [creature.growth, creature.growthToNext])

  const isMaxStage = creature.stage >= creature.maxStage
  // Asleep = stage 0 (Awaken v2). The boss couldn't tell a sleeping egg apart from
  // an awake creature — so a stage-0 card gets a dimmed sprite + a "💤 Sleeping"
  // veil drawn over the art, making the sleep state obvious at a glance.
  const asleep = creature.stage === 0
  const rarity = (creature.rarity || 'common').toLowerCase()
  const family = creature.species // play.ts sets species = sp.family (e.g. "Fire", "Water")
  const fb = familyBadge(family)
  const sm = stageMeta(creature.stage)
  const stageSub = isMaxStage ? 'MAX' : `STAGE ${creature.stage}`
  // Species roster number (#N SP) — from the real decoded species name.
  const speciesNo = SPECIES_NO[speciesKey] ?? 0

  // The species name the card falls back to when the creature has no nickname.
  const defaultName = creature.name || speciesInfo.sciName
  const displayName = nickname || defaultName

  const commitRename = () => {
    if (draftName === null) return
    onRename?.(draftName.trim())
    setDraftName(null)
  }

  return (
    <div className={styles.wrap}>
      <article
        className={`${styles.card} ${styles[rarity] || styles.common} ${asleep ? styles.asleep : ''}`}
        data-rarity={rarity}
        data-asleep={asleep ? '1' : '0'}
      >
        {/* ── Top bar: rarity icon + asset ID ── */}
        <div className={styles.topBar}>
          <div className={styles.rarityIcon}>
            {RARITY_ICON[rarity] || 'C'}
          </div>
          <div className={styles.topBarRight}>
            {/* Pin — lifts this creature to the top of the collection. Kept next to
                the ID (not in the action row) so it never sits beside Burn. */}
            {onTogglePin && (
              <button
                type="button"
                className={`${styles.pinBtn} ${pinned ? styles.pinBtnOn : ''}`}
                onClick={onTogglePin}
                aria-pressed={pinned}
                aria-label={pinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                title={pinned ? 'Unpin from the top' : 'Pin to the top'}
                data-testid={`pin-${creature.assetId}`}
              >
                {pinned ? '📌' : '📍'}
              </button>
            )}
            <div className={styles.cardId}>
              #{String(creature.assetId).slice(-4).padStart(4, '0')}
            </div>
          </div>
        </div>

        {/* ── Art window with rarity aura ── */}
        <div className={styles.artWrap}>
          <div className={styles.artAura} />
          <CreatureSprite
            genetics={creature.genetics}
            species={creature.name || creature.species}
            assetId={creature.assetId}
            rarity={rarity}
            anim={creatureAnim}
          />
          {/* Sparkle particles — Rare only, visible on light bg */}
          {SPARKLE_COUNTS[rarity] && (
            <div className={styles.sparkles}>
              {Array.from({ length: SPARKLE_COUNTS[rarity] }, (_, i) => (
                <span
                  key={i}
                  className={styles.sparkle}
                  style={{ color: SPARKLE_COLORS[rarity] }}
                />
              ))}
            </div>
          )}
          {/* Sleep veil — only over a stage-0 (asleep) card. Dims the art and
              flags the state so a dozing egg never looks like an awake creature. */}
          {asleep && (
            <div className={styles.sleepVeil} aria-label="Sleeping">
              <span className={styles.sleepZzz}>Zzz</span>
              <span className={styles.sleepTag}>😴 Sleeping</span>
            </div>
          )}
        </div>

        {/* ── Info: stage pill, name, species+element, DNA, stats ── */}
        <div className={styles.info}>
          {/* Stage pill — amber status dot + stage word + real chain stage number */}
          <span className={styles.stagePill}>
            <span className={styles.stageDot} />
            {sm.emoji} {sm.word} · {stageSub}
          </span>

          {/* Name — the player's nickname when set, else the species name. Renaming
              is cosmetic and local (the contract has no setname yet), so it never
              hides what the creature IS: the species line below always shows. */}
          {draftName !== null ? (
            <input
              className={styles.nameInput}
              value={draftName}
              autoFocus
              maxLength={MAX_NICKNAME}
              placeholder={defaultName}
              aria-label={`Nickname for ${defaultName}`}
              data-testid={`name-input-${creature.assetId}`}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setDraftName(null)
              }}
            />
          ) : (
            <h3 className={styles.name} data-testid={`name-${creature.assetId}`}>
              <span className={styles.nameText}>{displayName}</span>
              {onRename && (
                <button
                  type="button"
                  className={styles.renameBtn}
                  onClick={() => setDraftName(nickname ?? '')}
                  aria-label={`Rename ${displayName}`}
                  title="Give it a nickname"
                  data-testid={`rename-${creature.assetId}`}
                >
                  ✏️
                </button>
              )}
              {nickname && (
                <button
                  type="button"
                  className={styles.renameBtn}
                  onClick={() => onRename?.('')}
                  aria-label={`Clear nickname for ${displayName}`}
                  title={`Clear the nickname (back to ${defaultName})`}
                  data-testid={`clear-name-${creature.assetId}`}
                >
                  ✕
                </button>
              )}
            </h3>
          )}

          {/* Scientific name + elemental type (real chain family), inline */}
          <div className={styles.speciesLabel}>
            <span className={styles.sciName}>{speciesInfo.sciName}</span>
            {family && (
              <>
                <span className={styles.sep}> — </span>
                <span className={styles.element} style={fb ? { color: fb.text } : undefined}>
                  {fb ? `${fb.icon} ` : ''}{family}
                </span>
              </>
            )}
          </div>

          {creature.genetics && <GeneDots genetics={creature.genetics} />}

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>⚔️</span>
              <span className={styles.statValue}>{speciesInfo.pow}</span>
              <span className={styles.statLabel}>POW</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>✦</span>
              <span className={styles.statValue}>{speciesInfo.charm}</span>
              <span className={styles.statLabel}>CHARM</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>🧬</span>
              <span className={styles.statValue}>#{speciesNo}</span>
              <span className={styles.statLabel}>SP</span>
            </div>
          </div>
        </div>

        {/* ── Rarity footer ── */}
        <div className={styles.rarityFooter}>
          <span className={styles.rarityLine} />
          <span className={styles.rarityName}>{rarity}</span>
          <span className={styles.rarityLine} />
        </div>

        {/* ── Progress ── */}
        {!isMaxStage && (
          <div className={styles.progressSection}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${progress}%`,
                  background: RARITY_GRADIENT[rarity] || RARITY_GRADIENT.common,
                }}
              />
            </div>
            <span className={styles.progressLabel}>
              {creature.growth.toLocaleString()} / {creature.growthToNext.toLocaleString()}
            </span>
          </div>
        )}

        {isMaxStage && (
          <div className={styles.progressSection}>
            <div className={styles.maxBadge}>⭐ Max Stage</div>
          </div>
        )}

        {/* ── Awaken v2 (stage 0, asleep): sleep-timer + WAX wake ── */}
        {creature.stage === 0 ? (
          <AwakenMeter
            bornAt={creature.bornAt ?? 0}
            rarity={rarity as Rarity}
            awakenDurSec={creature.awakenDur}
            wakeCostWax={creature.wakeCostWax}
            onWake={onWake}
            disabled={disabled}
          />
        ) : (
          /* ── Feed v2 (awake): satiety meter + stateful Feed button ── */
          !isMaxStage && (
            <SatietyMeter
              lastFed={creature.lastFed ?? 0}
              rarity={rarity as Rarity}
              stage={creature.stage}
              onFeed={() => { triggerAnim('feed', 750); onFeed?.() }}
              disabled={disabled}
              config={satietyConfig}
              fedDurSec={creature.fedDur}
              feedCdSec={creature.feedCd}
              earnFull={creature.earnFull}
              earnMult={creature.earnMult}
            />
          )
        )}

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.evolveBtn} ${styles.evolveFull}`}
            onClick={() => { triggerAnim('evolve', 950); onEvolve?.() }}
            disabled={disabled || isMaxStage || creature.growth < creature.growthToNext}
          >
            {isMaxStage ? '🏆 MAX LEVEL' : '✨ Evolve · 50 HATCH'}
          </button>

          {onBurn && !confirmingBurn && (
            <button
              className={`${styles.btn} ${styles.burnGhost} ${styles.evolveFull}`}
              onClick={() => setConfirmingBurn(true)}
              disabled={disabled}
            >
              🔥 Burn
            </button>
          )}

          {onBurn && confirmingBurn && (
            <div className={styles.burnConfirm}>
              <span className={styles.burnWarn}>
                Burning permanently destroys this creature. This can’t be undone.
              </span>
              <div className={styles.burnConfirmRow}>
                <button
                  className={`${styles.btn} ${styles.cancelBtn}`}
                  onClick={() => setConfirmingBurn(false)}
                  disabled={disabled}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.btn} ${styles.burnBtn}`}
                  onClick={() => {
                    setConfirmingBurn(false)
                    onBurn()
                  }}
                  disabled={disabled}
                >
                  🔥 Burn forever
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
