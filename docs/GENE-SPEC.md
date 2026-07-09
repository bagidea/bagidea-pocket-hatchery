# Pocket Hatchery — GENE-SPEC.md (Canonical Gene Encoding)

> **สถานะ:** Canonical — single source of truth สำหรับ gene bit layout ทั้งโปรเจค
> **ผู้ดูแล:** Monanisa (64-bit rendering) + Sun (256-bit contract bridge)
> **อัปเดตล่าสุด:** 2026-07-03
> **แทนที่:** GENETICS-SPEC.md (contract-only), SPECIES-DESIGN.md §13 (partial), showcase.html lab decoder (outdated)

---

## 0. Purpose

This document defines the **ONE canonical gene encoding** for Pocket Hatchery. Every consumer — contract, slot engine, showcase lab, SVG renderer, breeding calculator, NFT card display — MUST use this spec.

**Before this spec (the problem):** Three conflicting gene layouts existed:
- `GENETICS-SPEC.md` — 256-bit contract-level (8×32-bit genes), no rendering bridge
- `SPECIES-DESIGN.md §13` + `slot-engine.js` — 64-bit rendering layout (correct, canonical)
- `showcase.html` lab — **different 64-bit layout** (bits shifted by 4, missing species_id/traits/mutations)

This spec reconciles them into one truth.

---

## 1. Architecture: Two Layers, One Truth

```
┌─────────────────────────────────────────────────────────────┐
│  256-bit CONTRACT GENE (on-chain checksum256)               │
│  ┌──────────────────────┬──────────────────────────────────┐│
│  │ 64-bit RENDERING GENE│ 192-bit BREEDING ENTROPY         ││
│  │ (bits 0–63)          │ (bits 64–255)                    ││
│  │ → drives display     │ → rarity bands, mutation seeds   ││
│  └──────────────────────┴──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

| Layer | Width | Where | Purpose |
|---|---|---|---|
| **Rendering Gene** | 64-bit | Off-chain (SVG, slot engine, card display) | What the player sees — species, color, pattern, traits |
| **Contract Gene** | 256-bit | On-chain (`checksum256` in `creatures_s`) | What the blockchain stores — includes rendering gene + rarity entropy + breeding seeds |

**Bridge rule:** The 64-bit rendering gene occupies **bits 0–63** of the 256-bit contract gene. Bits 64–255 carry rarity-band entropy and breeding mutation seeds (see §7).

---

## 2. Canonical 64-bit Rendering Gene Layout

```
BIT   FIELD            WIDTH   RANGE        DESCRIPTION
───   ─────            ─────   ─────        ───────────
0–3   species_id       4-bit   0–11 (12–15  Species index (see species-registry.js)
                                       reserved)
4–11  body_hue         8-bit   0–255        Base body color → HSL hue 0°–360°
12–19 accent_hue       8-bit   0–255        Accent color (ears, tail, cheeks)
20–23 pattern_type     4-bit   0–15         Pattern style (stripes/spots/hearts/stars…)
24–31 pattern_hue      8-bit   0–255        Pattern color → HSL hue 0°–360°
32–35 sat_lvl          4-bit   0–15         Saturation: 40% + val/15 × 45%
36–39 bright_mod       4-bit   0–15         Brightness offset: (val−7)/15 × 30%
                                           (±14% around 55% base)
40–43 eye_var          4-bit   0–15         Eye color palette index
44–47 pat_opacity      4-bit   0–15         Pattern opacity: 20% + val/15 × 60%
48–51 trait_1          4-bit   0–15         Species-specific trait A (0–3 active, 4–15 reserved)
52–55 trait_2          4-bit   0–15         Species-specific trait B (0–3 active, 4–15 reserved)
56–59 trait_3          4-bit   0–15         Species-specific trait C (0–3 active, 4–15 reserved)
60–63 mutation_flags   4-bit   per-bit       bit60=Shiny, bit61=Giant, bit62=Prismatic, bit63=Ethereal
```

**Total: 64 bits = 16 hex chars** (e.g. `0x3A4F_8CD4_E827_55F1`)

### Bit map (visual)

```
63        56        48        40        32        24        16         8         0
│         │         │         │         │         │         │         │         │
├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│mut│ trait_3 │ trait_2 │ trait_1 │pat_opa│eye_var│bri_mod│ sat_lvl│pat_hue│pat_typ│acc_hue│bod_hue│sp│
└───┴─────────┴─────────┴─────────┴───────┴───────┴───────┴────────┴───────┴───────┴───────┴───────┴──┘
```

---

## 3. Field Details

### 3.1 species_id (bits 0–3)

Maps to `SPECIES` array index in `species-registry.js`:

| id | Species   | id | Species    |
|----|-----------|----|------------|
| 0  | Foxling   | 6  | Glimmer    |
| 1  | Owlet     | 7  | Wisp       |
| 2  | Droplet   | 8  | Fluffle    |
| 3  | Pebblit   | 9  | Shellby    |
| 4  | Sproutling| 10 | Dracling   |
| 5  | Flicker   | 11 | Buzzle     |

12–15 reserved for future species.

### 3.2 body_hue / accent_hue / pattern_hue (8-bit each)

0–255 linear → 0°–360° HSL hue. Conversion: `hue_deg = val × 360 / 255`.

Reference hues for presets:

| Name     | val | ~HSL  | Swatch    |
|----------|-----|-------|-----------|
| Coral    | 250 | 353°  | `#FF9EB5` |
| Golden   |  30 |  42°  | `#FFCB6B` |
| Mint     | 100 | 141°  | `#8FD694` |
| Teal     | 127 | 179°  | `#5BC0BE` |
| Sky      | 147 | 207°  | `#A8DCF0` |
| Lavender | 190 | 268°  | `#C9A8FF` |
| Earth    |  20 |  28°  | `#C49A6C` |

### 3.3 pattern_type (bits 20–23)

| val | Pattern      | val | Pattern        |
|-----|-------------|-----|----------------|
| 0   | Stripes      | 8   | Zigzag         |
| 1   | Spots        | 9   | Waves          |
| 2   | Hearts       | 10  | Scales         |
| 3   | Stars        | 11  | Diamonds       |
| 4   | Grid         | 12  | Tribal Marks   |
| 5   | Swirls       | 13  | Runes (glow)   |
| 6   | Rings        | 14  | Constellation  |
| 7   | Gradient     | 15  | Fractal        |

### 3.4 sat_lvl (bits 32–35)

`0` = 40% saturation (muted/pastel), `15` = 85% saturation (vivid).

```js
sat_pct = 40 + (sat_lvl / 15) * 45;
```

### 3.5 bright_mod (bits 36–39)

Center = 7 = ±0%. Range: -14% to +16% around 55% base brightness.

```js
brit_pct = 55 + ((bright_mod - 7) / 15) * 30;
```

### 3.6 eye_var (bits 40–43)

Eye color palette index. Renderer selects from predefined palettes:

| val | Palette      | val | Palette       |
|-----|-------------|-----|---------------|
| 0   | Warm Brown   | 8   | Amber Gold    |
| 1   | Cool Blue    | 9   | Emerald Green |
| 2   | Forest Green | 10  | Ruby Red      |
| 3   | Storm Grey   | 11  | Sapphire      |
| 4   | Honey        | 12  | Amethyst      |
| 5   | Ocean Teal   | 13  | Onyx Black    |
| 6   | Sunset       | 14  | Pearl White   |
| 7   | Twilight     | 15  | Prismatic     |

### 3.7 pat_opacity (bits 44–47)

`0` = 20% (faint), `15` = 80% (bold).

```js
pat_opacity_pct = 20 + (val / 15) * 60;
```

### 3.8 trait_1 / trait_2 / trait_3 (bits 48–51, 52–55, 56–59)

Species-specific traits. Each species defines 3 trait slots × 4 variants (0–3). See `species-registry.js` for per-species mapping.

| Species   | trait_1        | trait_2       | trait_3        |
|-----------|----------------|---------------|----------------|
| Foxling   | Ear style      | Tail plume    | Forehead mark  |
| Owlet     | Eye rings      | Wing style    | Crown          |
| Droplet   | Core shape     | Fin style     | Transparency   |
| Pebblit   | Stone type     | Moss coverage | Crystal growth |
| Sproutling| Head plant     | Root style    | Season color   |
| Flicker   | Flame color    | Flame shape   | Spark level    |
| Glimmer   | Crystal shape  | Inner core    | Refraction     |
| Wisp      | Tail style     | Glow color    | Opacity        |
| Fluffle   | Fluff level    | Ear length    | Ear style      |
| Shellby   | Shell type     | Shell color   | Antennae       |
| Dracling  | Horn style     | Wing size     | Breath         |
| Buzzle    | Stripe pattern | Wing style    | Fluff collar   |

Values 4–15 in each trait slot are **reserved** for future trait variants.

### 3.9 mutation_flags (bits 60–63)

Individual bits — can be combined:

| Bit | Name        | Effect                              | Rarity  |
|-----|-------------|-------------------------------------|---------|
| 60  | **Shiny**   | Hue shift +30°, alternate palette   | 1/64    |
| 61  | **Giant**   | Sprite scale ×1.3                   | 1/128   |
| 62  | **Prismatic**| Rainbow iridescence on body         | 1/256   |
| 63  | **Ethereal**| Transparency + glow aura            | 1/512   |

Only one mutation should typically be active for breeding realism. All four = 0 = no mutation.

---

## 4. Trait Values vs Slot Width

Each trait slot is **4 bits wide** (0–15), but currently only **values 0–3 are active** per trait (4 variants). Values 4–15 are reserved for future trait expansion without changing the bit layout.

When reading a 64-bit gene:
```js
const t1 = (gene >> 48n) & 0xFn; // 0–15
const variant = t1 & 3;           // 0–3, safe even if t1 ≥ 4
```

When encoding, only write 0–3 into trait slots.

---

## 5. JavaScript Reference Implementation

```js
// Canonical 64-bit Gene Encoder/Decoder
// Matches slot-engine.js exactly — DO NOT duplicate, import from slot-engine.js

const Gene64 = {
  decode(geneHex) {
    const gene = BigInt(geneHex.startsWith('0x') ? geneHex : '0x' + geneHex);
    return {
      speciesId:   Number(gene & 0xFn),
      bodyHue:     Number((gene >> 4n)  & 0xFFn),
      accentHue:   Number((gene >> 12n) & 0xFFn),
      patternType: Number((gene >> 20n) & 0xFn),
      patternHue:  Number((gene >> 24n) & 0xFFn),
      saturation:  Number((gene >> 32n) & 0xFn),
      brightness:  Number((gene >> 36n) & 0xFn),
      eyeColor:    Number((gene >> 40n) & 0xFn),
      patOpacity:  Number((gene >> 44n) & 0xFn),
      traitA:      Number((gene >> 48n) & 0xFn),
      traitB:      Number((gene >> 52n) & 0xFn),
      traitC:      Number((gene >> 56n) & 0xFn),
      mutations:   Number((gene >> 60n) & 0xFn),
    };
  },

  encode({speciesId, bodyHue, accentHue, patternType, patternHue,
          saturation, brightness, eyeColor, patOpacity,
          traitA, traitB, traitC, mutations}) {
    let gene = BigInt(0);
    gene |= BigInt(speciesId  & 0xF)  << 0n;
    gene |= BigInt(bodyHue    & 0xFF) << 4n;
    gene |= BigInt(accentHue  & 0xFF) << 12n;
    gene |= BigInt(patternType & 0xF) << 20n;
    gene |= BigInt(patternHue & 0xFF) << 24n;
    gene |= BigInt(saturation & 0xF)  << 32n;
    gene |= BigInt(brightness & 0xF)  << 36n;
    gene |= BigInt(eyeColor   & 0xF)  << 40n;
    gene |= BigInt(patOpacity & 0xF)  << 44n;
    gene |= BigInt(traitA     & 0xF)  << 48n;
    gene |= BigInt(traitB     & 0xF)  << 52n;
    gene |= BigInt(traitC     & 0xF)  << 56n;
    gene |= BigInt(mutations  & 0xF)  << 60n;
    return '0x' + gene.toString(16).padStart(16, '0').toUpperCase();
  },

  // Hex display: 0xPPPP_PPPP_PPPP_PPPP (16 hex chars, 4 groups of 4)
  toDisplayHex(geneHex) {
    const clean = geneHex.replace('0x', '').padStart(16, '0').toUpperCase();
    return '0x' + clean.slice(0,4) + '_' + clean.slice(4,8) + '_'
                + clean.slice(8,12) + '_' + clean.slice(12,16);
  },

  // Rarity from gene (proxy — real rarity assigned at mint)
  rarityFromGene(decoded) {
    if (decoded.mutations & 0x8) return 5; // ethereal → mythic
    if (decoded.mutations & 0x4) return 4; // prismatic → legendary
    if (decoded.saturation >= 12)  return 3; // epic
    if (decoded.saturation >= 8)   return 2; // rare
    if (decoded.brightness >= 8)   return 1; // uncommon
    return 0; // common
  },

  // Random gene generator
  random(speciesId = null) {
    const sid = speciesId !== null ? speciesId : Math.floor(Math.random() * 12);
    return this.encode({
      speciesId: sid,
      bodyHue:    Math.floor(Math.random() * 256),
      accentHue:  Math.floor(Math.random() * 256),
      patternType: Math.floor(Math.random() * 16),
      patternHue: Math.floor(Math.random() * 256),
      saturation: Math.floor(Math.random() * 16),
      brightness: Math.floor(Math.random() * 16),
      eyeColor:   Math.floor(Math.random() * 16),
      patOpacity: Math.floor(Math.random() * 16),
      traitA:     Math.floor(Math.random() * 4),
      traitB:     Math.floor(Math.random() * 4),
      traitC:     Math.floor(Math.random() * 4),
      mutations:  Math.random() < 0.1
        ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15][Math.floor(Math.random() * 15)]
        : 0,
    });
  },
};
```

---

## 6. Consumer Compliance Checklist

| File | Status | Action |
|------|--------|--------|
| `art/species/svg/slot-engine.js` | ✅ COMPLIANT | Matches canonical 64-bit exactly. No change needed. |
| `art/species/svg/species-registry.js` | ✅ COMPLIANT | Data file — trait slot IDs match §3.8. No change needed. |
| `art/nft-cards/showcase.html` | ❌ FIXED | Lab decoder was using wrong bit layout (no species_id, shifted by 4). Now matches canonical. |
| `GENETICS-SPEC.md` | ⚠️ SUPERSEDED | 256-bit contract spec — still valid for on-chain, but §2 (gene layout) superseded by this doc's §7 bridge. |
| `SPECIES-DESIGN.md` | ⚠️ SUPERSEDED | §13 (gene encoding) superseded by this doc. Rest of SPECIES-DESIGN.md remains authoritative for species roster. |
| `deploy/SPECIES-DESIGN.md` | ⚠️ SUPERSEDED | Copy — same as above. |
| Contract (`pockethatch.cpp/.hpp`) | ⏳ PENDING | Kevin to implement 64→256 bridge per §7. |

---

## 7. Bridge: 64-bit Rendering Gene ↔ 256-bit Contract Gene

### 7.1 Encoding (contract → rendering)

```
contract_gene = checksum256 (32 bytes)
rendering_gene = contract_gene.bytes[0..7]  → uint64 (lower 64 bits)
```

The lower 64 bits of the on-chain `checksum256` carry the canonical rendering gene. Bits 64–255 carry:
- **Bits 64–127:** Rarity band seeds (per-gene rarity entropy for breed mutations)
- **Bits 128–255:** Reserved (future gene expansion, dominance/recessive data, etc.)

### 7.2 Contract gene structure (256-bit)

```
bits   0– 63:  RENDERING GENE (canonical 64-bit, per §2)
bits  64– 95:  Gene 2 — Shade & Tone entropy (32-bit)
bits  96–127:  Gene 3 — Pattern Accent entropy (32-bit)
bits 128–159:  Gene 4 — Physique entropy (32-bit)
bits 160–191:  Gene 5 — Feature entropy (32-bit)
bits 192–223:  Gene 6 — Eyes entropy (32-bit)
bits 224–255:  Gene 7 — Aura & Shiny entropy (32-bit)
```

**Note:** Genes 0–1 (Primary Hue + Shade) are covered by the rendering gene's body_hue/accent_hue. The contract carries additional entropy for breeding mutations in bits 64–255.

### 7.3 Rarity bands (contract-level)

For on-chain rarity scoring, each gene in the 64–255 range maps to a rarity band:

| Band      | Range (normalized) | Weight |
|-----------|-------------------|--------|
| Common    | [0.00, 0.50)      | 1      |
| Uncommon  | [0.50, 0.75)      | 2      |
| Rare      | [0.75, 0.90)      | 5      |
| Epic      | [0.90, 0.97)      | 15     |
| Legendary | [0.97, 0.995)     | 50     |
| Mythic    | [0.995, 1.00)     | 200    |

Rarity score = Σ weight(gene_band) across genes 2–7. Min=6, Max=1200.

The rendering gene's eye_var (bits 40–43) can also serve as aesthetic rarity proxy off-chain.

---

## 8. Species-Specific Trait Slot Reference

From `species-registry.js`, for quick lookup:

| Species   | Slot A (trait_1) | Slot B (trait_2) | Slot C (trait_3) |
|-----------|------------------|------------------|------------------|
| Foxling   | `ears`           | `tail`           | `forehead`       |
| Owlet     | `eyerings`       | `wings`          | `crown`          |
| Droplet   | `core`           | `fins`           | `clarity`        |
| Pebblit   | `stone`          | `moss`           | `crystals`       |
| Sproutling| `headplant`      | `roots`          | `season`         |
| Flicker   | `flamecolor`     | `flameshape`     | `sparks`         |
| Glimmer   | `shape`          | `innercore`      | `refraction`     |
| Wisp      | `tailstyle`      | `glow`           | `opacity`        |
| Fluffle   | `fluff`          | `earlen`         | `earstyle`       |
| Shellby   | `shelltype`      | `shellcolor`     | `antennae`       |
| Dracling  | `horns`          | `wingsize`       | `breath`         |
| Buzzle    | `stripes`        | `wingstyle`      | `collar`         |

Each slot has exactly 4 variants (0–3). See `species-registry.js` for variant names, emojis, and descriptions.

---

## 9. Mutation Flags Reference

```
bit 60: SHINY       → hue_shift = +30° on all hue fields, alternate palette
bit 61: GIANT       → sprite_scale = 1.3×
bit 62: PRISMATIC   → rainbow iridescence overlay on body
bit 63: ETHEREAL    → body_opacity = 0.7 + glow aura
```

Mutations are independent flags — a creature CAN have multiple (e.g., Shiny + Giant = 0x3000_...). Rarity increases multiplicatively with each active flag.

---

## 10. Version History

| Date       | Version | Change |
|------------|---------|--------|
| 2026-07-03 | 1.0     | Initial canonical spec. Reconciles 3 conflicting gene specs into one truth. 64-bit rendering gene = canonical; 256-bit contract bridge defined. |
| 2026-07-03 | 1.0.1   | Updated showcase.html lab decoder to match canonical 64-bit. |

---

## 11. Consumers & Owners

| Consumer | File(s) | Owner | Notes |
|----------|---------|-------|-------|
| Slot Engine | `art/species/svg/slot-engine.js` | Monanisa | Reference implementation of 64-bit encode/decode |
| Species Registry | `art/species/svg/species-registry.js` | Monanisa | 12 species × 3 trait slots — source of truth for trait names |
| NFT Showcase | `art/nft-cards/showcase.html` | Monanisa | Interactive gene lab — uses canonical 64-bit |
| Species Showcase | `art/species/showcase.html` | Monanisa | Static species roster — no gene code |
| Contract | `pockethatch.cpp/.hpp` | Kevin | Implements 256-bit gene with 64-bit rendering gene embedded |
| Contract spec | `GENETICS-SPEC.md` | Sun | Superseded for gene layout; still valid for rarity/breeding algorithm |
| Species design | `SPECIES-DESIGN.md` | Monanisa | Superseded for §13 (gene encoding); still authoritative for species roster |

---

> *"One gene. One truth. Every pixel and every block — aligned."*
