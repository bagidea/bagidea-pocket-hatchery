/**
 * variationSpec.ts — the injection point for Monanisa's palette/marking/rarity spec.
 *
 * creatureRender.ts NEVER hardcodes a species colour. It asks this module for the
 * palette/marking/accessory of a given (species, gene, rarity) and falls back to a
 * gene-derived default only when the spec returns null. Monanisa can drop her real
 * spec in by calling `setVariationSpec({...})` once at app start — no renderer edit.
 */

import type { GeneData } from './geneDecoder'

/** Everything the spec is allowed to know about the creature it is colouring. */
export interface VariationContext {
  /** species slug, e.g. 'foxling' */
  species: string
  /** decoded gene bits */
  gene: GeneData
  /** 0=common … 5=mythic */
  rarity: number
  /** on-chain asset id (stable per creature) */
  assetId: string
}

/**
 * A palette is expressed as HUE + SATURATION TARGETS, not literal fills. The
 * renderer re-maps hue/saturation while preserving the artist's original
 * lightness and alpha — so shading, highlights and AO that Monanisa painted
 * survive intact and only the colour identity changes.
 *
 * WHAT A PALETTE CAN AND CANNOT REACH
 * Both gradient stops and flat `fill=`/`stroke=` paint are re-mapped, so a
 * palette drives essentially the whole creature. Two deliberate exclusions:
 *
 *   · Near-white (L ≥ 90), near-black (L ≤ 9) and neutral (S ≤ 8) paint is
 *     preserved — that is the shading structure, not the colour identity.
 *     (A part painted *entirely* in that range, like fluffle's white cloud,
 *     falls back to a relaxed pass so it isn't left colourless.)
 *   · Parts whose group id matches the SKIP list in creatureRender.ts —
 *     `aura`, `glow`, `rim`, `spec`, mutation FX. Those are tier-driven.
 *
 * A part is assigned bodyHue / accentHue / eyeHue by the nearest ancestor id
 * that names it (`<g id="slot-ears-1">` → accent). Paint under no named group
 * is left as the artist painted it.
 */
export interface CreaturePalette {
  /** 0–360 — main body / fur / shell */
  bodyHue: number
  /** 0–360 — ears, wings, fins, tail, horns, flame */
  accentHue: number
  /** 0–360 — iris */
  eyeHue: number
  /** 0–360 — markings drawn by the renderer */
  patternHue: number
  /** 0–1 multiplier applied on top of each stop's own saturation */
  saturation: number
  /** rim-light colour (hex) — the light wrapping the silhouette */
  rim: string
}

export type MarkingKind =
  | 'none'
  | 'stripes'
  | 'spots'
  | 'belly-patch'
  | 'dapple'
  | 'gradient-fade'
  | 'freckles'

export interface VariationSpec {
  /** Return null to let the renderer derive the palette from the gene. */
  paletteFor?(ctx: VariationContext): CreaturePalette | null
  /** Return null to let the renderer pick from gene.patternType. */
  markingFor?(ctx: VariationContext): MarkingKind | null
  /** Return null for the renderer's default tier accessory. */
  accessoryFor?(ctx: VariationContext): AccessoryKind | null
}

export type AccessoryKind = 'none' | 'sparkles' | 'orbit-motes' | 'halo' | 'crown-shards' | 'prismatic'

let active: VariationSpec = {}

/** Install a spec (Monanisa's). Later calls replace the previous one. */
export function setVariationSpec(spec: VariationSpec): void {
  active = spec ?? {}
}

export function getVariationSpec(): VariationSpec {
  return active
}
