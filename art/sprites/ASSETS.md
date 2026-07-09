# 🐣 Pocket Hatchery — Complete Species Sprite Set (hand-off)

> All 12 species of Pocket Hatchery. Hand-authored vectors rendered to
> transparent PNG — **no AI-generated pixels**, so what you see here is exactly
> what ships. Follows `ART.md` (cozy-premium soft-3D · golden-hour key light).
>
> Author: Monanisa (Designer) · v2 · 2026-07-03
> Expanded from Foxling-only v1 to full 12-species roster.

---

## What's here

### 12 Species × 3 Stages × 3 Frames = 108 sprites

| # | Species | Element | Base Color | Key Silhouette |
|---|---|---|---|---|
| 1 | **Foxling** 🦊 | Fire | Mint `#8FD694` | Fox with fluffy plume tail, pointed ears |
| 2 | **Owlet** 🦉 | Air | Sky `#A8DCF0` | Round owl body (no neck), concentric eye rings |
| 3 | **Droplet** 💧 | Water | Teal `#5BC0BE` | Inverted teardrop, translucent core, side fins |
| 4 | **Pebblit** 🪨 | Earth | Earth `#C49A6C` | Round rock, 4 stubby legs, moss on top |
| 5 | **Sproutling** 🌱 | Nature | Meadow `#5BB572` | Plant stem body, leaf head, root legs |
| 6 | **Flicker** 🔥 | Fire | Gold→Coral | Flame shape with fire arms, internal glow |
| 7 | **Glimmer** 💎 | Crystal | Lavender `#C9A8FF` | Hexagonal crystal, geometric facets, refraction |
| 8 | **Wisp** 👻 | Shadow | Navy `#3A3A52` | Round ghost, smoke tail, glowing lavender eyes |
| 9 | **Fluffle** ☁️ | Air | Cream `#FFF6E9` | Fluff-ball cloud, long droopy ears |
| 10 | **Shellby** 🐚 | Water | Pearl `#F5F0E8` | Snail with spiral shell, eyes on antennae |
| 11 | **Dracling** 🐉 | Fire | Deep Lavender | Chubby dragon, small wings, curved horns |
| 12 | **Buzzle** 🐝 | Nature | Gold+Earth | Round bee with stripes, transparent wings, fluff collar |

### Each species covers 3 stages

| Stage | Frames | Description |
|---|---|---|
| **egg** (in nest, glow pulses, species-specific pattern) | 3 | `creature_{species}_egg_idle_f1.png` … `_f3.png` |
| **baby** (hatchling — chibi proportions, head≈body) | 3 | `creature_{species}_baby_idle_f1.png` … `_f3.png` |
| **adult** (1st evolution — full features, unique identity) | 3 | `creature_{species}_adult_idle_f1.png` … `_f3.png` |

- **Size:** 512×512 px each (designed @2x; downscale freely — card icon ~96px, farm sprite ~256px).
- **Background:** transparent (true alpha).
- **Naming:** `creature_{species}_{stage}_{state}.png` per `ART.md §9`.

## Per-species contact sheets

`{species}_contact_sheet.png` — cream-bg review sheet showing all 3 stages × 3 frames for one species.

## Master roster sheet

`species_roster_contact_sheet.png` — all 12 species (adult stage) side by side for silhouette comparison.

## Regenerate / edit

Source is vector + script — fully reproducible, no binary editing:
```
node "art/sprites/_build/render.js"
```

Source files:
- `art/sprites/_build/creatures.js` — the drawing engine (gradients, per-species shapes, frame transforms) for ALL 12 species.
- `art/sprites/_build/render.js` — headless-Chrome render → 108 PNGs + 12 species sheets + 1 master roster.

## Animation (idle loop)

3 frames per stage, play ping-pong at ~4–6 fps:
- **egg:** wobble (±3°) + glow ramp; **f3 shows the crack** — use as hatch-tease pose.
- **baby / adult:** squash-&-stretch breathing, pivoting at the feet (stays grounded).

> Squash/stretch pivots at `(128,206)` in the 256-unit design space — keep that anchor if you add frames.

## Color path (per ART.md §5)

Each species maintains its base color + accent across all 3 stages:
- Foxling: mint body + cream belly + coral accents → adult adds lavender ear-tips
- Owlet: sky body + cream belly + gold accents → adult adds forehead star
- Droplet: translucent teal + pearl fins → adult reveals heart-shaped core
- Pebblit: earth body + moss green → adult adds crystal cluster
- Sproutling: meadow green + coral flower → adult adds full bloom
- Flicker: gold→coral gradient + white-hot core → adult adds multi-layer flame
- Glimmer: lavender crystal + white facets → adult adds prismatic refraction
- Wisp: navy ghost + lavender glow → adult adds constellation tail
- Fluffle: cream cloud + mint ear tips → adult adds cotton-candy sparkle
- Shellby: pearl shell + coral body → adult adds golden pearl sheen
- Dracling: deep lavender + gold belly → adult adds curved horns + wings
- Buzzle: gold-black stripes + white fluff → adult adds transparent iridescent wings

## Drop-in for the web

```html
<img src="/art/sprites/creature_foxling_adult_idle_f1.png" alt="Foxling" width="96" height="96">
```

Slug mapping (species id → file prefix):
```js
const SPECIES = ['foxling','owlet','droplet','pebblit','sproutling','flicker',
  'glimmer','wisp','fluffle','shellby','dracling','buzzle'];
const file = `/art/sprites/creature_${SPECIES[id]}_${stage}_idle_f${frame}.png`;
```

## Notes / next

- Contact shadow is **baked** into each sprite. To split into a separate engine layer for opacity control (`ART.md §9`), pull the `<ellipse class="shadow">` element out in `creatures.js`.
- Still on the roadmap: full expression sheet (happy/eating/sleeping/evolving) per species, the **rare/legendary** 4th stage (crystal + aura), and the evolution-moment flash/particle.
- The **rendered PNGs** can be used directly in the web frontend for creature display — no emoji placeholders needed anymore.
- **Species silhouettes** are all unique at adult stage (verified via SVG structural hash).
