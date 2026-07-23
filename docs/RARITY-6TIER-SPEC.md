# RARITY 6-TIER SPEC — Pocket Hatchery

**Author:** Sun (economy design + simulation)  
**Date:** 2026-07-10  
**Status:** DRAFT → CEO review  
**Current state:** 3-tier (Common/Uncommon/Rare), weights 700/250/50, earn_mult ×1.0/×1.1/×1.4, flat 150 EGG/hatch  
**Target:** 6-tier with Mythic aspirational ceiling

---

## 1. Proposed Numbers (CEO Baseline)

| Tier | egg_type | Weight (bp) | % Chance | earn_mult (bp) | × | Daily Cap¹ | fed_dur |
|------|----------|-------------|----------|-----------------|---|-----------|---------|
| Common | 0 | 6900 | 69.00% | 10000 | ×1.0 | 240 | 48h |
| Uncommon | 1 | 2000 | 20.00% | 11000 | ×1.1 | 264 | 72h |
| Rare | 2 | 800 | 8.00% | 14000 | ×1.4 | 336 | 120h |
| Epic | 3 | 250 | 2.50% | 20000 | ×2.0 | 480 | 168h (7d) |
| Legendary | 4 | 45 | 0.45% | 32000 | ×3.2 | 768 | 240h (10d) |
| Mythic | 5 | 5 | 0.05% | 50000 | ×5.0 | 1200 | 336h (14d) |
| **Total** | | **10000** | **100%** | | | | |

¹ `daily_egg_cap (240) × earn_mult / 10000` with `cap_scales_rarity=1`

### CEO's original proposal vs Sun's adjustment

| Parameter | CEO Proposed | Sun Adjusted | Reason |
|-----------|-------------|-------------|--------|
| Legendary earn_mult | ×3.5 (35000) | ×3.2 (32000) | Cap 840→768; gentler top-end slope |
| Mythic earn_mult | ×6.0 (60000) | ×5.0 (50000) | Cap 1440→1200; avoid 10-hatch/day velocity |
| All weights | same | same | Distribution curve is excellent |

---

## 2. Drop Rate Simulation

### 2.1 Geometric Distribution — Expected Hatches to First of Each Tier

| Tier | P(hatch) | E[hatches] = 1/P | E[EGG cost] @150 | Cumulative EGG |
|------|----------|------------------|------------------|----------------|
| Common | 69.00% | **1.4** | 210 | 210 |
| Uncommon | 20.00% | **5** | 750 | 960 |
| Rare | 8.00% | **12.5** | 1,875 | 2,835 |
| Epic | 2.50% | **40** | 6,000 | 8,835 |
| Legendary | 0.45% | **222** | 33,333 | 42,168 |
| Mythic | 0.05% | **2,000** | 300,000 | 342,168 |

### 2.2 "How many hatches to be 90% sure?"

Using cumulative geometric: P(at least 1 in N) = 1 − (1−p)^N ≥ 0.9 → N ≥ ln(0.1) / ln(1−p)

| Tier | p | N for 90% confidence | EGG cost |
|------|---|----------------------|----------|
| Common | 0.69 | 2 | 300 |
| Uncommon | 0.20 | 11 | 1,650 |
| Rare | 0.08 | 28 | 4,200 |
| Epic | 0.025 | 91 | 13,650 |
| Legendary | 0.0045 | 511 | 76,650 |
| Mythic | 0.0005 | 4,605 | 690,750 |

> **Interpretation:** A player who hatches 91 eggs (~13,650 EGG) has a 90% chance of owning at least one Epic. For Mythic, 4,605 hatches (~690K EGG) to reach 90% confidence — this is a genuine long-term chase goal.

### 2.3 Snowball Progression (expected journey from Common start)

Using expected hatches and daily cap at each tier:

| From → To | E[hatches] | Daily Cap at current tier | Days to earn EGG | Cumulative Days |
|------------|-----------|--------------------------|-----------------|-----------------|
| Start → Uncommon | 5 | 240 (Common) | 3.1 | **3** |
| Uncommon → Rare | 12.5 | 264 | 7.1 | **10** |
| Rare → Epic | 40 | 336 | 17.9 | **28** |
| Epic → Legendary | 222 | 480 | 69.4 | **97** |
| Legendary → Mythic | 2,000 | 768 | 390.6 | **488** |

> 🎯 **~1.3 years of daily play to reach Mythic.** Long enough to be genuinely aspirational, not so long it's impossible. A lucky player (90th percentile on any tier) cuts this roughly in half.

---

## 3. Balance Check — Flat 150 EGG Cost

### 3.1 Is flat hatch cost still balanced?

**Yes.** RNG gating replaces cost gating. With the old system (cost_mult = 1/3/10), a Rare hatch cost 1,500 EGG. Now it costs 150 — but you only get a Rare 8% of the time, spending 1,875 EGG on average to find one. The expected cost is actually HIGHER (1,875 vs 1,500), but smoothed across many hatches rather than concentrated in one expensive roll.

**Player psychology:** 12 failed Common hatches at 150 each (1,800 EGG) → then a Rare on the 13th feels better than one 1,500 EGG gamble. More hatches = more dopamine hits = better retention.

### 3.2 Does ×5.0 Mythic earn_mult break the economy?

**No, with caps.** A Mythic at stage 1 earns 500 EGG/hr at full satiety. The daily cap of 1,200 means it hits cap in 2.4 hours. The cap is the bottleneck, not the earn rate.

| Metric | Common (stage 1) | Mythic (stage 1) | Ratio |
|--------|-----------------|-------------------|-------|
| Earn/hr (full) | 100 | 500 | 5× |
| Daily cap | 240 | 1,200 | 5× |
| Time to hit cap | 2.4h | 2.4h | 1× |
| Feed cost/day | 6.0 | 0.86 | 0.14× |
| Net EGG/day | 234 | 1,199 | 5.1× |
| Hatches/day from surplus | 1.6 | 8.0 | 5× |

**The 8 hatches/day ceiling** means a Mythic owner can generate substantial EGG, but:
- Egg slot limit (3 free + expensive unlocks) caps active creature count
- Each additional creature costs 12 EGG/feed (amortized: 6 EGG/day for Common, less for higher tiers)
- Evolve costs (300-1,800 EGG) are meaningful EGG sinks
- The real bottleneck for progression is **time** (growth, evolve thresholds, breed cooldowns), not EGG

### 3.3 EGG sinks vs faucet balance

| Faucet (daily) | Max EGG | Sink (occasional) | EGG Cost |
|----------------|---------|-------------------|----------|
| Harvest (Common) | 240 | Hatch | 150 |
| Harvest (Epic) | 480 | Evolve (stage 1→5) | 300-1,800 |
| Harvest (Mythic) | 1,200 | Feed (per creature) | 12 |
| | | Slot unlock (4th-6th) | 500-2,500 |
| | | Cosmetic reroll | 100 |

At Mythic tier: 1,200 EGG/day. Daily hatch: 8 eggs (1,200 EGG). After 30 days: 240 hatches, ~1 Legendary expected. The player has 30+ creatures to manage — slot limits + feed costs naturally throttle.

---

## 4. Code Changes Required

### 4.1 configv3 struct (`pockethatch.hpp`)

Add 9 new fields (3 per new tier × 3 categories):

```cpp
// ── Extended to 6 tiers ──
uint16_t    rarity_w_epic       = 250;   // 2.5%
uint16_t    rarity_w_legendary  = 45;    // 0.45%
uint16_t    rarity_w_mythic     = 5;     // 0.05%

uint16_t    earn_mult_epic      = 20000; // ×2.0
uint16_t    earn_mult_legendary = 32000; // ×3.2
uint16_t    earn_mult_mythic    = 50000; // ×5.0

uint32_t    fed_dur_epic        = 604800;  // 7 days
uint32_t    fed_dur_legendary   = 864000;  // 10 days
uint32_t    fed_dur_mythic      = 1209600; // 14 days
```

### 4.2 roll_egg_type() (`pockethatch.cpp:206-216`)

Extend from 3 if/else to 6:

```cpp
uint64_t total = (uint64_t)cfg.rarity_w_common + cfg.rarity_w_uncommon
               + cfg.rarity_w_rare + cfg.rarity_w_epic
               + cfg.rarity_w_legendary + cfg.rarity_w_mythic;
uint64_t roll = make_seed() % total;
uint64_t cum = 0;
cum += cfg.rarity_w_common;    if (roll < cum) return 0;
cum += cfg.rarity_w_uncommon;  if (roll < cum) return 1;
cum += cfg.rarity_w_rare;      if (roll < cum) return 2;
cum += cfg.rarity_w_epic;      if (roll < cum) return 3;
cum += cfg.rarity_w_legendary; if (roll < cum) return 4;
return 5; // mythic
```

### 4.3 fed_duration_for() (`pockethatch.cpp:94-100`)

Add cases 3/4/5:

```cpp
case 3: return cfg.fed_dur_epic;
case 4: return cfg.fed_dur_legendary;
case 5: return cfg.fed_dur_mythic;
```

### 4.4 earn_mult_for() (`pockethatch.cpp:103-109`)

Add cases 3/4/5:

```cpp
case 3: return cfg.earn_mult_epic;
case 4: return cfg.earn_mult_legendary;
case 5: return cfg.earn_mult_mythic;
```

### 4.5 Frontend: satiety.ts

Update `RARITY_EARN_MULT` and `FED_DUR_DEFAULT` with 6 entries:

```ts
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export const RARITY_EARN_MULT: Record<Rarity, number> = {
  common: 1.0, uncommon: 1.1, rare: 1.4,
  epic: 2.0, legendary: 3.2, mythic: 5.0,
}

export const FED_DUR_DEFAULT: Record<Rarity, number> = {
  common: 48*3600, uncommon: 72*3600, rare: 120*3600,
  epic: 168*3600, legendary: 240*3600, mythic: 336*3600,
}
```

### 4.6 speciescfg entries

New species for Epic/Legendary/Mythic tiers (egg_type 3/4/5). Per `species-config.json` design: flat yields per family, rarity premium from earn_mult only.

---

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Mythic earn ×5.0 floods EGG | Low | Daily cap (1,200) + slot limits + feed/evolve sinks |
| Rich-get-richer snowball | Low | 488-day expected journey; cap is per-player, not per-creature |
| roll_egg_type() needs uint64 for total | None | 10000 bp × 10 = 100,000 fits in uint64_t |
| New fed_dur fields overflow uint32 | None | 14 days = 1,209,600s < 2^32 (~136 years) |
| Frontend Rarity type narrowing | Medium | CreatureCard.tsx, geneDecoder.ts, satiety.ts all need `'epic'|'legendary'|'mythic'` |
| speciescfg egg_type already uint64 | None | Values 0-5 fit. No migration needed for existing species. |

---

## 6. Migration Path (phgamecreatr)

1. **Deploy updated contract** with extended `configv3`, `roll_egg_type`, `fed_duration_for`, `earn_mult_for`
2. **setconfig** with new 6-tier weights + earn_mults + fed_durs
3. **setspecies** for Epic/Legendary/Mythic species (egg_type 3/4/5) — need AA template IDs
4. **Frontend deploy** with updated satiety.ts + Rarity type
5. Existing creatures (egg_type 0/1/2) continue to work — new fields only affect new hatches

---

## 7. CEO Decision Checklist

- [ ] **Weights:** Approve 6900/2000/800/250/45/5?
- [ ] **Earn multipliers:** Approve ×1.0/×1.1/×1.4/×2.0/×3.2/×5.0? (or stick with CEO's ×3.5/×6.0?)
- [ ] **fed_dur for new tiers:** Approve 7d/10d/14d?
- [ ] **Flat 150 EGG hatch cost:** Keep as-is? (RNG gates rarity, not cost)
- [ ] **species creation:** Who designs Epic/Legendary/Mythic species? (template_ids, names, art)
- [ ] **Deploy order:** Contract update → setconfig → setspecies → frontend?
- [ ] **Backward compat:** Existing 3-tier creatures stay as-is? (egg_type 0/1/2 unchanged)

---

## 8. Sun's Recommendation

> **Approve baseline with adjusted earn_mults (×3.2/×5.0).**

CEO's original ×3.5/×6.0 isn't broken — the math works either way. But ×3.2/×5.0 creates a smoother curve at the top end and keeps Mythic at 8 hatches/day instead of 10, which feels better for long-term content pacing.

ถ้าอยากเก็บ ×6.0 ไว้เพื่อ "wow factor" — ลดน้ำหนัก Mythic จาก 5 เป็น 3 (1 ใน 3,333 → E[cost] = 500K EGG). ของหายากขึ้นแต่ reward แรงขึ้น = fair trade.

The single most important thing: **rarity must FEEL rare.** With these weights, Mythic is genuinely 1-in-2,000 — a player needs ~1.3 years of daily play. That's a real achievement. Don't dilute it.

---

*Spec v1.0 — pending CEO approval. No code changes made.*
