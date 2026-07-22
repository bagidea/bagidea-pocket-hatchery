/**
 * creatureRender.ts — the Pocket Hatchery creature renderer.
 *
 * Takes a shipped species SVG (Monanisa's art, never edited here) plus the
 * creature's gene + asset id, and composites a richer, per-creature sprite:
 *
 *   1. per-instance id namespacing   — kills cross-card `url(#bodyGrad)` collisions
 *   2. palette re-mapping            — gradient stops AND flat fill/stroke paint,
 *                                      artist shading + alpha preserved
 *   3. contact shadow                — nothing floats (ART.md §2)
 *   4. marking overlay               — stripes/spots/dapple/… from patternType + patternHue
 *   5. ambient occlusion             — volume from below
 *   6. specular sheen                — the soft-3D "touchable" pop
 *   7. rim light                     — key light upper-left, hugs any silhouette
 *   8. tier accessory                — motes/halo/shards by rarity
 *   9. deterministic pose            — every creature sits slightly differently
 *
 * Everything derives from (assetId, genetics), so a creature renders identically
 * forever. Colours come from variationSpec.ts — this file has no species palette.
 */

import { decodeGeneRender, type GeneData } from './geneDecoder'
import {
  getVariationSpec,
  type AccessoryKind,
  type CreaturePalette,
  type MarkingKind,
  type VariationContext,
} from './variationSpec'

// ── Deterministic randomness ───────────────────────────────────────────
// Same creature → same seed → same pose/mote layout, forever.

function hash32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Colour ─────────────────────────────────────────────────────────────

interface HSL { h: number; s: number; l: number }

function hexToHsl(hex: string): HSL | null {
  let c = hex.trim()
  if (c[0] !== '#') return null
  if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
  if (c.length !== 7) return null
  const r = parseInt(c.slice(1, 3), 16) / 255
  const g = parseInt(c.slice(3, 5), 16) / 255
  const b = parseInt(c.slice(5, 7), 16) / 255
  if ([r, g, b].some(Number.isNaN)) return null

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

function hslToHex({ h, s, l }: HSL): string {
  const hh = ((h % 360) + 360) % 360
  const ss = Math.min(100, Math.max(0, s)) / 100
  const ll = Math.min(100, Math.max(0, l)) / 100
  const k = (n: number) => (n + hh / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + to(f(0)) + to(f(8)) + to(f(4))
}

/**
 * Re-hue one gradient stop while keeping the artist's lightness + alpha.
 * Near-white highlights, near-black AO and neutral greys are left alone — they
 * are the shading structure, not the colour identity.
 *
 * `relaxed` drops those guards for art that is *entirely* near-white or neutral
 * (fluffle's cloud, glimmer's crystal). Without it such a species would skip
 * every stop and render with no gene identity at all — the strict pass has
 * nothing to grip.
 */
function reHue(hex: string, targetHue: number, satMult: number, relaxed = false): string | null {
  const hsl = hexToHsl(hex)
  if (!hsl) return null
  if (relaxed) {
    if (hsl.l >= 98 || hsl.l <= 4) return null // true white / true black — always preserve
    // Pull pale art down off the ceiling so a hue can actually be seen on it.
    const l = hsl.l >= 88 ? 88 - (hsl.l - 88) * 0.6 : hsl.l
    return hslToHex({ h: targetHue, s: Math.max(34, hsl.s * satMult), l })
  }
  if (hsl.l >= 90 || hsl.l <= 9) return null // highlight / AO — preserve
  if (hsl.s <= 8) return null                // neutral — preserve
  return hslToHex({ h: targetHue, s: Math.min(96, hsl.s * satMult), l: hsl.l })
}

// ── Gradient role classification ───────────────────────────────────────
// Which part of the creature a gradient id paints. Matches every species SVG's
// own naming (bodyGrad, foxIrisL, fkFlameOrange, graniteGrad, hexGrad, …).

type Role = 'body' | 'accent' | 'eye' | 'skip'

const EYE_RE = /iris|eyeglow|eyeshine/i
const ACCENT_RE = /wing|ear|fin|tail|horn|flame|crown|moss|core|beak|spiral|petal|flower|fruit|stem|root|smoke|stripe|refract/i
const BODY_RE = /body|fluff|shell|granite|obsidian|marble|geode|hex|diamond|obelisk|head|belly/i
const SKIP_RE = /aura|glow|blur|rim|sss|cheek|catch|ao$|hl$|spec/i

function roleOf(id: string): Role {
  if (SKIP_RE.test(id)) return 'skip'   // lighting/FX layers — driven by tier, not gene
  if (EYE_RE.test(id)) return 'eye'
  if (ACCENT_RE.test(id)) return 'accent'
  if (BODY_RE.test(id)) return 'body'
  return 'skip'
}

// ── Palette / marking / accessory defaults ─────────────────────────────
// Used only when the variation spec declines to answer.

function defaultPalette(gene: GeneData): CreaturePalette {
  const hue = (n: number, span = 360) => Math.round((n / 255) * span)
  return {
    bodyHue: hue(gene.bodyHue),
    accentHue: hue(gene.accentHue),
    eyeHue: Math.round((gene.eyeColor / 15) * 360),
    patternHue: hue(gene.patternHue),
    // saturation nibble 0–15 → 0.80–1.25 multiplier around the artist's own value
    saturation: 0.8 + (gene.saturation / 15) * 0.45,
    rim: hslToHex({ h: hue(gene.accentHue), s: 62, l: 88 }),
  }
}

const MARKINGS: MarkingKind[] = [
  'none', 'stripes', 'spots', 'belly-patch',
  'dapple', 'gradient-fade', 'freckles', 'none',
]

function defaultMarking(gene: GeneData): MarkingKind {
  return MARKINGS[gene.patternType % MARKINGS.length]
}

function defaultAccessory(rarity: number): AccessoryKind {
  if (rarity >= 5) return 'prismatic'     // Mythic
  if (rarity >= 4) return 'crown-shards'  // Legendary
  if (rarity >= 3) return 'halo'          // Epic
  if (rarity >= 2) return 'orbit-motes'   // Rare
  if (rarity >= 1) return 'sparkles'      // Uncommon
  return 'none'                           // Common
}

// ── Pipeline ───────────────────────────────────────────────────────────

export interface RenderOptions {
  /** on-chain asset id — seeds the deterministic pose/mote layout */
  assetId: string
  /** 64-char hex genetics */
  genetics: string
  /** on-chain rarity 0–5. Falls back to the gene heuristic when omitted. */
  rarity?: number
}

/** Collect ids and rewrite them + every `url(#…)` / `href="#…"` reference. */
function namespaceIds(root: SVGElement, doc: Document, prefix: string): void {
  const owned = new Set<string>()
  root.querySelectorAll('[id]').forEach(el => owned.add(el.id))
  if (owned.size === 0) return

  const rename = (id: string) => (owned.has(id) ? prefix + id : id)

  root.querySelectorAll('[id]').forEach(el => { el.id = prefix + el.id })

  const URL_ATTRS = [
    'fill', 'stroke', 'filter', 'clip-path', 'mask', 'style',
    'marker-start', 'marker-mid', 'marker-end',
  ]
  const all = [root, ...Array.from(root.querySelectorAll('*'))] as Element[]
  for (const el of all) {
    for (const attr of URL_ATTRS) {
      const v = el.getAttribute(attr)
      if (!v || !v.includes('url(#')) continue
      el.setAttribute(attr, v.replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${rename(id.trim())})`))
    }
    for (const attr of ['href', 'xlink:href']) {
      const v = el.getAttribute(attr)
      if (v && v.startsWith('#')) el.setAttribute(attr, '#' + rename(v.slice(1)))
    }
  }

  // The shared `<style>` block is class-based (.gene-tint) — scope it so 20
  // inline sprites don't stack 20 identical global rules.
  doc.querySelectorAll('style').forEach(s => {
    if (s.textContent) s.textContent = s.textContent.replace(/\.gene-tint/g, `.${prefix}tint`)
  })
  root.querySelectorAll('.gene-tint').forEach(el => {
    el.classList.remove('gene-tint')
    el.classList.add(prefix + 'tint')
  })
}

function hueForRole(role: Exclude<Role, 'skip'>, palette: CreaturePalette): number {
  return role === 'eye' ? palette.eyeHue : role === 'accent' ? palette.accentHue : palette.bodyHue
}

/** Re-colour every classified gradient's stops to the palette. */
function remapGradients(root: SVGElement, palette: CreaturePalette): void {
  const grads = root.querySelectorAll('linearGradient, radialGradient')
  grads.forEach(g => {
    const role = roleOf(g.id)
    if (role === 'skip') return
    const hue = hueForRole(role, palette)
    const stops = Array.from(g.querySelectorAll('stop'))

    const apply = (relaxed: boolean) => {
      let hits = 0
      for (const stop of stops) {
        const cur = stop.getAttribute('stop-color')
        if (!cur) continue
        const next = reHue(cur, hue, palette.saturation, relaxed)
        if (next) { stop.setAttribute('stop-color', next); hits++ }
      }
      return hits
    }

    // Strict pass keeps the artist's shading. If it gripped less than half the
    // ramp, the gradient is mostly pale/neutral (fluffle's cloud is #FFFFFF →
    // #FAFAFA → #F0E0D0) and re-hueing one end leaves the creature colourless.
    // Redo the whole ramp relaxed so it still reads as this creature's colour.
    if (apply(false) * 2 < stops.length) apply(true)
  })
}

const COLOUR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color'] as const

/**
 * Re-colour flat `fill="#…"` / `stroke="#…"` paint.
 *
 * Gradients are the minority of every species file — foxling is 34 gradient-fills
 * to 77 flat ones, so a gradient-only pass leaves two thirds of the creature
 * wearing the artist's stock palette while the rest carries the gene (the mint
 * paws against a re-hued red body). Flat paint has no id of its own, so a part's
 * role comes from the nearest ancestor that names it — `<g id="slot-ears-1">` →
 * accent, `<g id="body">` → body, `<g id="legendary-aura">` → skip. Anything
 * under no named group is left alone.
 */
function remapFlatFills(root: SVGElement, palette: CreaturePalette): void {
  // role → the paint attrs it owns, so the relaxed fallback can be decided per
  // role exactly as it is per gradient-ramp.
  const buckets = new Map<Exclude<Role, 'skip'>, Array<{ el: Element; attr: string; hex: string }>>()

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.tagName === 'stop') continue // gradient ramps are remapGradients' job
    if (el.closest('linearGradient, radialGradient')) continue

    // nearest self-or-ancestor that carries an id we can classify
    let role: Role = 'skip'
    for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
      if (n.id) { role = roleOf(n.id); break }
    }
    if (role === 'skip') continue

    for (const attr of COLOUR_ATTRS) {
      const v = el.getAttribute(attr)
      if (!v || v[0] !== '#') continue
      let list = buckets.get(role)
      if (!list) { list = []; buckets.set(role, list) }
      list.push({ el, attr, hex: v })
    }
  }

  for (const [role, list] of buckets) {
    const hue = hueForRole(role, palette)
    const apply = (relaxed: boolean) => {
      let hits = 0
      for (const { el, attr, hex } of list) {
        const next = reHue(hex, hue, palette.saturation, relaxed)
        if (next) { el.setAttribute(attr, next); hits++ }
      }
      return hits
    }
    // Same reasoning as the gradient ramps: if strict barely gripped, the part is
    // painted mostly pale/neutral and would otherwise read as colourless.
    if (apply(false) * 2 < list.length) apply(true)
  }
}

const LIGHT_DX = 2.2 // key light from upper-left (ART.md §2) → rim band offset
const LIGHT_DY = 2.6

function markingFill(kind: MarkingKind, p: string, hue: number, rnd: () => number): { defs: string; body: string } {
  const col = hslToHex({ h: hue, s: 58, l: 34 })
  const lit = hslToHex({ h: hue, s: 64, l: 72 })
  const jitter = () => (rnd() - 0.5) * 6

  switch (kind) {
    case 'stripes': {
      const angle = Math.round(-40 + rnd() * 25)
      return {
        defs: `<pattern id="${p}mk" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
          <rect width="13" height="13" fill="none"/>
          <rect x="0" y="0" width="5" height="13" fill="${col}" rx="2.5"/>
        </pattern>`,
        body: `<rect width="200" height="200" fill="url(#${p}mk)"/>`,
      }
    }
    case 'spots': {
      const dots = Array.from({ length: 9 }, () => {
        const cx = 62 + rnd() * 76, cy = 66 + rnd() * 80, r = 3.2 + rnd() * 4.4
        return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.86).toFixed(1)}" fill="${col}"/>`
      }).join('')
      return { defs: '', body: dots }
    }
    case 'freckles': {
      const dots = Array.from({ length: 22 }, () => {
        const cx = 58 + rnd() * 84, cy = 60 + rnd() * 92, r = 1 + rnd() * 1.6
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}"/>`
      }).join('')
      return { defs: '', body: dots }
    }
    case 'dapple': {
      const blobs = Array.from({ length: 6 }, () => {
        const cx = 64 + rnd() * 72, cy = 62 + rnd() * 84, r = 9 + rnd() * 9
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}"/>`
      }).join('')
      return {
        defs: `<filter id="${p}mkb"><feGaussianBlur stdDeviation="4.5"/></filter>`,
        body: `<g filter="url(#${p}mkb)">${blobs}</g>`,
      }
    }
    case 'belly-patch': {
      return {
        defs: `<radialGradient id="${p}mk" cx="50%" cy="50%">
          <stop offset="0%" stop-color="${lit}" stop-opacity="1"/>
          <stop offset="70%" stop-color="${lit}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${lit}" stop-opacity="0"/>
        </radialGradient>`,
        body: `<ellipse cx="${(100 + jitter()).toFixed(1)}" cy="${(126 + jitter()).toFixed(1)}" rx="30" ry="26" fill="url(#${p}mk)"/>`,
      }
    }
    case 'gradient-fade': {
      return {
        defs: `<linearGradient id="${p}mk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity="0"/>
          <stop offset="55%" stop-color="${col}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="0.9"/>
        </linearGradient>`,
        body: `<rect width="200" height="200" fill="url(#${p}mk)"/>`,
      }
    }
    default:
      return { defs: '', body: '' }
  }
}

function accessoryLayer(kind: AccessoryKind, p: string, palette: CreaturePalette, rnd: () => number): string {
  const gold = hslToHex({ h: palette.accentHue, s: 82, l: 72 })
  const goldBright = hslToHex({ h: palette.accentHue, s: 68, l: 90 })

  /** 4-pointed star path at (cx,cy) with given outer radius and inner fraction. */
  const star4 = (cx: number, cy: number, outer: number, innerFrac = 0.38): string => {
    const inner = outer * innerFrac
    const s = Math.SQRT1_2
    const pts: [number, number][] = [
      [cx, cy - outer], [cx + inner * s, cy - inner * s],
      [cx + outer, cy], [cx + inner * s, cy + inner * s],
      [cx, cy + outer], [cx - inner * s, cy + inner * s],
      [cx - outer, cy], [cx - inner * s, cy - inner * s],
    ]
    return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + 'Z'
  }

  switch (kind) {
    case 'sparkles': {
      // 6 rotating 4-pointed stars — more visible and charming than plain dots
      return Array.from({ length: 6 }, (_, i) => {
        const a = rnd() * Math.PI * 2
        const dist = 56 + rnd() * 18
        const cx = 100 + Math.cos(a) * dist
        const cy = 100 + Math.sin(a) * dist * 0.82
        const sz = 2.5 + rnd() * 2.2
        const dur = (1.4 + i * 0.28).toFixed(2)
        const spin = (3.8 + i * 0.65).toFixed(1)
        const delay = (rnd() * 1.8).toFixed(2)
        return `<path d="${star4(cx, cy, sz)}" fill="${gold}" opacity="0.85" filter="url(#${p}soft)">
          <animate attributeName="opacity" values="0.85;0.15;0.85" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate"
            from="0 ${cx.toFixed(1)} ${cy.toFixed(1)}" to="360 ${cx.toFixed(1)} ${cy.toFixed(1)}"
            dur="${spin}s" repeatCount="indefinite"/>
        </path>`
      }).join('')
    }

    case 'orbit-motes': {
      // 8 motes alternating between two radii — denser, more jewel-like orbit
      return Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * 360 + rnd() * 12
        const radius = i % 2 === 0 ? 58 : 68
        const sz = (1.8 + rnd() * 1.9).toFixed(1)
        const dur = (11 + i * 0.9 + rnd() * 4).toFixed(1)
        return `<g transform="translate(100 106)">
          <g transform="rotate(${a.toFixed(1)})">
            <circle cx="0" cy="-${radius}" r="${sz}" fill="${gold}" opacity="0.88" filter="url(#${p}soft)"/>
          </g>
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0"
            dur="${dur}s" repeatCount="indefinite" additive="sum"/>
        </g>`
      }).join('')
    }

    case 'halo': {
      // Wider tilted halo with feathered outer glow + sharp inner crescent
      const h2 = hslToHex({ h: palette.accentHue, s: 58, l: 92 })
      const hId = `${p}hglow`
      return `
        <defs>
          <filter id="${hId}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${gold}"
          stroke-width="7" opacity="0.18" filter="url(#${hId})"/>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${gold}"
          stroke-width="3.0" opacity="0.78" filter="url(#${p}soft)">
          <animate attributeName="opacity" values="0.78;0.36;0.78" dur="3.0s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${h2}"
          stroke-width="1.2" opacity="0.62">
          <animate attributeName="opacity" values="0.62;1.0;0.62" dur="3.0s" repeatCount="indefinite"/>
        </ellipse>
        ${accessoryLayer('orbit-motes', p, palette, rnd)}`
    }

    case 'crown-shards': {
      // 7 shards with alternating heights forming a proper crown silhouette
      const heights = [15, 20, 24, 28, 24, 20, 15]
      const angles  = [-52, -36, -20, 0, 20, 36, 52]
      const shards = heights.map((h, i) => {
        const a = angles[i]
        const w = (3.2 + h * 0.13).toFixed(1)
        return `<g transform="translate(100 106) rotate(${a}) translate(0 -64)">
          <polygon points="0,${-h} ${w},0 0,${(h * 0.34).toFixed(1)} -${w},0"
            fill="${gold}" opacity="0.90" filter="url(#${p}soft)"/>
          <polygon points="0,${(-h * 0.70).toFixed(1)} 1.6,0 0,${(h * 0.17).toFixed(1)} -1.6,0"
            fill="${goldBright}" opacity="0.68"/>
        </g>`
      }).join('')
      return shards + accessoryLayer('orbit-motes', p, palette, rnd)
    }

    case 'prismatic': {
      // Mythic tier: full prismatic corona — rainbow rings + constellation + elaborate crown
      // Steps 60° from the creature's own accent hue so the rainbow feels personal, not generic
      const rainbowCols = [0, 48, 96, 160, 220, 270].map(off =>
        hslToHex({ h: (palette.accentHue + off) % 360, s: 88, l: 66 }),
      )

      // 6 counter-rotating rainbow ellipses at slightly different radii/rotations
      const rings = rainbowCols.map((col, i) => {
        const rot = i * 7, rx = 70 + i, ry = 63 + i
        const dur = (17 + i * 1.8).toFixed(1)
        return `<ellipse cx="100" cy="100" rx="${rx}" ry="${ry}" fill="none"
          stroke="${col}" stroke-width="2.0" opacity="0.40"
          transform="rotate(${rot} 100 100)" filter="url(#${p}soft)">
          <animateTransform attributeName="transform" type="rotate"
            from="${rot} 100 100" to="${rot + 360} 100 100" dur="${dur}s" repeatCount="indefinite"/>
        </ellipse>`
      }).join('')

      // 12 motes: 6 inner CW + 6 outer CCW, each a distinct rainbow hue
      const motes = rainbowCols.flatMap((col, i) => {
        const a = (i / 6) * 360, a2 = a + 30
        const dur1 = (14 + i * 0.7).toFixed(1), dur2 = (19 + i * 0.6).toFixed(1)
        return [
          `<g transform="translate(100 106)"><g transform="rotate(${a})">
            <circle cx="0" cy="-62" r="2.8" fill="${col}" opacity="0.92" filter="url(#${p}soft)"/>
          </g><animateTransform attributeName="transform" type="rotate"
            from="0 0 0" to="360 0 0" dur="${dur1}s" repeatCount="indefinite" additive="sum"/></g>`,
          `<g transform="translate(100 106)"><g transform="rotate(${a2})">
            <circle cx="0" cy="-75" r="1.8" fill="${col}" opacity="0.70" filter="url(#${p}soft)"/>
          </g><animateTransform attributeName="transform" type="rotate"
            from="360 0 0" to="0 0 0" dur="${dur2}s" repeatCount="indefinite" additive="sum"/></g>`,
        ]
      }).join('')

      // 9-shard crown, each tipped with a rainbow gem dot
      const crownH = [14, 19, 23, 28, 31, 28, 23, 19, 14]
      const crownA = [-60, -44, -28, -14, 0, 14, 28, 44, 60]
      const crownShards = crownH.map((h, i) => {
        const a = crownA[i]
        const col = rainbowCols[i % 6]
        const w = (3.4 + h * 0.12).toFixed(1)
        return `<g transform="translate(100 106) rotate(${a}) translate(0 -66)">
          <polygon points="0,${-h} ${w},0 0,${(h * 0.30).toFixed(1)} -${w},0"
            fill="${gold}" opacity="0.94" filter="url(#${p}soft)"/>
          <polygon points="0,${(-h * 0.65).toFixed(1)} 1.7,0 0,${(h * 0.15).toFixed(1)} -1.7,0"
            fill="${col}" opacity="0.86"/>
          <circle cx="0" cy="${-h}" r="1.5" fill="${col}" opacity="0.98" filter="url(#${p}soft)"/>
        </g>`
      }).join('')

      return rings + motes + crownShards
    }

    default:
      return ''
  }
}

/**
 * Render one creature. Pure string→string; safe to memoize on (assetId, genetics).
 */
export function renderCreatureSvg(svgText: string, opts: RenderOptions): string {
  const r = decodeGeneRender(opts.genetics)
  const rarity = opts.rarity ?? r.rarity
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('malformed species SVG')
  const root = doc.documentElement as unknown as SVGElement

  // ── trait / mutation / rarity layers (must run before ids are namespaced) ──
  for (const [id, show] of Object.entries(r.visibility)) {
    const el = doc.getElementById(id)
    if (el) (el as HTMLElement).style.display = show ? '' : 'none'
  }

  const seed = hash32(opts.assetId + '|' + opts.genetics)
  const rnd = mulberry32(seed)
  const p = `c${seed.toString(36)}-`

  const ctx: VariationContext = { species: r.speciesId, gene: r.gene, rarity, assetId: opts.assetId }
  const spec = getVariationSpec()
  const palette = spec.paletteFor?.(ctx) ?? defaultPalette(r.gene)
  const marking = spec.markingFor?.(ctx) ?? defaultMarking(r.gene)
  const accessory = spec.accessoryFor?.(ctx) ?? defaultAccessory(rarity)

  // Re-colour BEFORE namespacing: roleOf() classifies on the artist's own id
  // (`slot-ears-1`, `foxIrisL`), and a `c<seed36>-` prefix in front of it would
  // be matched by the unanchored regexes — a seed containing "ear" or "core"
  // would silently misclassify that one creature, forever.
  remapGradients(root, palette)
  remapFlatFills(root, palette)

  namespaceIds(root, doc, p)

  // Hue now lives in the gradients, so the legacy whole-sprite hue-rotate must
  // stand down — otherwise the palette gets shifted twice. Sat/light still apply.
  root.style.setProperty('--gene-hue-shift', '0deg')
  for (const [k, v] of Object.entries(r.cssVars)) {
    if (k !== '--gene-hue-shift') root.style.setProperty(k, v)
  }

  // ── lift the artwork into an addressable group ──
  const artId = p + 'art'
  const art = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  art.setAttribute('id', artId)
  const kids = Array.from(root.childNodes).filter(n => (n as Element).tagName !== 'defs')
  kids.forEach(n => art.appendChild(n))
  root.appendChild(art)

  const defs = root.querySelector('defs') ?? root.insertBefore(
    doc.createElementNS('http://www.w3.org/2000/svg', 'defs'), root.firstChild,
  )

  // ── deterministic pose: no two creatures sit identically ──
  const tilt = (rnd() - 0.5) * 5.2
  const scale = 0.975 + rnd() * 0.05
  const nudge = (rnd() - 0.5) * 3
  const giant = r.giant ? 1.3 : 1
  const pose = `translate(${(100 + nudge).toFixed(2)} 108) rotate(${tilt.toFixed(2)}) scale(${(scale * giant).toFixed(3)}) translate(${(-100 - nudge).toFixed(2)} -108)`

  const mk = markingFill(marking, p, palette.patternHue, rnd)
  const patOpacity = 0.12 + (r.gene.patOpacity / 15) * 0.4
  const rimStrength = 0.4 + rnd() * 0.16

  const extraDefs = `
    <filter id="${p}soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.6"/>
    </filter>
    <!-- Silhouette mask: flood the art's own alpha to white. Works for any
         species geometry — no per-species shape list to keep in sync. -->
    <filter id="${p}white" x="-10%" y="-10%" width="120%" height="120%">
      <feFlood flood-color="#ffffff" result="f"/>
      <feComposite in="f" in2="SourceAlpha" operator="in"/>
    </filter>
    <mask id="${p}sil">
      <g filter="url(#${p}white)"><use href="#${artId}"/></g>
    </mask>
    <!-- Rim light: erode the alpha, push the core away from the key light, and
         keep what's left — an even band hugging the upper-left edge. -->
    <filter id="${p}rim" x="-25%" y="-25%" width="150%" height="150%">
      <feMorphology in="SourceAlpha" operator="erode" radius="1.6" result="core"/>
      <feOffset in="core" dx="${LIGHT_DX}" dy="${LIGHT_DY}" result="coreOff"/>
      <feComposite in="SourceAlpha" in2="coreOff" operator="out" result="band"/>
      <feGaussianBlur in="band" stdDeviation="0.85" result="bandSoft"/>
      <feFlood flood-color="${palette.rim}" flood-opacity="${rimStrength.toFixed(2)}" result="rc"/>
      <feComposite in="rc" in2="bandSoft" operator="in"/>
    </filter>
    <radialGradient id="${p}shadow" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}ao" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0B1020" stop-opacity="0"/>
      <stop offset="58%" stop-color="#0B1020" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0B1020" stop-opacity="0.42"/>
    </linearGradient>
    <radialGradient id="${p}spec" cx="34%" cy="22%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.26"/>
      <stop offset="42%" stop-color="#FFFFFF" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    ${mk.defs}
  `
  defs.insertAdjacentHTML('beforeend', extraDefs)

  // ── composite, bottom → top ──
  art.setAttribute('transform', pose)

  const shadow = `<ellipse cx="100" cy="168" rx="${(34 * scale * giant).toFixed(1)}" ry="${(7.5 * scale).toFixed(1)}" fill="url(#${p}shadow)"/>`
  root.insertBefore(
    new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${shadow}</svg>`, 'image/svg+xml').documentElement.firstChild!,
    art,
  )

  const over = `
    ${mk.body ? `<g mask="url(#${p}sil)" opacity="${patOpacity.toFixed(2)}" style="mix-blend-mode:multiply" transform="${pose}">${mk.body}</g>` : ''}
    <g mask="url(#${p}sil)" style="mix-blend-mode:multiply"><rect width="200" height="200" fill="url(#${p}ao)"/></g>
    <g mask="url(#${p}sil)" style="mix-blend-mode:screen"><rect width="200" height="200" fill="url(#${p}spec)"/></g>
    <g filter="url(#${p}rim)"><use href="#${artId}"/></g>
    ${accessoryLayer(accessory, p, palette, rnd)}
  `
  root.insertAdjacentHTML('beforeend', over)

  return new XMLSerializer().serializeToString(root)
}

// ── Species SVG cache ──────────────────────────────────────────────────
// The old CreatureSprite re-fetched the species file for every card — a 20-card
// grid was 20 requests for 12 files. One in-flight promise per species now.

const svgCache = new Map<string, Promise<string>>()

export function fetchSpeciesSvg(base: string, speciesId: string): Promise<string> {
  const key = base + speciesId
  let hit = svgCache.get(key)
  if (!hit) {
    hit = fetch(base + 'assets/creatures/' + speciesId + '.svg').then(res => {
      if (!res.ok) throw new Error(`SVG not found: ${speciesId}`)
      return res.text()
    })
    hit.catch(() => svgCache.delete(key)) // don't cache a failure forever
    svgCache.set(key, hit)
  }
  return hit
}

// Rendered output cache — a re-render of an unchanged creature is a map lookup.
const renderCache = new Map<string, string>()

export function renderCreatureCached(svgText: string, opts: RenderOptions): string {
  const key = `${opts.assetId}|${opts.genetics}|${opts.rarity ?? ''}`
  let hit = renderCache.get(key)
  if (hit === undefined) {
    hit = renderCreatureSvg(svgText, opts)
    if (renderCache.size > 256) renderCache.clear()
    renderCache.set(key, hit)
  }
  return hit
}

// ── Sprite bitmap cache (the FARM's performance seam) ──────────────────────
//
// A creature sprite is a filter-heavy SVG — 5 feGaussianBlur glows, feMerge
// rim/AO/spec stacks, AND (uncommon+) SMIL sparkles/halo/orbit motes running
// `repeatCount="indefinite"`. In a detail view (one card, held still) that is
// fine. In the FARM it is fatal: 21 of these, each walking every frame, means
// Chrome re-rasterises 21 live filtered+animated SVGs continuously — the raster
// worker pins at ~99% and the scene runs ~10fps on a real GPU.
//
// The farm doesn't need a *live* SVG per creature: nothing inside a walking
// sprite needs to change. So bake each rendered sprite to a PNG once. A static
// bitmap on a composited layer is a cached GPU texture — a walk is then a pure
// transform with ZERO raster. Measured on an NVIDIA GTX 1060 with 21 creatures:
// 95ms → 24ms per frame, long-frames (>50ms) 25 → 1. The trade is the in-sprite
// sparkle/halo SMIL freezes to a single frame in the farm — invisible at farm
// scale, and the CreatureCard keeps the fully-animated SVG untouched.

const bitmapCache = new Map<string, Promise<string>>()

/**
 * Rasterise a rendered creature SVG to a PNG data URL at `px`×`px`. Cached by the
 * same (assetId|genetics|rarity) key as the SVG render, so a creature bakes once.
 * Rejects fall back to the live SVG at the call site — a bake failure must never
 * blank a creature.
 */
export function rasterizeCreatureBitmap(svgText: string, opts: RenderOptions, px = 384): Promise<string> {
  const key = `${opts.assetId}|${opts.genetics}|${opts.rarity ?? ''}|${px}`
  let hit = bitmapCache.get(key)
  if (!hit) {
    hit = rasterizeSvg(svgText, px)
    hit.catch(() => bitmapCache.delete(key)) // a failed bake must be retryable
    if (bitmapCache.size > 256) bitmapCache.clear()
    bitmapCache.set(key, hit)
  }
  return hit
}

/** Draw an SVG string onto a square canvas and return a PNG data URL. */
function rasterizeSvg(svgText: string, px: number): Promise<string> {
  // The species files carry a viewBox but no width/height; an <img> needs an
  // intrinsic size to rasterise, so pin it to the target box before loading.
  const sized = svgText.replace(/<svg\b/, `<svg width="${px}" height="${px}"`)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized)
  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = px
        canvas.height = px
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no 2d context'))
        ctx.drawImage(img, 0, 0, px, px)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e as Error)
      }
    }
    img.onerror = () => reject(new Error('sprite image failed to load'))
    img.src = url
  })
}
