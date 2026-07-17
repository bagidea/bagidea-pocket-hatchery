# 🃏 Pocket Hatchery — Creature NFT Cards (Definitive 6-Tier Set)

> Flamingo (Designer) · 2026-07-08 · builds on Monanisa's "Prism Card" ([`../../NFT-CARD-DESIGN.md`](../../NFT-CARD-DESIGN.md))
> Render: `art/nft-cards/render-tiers.cjs` (headless Chrome, real per-species SVGs, no AI mockups)

## ⚠️ Tier reconciliation — READ FIRST (coordination with Kevin)

The card system must show **exactly the tiers that exist on-chain**, so a card can match a real
AtomicAssets asset. **Ground truth = `configv3` table on `phgamecreatr` (WAX mainnet) — verified
live by the CEO; this overrides any older source (`pockethatch.hpp`, `SPECIES-DESIGN.md`, prior
spec drafts).** See also [`docs/RARITY-6TIER-SPEC.md`](../../../docs/RARITY-6TIER-SPEC.md) for
the full economy spec.

`configv3` defines **6 tiers** via `egg_type`:

| egg_type | Rarity string (minted) | Supply |
|---|---|---|
| 0 | **Common** | Unlimited |
| 1 | **Uncommon** | Unlimited |
| 2 | **Rare** | Unlimited |
| 3 | **Epic** | capped |
| 4 | **Legendary** | capped |
| 5 | **Mythic** | capped |

This mapping aligns with the live `ACCESSORY_MAP` in the panel. All 6 tiers exist on-chain and
**will** appear on real assets — cards must support all of them.

## Contract & spec (not guessed — read from the repo)

- Card ratio **7:10** → 300 × 432 px, radius 24 (NFT-CARD-DESIGN §2).
- Creature art = the team's real per-species SVGs (`art/species/svg/species/*.svg`), gene-tint capable.
- Creature recolor tokens = `--critter-base / -accent / -pattern / -belly / -eye / -nose / -pattern-opacity`
  + `data-pat` (`creature-template.svg`). Rarity is conveyed by the **frame + aura**, never by creature color.
- Rarity color tokens = NFT-CARD-DESIGN §8 (the tiebreaker doc).

## Rarity color system (frame / aura / glow per tier)

| Tier | Frame gradient | Aura | Extra FX | Icon |
|---|---|---|---|---|
| Common | `#8FD694 → #5BB572 → #4A9E5E` | `rgba(143,214,148,.25)` | flat | `C` |
| Uncommon | `#7ED6D4 → #5BC0BE → #3DA5A3` | `rgba(91,192,190,.28)` | soft glow | `U` |
| Rare | `#8FD0F4 → #5FB8E8 → #3D8FBF` | `rgba(95,184,232,.30)` | outer glow | `R` |
| Epic | `#C89EF0 → #B07BE8 → #8A4FCC` | `rgba(176,123,232,.35)` | inner + outer glow | `E` |
| Legendary | `#FFE8A0 → #FFD86B → #F0B830` | `rgba(255,216,107,.40)` | shimmer glow + 6 sparkles | `L` |
| Mythic | `#FF9FD4 → #C86BFF → #6B9FFF` (prismatic) | `rgba(180,120,255,.45)` | full prismatic shimmer + 10 sparkles + holo shift | `M` |

Rarity is triple-encoded for accessibility: **frame color + tier label text + letter icon**.
Epic/Legendary/Mythic CSS tokens are already in `showcase.html` (Monanisa's original spec).

## Card anatomy

**Front:** rarity icon + card ID · art window (aura + creature + sparkles on Epic/Legendary/Mythic) ·
stage badge · name · species (`sci — element`) · gene strip · POW/CHARM/AGE · rarity footer bar.

**Back:** corner gems · 4-ring mandala · egg brand logo · POCKET HATCHERY · COLLECT·BREED·EVOLVE ·
summary (Species / Element / Rarity / Gene / Collection `phgamecreatr` / Chain) · `egg_type · supply`.

## Deliverables (this folder)

- `tiers-board-front.png` / `tiers-board-back.png` — all 6 tiers side by side (swatch + examples).
- `{common,uncommon,rare,epic,legendary,mythic}-front.png` — one real card face per tier.
- `{common,uncommon,rare,epic,legendary,mythic}-back.png` — matching card backs.

Demo species (art picked to read distinct — swap freely per real asset):
Common = Sproutling · Uncommon = Droplet · Rare = Owlet · Epic = Fernix · Legendary = Dracling · Mythic = _(TBD — assign when art ships)_.

## To mint (hand-off)

The PNG shown on AtomicHub is baked off-chain: `species SVG + gene tint → card front → PNG`
(NFT-CARD-DESIGN §10 pipeline). Front PNG = the asset `img`; back can ride as a second media field.
Re-run: `node art/nft-cards/render-tiers.cjs`.
