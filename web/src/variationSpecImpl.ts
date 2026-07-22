/**
 * variationSpecImpl.ts — Monanisa's curated variation spec for Pocket Hatchery.
 *
 * Call initVariationSpec() once at app start (before any CreatureCard renders).
 * That's all — no SVG edits, no geneDecoder.ts changes.
 *
 * Wires into creatureRender.ts via the setVariationSpec() injection point in
 * variationSpec.ts. See docs/creature-variation-spec.md for the full design rationale.
 */

import { setVariationSpec } from './variationSpec'
import type { AccessoryKind, CreaturePalette, MarkingKind, VariationContext } from './variationSpec'

// gene.patternType (0–15) → MarkingKind
// Renderer draws markings programmatically via markingFill() — no SVG groups needed.
const MARKING_MAP: MarkingKind[] = [
  'none',           // 0  — clean silhouette
  'stripes',        // 1
  'spots',          // 2
  'spots',          // 3  — denser spot seed (same kind, different rnd output)
  'belly-patch',    // 4
  'dapple',         // 5
  'freckles',       // 6
  'gradient-fade',  // 7
  'stripes',        // 8  — different stripe angle from rnd seed
  'spots',          // 9
  'dapple',         // 10
  'freckles',       // 11
  'belly-patch',    // 12
  'gradient-fade',  // 13
  'stripes',        // 14
  'none',           // 15 — Mythic slot; crown-shards accessory is the statement
]

// on-chain rarity 0–5 → AccessoryKind
// 6 tiers: Common · Uncommon · Rare · Epic · Legendary · Mythic
// Accessory colour is derived from palette.accentHue by the renderer.
const ACCESSORY_MAP: AccessoryKind[] = [
  'none',          // 0 — Common
  'sparkles',      // 1 — Uncommon
  'orbit-motes',   // 2 — Rare
  'halo',          // 3 — Epic
  'crown-shards',  // 4 — Legendary
  'crown-shards',  // 5 — Mythic  (palette + rim distinguish it from Legendary)
]

// Additive saturation bonus per tier — rarer creatures show richer, more intense colour.
// Stacks on top of the gene.saturation base range (0.80–1.25).
const TIER_SAT_BONUS = [0, 0.05, 0.10, 0.18, 0.28, 0.42]
//                      Com  Unc   Rar   Epic  Leg   Myth

// gene.eyeColor (0–15 index) → HSL hue 0–360 for CreaturePalette.eyeHue.
// This is a curated hue table, not a raw linear mapping — colours read as
// distinct named eye tones rather than arbitrary hue-rotate steps.
const EYE_HUES = [270, 240, 200, 160, 120, 80, 50, 30, 10, 345, 320, 295, 230, 180, 140, 0]
//               Viol Blue  Sky  Teal Grn  Olv  Amb Gold Cop  Rose Pink Purp Ind  Cya  Mint Ruby

// Matches the hslToHex() implementation in creatureRender.ts (not exported there).
function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const ss = Math.min(100, Math.max(0, s)) / 100
  const ll = Math.min(100, Math.max(0, l)) / 100
  const k = (n: number) => (n + hh / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + to(f(0)) + to(f(8)) + to(f(4))
}

export function initVariationSpec(): void {
  setVariationSpec({
    paletteFor(ctx: VariationContext): CreaturePalette {
      const { gene, rarity } = ctx
      const bodyHue    = Math.round((gene.bodyHue    / 255) * 360)
      const accentHue  = Math.round((gene.accentHue  / 255) * 360)
      const patternHue = Math.round((gene.patternHue / 255) * 360)
      // eyeColor is a 0–15 index into a curated hue table — not a linear 0→360 sweep.
      const eyeHue     = EYE_HUES[gene.eyeColor] ?? Math.round((gene.eyeColor / 15) * 360)
      // Gene saturation sets the base range 0.80–1.25; tier adds richness on top.
      const tier = Math.min(rarity, 5)
      const saturation = 0.8 + (gene.saturation / 15) * 0.45 + (TIER_SAT_BONUS[tier] ?? 0)
      // Rim light: Common–Rare echo the creature's own accent hue (brightening with tier).
      // Epic → cool lavender shimmer; Legendary → warm gold; Mythic → cosmic ice-blue.
      let rim: string
      if (tier <= 2) {
        rim = hslToHex(accentHue, 60 + tier * 6, 87 + tier * 2)
      } else if (tier === 3) {
        rim = hslToHex(240, 65, 93)   // Epic
      } else if (tier === 4) {
        rim = hslToHex(45, 86, 82)    // Legendary
      } else {
        rim = hslToHex(195, 80, 96)   // Mythic
      }
      return { bodyHue, accentHue, eyeHue, patternHue, saturation, rim }
    },

    markingFor(ctx: VariationContext): MarkingKind {
      return MARKING_MAP[ctx.gene.patternType] ?? 'none'
    },

    accessoryFor(ctx: VariationContext): AccessoryKind {
      return ACCESSORY_MAP[Math.min(ctx.rarity, 5)] ?? 'none'
    },
  })
}
