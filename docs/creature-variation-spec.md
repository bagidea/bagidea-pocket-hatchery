# Pocket Hatchery — Creature Variation System Spec v2
**By:** Monanisa (Designer) · **Revised:** 2026-07-17 · **Target:** Flamingo (Dev plug-in)
**Data companion:** `docs/creature-variation-data.json`
**Supersedes:** v1 spec (targeted wrong API — SVG mark-N groups + cssVars injection)

---

## 0. Purpose in one sentence

Provide a complete `setVariationSpec()` implementation that drives the renderer's curated per-species palettes, a 16→7 marking mapping, and a tier-matched accessory ladder — all wired through the existing `variationSpec.ts` injection point. Flamingo creates one file and calls one function.

---

## 1. Architecture — how the renderer actually works

`creatureRender.ts` is a full compositor. It **never reads `mark-N` SVG groups or gene CSS vars for palette**. It calls `variationSpec.ts` hooks once per render:

```
renderCreatureSvg(svgText, { assetId, genetics, rarity })
  ├─ decodeGeneRender(genetics)          → GeneData + cssVars (hue/sat/light only)
  ├─ getVariationSpec()                  → the installed spec hooks
  │   ├─ .paletteFor(ctx)  → CreaturePalette  → remapGradients() re-hues every gradient stop
  │   ├─ .markingFor(ctx)  → MarkingKind      → markingFill() draws the pattern programmatically
  │   └─ .accessoryFor(ctx) → AccessoryKind   → accessoryLayer() composites motes/halo/crown
  └─ SVG output written to DOM
```

**Flamingo's only job:** call `setVariationSpec(...)` once at app start.
No SVG edits needed. No changes to `geneDecoder.ts`.

---

## 2. Integration point — `variationSpec.ts` interfaces (read-only)

```ts
// variationSpec.ts — Flamingo does NOT edit this file
export function setVariationSpec(spec: VariationSpec): void

export interface VariationContext {
  species: string    // e.g. 'foxling'
  gene: GeneData     // decoded gene bits
  rarity: number     // on-chain rarity 0–3 (Common/Uncommon/Rare/Legendary)
  assetId: string    // stable per-creature
}

export interface CreaturePalette {
  bodyHue:    number   // 0–360 — re-hues body/fur/shell/granite gradients
  accentHue:  number   // 0–360 — re-hues ears/wings/fins/tail/horn/flame gradients
  eyeHue:     number   // 0–360 — re-hues iris/eyeglow/eyeshine gradients
  patternHue: number   // 0–360 — marking fill color
  saturation: number   // 0.8–1.25 — multiplied onto each gradient stop's own saturation
  rim:        string   // hex — rim-light color hugging the silhouette edge
}

export type MarkingKind =
  | 'none' | 'stripes' | 'spots' | 'belly-patch'
  | 'dapple' | 'gradient-fade' | 'freckles'

export type AccessoryKind =
  | 'none' | 'sparkles' | 'orbit-motes' | 'halo' | 'crown-shards'
```

---

## 3. The plug-in implementation (Flamingo creates this file)

**Create `web/src/variationSpecImpl.ts`** and call `initVariationSpec()` once from `main.tsx`:

```ts
// web/src/variationSpecImpl.ts
import { setVariationSpec } from './variationSpec'
import type { VariationContext, CreaturePalette, MarkingKind, AccessoryKind } from './variationSpec'

// gene.patternType (0–15) → MarkingKind
// Renderer draws markings programmatically — no SVG groups required.
const MARKING_MAP: MarkingKind[] = [
  'none',           // 0  — clean silhouette
  'stripes',        // 1
  'spots',          // 2
  'spots',          // 3  — denser spot seed
  'belly-patch',    // 4
  'dapple',         // 5
  'freckles',       // 6
  'gradient-fade',  // 7
  'stripes',        // 8  — different angle from rnd seed
  'spots',          // 9
  'dapple',         // 10
  'freckles',       // 11
  'belly-patch',    // 12
  'gradient-fade',  // 13
  'stripes',        // 14
  'none',           // 15 — Legendary slot; accessory (crown-shards) is the visual statement
]

// on-chain rarity 0–3 → AccessoryKind
// Color is derived from palette.accentHue by the renderer — not set here.
const ACCESSORY_MAP: AccessoryKind[] = [
  'none',          // 0 — Common
  'sparkles',      // 1 — Uncommon
  'orbit-motes',   // 2 — Rare
  'crown-shards',  // 3 — Legendary
]

// gene.eyeColor (0–15 index) → HSL hue 0–360
const EYE_HUES = [270, 240, 200, 160, 120, 80, 50, 30, 10, 345, 320, 295, 230, 180, 140, 0]

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
      const { gene } = ctx
      const bodyHue    = Math.round((gene.bodyHue    / 255) * 360)
      const accentHue  = Math.round((gene.accentHue  / 255) * 360)
      const patternHue = Math.round((gene.patternHue / 255) * 360)
      const eyeHue     = EYE_HUES[gene.eyeColor] ?? Math.round((gene.eyeColor / 15) * 360)
      const saturation = 0.8 + (gene.saturation / 15) * 0.45
      const rim        = hslToHex(accentHue, 62, 88)
      return { bodyHue, accentHue, eyeHue, patternHue, saturation, rim }
    },

    markingFor(ctx: VariationContext): MarkingKind {
      return MARKING_MAP[ctx.gene.patternType] ?? 'none'
    },

    accessoryFor(ctx: VariationContext): AccessoryKind {
      const tier = Math.min(ctx.rarity, 3) // clamp to 4 on-chain tiers
      return ACCESSORY_MAP[tier] ?? 'none'
    },
  })
}
```

Call site (add two lines to `main.tsx` before any render):
```ts
import { initVariationSpec } from './variationSpecImpl'
initVariationSpec()
```

That is the complete implementation. No other files need to change.

---

## 4. `CreaturePalette` field guide

| Field | Range | How the renderer uses it | Gene source |
|---|---|---|---|
| `bodyHue` | 0–360° | Re-hues gradients matching `/body\|fluff\|shell\|granite\|hex\|head\|belly/` | `gene.bodyHue` 0–255 → ×360/255 |
| `accentHue` | 0–360° | Re-hues gradients matching `/wing\|ear\|fin\|tail\|horn\|flame\|crown\|core/` | `gene.accentHue` 0–255 → ×360/255 |
| `eyeHue` | 0–360° | Re-hues gradients matching `/iris\|eyeglow\|eyeshine/` | `EYE_HUES[gene.eyeColor]` (curated table) |
| `patternHue` | 0–360° | Marking fill hue passed to `markingFill()` | `gene.patternHue` 0–255 → ×360/255 |
| `saturation` | 0.8–1.25 | Multiplied onto each gradient stop's own saturation | `gene.saturation` 0–15 → 0.8–1.25 |
| `rim` | hex | Rim-light color wrapping the silhouette upper-left | Derived from `accentHue` at s=62 l=88 |

**Gradient role classification is in `creatureRender.ts`** — the renderer assigns body/accent/eye by regex on gradient IDs. Monanisa's SVG naming convention (`bodyGrad`, `foxIrisL`, `fkFlameOrange`, etc.) determines which palette channel each gradient receives. Species SVGs don't need new CSS classes for the variation system.

---

## 5. Marking system — `markingFor()` → `MarkingKind`

The renderer draws all markings **programmatically** in `markingFill()`. There are no SVG `<g id="mark-N">` groups — those never existed in this architecture.

### 5A. What the renderer can paint (7 MarkingKind values)

| `MarkingKind` | Visual | Key renderer behaviour |
|---|---|---|
| `'none'` | Clean — no overlay | Returns empty strings from `markingFill()` |
| `'stripes'` | Diagonal tiled stripe pattern | Angle randomised per creature via `assetId` seed |
| `'spots'` | 9 scattered ellipses | Position + size randomised per creature |
| `'belly-patch'` | Radial gradient ellipse on ventral area | Position jittered by ±3 px from seed |
| `'dapple'` | 6 large blurred blobs | Blurred with feGaussianBlur — appaloosa / cloud effect |
| `'gradient-fade'` | Linear gradient sweep top → bottom | Full-body colour wash |
| `'freckles'` | 22 micro-dots across body | All positions randomised per creature |

Opacity is `0.12 + (gene.patOpacity / 15) × 0.40` — the renderer computes this directly from the gene; `markingFor()` does not set it.

### 5B. `patternType` (0–15) → `MarkingKind` mapping

| patternType | MarkingKind | Notes |
|---|---|---|
| 0 | `none` | Clean — default |
| 1 | `stripes` | |
| 2 | `spots` | |
| 3 | `spots` | Same kind; creature looks different because `rnd` seed is different |
| 4 | `belly-patch` | |
| 5 | `dapple` | |
| 6 | `freckles` | |
| 7 | `gradient-fade` | |
| 8 | `stripes` | Different stripe angle from seed |
| 9 | `spots` | |
| 10 | `dapple` | |
| 11 | `freckles` | |
| 12 | `belly-patch` | |
| 13 | `gradient-fade` | |
| 14 | `stripes` | |
| 15 | `none` | Legendary slot — `crown-shards` accessory is the statement |

---

## 6. Accessory system — `accessoryFor()` → `AccessoryKind`

The renderer composites accessories on top of the sprite via `accessoryLayer()`. Accessory color is always derived from `palette.accentHue` — `accessoryFor()` only names which effect plays.

| `AccessoryKind` | What it renders | Rarity |
|---|---|---|
| `'none'` | Nothing | Common (0) |
| `'sparkles'` | 4 tiny pulsing dots near the sprite | Uncommon (1) |
| `'orbit-motes'` | 6 larger motes slowly rotating around the sprite | Rare (2) |
| `'halo'` | Elliptical halo above head + orbit-motes | (reserved, not assigned by this spec) |
| `'crown-shards'` | 5 crystal shards radiating from crown + orbit-motes | Legendary (3) |

On-chain rarity → AccessoryKind:

| On-chain value | Tier | AccessoryKind |
|---|---|---|
| 0 | Common | `none` |
| 1 | Uncommon | `sparkles` |
| 2 | Rare | `orbit-motes` |
| 3 | Legendary | `crown-shards` |

---

## 7. Eye color — `eyeHue` in `CreaturePalette`

`eyeHue` is a 0–360° hue. It is NOT a CSS custom property — it is a field on the `CreaturePalette` object returned by `paletteFor()`, consumed by `remapGradients()` when it encounters an iris gradient.

Curated eye table (16 entries for `gene.eyeColor` 0–15):

| idx | Name | Hue° | idx | Name | Hue° |
|---|---|---|---|---|---|
| 0 | Violet | 270 | 8 | Copper | 10 |
| 1 | Blue | 240 | 9 | Rose | 345 |
| 2 | Sky | 200 | 10 | Pink | 320 |
| 3 | Teal | 160 | 11 | Purple | 295 |
| 4 | Green | 120 | 12 | Indigo | 230 |
| 5 | Olive | 80 | 13 | Cyan | 180 |
| 6 | Amber | 50 | 14 | Mint | 140 |
| 7 | Gold | 30 | 15 | Ruby | 0 |

---

## 8. Rarity FX ladder

The renderer handles rarity FX natively via `rare-iridescent` / `legendary-aura` visibility keys already in `GeneRender.visibility` (set by `geneDecoder.ts → decodeGeneRender()`). The spec does not touch these.

| Rarity | `rare-iridescent` | `legendary-aura` | Accessory |
|---|---|---|---|
| Common (0) | hidden | hidden | none |
| Uncommon (1) | hidden | hidden | sparkles |
| Rare (2) | visible (gene mut flag) | hidden | orbit-motes |
| Legendary (3) | visible (gene mut flag) | visible (gene mut flag) | crown-shards |

> `rare-iridescent` and `legendary-aura` are driven by `gene.mutations` bits in `geneDecoder.ts`, not by on-chain rarity passed to the renderer. `accessoryFor()` drives the compositor accessory using the on-chain `rarity` from `VariationContext`.

The per-tier `.artAura` CSS overrides in `CreatureCard.module.css` are optional card-level polish (§9).

---

## 9. Optional card CSS polish (`CreatureCard.module.css`)

These CSS additions boost the aura halo intensity per tier — purely cosmetic, independent of the renderer:

```css
.common .artAura {
  background: radial-gradient(circle at 50% 46%,
    rgba(var(--tierRGB), 0.14) 0%, rgba(var(--tierRGB), 0.05) 34%, transparent 55%);
}
.uncommon .artAura {
  background: radial-gradient(circle at 50% 46%,
    rgba(var(--tierRGB), 0.20) 0%, rgba(var(--tierRGB), 0.08) 34%, transparent 58%);
}
.rare .artAura {
  background: radial-gradient(circle at 50% 46%,
    rgba(var(--tierRGB), 0.28) 0%, rgba(var(--tierRGB), 0.10) 34%, transparent 62%);
}
.legendary .artAura {
  background: radial-gradient(circle at 50% 46%,
    rgba(var(--tierRGB), 0.38) 0%, rgba(var(--tierRGB), 0.16) 38%, transparent 65%),
    radial-gradient(circle at 50% 80%, rgba(var(--tierRGB), 0.12) 0%, transparent 50%);
}
```

---

## 10. Named palette reference (informational — NFT metadata + lore UI)

Not read by the renderer. Used for naming creatures in metadata and the web UI hover tooltip.

### Foxling (speciesId 0)

| ID | Name | `bodyHue` range | Mood |
|---|---|---|---|
| foxling-mint | Mint | 0–25 | Fresh + playful — default shipped look |
| foxling-teal | Teal | 26–65 | Cool ocean freshness |
| foxling-sage | Sage | 66–105 | Earthy forest guardian |
| foxling-twilight | Twilight | 195–245 | Night-watch, stargazer |
| foxling-blossom | Blossom | 295–340 | Spring cherry |

### Flicker (speciesId 5)

| ID | Name | `bodyHue` range | Mood |
|---|---|---|---|
| flicker-ember | Ember | 0–20 | Classic fire sprite — default shipped look |
| flicker-blaze | Blaze | 340–359 | Fierce arena fighter |
| flicker-sunrise | Sunrise | 21–50 | Bright + cheerful sunbeam |
| flicker-specter | Specter | 155–215 | Ghost flame — ultra-rare visual |
| flicker-arcane | Arcane | 240–285 | Mystical caster |

---

## 11. Implementation checklist for Flamingo

**New file — `web/src/variationSpecImpl.ts` (~55 lines):**
- [ ] Copy the implementation from §3 exactly
- [ ] Verify imports resolve: `./variationSpec` must export `setVariationSpec`, `VariationContext`, `CreaturePalette`, `MarkingKind`, `AccessoryKind`

**Two-line edit — `web/src/main.tsx`:**
- [ ] `import { initVariationSpec } from './variationSpecImpl'`
- [ ] `initVariationSpec()` — call before first render

**Optional CSS polish — `web/src/components/CreatureCard.module.css`:**
- [ ] Add per-tier `.artAura` overrides from §9

**No changes to:**
- `web/src/geneDecoder.ts` — gene decoding is complete, variation doesn't need more CSS vars
- `web/src/creatureRender.ts` — compositor already calls `getVariationSpec()`
- `web/src/variationSpec.ts` — interface is stable; `setVariationSpec` is the only door
- `web/public/assets/creatures/foxling.svg` — no mark-N groups needed
- `web/public/assets/creatures/flicker.svg` — no mark-N groups needed
- Any other species SVGs — variation is species-agnostic via gradient role classification
- `contract/` — no on-chain changes
- `web/src/chain.ts`, `web/src/satiety.ts`, `deploy/` — no changes
- Any keystore or credentials
- Card 7:10 ratio (300×432 px) — unchanged
- All UI text — English-only, unchanged

---

*All UI text in shipped cards and SVGs remains English-only. Card ratio 7:10 (300×432 px) preserved.*
