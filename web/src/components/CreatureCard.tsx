import { useEffect, useMemo, useState } from 'react'
import { decodeGeneCSS, decodeGeneRender } from '../geneDecoder'
import { SatietyMeter } from './SatietyMeter'
import type { SatietyConfig } from '../satiety'
import styles from './CreatureCard.module.css'

const BASE = import.meta.env.BASE_URL

// On-chain rarity has exactly THREE tiers (speciescfg.egg_type 0/1/2 →
// common/uncommon/rare). See GENETICS-SPEC.md §"Rarity อยู่ที่ species level".
// epic/legendary/mythic were mock tiers and no longer exist anywhere in the model.
export type Rarity = 'common' | 'uncommon' | 'rare'

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
}

interface CreatureCardProps {
  creature: Creature
  onFeed?: () => void
  onEvolve?: () => void
  disabled?: boolean
  /** Feed-v2 decay clock override (preview uses a fast one). Defaults to MOCK. */
  satietyConfig?: SatietyConfig
}

// ── Visual constants ───────────────────────────────────────────────────
const STAGE_LABELS: Record<number, string> = {
  0: '🥚 Egg',
  1: '🐣 Baby',
  2: '🌱 Juvenile',
  3: '✨ Adult',
  4: '👑 Elite',
  5: '🏆 Champion',
}

const RARITY_ICON: Record<string, string> = {
  common: 'C', uncommon: 'U', rare: 'R',
}

const RARITY_GRADIENT: Record<string, string> = {
  common: 'linear-gradient(135deg, #22C55E, #16A34A)',
  uncommon: 'linear-gradient(135deg, #06B6D4, #0891B2)',
  rare: 'linear-gradient(135deg, #3B82F6, #2563EB)',
}

// Elemental family → color (on-chain speciescfg.family values)
const FAMILY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Fire:      { bg: '#FEF2F2', text: '#DC2626', icon: '🔥' },
  Water:     { bg: '#EFF6FF', text: '#2563EB', icon: '💧' },
  Earth:     { bg: '#F7FEE7', text: '#65A30D', icon: '🪨' },
  Air:       { bg: '#F0F9FF', text: '#0EA5E9', icon: '💨' },
  Void:      { bg: '#FAF5FF', text: '#9333EA', icon: '🌑' },
  Mythical:  { bg: '#FFF7ED', text: '#D97706', icon: '✨' },
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

function stageName(stage: number): string {
  return STAGE_LABELS[stage] ?? `Stage ${stage}`
}

// ── Sparkle particles config ─────────────────────────────────────────────
// Only the top on-chain tier (Rare) gets sparkles — a small premium flourish.
const SPARKLE_COLORS: Record<string, string> = {
  rare: '#3B82F6', // blue — matches the rare gradient
}
const SPARKLE_COUNTS: Record<string, number> = {
  rare: 5,
}

// ── Gene color helpers ─────────────────────────────────────────────────
function geneToHsl(hueBits: number): string {
  // 0–255 → 0°–360° hue, fixed sat/light for vibrant display
  const h = Math.round((hueBits / 255) * 360)
  return `hsl(${h}, 65%, 55%)`
}

function decodeGeneForDisplay(genetics: string): { bodyColor: string; accentColor: string; patColor: string } | null {
  try {
    const { gene } = decodeGeneCSS(genetics)
    return {
      bodyColor: geneToHsl(gene.bodyHue),
      accentColor: geneToHsl(gene.accentHue),
      patColor: geneToHsl(gene.patternHue),
    }
  } catch {
    return null
  }
}

// ── Creature sprite (gene-driven inline SVG) ──────────────────────────
// Bakes the decoded gene into a species SVG: the gene-tint CSS vars
// (hue/sat/light) drive the SVG's `.gene-tint` filter, and the visibility map
// shows exactly one trait variant per slot plus any mutation/rarity layers the
// gene calls for. Two creatures of the same species therefore look visibly
// different — their ears/tail/forehead/… come from the gene, not the SVG default.
function applyGeneToSvg(svgText: string, genetics: string): string {
  const r = decodeGeneRender(genetics)
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('malformed species SVG')
  }
  const root = doc.documentElement

  // gene-tint vars — consumed by the SVG's own .gene-tint filter
  for (const [k, v] of Object.entries(r.cssVars)) root.style.setProperty(k, v)

  // Giant mutation → scale the whole creature ~1.3× about its center
  if (r.giant) {
    root.style.setProperty('transform-box', 'fill-box')
    root.style.setProperty('transform-origin', 'center')
    root.style.transform = 'scale(1.3)'
  }

  // Trait / mutation / rarity layer visibility — absent groups are skipped
  for (const [id, show] of Object.entries(r.visibility)) {
    const el = doc.getElementById(id)
    if (el) el.style.display = show ? '' : 'none'
  }

  return new XMLSerializer().serializeToString(root)
}

export function CreatureSprite({ genetics, species }: { genetics: string; species: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadFromGenetics = async () => {
      const { speciesId } = decodeGeneRender(genetics)
      const res = await fetch(BASE + 'assets/creatures/' + speciesId + '.svg')
      if (!res.ok) throw new Error(`SVG not found: ${speciesId}`)
      const svg = applyGeneToSvg(await res.text(), genetics)
      if (!cancelled) setSvgContent(svg)
    }

    const loadFromSpecies = async () => {
      const speciesId = species.toLowerCase()
      const res = await fetch(BASE + 'assets/creatures/' + speciesId + '.svg')
      if (!res.ok) throw new Error(`SVG not found: ${speciesId}`)
      if (!cancelled) setSvgContent(await res.text())
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
  }, [genetics, species])

  if (!svgContent) return null
  return <div className={styles.svgWrap} dangerouslySetInnerHTML={{ __html: svgContent }} />
}

// ── Gene dots row ──────────────────────────────────────────────────────
function GeneDots({ genetics }: { genetics: string }) {
  const colors = useMemo(() => {
    const g = decodeGeneForDisplay(genetics)
    if (g) return [g.bodyColor, g.accentColor, g.patColor]
    // Fallback: species-based dots from CSS vars
    return ['#F59E0B', '#F43F5E', '#8B5CF6']
  }, [genetics])

  return (
    <div className={styles.geneRow}>
      <span className={styles.geneLabel}>🧬 DNA</span>
      {colors.map((c, i) => (
        <span key={i} className={styles.geneDot} style={{ background: c }} />
      ))}
    </div>
  )
}

// ── Main card ──────────────────────────────────────────────────────────
export function CreatureCard({ creature, onFeed, onEvolve, disabled = false, satietyConfig }: CreatureCardProps) {
  // Use creature.name (decoded from genetics) NOT creature.species (chain
  // family "Fire") — species is the on-chain category, name is the real species.
  const speciesKey = (creature.name || creature.species).toLowerCase()
  const speciesInfo = SPECIES_STATS[speciesKey] ?? { pow: 1, charm: 1, sciName: creature.species }

  const progress = useMemo(() => {
    if (creature.growthToNext <= 0) return 100
    return Math.min(100, Math.round((creature.growth / creature.growthToNext) * 100))
  }, [creature.growth, creature.growthToNext])

  const isMaxStage = creature.stage >= creature.maxStage
  const rarity = (creature.rarity || 'common').toLowerCase()
  const family = creature.species // play.ts sets species = sp.family (e.g. "Fire", "Water")
  const fb = familyBadge(family)

  return (
    <div className={styles.wrap}>
      <article
        className={`${styles.card} ${styles[rarity] || styles.common}`}
        data-rarity={rarity}
      >
        {/* ── Top bar: rarity icon + asset ID ── */}
        <div className={styles.topBar}>
          <div className={styles.rarityIcon}>
            {RARITY_ICON[rarity] || 'C'}
          </div>
          <div className={styles.cardId}>
            #{String(creature.assetId).slice(-4).padStart(4, '0')}
          </div>
        </div>

        {/* ── Art window with rarity aura ── */}
        <div className={styles.artWrap}>
          <div className={styles.artAura} />
          <CreatureSprite genetics={creature.genetics} species={creature.name || creature.species} />
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
          <span className={styles.stageBadge}>{stageName(creature.stage)}</span>
        </div>

        {/* ── Info: name, species, DNA, stats ── */}
        <div className={styles.info}>
          <h3 className={styles.name}>{creature.name || speciesInfo.sciName}</h3>
          <div className={styles.speciesLabel}>
            {speciesInfo.sciName} · {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
          </div>
          {fb && (
            <span
              className={styles.familyBadge}
              style={{ background: fb.bg, color: fb.text, borderColor: fb.text }}
            >
              {fb.icon} {family}
            </span>
          )}
          {creature.genetics && <GeneDots genetics={creature.genetics} />}
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>⚔</span>
              <span className={styles.statValue}>{speciesInfo.pow}</span>
              <span className={styles.statLabel}>POW</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>✦</span>
              <span className={styles.statValue}>{speciesInfo.charm}</span>
              <span className={styles.statLabel}>CHARM</span>
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

        {/* ── Feed v2: satiety meter + stateful Feed button ── */}
        {!isMaxStage && (
          <SatietyMeter
            lastFed={creature.lastFed ?? 0}
            rarity={rarity as Rarity}
            stage={creature.stage}
            onFeed={onFeed}
            disabled={disabled}
            config={satietyConfig}
            fedDurSec={creature.fedDur}
          />
        )}

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.evolveBtn} ${styles.evolveFull}`}
            onClick={onEvolve}
            disabled={disabled || isMaxStage || creature.growth < creature.growthToNext}
          >
            {isMaxStage ? '🏆 MAX LEVEL' : '✨ Evolve · 50 HATCH'}
          </button>
        </div>
      </article>
    </div>
  )
}
