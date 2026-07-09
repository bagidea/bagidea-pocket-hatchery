# 🃏 Pocket Hatchery — NFT Card Design System

> **"Prism Card"** — การ์ด NFT ระบบคริสตัลที่แต่ละใบสะท้อนเอกลักษณ์ของ creature ผ่านสี กรอบ และ visual effect
> Monanisa (Designer) · v1.0 · 2026-07-03
> อ้างอิง: [`ART.md`](./ART.md) · [`UI-KIT.md`](./UI-KIT.md)

---

## 0. Deliverables (ของที่ส่งมอบ)

| ไฟล์ | คำอธิบาย |
|---|---|
| `art/nft-cards/showcase.html` | Live preview การ์ดทั้งหมด 6 tier (front+back) พร้อม genetics demo |
| `art/nft-cards/creature-template.svg` | SVG creature ต้นแบบ recolor ได้ผ่าน CSS variables + 4 pattern types (stripes/spots/hearts/stars) |
| `art/nft-cards/showcase.html` | **Interactive Genetics Lab** — sliders ปรับ gene จริง → creature เปลี่ยนสี real-time + 8 presets |
| `art/nft-cards/nft-card-showcase-full.png` | ภาพ full-page showcase ทั้งหมด |
| `art/nft-cards/nft-card-all-tiers-grid.png` | ภาพ grid การ์ดทั้ง 6 tier |
| `art/nft-cards/card-front-*.png` / `card-back-*.png` | ภาพการ์ดแยก front/back ทุก tier |
| `NFT-CARD-DESIGN.md` | เอกสารนี้ — design spec ฉบับสมบูรณ์ |

---

## 1. Design Concept — "Prism Card"

### North Star
> **"Every card is a crystal that contains a unique creature inside — and the crystal's color and brilliance reveal its rarity at a glance."**

### Key Principles
1. **Rarity แสดงผ่าน frame + aura** — เห็น tier ได้ทันทีจากสีกรอบและเอฟเฟกต์ โดยไม่ต้องอ่านตัวหนังสือ
2. **ทุกใบไม่เหมือนกัน** — creature SVG recolor ได้จาก genetics บน chain → 10⁶+ combinations
3. **Dark premium canvas** — card body สีเข้ม (`#0f1119`) ทำให้ creature สีสว่าง pop และ aura เรืองแสง
4. **Accessibility first** — rarity สื่อด้วย สี + ป้ายข้อความ + ไอคอน (3 channels) เสมอ

---

## 2. Card Anatomy (Front)

```
┌─────────────────────────────────┐  ┌─ Frame border (gradient ตาม tier)
│ ◆C  #0042                      │  │  Top bar: rarity icon + card ID
│ ┌─────────────────────────────┐ │  │
│ │  ╭───────────────────────╮  │ │  │
│ │  │  ✨  CREATURE ART   ✨ │  │ │  │  Art window: radial aura +
│ │  │   (oval window,       │  │ │  │  sparkle (epic+) +
│ │  │    radial aura glow)  │  │ │  │  creature illustration
│ │  ╰───────────────────────╯  │ │  │
│ └─────────────────────────────┘ │  │
│ ● Baby · Stage 1                │  │  Stage badge
│ Foxling                         │  │  Creature name (display font)
│ Vulpes magica — The Meadow Fox │  │  Species label
│ 🧬 ●●●●●●                      │  │  Genetics strip (6 gene dots)
│ ⚔ 5  ◆ 7  ⏳ 1d               │  │  Stats (Power / Charm / Age)
│ ──────── COMMON ────────        │  │  Rarity bar footer
└─────────────────────────────────┘  │
```

### Dimensions
| Property | Value |
|---|---|
| Card size | 300 × 432 px (ratio ~7:10) |
| Border radius | 24px (`--ph-radius-xl`) |
| Frame border width | 3px (gradient) |
| Art window | ~250 × 210 px, radius 18px |
| Art window margin | 16px horizontal |

### Zones (เรียงจากบนลงล่าง)

| Zone | Position | Content |
|---|---|---|
| **Top Bar** | padding 14/18/8 | Rarity icon (left) + Card ID (right) |
| **Art Window** | margin 0 16px, h 210px | Radial aura bg + creature illustration + sparkle particles (epic+) |
| **Info** | padding 8/18/14 | Stage badge → Name → Species → Genetics → Stats |
| **Footer** | padding 0/18/14 | Rarity divider bar with tier name |

---

## 3. Rarity Tiers (6 levels)

### Visual System — เพิ่ม Uncommon และ Mythic ต่อจาก ART.md §3 เดิม (4 tier)

| # | Tier | Frame Color | Hex | FX | Animation | Supply |
|---|---|---|---|---|---|---|
| 1 | **Common** | Mint green | `#8FD694` | Solid gradient border | — | Unlimited |
| 2 | **Uncommon** | Teal | `#5BC0BE` | Double-line gradient | — | Unlimited |
| 3 | **Rare** | Sky blue | `#5FB8E8` | Gradient + outer glow | — | Unlimited |
| 4 | **Epic** | Lavender | `#B07BE8` | Multi-layer + shadow + sparkle | Sparkle particles float | Unlimited |
| 5 | **Legendary** | Gold | `#FFD86B` | Iridescent animated border + crystal horn | Aura pulse (2.5s) + shimmer (3s) | 10,000 max |
| 6 | **Mythic** | Prismatic | Rainbow | Full spectral hue-rotate + diamond crown | Rainbow cycle (4s) + constellation | 1,000 max |

### Frame Specification (CSS implementation)

```css
/* Common — simple solid gradient */
.card-front::before {
  background: linear-gradient(160deg, #8FD694 0%, #5BB572 50%, #4A9E5E 100%);
}

/* Uncommon — teal gradient */
.card-front::before {
  background: linear-gradient(160deg, #7ED6D4 0%, #5BC0BE 40%, #3DA5A3 100%);
}

/* Rare — adds box-shadow glow */
.card-front::before {
  background: linear-gradient(160deg, #8FD0F4 0%, #5FB8E8 40%, #3D8FBF 100%);
  box-shadow: 0 0 30px rgba(95,184,232,0.25);
}

/* Epic — stronger shadow */
.card-front::before {
  background: linear-gradient(160deg, #C9A0F8 0%, #B07BE8 40%, #8A4FD4 100%);
  box-shadow: 0 0 35px rgba(176,123,232,0.30);
}

/* Legendary — animated shimmer */
.card-front::before {
  background: linear-gradient(160deg, #FFE8A0 0%, #FFD86B 30%, #F0B830 60%, #FFD86B 100%);
  animation: legendaryShimmer 3s ease-in-out infinite;
}

/* Mythic — rainbow hue-rotate animation */
.card-front::before {
  background: linear-gradient(160deg,
    #ff9a9e 0%, #fad0c4 14%, #fad0c4 15%, #a18cd1 28%, #a18cd1 29%,
    #fbc2eb 42%, #fbc2eb 43%, #a6c1ee 56%, #a6c1ee 57%,
    #d4fc79 70%, #d4fc79 71%, #96e6a1 84%, #96e6a1 85%, #ff9a9e 100%);
  box-shadow: 0 0 55px rgba(240,224,255,0.45), 0 0 100px rgba(255,255,255,0.15);
  animation: mythicRainbow 4s linear infinite;
}
```

### Aura (glow behind creature in art window)

| Tier | Color | Opacity |
|---|---|---|
| Common | `rgba(143,214,148,0.25)` | 25% |
| Uncommon | `rgba(91,192,190,0.28)` | 28% |
| Rare | `rgba(95,184,232,0.30)` | 30% |
| Epic | `rgba(176,123,232,0.33)` | 33% |
| Legendary | `rgba(255,216,107,0.38)` | 38% (pulsing) |
| Mythic | Multi-color radial blend | 12-18% per color |

### Sparkle Particles (Epic+)

- **Epic:** 5 sparkles, random positions, 3s float cycle
- **Legendary:** 6 sparkles + accelerated float
- **Mythic:** 8 sparkles + constellation pattern

---

## 4. Card Back (ทุก tier ใช้โครงสร้างเดียวกัน)

```
┌─────────────────────────────────┐
│ ◆  ·  ·  ·  ·  ·  ·  ·  ·  ◆  │  Corner gems (สีตาม tier)
│   ╭─────────────────────────╮   │
│   │    ○  ○  ○  ○  ○       │   │  Concentric mandala rings
│   │   ○               ○     │   │  (4 rings: solid → dashed → solid → dotted)
│   │  ○     🥚 LOGO     ○    │   │  Center: egg logo + POCKET HATCHERY text
│   │   ○               ○     │   │
│   │    ○  ○  ○  ○  ○       │   │
│   ╰─────────────────────────╯   │
│ ◆  ·  ·  ·  ·  ·  ·  ·  ·  ◆  │
└─────────────────────────────────┘
```

### Back Design Spec
- **Background:** `#1a1d2e` (card-bg-light) — lighter than front for contrast
- **Pattern:** 4 concentric mandala rings, each different border style (solid → dashed → solid → dotted)
- **Corner gems:** 4 diamond shapes (rotated 45° squares) at corners, tier-colored, 40% opacity
- **Logo:** 64×76px egg icon with sparkle, centered
- **Text:** "POCKET HATCHERY" in display font, 16px, letter-spacing 1px
- **Subtitle:** "COLLECT · BREED · EVOLVE" in 9px, letter-spacing 3px

---

## 5. SVG Recolor System — Genetics → Visual

### Gene Encoding (uint64 → 48 bits used, 16 reserved)

```
bits  0-7:  body_hue       (0-255 → HSL hue 0°-360°)
bits  8-15: accent_hue     (0-255 → HSL hue 0°-360°) — ears, paws, nose
bits 16-19: pattern_id     (0-15 → 16 pattern types)
bits 20-27: pattern_hue    (0-255 → HSL hue 0°-360°) — markings color
bits 28-31: saturation_lvl (0-15 → 40%-85% saturation)
bits 32-35: brightness_mod (0-15 → -15% to +15% brightness offset)
bits 36-39: eye_variant    (0-15 → eye color palette index)
bits 40-43: pattern_opac   (0-15 → 20%-80% pattern opacity)
bits 44-47: reserved       (ear marking style)
bits 48-63: reserved       (future: glow, aura, crown, accessories)
```

### Pattern Types (pattern_id)

| ID Range | Pattern | SVG Method |
|---|---|---|
| 0-3 | Stripes | `<ellipse>` stripes clipped to body shape |
| 4-7 | Spots/Dots | `<pattern>` with `<circle>` elements |
| 8-11 | Hearts | `<pattern>` with `<path>` heart shapes |
| 12-15 | Stars | `<pattern>` with `<polygon>` stars |

### Interactive Genetics Lab (Live Demo)

Open `art/nft-cards/showcase.html` in a browser — the **Interactive Genetics Lab** section lets you:

- **Move sliders** for every gene parameter (body hue, accent hue, pattern hue, saturation, brightness, pattern opacity)
- **See the creature change color in real time** — the SVG re-renders instantly as you adjust any slider
- **Switch pattern types** (Stripes · Spots · Hearts · Stars) — patterns render as actual SVG elements overlaid on the body
- **Randomize genes** — 🎲 button generates a completely random creature
- **Load presets** — 8 preset gene combinations (Meadow, Lagoon, Azure, Mystic, Sunborn, Blossom, Cocoa, Prima)
- **Copy gene hex** — 📋 button copies the full gene value for use in contract testing

The lab uses the **same JavaScript decoder** that runs in production — it's not simulated. Gene bits → decode → HSL colors → CSS inject → SVG render. The full pipeline is live and inspectable.

### Pattern Rendering (4 types, actual SVG elements)

Patterns are NOT flat colors — they are real SVG shapes rendered as overlays on the creature body:

| Pattern ID | Type | SVG Method | Visual |
|---|---|---|---|
| 0 | **Stripes** | 6 diagonal `<ellipse>` bands clipped to body | Tiger-like bands |
| 1 | **Spots** | 10 scattered `<circle>` elements | Dalmatian dots |
| 2 | **Hearts** | 6 `<path>` heart shapes | Cute love markings |
| 3 | **Stars** | 6 `<polygon>` pentagram sparkles | Magical constellation |

Each pattern group is toggled by `--critter-pat-idx` CSS variable (set to 0-3). The interactive lab shows all 4 types live.

### SVG Template Structure

The creature SVG (`creature-template.svg`) uses CSS custom properties:

```css
:root {
  --critter-base: #8FD694;       /* from gene bits 0-7 + saturation + brightness */
  --critter-base-dark: #5BB572;  /* computed: base darkened 20% */
  --critter-accent: #FFCB6B;     /* from gene bits 8-15 */
  --critter-pattern: #FF9EB5;    /* from gene bits 20-27 */
  --critter-belly: #F5F0E8;      /* always light cream */
  --critter-eye: #3A3A52;        /* from eye_variant palette */
  --critter-pattern-opacity: 0.55; /* from gene bits 40-43 */
}
```

Each SVG element references these variables via class:

```html
<ellipse class="body-shape" cx="256" cy="290" rx="115" ry="120"/>
<!-- renders with fill: var(--critter-base) -->
```

### Client-Side Rendering Flow

```
1. Client reads creature row from contract via get_table_rows
   → genetics: uint64 (e.g. 0xA3F0_8CD4_E500_7A2F)

2. Decode bits:
   body_hue     = (genetics >> 0)  & 0xFF = 0xA3 = 163 → HSL hue 229°
   accent_hue   = (genetics >> 8)  & 0xFF = 0xF0 = 240 → HSL hue 338°
   pattern_id   = (genetics >> 16) & 0x0F = 0x08 = 8   → Hearts pattern
   pattern_hue  = (genetics >> 20) & 0xFF = ...
   // ... etc.

3. Compute CSS variables:
   --critter-base: hsl(229, 62%, 72%)     // hue=body_hue, sat=from sat_lvl, lit=from bright_mod
   --critter-accent: hsl(338, 70%, 75%)
   --critter-pattern: hsl(15, 65%, 70%)

4. Inject into SVG <style> (or set on :root via JS)

5. Render SVG → the creature appears with unique colors
```

### Breeding Color Computation (on-chain)

```cpp
// Pseudocode for breed() action
uint64_t child_genetics = 0;

// body_hue = average of parents ± random mutation
uint8_t body_hue = (parent1_body_hue + parent2_body_hue) / 2;
int8_t mutation = random_range(-12, +12);       // ±12 hue shift
body_hue = clamp(body_hue + mutation, 0, 255);

// accent_hue = randomly from either parent
uint8_t accent_hue = (random_bit() ? parent1_accent : parent2_accent);

// pattern_id = from either parent, 5% chance of new random
uint8_t pattern_id = (random_range(0, 100) < 5)
  ? random_range(0, 15)
  : (random_bit() ? parent1_pattern : parent2_pattern);

// ... pack all into child_genetics
```

---

## 6. Stats Display

Stats on the card are simplified to 3 key metrics:

| Stat | Icon | Source | Display |
|---|---|---|---|
| **Power** | ⚔ | Computed from stage + rarity bonus + gene quality | Integer |
| **Charm** | ◆ | Computed from rarity + pattern rarity + age | Integer |
| **Age** | ⏳ | `current_time - born_at` | Human-readable (e.g. "1d", "12d", "90d", "∞") |

The stats values scale with tier:

| Tier | POW range | CHARM range |
|---|---|---|
| Common | 1-10 | 1-12 |
| Uncommon | 8-18 | 10-22 |
| Rare | 14-26 | 18-30 |
| Epic | 22-36 | 26-40 |
| Legendary | 34-52 | 42-58 |
| Mythic | 50-80 | 60-90 |

---

## 7. Typography (per ART.md §4)

| Element | Font | Weight | Size |
|---|---|---|---|
| Creature name | Baloo 2 / Fredoka | 700 | 20px |
| Species label | Nunito | 600 | 12px |
| Rarity name | Nunito | 800 | 11px, ls 2px, uppercase |
| Stats values | Nunito (tabular-nums) | 800 | 14px |
| Stats labels | Nunito | 700 | 9px |
| Card ID | Nunito | 700 | 12px |
| Stage badge | Nunito | 700 | 11px |
| Back logo text | Baloo 2 | 800 | 16px |

---

## 8. Color Reference (complete palette)

### Rarity Colors
```
Common:    #8FD694  →  dark: #5BB572  →  deep: #4A9E5E
Uncommon:  #5BC0BE  →  dark: #3DA5A3  →  deep: #2E8B8A
Rare:      #5FB8E8  →  dark: #3D8FBF  →  deep: #2A7099
Epic:      #B07BE8  →  dark: #8A4FD4  →  deep: #6B3FA8
Legendary: #FFD86B  →  dark: #F0B830  →  light: #FFE8A0
Mythic:    Rainbow  →  #ff9a9e → #a18cd1 → #a6c1ee → #96e6a1 (prismatic)
```

### Card Surfaces
```
Card bg (front): #0f1119
Card bg (back):  #1a1d2e
Inner frame:     rgba(255,255,255,0.06)
Info section:    rgba(255,255,255,0.04)
Text primary:    #F5F0E8
Text muted:      #7C7A92
Text dim:        rgba(255,255,255,0.3)
```

### Aura (radial glow behind creature)
```
Common:    rgba(143,214,148,0.25)
Uncommon:  rgba(91,192,190,0.28)
Rare:      rgba(95,184,232,0.30)
Epic:      rgba(176,123,232,0.33)
Legendary: rgba(255,216,107,0.38)  ← animated pulse
Mythic:    multi-color blend       ← hue-rotate animation
```

---

## 9. Accessibility

| Rule | Implementation |
|---|---|
| **Color ≠ only channel** | Rarity สื่อด้วย frame color + tier label text + rarity icon (C/U/R/E/L/M) |
| **Contrast** | Text #F5F0E8 on #0f1119 → ~15:1 (AAA) |
| **Touch target** | Card = 300×432px — well above 44×44px minimum |
| **Motion** | Animations respect `prefers-reduced-motion` via CSS media query |
| **Screen reader** | Use `aria-label` on cards: "Fluffle, Common rarity, Baby stage, Power 5" |

---

## 10. Hand-off to Dev

### What dev needs to build:

1. **Card component** (`<NFTCard>` in React/Vue)
   - Props: `creature`, `rarity`, `stage`, `genetics`, `stats`
   - Renders front face by default, back face on flip interaction
   - Rarity → applies correct CSS class (`.tier-common` / `.tier-uncommon` / etc.)

2. **Genetics decoder utility** (`decodeGenetics(uint64) → ColorVars`)
   - Pure function: gene bits → `{ bodyColor, accentColor, patternColor, patternType, ... }`
   - Tested with known gene values against expected colors

3. **SVG creature renderer**
   - Takes decoded color vars + species template → renders SVG with injected CSS
   - Caches rendered output; re-renders only when genetics change

4. **Card back component**
   - Static for all tiers except the outer frame color follows rarity
   - Logo and mandala pattern shared across all tiers

### CSS Integration
- Card uses existing design tokens from `art/ui-kit/tokens.css` where applicable
- New tokens for card-specific values defined in this spec §8
- All animations use `--ph-ease-*` and `--ph-dur-*` from tokens.css

### Production Asset Pipeline (future)
```
1. Creature species → SVG template per species (hand-authored by designer)
2. Genetics decode → ColorVars (client-side util)
3. ColorVars + SVG template → unique colored creature (dynamic)
4. Colored creature + card frame template → final card (dynamic)
5. Optional: bake to PNG for marketplace/OpenSea (off-chain render service)
```

---

## 11. Next Steps

- [ ] **เลือก species แรก** — Fluffle (template) หรือ Foxling (ที่มี sprite แล้ว) สำหรับ production card
- [ ] **ทำ species-specific SVG templates** — silhouette ต้องอ่านออกทันทีว่าเป็น species ไหน (per ART.md §5)
- [ ] **Implement genetics decoder** — pure function ใน client codebase
- [ ] **Test breeding color output** — breed 2 creatures ดูว่า child ได้สีตาม expectation
- [ ] **Animation polish** — legendary shimmer + mythic rainbow + epic sparkle ให้ smooth บน performance ต่ำ
- [ ] **Marketplace preview** — render card PNG สำหรับแสดงบน AtomicMarket / OpenSea
- [ ] **Figma component library** — สร้าง card component ใน Figma สำหรับ designer คนอื่นใช้ต่อ

---

> **Design files:** `art/nft-cards/showcase.html` (open in browser to see everything live)
> **Questions?** → Monanisa ในออฟฟิศ
