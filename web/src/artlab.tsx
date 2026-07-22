/**
 * artlab.tsx — honest before/after harness for the creature renderer.
 *
 *   /artlab.html?mode=before   legacy path (applyGeneToSvg as shipped)
 *   /artlab.html?mode=after    creatureRender.ts pipeline
 *
 * Same genes, same species, same dark canvas — only the renderer changes.
 * Dev-only; not linked from the app. Screenshots land in web/screenshots/.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { decodeGeneRender } from './geneDecoder'
import { fetchSpeciesSvg, renderCreatureCached } from './creatureRender'
import './styles/tokens.css'

const BASE = import.meta.env.BASE_URL
const MODE = new URLSearchParams(location.search).get('mode') === 'before' ? 'before' : 'after'

// ── Gene construction (mirrors GENE-SPEC.md §2 bit layout) ──────────────
interface GeneFields {
  species: number; bodyHue: number; accentHue: number; patternType: number
  patternHue: number; saturation: number; brightness: number; eyeColor: number
  patOpacity: number; traitA: number; traitB: number; traitC: number; mutations: number
}

function makeGene(f: GeneFields): string {
  const b = (v: number, shift: number) => BigInt(v) << BigInt(shift)
  const g =
    b(f.species, 0) | b(f.bodyHue, 4) | b(f.accentHue, 12) | b(f.patternType, 20) |
    b(f.patternHue, 24) | b(f.saturation, 32) | b(f.brightness, 36) | b(f.eyeColor, 40) |
    b(f.patOpacity, 44) | b(f.traitA, 48) | b(f.traitB, 52) | b(f.traitC, 56) | b(f.mutations, 60)
  return g.toString(16).padStart(16, '0') + '0'.repeat(48)
}

// ── Legacy renderer — verbatim copy of the shipped applyGeneToSvg ───────
function legacyRender(svgText: string, genetics: string): string {
  const r = decodeGeneRender(genetics)
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('malformed species SVG')
  const root = doc.documentElement
  for (const [k, v] of Object.entries(r.cssVars)) root.style.setProperty(k, v)
  if (r.giant) {
    root.style.setProperty('transform-box', 'fill-box')
    root.style.setProperty('transform-origin', 'center')
    root.style.transform = 'scale(1.3)'
  }
  for (const [id, show] of Object.entries(r.visibility)) {
    const el = doc.getElementById(id)
    if (el) el.style.display = show ? '' : 'none'
  }
  return new XMLSerializer().serializeToString(root)
}

// ── Specimens ───────────────────────────────────────────────────────────
const SPECIES_NAMES = ['foxling', 'owlet', 'droplet', 'pebblit', 'sproutling', 'flicker',
  'glimmer', 'wisp', 'fluffle', 'shellby', 'dracling', 'buzzle']

// A deterministic spread so before/after compare like-for-like.
function specimen(i: number, species: number): { assetId: string; genetics: string; rarity: number; label: string } {
  const s = (n: number, m: number) => (i * n + species * 37 + 11) % m
  return {
    assetId: String(1099500000000 + i * 7 + species * 101),
    genetics: makeGene({
      species,
      bodyHue: s(53, 256), accentHue: s(97, 256), patternType: s(3, 8),
      patternHue: s(71, 256), saturation: 6 + s(5, 9), brightness: 5 + s(3, 8),
      eyeColor: s(7, 16), patOpacity: 6 + s(4, 9),
      traitA: s(2, 4), traitB: s(3, 4), traitC: s(5, 4),
      mutations: i === 5 ? 0x4 : i === 7 ? 0x8 : 0,
    }),
    rarity: i % 6,
    label: `${SPECIES_NAMES[species]} · ${['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'][i % 6]}`,
  }
}

const ROSTER = SPECIES_NAMES.map((_, sp) => specimen(sp, sp))
// Offset the index so these are 8 *different* foxlings, not re-draws of ROSTER[0].
const FOXES = Array.from({ length: 8 }, (_, i) => specimen(i + 20, 0))

function Sprite({ assetId, genetics, rarity }: { assetId: string; genetics: string; rarity: number }) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let dead = false
    const { speciesId } = decodeGeneRender(genetics)
    fetchSpeciesSvg(BASE, speciesId).then(text => {
      const out = MODE === 'before'
        ? legacyRender(text, genetics)
        : renderCreatureCached(text, { assetId, genetics, rarity })
      if (!dead) setHtml(out)
    })
    return () => { dead = true }
  }, [assetId, genetics, rarity])
  if (!html) return <div style={{ width: 132, height: 132 }} />
  return <div style={{ width: 132, height: 132 }} dangerouslySetInnerHTML={{ __html: html }} />
}

function Grid({ title, items }: { title: string; items: ReturnType<typeof specimen>[] }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ font: 'var(--ph-text-h3)', color: 'var(--ph-text-primary)', margin: '0 0 12px' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {items.map(c => (
          <div key={c.assetId} style={{
            background: 'var(--ph-panel)', border: '1px solid var(--ph-panel-border)',
            borderRadius: 'var(--ph-radius-lg)', padding: 10, display: 'grid',
            placeItems: 'center', gap: 6,
          }}>
            <Sprite {...c} />
            <span style={{ font: 'var(--ph-text-caption)', color: 'var(--ph-text-muted)' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function App() {
  useEffect(() => {
    // Signals the screenshot harness that every sprite has settled.
    const t = setTimeout(() => document.body.setAttribute('data-artlab-ready', '1'), 900)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ background: 'var(--ph-surface-canvas)', minHeight: '100vh', padding: 24, fontFamily: 'var(--ph-font-body)' }}>
      <h1 style={{ font: 'var(--ph-text-h2)', color: 'var(--ph-text-primary)', margin: '0 0 4px' }}>
        Art Lab — renderer <b style={{ color: 'var(--tier-legendary)' }}>{MODE}</b>
      </h1>
      <p style={{ font: 'var(--ph-text-caption)', color: 'var(--ph-text-muted)', margin: '0 0 24px' }}>
        Identical genes and asset ids in both modes. Only the render pipeline differs.
      </p>
      <Grid title="All 12 species — one specimen each" items={ROSTER} />
      <Grid title="Foxling ×8 — same species, different genes" items={FOXES} />
    </div>
  )
}

// Vite keeps this module alive across in-page navigations, so re-running the
// entry would createRoot() the same container twice. Reuse the first root.
const host = document.getElementById('root')! as HTMLElement & { _root?: ReturnType<typeof createRoot> }
host._root ??= createRoot(host)
host._root.render(<StrictMode><App /></StrictMode>)
