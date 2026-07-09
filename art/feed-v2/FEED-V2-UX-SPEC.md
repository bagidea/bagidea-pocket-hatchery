# 🍽️ Feed v2 — Satiety UX spec (design → dev handoff)

> Flamingo (Designer) · 2026-07-09 · **DESIGN ONLY** — no contract change, no deploy.
> Builds ON the live v0.2.0 panel: `web/src/components/SatietyMeter.tsx`, `web/src/satiety.ts`,
> `web/src/styles/tokens.css`. Ground truth = `docs/FEED-ECONOMY-V2.md` (Kevin) + `satiety.ts`.
> Render: `node art/feed-v2/render.cjs` → `board-states.png`, `board-rarity.png`.

## What this design adds over the current build
The satiety bar + 3 states + earn-throttle already ship. This spec closes the 4 gaps CEO asked for
that the live `SatietyMeter` does **not** yet surface:

1. **Refill countdown** — a line under the bar: "🕒 เติมภายใน ~X ชม. ก่อนหยุดโต". The value already
   exists in `SatietyReading.secondsToEmpty` / `secondsToNextTier` — just render it (`fmt()` is in
   the component). Full→shows time to empty; Hungry→time to starving; Starving→urgent "เติมด่วนภายใน ~Xh".
2. **Growth state chip** — explicit: Full=`🌱 โตปกติ` · Hungry=`🐢 โตช้าลง (earn 50%)` · Starving=
   `⏸ โตหยุด · evolve ล็อก`. Maps to the contract's evolve gate `check(now < fed_until, …)`.
3. **Feed cost on button** — `🍎 Feed · 12 EGG` (from `FEED-ECONOMY-V2` `feed_cost`). Current build
   hard-codes "Free"; sync when economy v2 deploys.
4. **Rarity trade-off panel** — a per-tier card: `fed_dur` → cadence chip + two inverse gauges
   (feed-frequency ↓ vs earn-rate →) + `×mult`. Lets a player read the "rarer = less care, more HATCH" deal.

## Satiety states (unchanged from satiety.ts — 3 states)
`satiety% = clamp((last_fed + fed_dur − now) / fed_dur, 0, 1) × 100`

| State | % band | Bar | Growth | Earn factor |
|---|---|---|---|---|
| อิ่ม (full) | ≥60 | green `#22c55e→#16a34a` | ปกติ | ×1.0 |
| เริ่มหิว (hungry) | 25–60 | amber `#fbbf24→#f59e0b` | ช้าลง | ×0.5 |
| หิวจัด (starving) | <25 | red `#f87171→#ef4444`, ปุ่ม pulse | หยุด + evolve ล็อก | ×0.1 |

## Rarity trade-off (3 on-chain tiers — egg_type 0/1/2)
| Tier | fed_dur | Cadence | earn_mult |
|---|---|---|---|
| Common | 48h | เติม ~ทุกวัน | ×1.00 |
| Uncommon | 72h | เติม ~ทุก 3 วัน | ×1.10 |
| Rare | 120h | เติม ~ทุก 5 วัน | ×1.40 |

## ⚑ Reconcile-pending (wait for Kevin before wiring real)
- **earn_mult** — board uses verified ×1.0/1.1/1.4 (`satiety.ts`, 2026-07-09). `FEED-ECONOMY-V2` still
  lists ×1.5/2.5 as mock. Awaiting Kevin's final numbers. Layout is value-agnostic.
- **feed cost** — 12 EGG (FEED-ECONOMY-V2); not yet deployed. Button copy flips from "Free" on deploy.
- **tier count** — chain has 3 rarities; the NFT card set has 4 (adds Legendary). `rarCol()` /
  `RARITY` map accept N tiers — add a `legendary` entry when/if egg_type 3 gets feed config.
- **fed_dur** — 48/72/120h are spec defaults; `configv3.fed_dur_*` overrides automatically once live
  (`fedDurFor()` already threads chain > default).
