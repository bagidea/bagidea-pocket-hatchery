# 🧬 Pocket Hatchery — Species Design v1

> 12 species across 6 elemental families for the `phgamecreatr` WAX testnet deployment.
> All numbers designed for testnet fast-testing: fast growth, visible evolution in minutes.
> For mainnet, scale `growth_rate` down 10–100× and `thresh_*` up proportionally.

---

## Design Principles

1. **6 elemental families** — Fire 🔥, Water 💧, Earth 🪨, Air 🌪️, Spirit ✨, Shadow 🌑
2. **4 rarity tiers** via `egg_type` — Common (0), Uncommon (1), Rare (2), Legendary (3)
3. **Balanced yield curve** — slower growers yield more EGG at max stage (risk/reward)
4. **Distinct silhouettes** — each family has unique visual identity per ART.md
5. **Collection incentive** — families have 2–3 members, encourage breeding within/between families

---

## Growth & Yield Math (reference)

```
Growth per second = growth_rate
Stage N reached when: cumulative_growth ≥ thresh_N
EGG per hour = yield_N / 10000  (yield stored ×10⁴ for integer precision)

Example (Emberling, growth_rate=1000):
  Stage 0→1 (Baby):  1000/1000  = ~1 sec
  Stage 1→2 (Adult): 5000/1000  = ~5 sec
  Stage 2→3 (Rare):  20000/1000 = ~20 sec
  Stage 3→4 (Elder): 100000/1000 = ~100 sec
```

---

## ⚠️ READ FIRST — Template Creation Required

**The `phgamecreatr` collection currently has only 1 template: `662889` (Emberling).**
Before `setspecies` can register the other 11 species, their AtomicAssets templates
must be created. The flow is:

1. **Create templates** → `push action atomicassets createtempl` × 11
2. **Read assigned IDs** → `get table atomicassets phgamecreatr templates`
3. **Fill template_ids** → replace `"<ASSIGNED>"` in `species-config.json`
4. **Register species** → `push action phgamecreatr setspecies` × 11
5. **Verify on chain** → `get table phgamecreatr phgamecreatr speciescfg`

The `egg_type` field groups species into hatch pools. When a player calls `hatch(owner, egg_type)`,
the contract RNG-picks a species from that pool weighted by `egg_weight`.
The boss controls `egg_type` availability — e.g. free eggs = type 0 only, premium eggs = type 1–3.

---

## The 12 Species

### 🔥 Family: FIRE — aggressive, fast growth, moderate yield

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 1 | **Emberling** | 0 | 1000 | 1000 | 5000 | 20000 | 100000 | 100 | 300 | 600 | 1200 | 2400 | 5 | 100 | **662889** ✅ |
| 2 | **Blazetail** | 1 | 900 | 1500 | 7000 | 28000 | 120000 | 110 | 330 | 660 | 1320 | 2600 | 5 | 65 | `<ASSIGNED>` |
| 3 | **Drakember** | 2 | 700 | 2500 | 12000 | 45000 | 160000 | 140 | 420 | 840 | 1680 | 3300 | 5 | 22 | `<ASSIGNED>` |

### 💧 Family: WATER — balanced, higher yield

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 4 | **Aquaring** | 0 | 800 | 1200 | 6000 | 24000 | 110000 | 120 | 350 | 700 | 1400 | 2800 | 5 | 100 | `<ASSIGNED>` |
| 5 | **Tidalfin** | 1 | 700 | 1800 | 9000 | 36000 | 140000 | 130 | 380 | 760 | 1520 | 3000 | 5 | 65 | `<ASSIGNED>` |
| 6 | **Leviathorn** | 2 | 500 | 3500 | 16000 | 60000 | 220000 | 160 | 480 | 960 | 1900 | 3800 | 5 | 22 | `<ASSIGNED>` |

### 🪨 Family: EARTH — slow growth, massive top-end yield

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 7 | **Terrabud** | 0 | 500 | 2000 | 10000 | 40000 | 150000 | 80 | 250 | 500 | 1000 | 2000 | 5 | 100 | `<ASSIGNED>` |
| 8 | **Mossback** | 1 | 450 | 2500 | 12000 | 48000 | 170000 | 90 | 280 | 560 | 1120 | 2200 | 5 | 65 | `<ASSIGNED>` |

### 🌪️ Family: AIR — fastest growth, lower individual yield but high throughput

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 9 | **Zephyrling** | 0 | 1200 | 800 | 4000 | 16000 | 80000 | 90 | 270 | 540 | 1080 | 2200 | 5 | 100 | `<ASSIGNED>` |
| 10 | **Stormwing** | 1 | 1000 | 1200 | 6000 | 24000 | 100000 | 100 | 300 | 600 | 1200 | 2400 | 5 | 65 | `<ASSIGNED>` |

### ✨ Family: SPIRIT — rare, premium yield, magical

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 11 | **Wispember** | 2 | 600 | 3000 | 15000 | 60000 | 200000 | 150 | 450 | 900 | 1800 | 3600 | 5 | 30 | `<ASSIGNED>` |

### 🌑 Family: SHADOW — legendary, apex yield, hardest to obtain

| # | Name | egg_type | growth | thresh_1 | thresh_2 | thresh_3 | thresh_4 | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | stage | weight | template_id |
|---|------|----------|--------|----------|----------|----------|----------|---------|---------|---------|---------|---------|-------|--------|-------------|
| 12 | **Nyxling** | 3 | 400 | 5000 | 25000 | 100000 | 300000 | 200 | 600 | 1200 | 2400 | 5000 | 5 | 8 | `<ASSIGNED>` |

---

## Probability Distribution

### egg_type=0 pool (Common) — total weight 400
Each species 100/400 = **25%** chance when hatching a common egg.

| Species | Weight | % |
|---------|--------|---|
| Emberling 🔥 | 100 | 25.0 |
| Aquaring 💧 | 100 | 25.0 |
| Terrabud 🪨 | 100 | 25.0 |
| Zephyrling 🌪️ | 100 | 25.0 |

### egg_type=1 pool (Uncommon) — total weight 260

| Species | Weight | % |
|---------|--------|---|
| Blazetail 🔥 | 65 | 25.0 |
| Tidalfin 💧 | 65 | 25.0 |
| Mossback 🪨 | 65 | 25.0 |
| Stormwing 🌪️ | 65 | 25.0 |

### egg_type=2 pool (Rare) — total weight 74

| Species | Weight | % |
|---------|--------|---|
| Drakember 🔥 | 22 | 29.7 |
| Leviathorn 💧 | 22 | 29.7 |
| Wispember ✨ | 30 | 40.5 |

### egg_type=3 pool (Legendary) — total weight 8

| Species | Weight | % |
|---------|--------|---|
| Nyxling 🌑 | 8 | 100.0 |

---

## Economy Balance Summary

| Metric | Common (×4) | Uncommon (×4) | Rare (×3) | Legendary (×1) |
|--------|-------------|---------------|-----------|----------------|
| Avg growth_rate | 875 | 763 | 600 | 400 |
| Avg max yield (stage 4) | 2350 | 2550 | 3567 | 5000 |
| Time to stage 4 (avg sec) | ~170s | ~210s | ~330s | ~750s |
| EGG/hr at stage 4 | 0.24 | 0.26 | 0.36 | 0.50 |

**Balance check:** Slower growers produce 50–100% more EGG at max stage, rewarding patience.
Common species are "workhorses" (fast, reliable, moderate yield); Legendary is the "crown jewel" (slow, rare, apex yield).

---

## Mainnet Scaling Guide

For mainnet, multiply all `thresh_*` by **60** and all `yield_*` by **10**:
- Stage 1: ~1 minute (was 1 sec on testnet)
- Stage 4: ~2 hours (was ~100 sec on testnet)
- Keep `growth_rate` and `egg_weight` the same.

---

*Prepared by Kevin · 2026-07-03*
