# 🧬 Pocket Hatchery — SVG Creature System

> **Slot Engine v1.0** — 12 species · 36 trait slots · 4 variants each = 144+ unique SVG layers
> Monanisa (Designer) · 2026-07-03

---

## Architecture

```
art/species/svg/
├── index.html              🎮 Live slot engine preview
├── slot-engine.js          ⚙️ Gene decoder/composer/breeder
├── species-registry.js     📋 12 species definitions + trait slots
└── species/
    ├── foxling.svg         🦊 Fox body + 3 trait slots × 4 variants
    ├── owlet.svg           🦉 Sphere owl + eye rings + wings + crown
    ├── droplet.svg         💧 Teardrop water + core + fins + clarity
    ├── pebblit.svg         🪨 Rock + stone type + moss + crystals
    ├── sproutling.svg      🌱 Plant stem + head plant + roots + season
    ├── flicker.svg         🔥 Living flame + color + shape + sparks
    ├── glimmer.svg         💎 Hex crystal + shape + core + refraction
    ├── wisp.svg            👻 Ghost + tail + glow + opacity
    ├── fluffle.svg         ☁️ Cloud fluff + fluff level + ears + style
    ├── shellby.svg         🐚 Snail + shell type + color + antennae
    ├── dracling.svg        🐉 Dragon + horns + wings + breath
    └── buzzle.svg          🐝 Bee + stripes + wings + collar
```

## How It Works

### Slot Engine

Each species SVG contains **layers** identified by `id`:
- `body` — base shape (always visible)
- `slot-{name}-{0|1|2|3}` — trait variant layers (only one active per slot)
- `rare-*` / `legendary-*` — rarity overlays
- `mut-*` — mutation effects

The engine:
1. Reads a **64-bit gene** (hex)
2. Decodes `species_id` (bits 0-3), 3 trait values (bits 48-59), mutations (bits 60-63)
3. Loads the species SVG
4. Shows/hides layers based on gene bits
5. Composes the final creature

### Gene Encoding (64 bits)
```
bits  0-3:   species_id      (0-11)
bits  4-11:  body_hue        (HSL hue shift)
bits 12-19:  accent_hue      
bits 20-35:  pattern (type + hue)
bits 32-35:  saturation      
bits 36-39:  brightness      
bits 40-47:  eye + pattern opacity
bits 48-51:  trait_a         (species-specific slot 1)
bits 52-55:  trait_b         (species-specific slot 2)
bits 56-59:  trait_c         (species-specific slot 3)
bits 60-63:  mutations       (shiny/giant/prismatic/ethereal)
```

## Usage

### Open the Slot Engine
```bash
# Just open in browser:
start art/species/svg/index.html
```

### API (slot-engine.js)
```javascript
// Decode a gene
const creature = SlotEngine.decode('0x0000000000000000');

// Encode traits into gene
const gene = SlotEngine.encode({speciesId:0, traitA:2, traitB:1, traitC:0, ...});

// Generate random creature
const randomGene = SlotEngine.random(0); // Foxling only

// Breed two creatures
const offspring = SlotEngine.breed(parentA, parentB);

// Calculate stats
const stats = SlotEngine.calcStats(0, 3); // Foxling, Epic
```

## Color Palette

| Element | Primary | Accent |
|---------|---------|--------|
| 🔥 Fire | Coral `#FF9EB5` | Golden `#FFCB6B` |
| 💧 Water | Teal `#5BC0BE` | White `#F0F8FF` |
| 🏔️ Earth | Earth `#C49A6C` | Moss `#8FD694` |
| 🌬️ Air | Sky `#A8DCF0` | Golden `#FFCB6B` |
| 🌿 Nature | Meadow `#5BB572` | Coral `#FF9EB5` |
| ✨ Crystal | Lavender `#C9A8FF` | White `#FFFFFF` |
| 🌙 Shadow | Navy `#3A3A52` | Lavender `#C9A8FF` |

## What's Next

- [ ] Add CSS `filter: hue-rotate()` runtime color shifting per gene hue bits
- [ ] Render 4-stage evolution overlays (egg/baby/adult/rare)
- [ ] Export composed SVG to PNG (via canvas API)
- [ ] Integrate with NFT card generation pipeline
- [ ] Add `breeding-preview.html` for pair-compatibility visualization
- [ ] Animate idle poses (CSS keyframes on SVG transforms)

---

> **Questions?** → Monanisa in the office
