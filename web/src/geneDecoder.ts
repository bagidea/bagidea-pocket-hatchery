/**
 * geneDecoder.ts — client-side 64-bit gene decoder for Pocket Hatchery.
 *
 * Takes a 64-char hex genetics string (checksum256 from chain) and
 * decodes the lower 64 bits into CSS filter variables that drive
 * Monanisa's canonical creature SVGs.
 *
 * ZERO dependencies — pure TypeScript, runs in the browser, no puppeteer.
 * Matches GENE-SPEC.md §2 and render/engine.js decodeBits() exactly.
 */

// Canonical species index → id (matches GENE-SPEC.md §3.1 + gene-map.json)
const SPECIES_BY_INDEX: Record<number, string> = {
  0: 'foxling',
  1: 'owlet',
  2: 'droplet',
  3: 'pebblit',
  4: 'sproutling',
  5: 'flicker',
  6: 'glimmer',
  7: 'wisp',
  8: 'fluffle',
  9: 'shellby',
  10: 'dracling',
  11: 'buzzle',
}

const SPECIES_NAMES: Record<number, string> = {
  0: 'Foxling',
  1: 'Owlet',
  2: 'Droplet',
  3: 'Pebblit',
  4: 'Sproutling',
  5: 'Flicker',
  6: 'Glimmer',
  7: 'Wisp',
  8: 'Fluffle',
  9: 'Shellby',
  10: 'Dracling',
  11: 'Buzzle',
}

// Per-species trait slot ids — the three 4-bit trait fields (traitA/B/C, bits
// 48–59) each drive one slot. Matches gene-map.json / species-registry.js and
// the `id="slot-{slotId}-{0..3}"` groups baked into every species SVG.
const SPECIES_SLOTS: Record<string, readonly [string, string, string]> = {
  foxling: ['ears', 'tail', 'forehead'],
  owlet: ['eyerings', 'wings', 'crown'],
  droplet: ['core', 'fins', 'clarity'],
  pebblit: ['stone', 'moss', 'crystals'],
  sproutling: ['headplant', 'roots', 'season'],
  flicker: ['flamecolor', 'flameshape', 'sparks'],
  glimmer: ['shape', 'innercore', 'refraction'],
  wisp: ['tailstyle', 'glow', 'opacity'],
  fluffle: ['fluff', 'earlen', 'earstyle'],
  shellby: ['shelltype', 'shellcolor', 'antennae'],
  dracling: ['horns', 'wingsize', 'breath'],
  buzzle: ['stripes', 'wingstyle', 'collar'],
}

export interface GeneData {
  speciesId: number
  bodyHue: number
  accentHue: number
  patternType: number
  patternHue: number
  saturation: number
  brightness: number
  eyeColor: number
  patOpacity: number
  traitA: number
  traitB: number
  traitC: number
  mutations: number
}

export interface GeneCSS {
  /** species key (e.g. 'foxling') — used to load the SVG file */
  speciesId: string
  /** human-readable species name */
  speciesName: string
  /** CSS :root block to inject into SVG */
  css: string
  /** raw decoded gene bits */
  gene: GeneData
}

/**
 * Decode a 64-char hex genetics string (checksum256) into GeneData.
 * Per GENE-SPEC.md §7.1, the lower 64 bits (last 16 hex chars) carry
 * the rendering gene.
 */
function decodeBits(geneticsHex: string): GeneData {
  // Remove 0x prefix if present
  const clean = geneticsHex.replace('0x', '')
  if (clean.length < 16) {
    throw new Error(`genetics must be at least 16 hex chars (got ${clean.length})`)
  }
  // Rendering gene = bytes 0–7 = first 16 hex chars (GENE-SPEC.md §7.1)
  const renderingGene = clean.slice(0, 16)
  const gene = BigInt('0x' + renderingGene)

  return {
    speciesId: Number(gene & 0xFn),
    bodyHue: Number((gene >> 4n) & 0xFFn),
    accentHue: Number((gene >> 12n) & 0xFFn),
    patternType: Number((gene >> 20n) & 0xFn),
    patternHue: Number((gene >> 24n) & 0xFFn),
    saturation: Number((gene >> 32n) & 0xFn),
    brightness: Number((gene >> 36n) & 0xFn),
    eyeColor: Number((gene >> 40n) & 0xFn),
    patOpacity: Number((gene >> 44n) & 0xFn),
    traitA: Number((gene >> 48n) & 0xFn),
    traitB: Number((gene >> 52n) & 0xFn),
    traitC: Number((gene >> 56n) & 0xFn),
    mutations: Number((gene >> 60n) & 0xFn),
  }
}

/**
 * Decode a 64-char hex genetics string and return the full GeneCSS payload
 * ready to inject into a species SVG.
 */
export function decodeGeneCSS(geneticsHex: string): GeneCSS {
  const g = decodeBits(geneticsHex)
  const speciesId = SPECIES_BY_INDEX[g.speciesId] ?? 'foxling'
  const speciesName = SPECIES_NAMES[g.speciesId] ?? 'Foxling'

  // bodyHue 0–255 → hue-rotate 0°–360°
  const hueDeg = Math.round((g.bodyHue / 255) * 360)
  // saturation 0–15 → 0.85–1.20 (filter saturate) — baseline near 1.0 so an
  // average gene stays close to the original SVG color; only the extremes diverge.
  const sat = (85 + (g.saturation / 15) * 35) / 100
  // brightness 0–15 → ~0.80–1.10 around 95% center
  const brit = (95 + ((g.brightness - 7) / 15) * 30) / 100

  const css = [
    `--gene-hue-shift: ${hueDeg}deg;`,
    `--gene-sat-mult: ${sat.toFixed(2)};`,
    `--gene-light-mult: ${brit.toFixed(2)};`,
  ].join(' ')

  return { speciesId, speciesName, css, gene: g }
}

// ── Full render payload (mirrors render/engine.js decodeFull) ───────────────
// CSS vars tint the body via the SVG's `.gene-tint` filter; `visibility` toggles
// the `id="slot-{slotId}-{0..3}"` trait groups, `mut-*` mutation layers, and
// `rare-iridescent` / `legendary-aura` rarity overlays baked into each SVG.

export interface GeneRender {
  /** species slug (e.g. 'foxling') — selects the SVG file */
  speciesId: string
  /** human-readable species name */
  speciesName: string
  /** CSS custom properties to set on the SVG root */
  cssVars: Record<string, string>
  /** raw decoded gene bits */
  gene: GeneData
  /** element-id → shown? map (slot/mutation/rarity layer visibility) */
  visibility: Record<string, boolean>
  /** 0=Common … 5=Mythic (heuristic from gene bits) */
  rarity: number
  /** Giant mutation (bit 61) — caller scales the sprite */
  giant: boolean
}

/**
 * Heuristic rarity tier from gene bits. Proxy only — the on-chain rarity is
 * assigned at mint. Matches render/engine.js rarityFromBits().
 */
export function rarityFromGene(g: GeneData): number {
  if (g.mutations & 0x8) return 5 // ethereal → mythic
  if (g.mutations & 0x4) return 4 // prismatic → legendary
  if (g.saturation >= 12) return 3 // epic
  if (g.saturation >= 8) return 2 // rare
  if (g.brightness >= 8) return 1 // uncommon
  return 0 // common
}

/**
 * Decode a 64-char hex genetics string into the FULL render payload: gene-tint
 * CSS vars + a visibility map that toggles every trait/mutation/rarity layer the
 * species SVG defines. This is what makes two creatures of the same species look
 * different — trait variants (ears/tail/…), mutations, and rarity auras all come
 * from the gene, not from the SVG's shipped defaults.
 */
export function decodeGeneRender(geneticsHex: string): GeneRender {
  const g = decodeBits(geneticsHex)
  const speciesId = SPECIES_BY_INDEX[g.speciesId] ?? 'foxling'
  const speciesName = SPECIES_NAMES[g.speciesId] ?? 'Foxling'

  // bodyHue 0–255 → hue-rotate 0°–360°
  const hueDeg = Math.round((g.bodyHue / 255) * 360)
  // saturation 0–15 → 0.85–1.20 (filter saturate) — baseline near 1.0 so an
  // average gene stays close to the original SVG color; only the extremes diverge.
  const sat = (85 + (g.saturation / 15) * 35) / 100
  // brightness 0–15 → ~0.80–1.10 around 95% center
  const brit = (95 + ((g.brightness - 7) / 15) * 30) / 100
  const cssVars: Record<string, string> = {
    '--gene-hue-shift': `${hueDeg}deg`,
    '--gene-sat-mult': sat.toFixed(2),
    '--gene-light-mult': brit.toFixed(2),
  }

  // Slot visibility: traitA/B/C each pick one of 4 variants per slot.
  const slots = SPECIES_SLOTS[speciesId] ?? []
  const traitVals = [g.traitA, g.traitB, g.traitC]
  const visibility: Record<string, boolean> = { body: true }
  slots.forEach((slotId, i) => {
    const activeVariant = (traitVals[i] ?? 0) % 4
    for (let v = 0; v < 4; v++) visibility[`slot-${slotId}-${v}`] = v === activeVariant
  })

  // Mutation layer visibility (giant is handled by the caller as a scale).
  visibility['mut-shiny'] = !!(g.mutations & 0x1)
  visibility['mut-prismatic'] = !!(g.mutations & 0x4)
  visibility['mut-ethereal'] = !!(g.mutations & 0x8)

  // Rarity overlays.
  const rarity = rarityFromGene(g)
  visibility['rare-iridescent'] = rarity >= 3
  visibility['legendary-aura'] = rarity >= 4

  return { speciesId, speciesName, cssVars, gene: g, visibility, rarity, giant: !!(g.mutations & 0x2) }
}

/**
 * Get the species display name from a gene's species_id (bits 0–3).
 */
export function speciesNameFromGene(geneticsHex: string): string {
  const g = decodeBits(geneticsHex)
  return SPECIES_NAMES[g.speciesId] ?? 'Foxling'
}

/**
 * Get the species ID slug (e.g. 'foxling') from a gene's species_id.
 */
export function speciesIdFromGene(geneticsHex: string): string {
  const g = decodeBits(geneticsHex)
  return SPECIES_BY_INDEX[g.speciesId] ?? 'foxling'
}

export { SPECIES_BY_INDEX, SPECIES_NAMES }
