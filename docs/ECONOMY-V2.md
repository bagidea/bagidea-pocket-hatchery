# ECONOMY V2 — Pocket Hatchery 🔒 LOCKED

**Author:** Sun (economy design)  
**Date:** 2026-07-15  
**Status:** 🔒 **CEO-LOCKED** — Single source of truth สำหรับ Kevin เขียนโค้ด  
**Depends on:** `RARITY-6TIER-SPEC.md` (approved), `ECONOMY-AUDIT.md` (double-count finding)  
**Covers:** 6 mechanisms — Awaken · WAX-wake · Satiety/Feed · Harvest Fix · HATCH Scarcity · Recycle/Burn

---

## 0. CEO-LOCKED NUMBERS — Single Source of Truth

### 0.1 Master Table: All Rarities × All Mechanisms

| Mechanism | Common (0) | Uncommon (1) | Rare (2) | Epic (3) | Legendary (4) | Mythic (5) |
|-----------|-----------|-------------|---------|---------|-------------|----------|
| **Weight (bp)** | 6900 | 2000 | 800 | 250 | 45 | 5 |
| **Drop chance** | 69% | 20% | 8% | 2.5% | 0.45% | 0.05% |
| **E[hatches]** | 1.4 | 5 | 12.5 | 40 | 222 | 2,000 |
| **earn_mult (bp)** | 10000 | 11000 | 14000 | 18000 | 24000 | 33000 |
| **earn_mult (×)** | ×1.0 | ×1.1 | ×1.4 | ×1.8 | ×2.4 | ×3.3 |
| **Daily EGG cap¹** | 240 | 264 | 336 | 432 | 576 | 792 |
| **Earn/hr stage1²** | 100 | 110 | 140 | 180 | 240 | 330 |
| **Hatches/day³** | 1.6 | 1.8 | 2.2 | 2.9 | 3.8 | 5.3 |
| **fed_dur (s)** | 172800 | 259200 | 432000 | 604800 | 864000 | 1209600 |
| **fed_dur (human)** | 48h | 72h | 120h | 7d | 10d | 14d |
| **Feeds/week** | 3.5 | 2.3 | 1.4 | 1.0 | 0.7 | 0.5 |
| **Awaken (s)** | 3600 | 5400 | 7200 | 9000 | 10800 | 10800 |
| **Awaken (human)** | 1h | 1.5h | 2h | 2.5h | 3h | 3h |
| **WAX wake** | 3 | 5 | 10 | 20 | 40 | 80 |
| **Burn EGG⁴** | 8 | 12 | 16 | 21 | 26 | 30 |
| **Burn HATCH⁵** | 2–100 | 6–300 | 20–1,000 | 50–2,500 | 120–6,000 | 300–15,000 |

¹ `daily_egg_cap (240) × earn_mult / 10000` via `cap_scales_rarity=1`  
² At stage 1, full satiety, with species yield flattened to 100  
³ Net EGG/day ÷ 150 (feed_cost=0). Limited by 3–6 creature slots  
⁴ Flat EGG refund on burn, per rarity (independent of stage)  
⁵ Range: stage 0 → stage 5. Formula: `burn_base_hatch(10) × stage_mul/10 × rarity_mul/10`

### 0.2 Config Baseline — Contract Defaults + v2 Overrides

> ⚠️ **Read this before coding.** "Contract default" = value in `pockethatch.hpp` C++ default (verified on-chain for phgamecreatr). "v2 target" = CEO-locked value for v2 — must be applied via `setconfig` after code deploy. Fields marked ⚡ need `setconfig` to change from their contract default.

| configv3 field | Contract default (live) | v2 Target (CEO locked) | ⚡? | Notes |
|---------------|------------------------|------------------------|-----|-------|
| `hatch_cost` | 150 | 150 | | Flat, no rarity multiplier |
| `evolve_cost` | 300 | 300 | | ⚠️ จะเลิกใช้ (evolve redesign TBD) |
| `breed_cost` | 5.0000 HATCH | 5.0000 HATCH | | 40% burn, 60% → pool |
| `daily_egg_cap` | 240 | 240 | | Scales with rarity via `cap_scales_rarity` |
| `offline_cap_h` | 8 | 8 | | Max EGG accrual while offline |
| `feed_cd` | 21600 (6h) | 21600 | | Per-creature cooldown |
| `harvest_cd` | 3600 (1h) | 3600 | | Per-player cooldown |
| `breed_cd` | 86400 (24h) | 86400 | | Per-parent cooldown |
| `feed_daily_cap` | 3 | 3 | | Max feeds/creature/day |
| `feed_cost` | 12 | **0** | ⚡ | CEO: free feeding |
| `feed_boost` | 100 | 100 | | Growth per feed |
| `tap_egg_cap` | 60 | 60 | | |
| `cap_scales_rarity` | 1 | 1 | | Cap × best owned earn_mult/10000 |
| `burn_base_hatch` | 10.0000 HATCH | 10.0000 HATCH | | CEO: เล่นใหญ่ — keep as-is |
| `rarity_w_common` | 700 | **6900** | ⚡ | v2: 6-tier distribution |
| `rarity_w_uncommon` | 250 | **2000** | ⚡ | |
| `rarity_w_rare` | 50 | **800** | ⚡ | |
| `fed_dur_common` | 172800 | 172800 | | 48h |
| `fed_dur_uncommon` | 259200 | 259200 | | 72h |
| `fed_dur_rare` | 432000 | 432000 | | 120h |
| `earn_mult_common` | 10000 | 10000 | | ×1.0 |
| `earn_mult_uncommon` | 11000 | 11000 | | ×1.1 |
| `earn_mult_rare` | 14000 | 14000 | | ×1.4 |

> ⚡ = Needs `setconfig` after code deploy to change from contract default.  
> Fields without ⚡ are already at target value in the current contract — no action needed.  
> `rarity_w_epic/legendary/mythic` are new fields in §0.3 — code deploy required first, then `setconfig`.

### 0.3 New configv3 Fields (ต้องเพิ่ม — code deploy required)

| New field | Type | Default | Notes |
|-----------|------|---------|-------|
| `rarity_w_epic` | uint16_t | 250 | §0.1 |
| `rarity_w_legendary` | uint16_t | 45 | |
| `rarity_w_mythic` | uint16_t | 5 | |
| `earn_mult_epic` | uint16_t | 18000 | ×1.8 |
| `earn_mult_legendary` | uint16_t | 24000 | ×2.4 |
| `earn_mult_mythic` | uint16_t | 33000 | ×3.3 |
| `fed_dur_epic` | uint32_t | 604800 | 7d |
| `fed_dur_legendary` | uint32_t | 864000 | 10d |
| `fed_dur_mythic` | uint32_t | 1209600 | 14d |
| `awaken_dur_common` | uint32_t | 3600 | 1h |
| `awaken_dur_uncommon` | uint32_t | 5400 | 1.5h |
| `awaken_dur_rare` | uint32_t | 7200 | 2h |
| `awaken_dur_epic` | uint32_t | 9000 | 2.5h |
| `awaken_dur_legendary` | uint32_t | 10800 | 3h |
| `awaken_dur_mythic` | uint32_t | 10800 | 3h |
| `wax_contract` | name | `"eosio.token"_n` | WAX token contract |
| `wake_cost_common` | asset | `3.00000000 WAX` | |
| `wake_cost_uncommon` | asset | `5.00000000 WAX` | |
| `wake_cost_rare` | asset | `10.00000000 WAX` | |
| `wake_cost_epic` | asset | `20.00000000 WAX` | |
| `wake_cost_legendary` | asset | `40.00000000 WAX` | |
| `wake_cost_mythic` | asset | `80.00000000 WAX` | |
| `burn_egg_common` | uint64_t | 8 | Flat EGG refund |
| `burn_egg_uncommon` | uint64_t | 12 | |
| `burn_egg_rare` | uint64_t | 16 | |
| `burn_egg_epic` | uint64_t | 21 | |
| `burn_egg_legendary` | uint64_t | 26 | |
| `burn_egg_mythic` | uint64_t | 30 | |

**Total new configv3 fields:** 3 (rarity_w: ep/leg/myt) + 3 (earn_mult) + 3 (fed_dur) + 6 (awaken_dur) + 1 (wax_contract) + 6 (wake_cost) + 6 (burn_egg) = **28 new fields**

### 0.4 setconfig ✅ vs Code Deploy 🔧 Summary

| What | How | Fields |
|------|-----|--------|
| ✅ **setconfig** — ล็อกเลขได้เลย | Existing `setconfig` action | All fields in §0.2 + §0.3 |
| ✅ **setspecies** — flatten yields | Existing `setspecies` action | All species: yield_* = 100/300/600/1200/2400 |
| 🔧 **Code deploy** — required | New contract binary | `roll_egg_type()` 3→6 tiers, `fed_duration_for()` 3→6 cases, `earn_mult_for()` 3→6 cases, `awaken_duration_for()` new helper, `on_wax_transfer()` new notify handler, `harvest()` auto-awaken, `claimreward()` satiety gate + revised payouts, `burncreature()` EGG refund per-rarity |
| 🔧 **Frontend deploy** | New web build | `satiety.ts` RARITY_EARN_MULT update, CreatureCard awaken timer UI |

---

## Overview

This spec designs 6 economy mechanisms for Pocket Hatchery v2 on the 6-tier rarity foundation already approved in `RARITY-6TIER-SPEC.md`. Numbers are anchored to the existing on-chain code (`pockethatch.cpp`, `pockethatch.hpp`), the double-count bug found in `ECONOMY-AUDIT.md`, and the approved rarity distribution:

| Tier | egg_type | Weight (bp) | earn_mult | Daily Cap¹ | fed_dur |
|------|----------|-------------|-----------|------------|---------|
| Common | 0 | 6900 (69%) | ×1.0 | 240 | 48h |
| Uncommon | 1 | 2000 (20%) | ×1.1 | 264 | 72h |
| Rare | 2 | 800 (8%) | ×1.4 | 336 | 120h |
| Epic | 3 | 250 (2.5%) | ×1.8 | 432 | 168h (7d) |
| Legendary | 4 | 45 (0.45%) | ×2.4 | 576 | 240h (10d) |
| Mythic | 5 | 5 (0.05%) | ×3.3 | 792 | 336h (14d) |
| Hatch cost | — | — | — | **150 EGG** (flat) | — |

¹ `daily_egg_cap (240) × earn_mult / 10000` via `cap_scales_rarity=1`

> 🔒 **CEO locked.** earn_mult: 10000/11000/14000/18000/24000/33000 (basis points). All numbers in §0 are authoritative.

---

## 1. Awaken Timer (ฟัก → ตื่น → earn ได้)

### 1.1 Concept

เมื่อฟักไข่ (hatch) → ได้ creature stage 0 (ทารก / ยังไม่ตื่น) — ยัง earn EGG ไม่ได้  
ต้องรอ awaken timer หมด → stage เปลี่ยนเป็น 1 (Hatchling) → พร้อม earn

**ทำไมต้องมี:**  
- ป้องกัน spam-hatch-then-harvest — ถ้าฟักแล้ว earn ได้ทันที คนจะฟักไข่เรื่อยๆ harvest ทันที
- สร้าง anticipation — "ไข่กำลังจะฟัก!" = emotional hook
- ให้ WAX-wake มีความหมาย (mechanism 2)

### 1.2 Duration per Rarity

| Rarity | Awaken Time | ชม. | เหตุผล |
|--------|------------|-----|--------|
| Common | 3,600s | 1h | เร็ว — ให้ผู้เล่นใหม่เห็นผลไว |
| Uncommon | 5,400s | 1.5h | |
| Rare | 7,200s | 2h | |
| Epic | 9,000s | 2.5h | anticipation สะสม |
| Legendary | 10,800s | 3h | |
| Mythic | 10,800s | 3h | cap ที่ 3h — ไม่ให้นานเกินหงุดหงิด |

> **Rarity สูงตื่นช้ากว่า** — สร้างความคาดหวัง ("ไข่นาน = ของดี") แต่ cap ที่ 3 ชม. ไม่ให้นานเกินจนผู้เล่นลืม

### 1.3 Implementation

**New config fields** (`configv3` in `pockethatch.hpp`):
```cpp
uint32_t awaken_dur_common    = 3600;    // 1h
uint32_t awaken_dur_uncommon  = 5400;    // 1.5h
uint32_t awaken_dur_rare      = 7200;    // 2h
uint32_t awaken_dur_epic      = 9000;    // 2.5h
uint32_t awaken_dur_legendary = 10800;   // 3h
uint32_t awaken_dur_mythic    = 10800;   // 3h
```

**How it works in code:**
1. `hatch()` → sets `creature.stage = 0`, `creature.born_at = now`
2. `harvest()` already skips stage 0 (`if (it->stage == 0) continue;` at line 570) — no code change needed
3. A new private helper or check in evolve/awaken: when `now >= born_at + awaken_dur_for(egg_type)` → stage 0→1 is permitted
4. Transition can be **automatic on next harvest** (stage auto-flips to 1 when timer elapsed) or **manual via `awaken` action** (player calls awaken, contract checks timer)

**Recommendation:** Automatic transition on harvest — simplest UX. Player just harvests normally; stage 0 creatures that have finished their timer auto-become stage 1 and start earning.

### 1.4 Awaken helper (new):
```cpp
uint32_t awaken_duration_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.awaken_dur_uncommon;
        case 2:  return cfg.awaken_dur_rare;
        case 3:  return cfg.awaken_dur_epic;
        case 4:  return cfg.awaken_dur_legendary;
        case 5:  return cfg.awaken_dur_mythic;
        default: return cfg.awaken_dur_common;
    }
}
```

In `harvest()` loop, add before the `if (it->stage == 0) continue;`:
```cpp
// Auto-awaken: stage 0 → 1 when timer has elapsed
if (it->stage == 0) {
    auto sp = sps.find(it->template_id);
    uint32_t awaken_dur = awaken_duration_for(cfg, sp != sps.end() ? sp->egg_type : 0);
    if (now >= it->born_at + awaken_dur) {
        crs.modify(it, same_payer, [&](auto& r) { r.stage = 1; });
        // creature now earns (will be processed in this same harvest since stage=1 now)
    } else {
        continue; // still sleeping — skip
    }
}
```

> ⚠️ **Edge case:** The `cr.modify(it, ...)` inside the loop modifies the table being iterated, but since we only change the `stage` field (not the index key), EOSIO multi_index iterators remain valid. Safe.

---

## 2. Pay-WAX-to-Wake-Now (ปลุกทันทีด้วย WAX)

### 2.1 Concept

ผู้เล่นจ่าย WAX เพื่อข้าม awaken timer — creature stage 0 → 1 ทันที  
รายได้ WAX เข้า `fee_account` (dev revenue) — ไม่ใช่ reward pool

**ทำไมต้อง WAX ไม่ใช่ EGG:**
- WAX = real value → monetization channel
- EGG = in-game soft currency → ปลุกฟรีด้วย EGG ทำให้ awaken timer ไร้ความหมาย
- WAX fee ป้องกัน spam-wake

### 2.2 Pricing Table

| Rarity | WAX Cost | เวลาที่เซฟ | WAX/ชม. | เหตุผล |
|--------|---------|-----------|---------|--------|
| Common | 3 WAX | 1h | 3.0 | คุ้มสุดสำหรับ impatient |
| Uncommon | 5 WAX | 1.5h | 3.3 | |
| Rare | 10 WAX | 2h | 5.0 | |
| Epic | 20 WAX | 2.5h | 8.0 | premium เรื่มรู้สึก |
| Legendary | 40 WAX | 3h | 13.3 | ของหายาก → ยอมจ่าย |
| Mythic | 80 WAX | 3h | 26.7 | luxury convenience |

> **WAX reference:** WAX ≈ $0.03–0.05. Mythic wake = 80 WAX ≈ $2.40–4.00.  
> **ไม่ใช่ whale trap** — เป็น convenience fee. คนไข่ Common จ่ายแค่ 3 WAX ($0.09).  
> **ถ้า CEO อยากให้สูงกว่านี้** → ×2 ทุก tier (Common 6 → Mythic 160) ก็สมเหตุสมผล

### 2.3 Implementation: `on_notify("eosio.token::transfer")`

**Pattern:** Player sends WAX to contract via standard `eosio.token::transfer` with memo `"wake:<asset_id>"`. Contract's notification handler processes the wake.  
**Why not inline transfer:** `require_auth(owner)` on `pockethatch::wake` grants authority over the contract's own actions — NOT the player's token balance. EOSIO/WAX cannot do an inline transfer FROM the player. The standard pattern (used by AtomicAssets, AtomicMarket, and Kevin's own `breed` action) is: player pushes `eosio.token::transfer` → contract receives `on_notify`.

**Flow:**
```
Player wallet
  │  eosio.token::transfer(from=player, to=pockethatch, quantity="80.00000000 WAX", memo="wake:12345")
  ▼
eosio.token contract
  │  inline notify → pockethatch
  ▼
pockethatch::on_wax_transfer(from, to, quantity, memo)
  │  parse memo → "wake:<asset_id>"
  │  validate: creature exists, stage==0, owner==from, now < born_at+awaken_dur
  │  validate: quantity >= wake_cost_for(rarity)
  │  if overpaid → refund excess? (or accept as tip)
  │  set creature.stage = 1
  │  forward WAX to fee_account (inline transfer: pockethatch → fee_account)
  ▼
Done — creature now earning
```

**Code skeleton:**
```cpp
[[eosio::on_notify("eosio.token::transfer")]]
void on_wax_transfer(name from, name to, asset quantity, std::string memo) {
    // 1. Ignore outgoing transfers and non-WAX tokens
    if (to != get_self()) return;
    if (quantity.symbol != symbol("WAX", 8)) return;
    
    // 2. Parse memo — expect "wake:<asset_id>"
    if (memo.rfind("wake:", 0) != 0) return; // not a wake — ignore
    uint64_t asset_id = std::stoull(memo.substr(5));
    
    // 3. Validate creature
    creatures_t crs(get_self(), get_self().value);
    auto it = crs.find(asset_id);
    check(it != crs.end(), "creature not found");
    check(it->owner == from, "not your creature");
    check(it->stage == 0, "already awake");
    
    // 4. Check timer (don't charge if already elapsed — just let them harvest)
    config_row cfg = _cfg();
    species_t sps(get_self(), get_self().value);
    auto sp = sps.find(it->template_id);
    uint32_t awaken_dur = awaken_duration_for(cfg, sp != sps.end() ? sp->egg_type : 0);
    check(current_time_point().sec_since_epoch() < it->born_at + awaken_dur, 
          "already awake — just harvest instead");
    
    // 5. Validate WAX amount
    asset required = wake_cost_for(cfg, sp->egg_type);
    check(quantity >= required, "insufficient WAX for wake");
    // (excess WAX kept as donation — or refunded if CEO prefers)
    
    // 6. Wake!
    crs.modify(it, same_payer, [&](auto& r) { r.stage = 1; });
    
    // 7. Forward WAX to fee_account
    if (quantity.amount > 0) {
        action(permission_level{get_self(), "active"_n},
               "eosio.token"_n, "transfer"_n,
               token_transfer{get_self(), cfg.fee_account, quantity, "wake:" + std::to_string(asset_id)}
        ).send();
    }
}
```

**WAX token contract:** `eosio.token` on WAX mainnet/testnet (`WAX` symbol, 8 decimals). Fee destination = `cfg.fee_account`.

### 2.4 WAX Flow

```
Player wallet
  │  eosio.token::transfer(to=pockethatch, memo="wake:<id>")
  ▼
pockethatch (on_notify handler)  ←  validates & wakes creature
  │  inline eosio.token::transfer(to=fee_account)
  ▼
fee_account (configurable)
  │  dev withdraw via existing `withdraw` action
  ▼
Dev wallet
```

> WAX flows: Player → (momentarily) contract → fee_account. Contract never holds WAX long-term.

---

## 3. Satiety → Earn Gating + Feed Cadence

### 3.1 The Model (already in code — designing the parameters)

satiety = food timer ที่ decay จาก 100% → 0% ตลอด `fed_dur`  
earn = yield_for(stage) × fed_hours × **avg_satiety** × earn_mult

```
gross += yield_for(stage) * fed_h * mult/10000 * avg_sat/10000
```
— `pockethatch.cpp:592-594`

**Key properties (all anti-exploit, already enforced):**
- Feed แล้ว harvest ทันที = 0 EGG (ws = max(last_harvest, last_fed) → retroactive credit เป็น 0)
- ปล่อยให้หิว = earn น้อยลงตาม satiety (linear 100%→0%)
- offline cap 8h = หายไปเกิน 8 ชม. → เสีย EGG ส่วนที่เกิน

### 3.2 feed_cost = 0 → Feed Cadence ต่อ Rarity

| Rarity | fed_dur | เติมอาหาร | feeds/week | feeds/month | หมายเหตุ |
|--------|---------|----------|-----------|------------|---------|
| Common | 48h | ทุก 2 วัน | 3.5 | ~15 | ต้องดูแลบ่อย |
| Uncommon | 72h | ทุก 3 วัน | 2.3 | ~10 | |
| Rare | 120h | ทุก 5 วัน | 1.4 | ~6 | สบายขึ้น |
| Epic | 168h | ทุก 7 วัน | 1.0 | ~4 | อาทิตย์ละครั้ง |
| Legendary | 240h | ทุก 10 วัน | 0.7 | ~3 | |
| Mythic | 336h | ทุก 14 วัน | 0.5 | ~2 | แทบไม่ต้องดูแล |

> **Design principle:** Rarity สูง = เลี้ยงง่าย = reward สำหรับความหายาก ✅  
> feed_cost = 0 (CEO สั่ง) → ไม่มีค่าใช้จ่าย EGG ในการ feed → การ feed คือ engagement loop ล้วนๆ

### 3.3 Earn Gating by Satiety

| Satiety State | % | Earn Factor | harvest() ใช้ avg_sat แทน discrete |
|--------------|---|-------------|--------------------------------------|
| Full | ≥60% | 100% | avg_sat วัดตามเวลาจริง (linear) |
| Hungry | 25-59% | ~50% | " |
| Starving | <25% | ~10% | " |

> harvest() ใช้ค่าเฉลี่ย satiety จริงตลอดช่วง [ws, we] — ไม่ใช่ discrete tier → **ป้องกันการ exploit โดย feed ก่อน harvest แล้วได้เต็มทั้งๆ ที่หิวมา 99% ของเวลา**

### 3.4 Daily Cap Scaling (existing mechanism, verified)

Daily cap = `daily_egg_cap (240) × best_earn_mult / 10000`

ด้วย `cap_scales_rarity=1`, best_mult = earn_mult ของ rarity สูงสุดที่ผู้เล่นครอบครองและ fed อยู่

| Best Rarity Owned | Daily Cap | เวลาถึง cap @stage1 full satiety |
|-------------------|-----------|----------------------------------|
| Common | 240 | 2.4h |
| Uncommon | 264 | 2.4h |
| Rare | 336 | 2.4h |
| Epic | 432 | 2.4h |
| Legendary | 576 | 2.4h |
| Mythic | 792 | 2.4h |

> ทุก tier ใช้เวลาเท่ากันในการ hit cap (2.4h) — เพราะ earn rate และ cap scale ด้วย multiplier เดียวกัน

### 3.5 Feed anti-spam (existing)

- `feed_cd = 21,600s` (6h cooldown ต่อ creature)
- `feed_daily_cap = 3` (max 3 feeds/creature/day)
- feed ฟรี → ไม่ต้องกังวลเรื่อง spam-feed สิ้นเปลือง EGG
- แต่ cooldown + daily cap ยังอยู่ → prevent bot-feed ทุก 1 วิ

---

## 4. Harvest Fix — Flatten Double-Count Bug

### 4.1 The Bug (from `ECONOMY-AUDIT.md` §3.1)

**ปัญหา:** Rarity premium ถูก apply **2 ชั้น** แล้ว harvest() คูณกัน:

| Layer | Common | Uncommon | Rare |
|-------|--------|----------|------|
| A: speciescfg yield (per-species) | ×1.00 (100) | ×1.10 (110) | ×1.40 (140) |
| B: configv3 earn_mult | ×1.00 (10000) | ×1.10 (11000) | ×1.40 (14000) |
| **Compound = A × B** | **×1.00** | **×1.21** | **×1.96** |

> Uncommon ได้ 21% ไม่ใช่ 10%. Rare ได้ 96% ไม่ใช่ 40%. 🔴

### 4.2 Fix: Flatten Species Yields

**ตั้งค่า speciescfg yields ให้เป็น FLAT ทุก rarity ภายใน family เดียวกัน:**

| Stage | Old (Rare) | Old (Uncommon) | New (ALL rarities) |
|-------|-----------|----------------|---------------------|
| 1 | 140 | 110 | **100** |
| 2 | 420 | 330 | **300** |
| 3 | 840 | 660 | **600** |
| 4 | 1,680 | 1,320 | **1,200** |
| 5 | 3,360 | 2,640 | **2,400** |

**earn_mult รับหน้าที่ sole rarity premium แทน:**

| Rarity | earn_mult (bp) | Effective × |
|--------|----------------|-------------|
| Common | 10000 | ×1.00 |
| Uncommon | 11000 | ×1.10 |
| Rare | 14000 | ×1.40 |
| Epic | 18000 | ×1.80 |
| Legendary | 24000 | ×2.40 |
| Mythic | 33000 | ×3.30 |

**ผลลัพธ์หลังแก้:**
- Common stage 1: 100 × 1.00 = **100 EGG/hr** ✅
- Uncommon stage 1: 100 × 1.10 = **110 EGG/hr** ✅ (จากเดิม compound 121)
- Rare stage 1: 100 × 1.40 = **140 EGG/hr** ✅ (จากเดิม compound 196)
- Epic stage 1: 100 × 1.80 = **180 EGG/hr** ✅
- Legendary stage 1: 100 × 2.40 = **240 EGG/hr** ✅
- Mythic stage 1: 100 × 3.30 = **330 EGG/hr** ✅

### 4.3 Implementation

**On-chain:** `setspecies` ทุก species → flatten yields (3 txs สำหรับ 3 species เดิม; เพิ่มใหม่สำหรับ Epic/Legendary/Mythic)

**Frontend:** `satiety.ts` RARITY_EARN_MULT → อัปเดตเป็นค่าใหม่ (ไม่ compound):
```ts
export const RARITY_EARN_MULT: Record<Rarity, number> = {
  common: 1.0, uncommon: 1.1, rare: 1.4,
  epic: 1.8, legendary: 2.4, mythic: 3.3,
}
```

> **Backward compat:** creatures เดิมที่มีอยู่ก่อน flatten → earn rate จะลดลง (Uncommon จาก ×1.21 → ×1.10, Rare จาก ×1.96 → ×1.40). ควรประกาศล่วงหน้า + run 1 season transition.

---

## 5. HATCH Claim Scarcity Model

### 5.1 Current State (from live chain)

| Parameter | Current Value |
|-----------|---------------|
| Claim frequency | 1 per player per season |
| Qualification | Highest stage ≥ 2 (Juvenile) |
| Payout (stage 2) | 20 HATCH |
| Payout (stage 3) | 30 HATCH |
| Payout (stage 4) | 50 HATCH |
| Payout (stage 5) | 100 HATCH |
| Payout precision | ×10⁴ (uint64) |
| Pool gate | Reverts if `pool.balance < payout` |
| Pool current | ~79 HATCH (phgamecreatr) / 1.5M (pockethatch1) |

### 5.2 Proposed Adjustments

**เป้าหมาย:** ทำให้ HATCH "ค่อยๆ ได้ ไม่เฟ้อ" — รักษา scarcity, balance faucet vs sink

#### 5.2.1 Revised Payout Table

| Stage | Current | Proposed | Δ | เหตุผล |
|-------|---------|----------|---|--------|
| 2 (Juvenile) | 20 | **15** | -25% | entry claim — พอมีกำลังใจ |
| 3 (Adult) | 30 | **25** | -17% | |
| 4 (Evolved) | 50 | **45** | -10% | เริ่มรู้สึกคุ้ม |
| 5 (Final) | 100 | **85** | -15% | aspirational แต่ไม่เฟ้อ |

> ลดทุกขั้น ~15-25% — ยังรู้สึกคุ้ม แต่รวม outflow ลดลง ~20%

#### 5.2.2 New Qualification: Satiety Gate

เพิ่มเงื่อนไข: **ต้องมีอย่างน้อย 1 creature ที่ fed อยู่ (satiety > 0, i.e. `now < last_fed + fed_dur`)** ถึงจะ claim ได้

**Why:** ป้องกัน "claim-and-abandon" — สร้าง account, rush stage 2, claim, ทิ้ง.  
satiety gate = ต้อง active เล่นอยู่จริง ถึงจะได้ reward.

```cpp
// Add to claimreward():
bool has_fed_creature = false;
for (auto it = idx.lower_bound(owner.value); it != idx.end() && it->owner == owner; ++it) {
    auto sp = sps.find(it->template_id);
    if (sp != sps.end() && now < it->last_fed + fed_duration_for(cfg, sp->egg_type)) {
        has_fed_creature = true;
        break;
    }
}
check(has_fed_creature, "no fed creature — feed before claiming");
```

#### 5.2.3 Season Duration & Claim Cadence

| Parameter | Value | Notes |
|-----------|-------|-------|
| Season length | configurable (default ~30d) | `newseason` action by dev |
| Claims/player/season | 1 | Unchanged (hard gate via `claims` table) |
| Cooldown between claims | `harvest_cd` (1h) | Existing (defense-in-depth) |
| Max claims/day (global) | Unlimited | Guarded by pool balance only |
| Pool refill | breed (60% of 5 HATCH) + bootstrap | Passive + manual |

#### 5.2.4 Pool Sustainability Model

**ต่อผู้เล่น 100 คน active, อ้างอิงต่อเดือน (burn_base_hatch = 10 HATCH):**

| Flow | Formula | HATCH/month |
|------|---------|------------|
| **Faucet: breed → pool** | 50 breeds/วัน × 3 HATCH × 30d | +4,500 |
| **Faucet: bootstrap** | CEO inject | +variable |
| **Sink: claims** | 100 players × avg 42.5 HATCH/claim | -4,250 |
| **Sink: burn payouts** | 20 burns/วัน × avg ~320 HATCH × 30d | **-192,000** |
| **Net (ไม่มี bootstrap)** | | **~-192,000** 🔴🔴 |

> 🔴🔴 **CEO เลือก "เล่นใหญ่" — burn_base_hatch = 10 HATCH คงไว้.**  
> Pool drain ~192K/month — pool 100K หมดใน ~16 วันหากไม่เติม.

**ทางแก้ (เลือก 1 ข้อ):**

| Option | Detail | Effect |
|--------|--------|--------|
| **1. CEO inject รายเดือน** ⭐ | เติม HATCH เข้า pool ตาม activity | ง่ายสุด — dev ควบคุม supply โดยตรง |
| 2. Cap daily burn payout | max N HATCH/day global | ต้องเพิ่ม code + state tracking |
| 3. ลด burn_base_hatch | 10.0 → 1.0 HATCH | CEO ไม่อยากลด — "เล่นใหญ่" |
| 4. ลด rarity_mul | หาร 2 ทั้งตาราง | max 15,000→7,500 — ยังสูง |

> **🔒 CEO decision: option 1 — CEO inject รายเดือน.** เริ่มด้วย pool 100K–500K HATCH. Monitor burn activity จริง → calibrate injection amount. Mainnet: อาจต้องใช้ option 2 (daily cap) เพื่อ sustainability อัตโนมัติ

### 5.5 HATCH Faucet vs Sink Summary

| Mechanism | Type | Token | Scale |
|-----------|------|-------|-------|
| Claim reward | Faucet | HATCH | 15-85 / player / season |
| Burn creature | Faucet | HATCH | 2–15,000 / burn (CEO: เล่นใหญ่) |
| Breed (40%) | Sink | HATCH | 2 HATCH / breed |
| Accelerate | Sink | HATCH | 1 HATCH → 100 growth |
| Breed (60%) | Pool | HATCH | 3 HATCH / breed |
| Bootstrap | Pool | HATCH | developer inject |

> **HATCH deflationary by design:** ทุก breed เผา 40% → supply ลดลงเรื่อยๆ. claim/burn จ่ายจาก pool (ไม่ mint ใหม่). pool เติมจาก breed 60% + dev inject. = sustainable scarcity ✅

---

## 6. Recycle / Burn Pet → EGG Refund + HATCH Sink Roadmap

### 6.1 EGG Refund on Burn (CEO-LOCKED: flat per rarity)

🔒 **CEO directive:** burn → EGG refund แบบน้อย (8–30 EGG) — flat ต่อ rarity, ไม่ใช่ %

| Rarity | EGG Refund | configv3 field | Notes |
|--------|-----------|----------------|-------|
| Common | **8** | `burn_egg_common` | น้อยสุด — common หาได้ง่าย |
| Uncommon | **12** | `burn_egg_uncommon` | |
| Rare | **16** | `burn_egg_rare` | |
| Epic | **21** | `burn_egg_epic` | |
| Legendary | **26** | `burn_egg_legendary` | |
| Mythic | **30** | `burn_egg_mythic` | มากสุด — แต่เทียบกับ 15,000 HATCH แล้วเล็กมาก |

> **Design:** flat per rarity, ไม่ขึ้นกับ stage. ง่าย — ไม่ต้องคำนวน complex formula.  
> คืนน้อย deliberately — burn ไม่ใช่ทางทำกำไร EGG. HATCH reward (§6.2) คือมูลค่าจริงจากการ sacrifice NFT.  
> **Implementation:** `burncreature()` อ่าน `cfg.burn_egg_<rarity>` แทน `hatch_cost * refund_pct`. ไม่ต้องมี stage lookup.

### 6.2 Existing Burn HATCH Payout (verified, already 6-tier)

จาก code ปัจจุบัน (already updated for 6 tiers):

```
payout = burn_base_hatch × stage_mul[stage] / 10 × rarity_mul[egg_type] / 10
```

| | stage_mul | rarity_mul |
|--|-----------|------------|
| 0 | 2 (×0.2) | 10 (×1) |
| 1 | 5 (×0.5) | 30 (×3) |
| 2 | 10 (×1) | 100 (×10) |
| 3 | 20 (×2) | 250 (×25) |
| 4 | 50 (×5) | 600 (×60) |
| 5 | 100 (×10) | 1500 (×150) |

**Sample payouts (burn_base_hatch = 10 HATCH):**

| Stage | Common | Rare | Epic | Mythic |
|-------|--------|------|------|--------|
| 0 | **2** | **20** | **50** | **300** |
| 1 | **5** | **50** | **125** | **750** |
| 2 | **10** | **100** | **250** | **1,500** |
| 3 | **20** | **200** | **500** | **3,000** |
| 4 | **50** | **500** | **1,250** | **7,500** |
| 5 | **100** | **1,000** | **2,500** | **15,000 HATCH** |

> 🔴 **Mythic stage 5 burn = 15,000 HATCH** — มากกว่า claimreward stage 5 (85 HATCH) ถึง 176 เท่า.  
> Common stage 5 = 100 HATCH — ก็ยังมากกว่า claim อยู่ดี.  
> 🔒 **CEO: เล่นใหญ่ — burn_base_hatch = 10 HATCH คงไว้.** Pool sustainability ดู §5.2.4.

### 6.3 HATCH Sink Roadmap (อนาคต)

นอกจาก breed/accelerate ที่เผา HATCH อยู่แล้ว — เสนอ sink เพิ่ม:

| Phase | Sink | HATCH Cost | Notes |
|-------|------|-----------|-------|
| **Now** | Breed | 5 HATCH (40% burn = 2) | ✅ deployed |
| **Now** | Accelerate | variable | ✅ deployed |
| **v2.1** | HATCH→EGG exchange | 1 HATCH = 50 EGG | safe ratio: Mythic earn 330 EGG/hr → ~5 HATCH = 1 ชม. harvest |
| **v2.2** | Cosmetic reroll (HATCH) | 1-5 HATCH | premium option |
| **v2.3** | Name change (HATCH) | 10 HATCH | rename creature ด้วย HATCH |
| **v2.4** | Seasonal leaderboard entry | 5-20 HATCH | จ่าย HATCH เข้าแข่ง — winner ได้ pool |
| **v3** | Cross-game HATCH bridge | TBD | |

> ทุก sink เผา HATCH (ไม่เข้า pool) → deflationary pressure → HATCH มีมูลค่าเพิ่มตามเวลา

---

## 7. Faucet / Sink Summary — Economy Balance

### 7.1 EGG Economy (per player, per day)

| Faucet | Max/day | Sink | Cost |
|--------|---------|------|------|
| Harvest (Common) | 240 | Hatch | 150/egg |
| Harvest (Uncommon) | 264 | Evolve (cumulative 0→5) | 4,650 |
| Harvest (Rare) | 336 | Slot unlock (4th/5th/6th) | 500/1,200/2,500 |
| Harvest (Epic) | 432 | Cosmetic reroll | 100 |
| Harvest (Legendary) | 576 | Feed | **0** (free) ✅ |
| Harvest (Mythic) | 792 | | |

### 7.2 Player Journey — EGG Balance Check

**Early game (Common tier, 240 EGG/day):**
- 1 hatch/day = 150 EGG
- Feed = 0
- Net: +90 EGG/day → สะสม evolve
- Evolve 0→1: 300 EGG → ใช้เวลา 4 วัน
- ✅ balanced — ไม่เร็วไม่ช้า

**Mid game (Rare tier, 336 EGG/day):**
- 2 hatches/day = 300 EGG
- Evolve amortized: ~100 EGG/day
- Net: -64 EGG/day → ต้องมีวันไม่ hatch เพื่อสะสม evolve
- Evolve 0→5: 4,650 EGG → ~2-3 weeks
- ✅ balanced — มี tension ระหว่าง hatch กับ evolve

**Endgame (Mythic tier, 792 EGG/day, 3 slots):**
- 3 slots active → hatch เฉพาะตอนจะ burn
- Burn EGG refund: 8-30 EGG (per rarity, §6.1)
- Hatch cycle: 150 - refund = ~130 EGG ต่อการเปลี่ยนตัว
- ถ้า burn+hatch 1 ตัว/วัน: 792 - 130 - 100 (evolve amortized) = +562 EGG/day
- Surplus → ซื้อ slot unlock (4,200 total), cosmetic, หรือเก็บ
- ✅ surplus คือ reward ของ endgame — intentional

### 7.3 HATCH Economy (per 100 active players, per month)

| | Mechanism | HATCH/month | Direction |
|--|-----------|------------|-----------|
| ➕ | Breed → pool (60% of 5 HATCH) | +4,500 | Pool inflow |
| ➕ | Bootstrap (dev inject) | +variable | Pool inflow |
| ➖ | Claim reward | -4,250 | Pool outflow → circulation |
| ➖ | Burn payouts | -50,000 to -200,000 | Pool outflow → circulation |
| 🔥 | Breed burn (40% of 5 HATCH) | 3,000 | Supply destroyed |
| 🔥 | Accelerate | ~2,000 | Supply destroyed |

> **Net effect:** HATCH supply ค่อยๆ ลด (deflationary) ✅  
> **Risk:** burn payouts drain pool ~192K/month — CEO inject รายเดือน (§5.2.4)  
> **Recommendation:** เริ่ม pool 100K–500K HATCH. Monitor burn activity → calibrate injection. Mainnet: พิจารณา daily burn cap

### 7.4 WAX Economy (dev revenue)

| Mechanism | WAX Flow |
|-----------|----------|
| Wake (instant awaken) | Player → fee_account |
| (Future) Marketplace fee | Seller → fee_account |
| (Future) Premium cosmetics | Player → fee_account |

> WAX แยกจาก HATCH/EGG economy โดยสิ้นเชิง — ไม่มีผลต่อ game balance

---

## 8. Summary — All Mechanisms At a Glance

| # | Mechanism | What It Does | Key Numbers |
|---|-----------|-------------|-------------|
| 1 | **Awaken timer** | ฟักแล้วต้องรอถึง earn ได้ | 1–3h ต่อ rarity |
| 2 | **WAX wake** | จ่าย WAX → ข้าม timer | 3–80 WAX ต่อ rarity |
| 3 | **Satiety/Feed** | ต้อง feed เพื่อ earn, rarity สูงเลี้ยงง่าย | 48h–14d fed_dur, feed ฟรี |
| 4 | **Harvest fix** | แก้ double-count → earn_mult เป็น sole rarity premium | flatten species yields → 100/300/600/... |
| 5 | **HATCH scarcity** | claim ลด ~20%, เพิ่ม satiety gate | 15–85 HATCH/season |
| 6 | **Recycle/Burn** | burn = HATCH reward + EGG refund | 2–15,000 HATCH, 8–30 EGG flat/rarity |

---

## 9. Code Changes Required

### 9.1 Contract (`pockethatch.hpp`)

```cpp
// ── Extended to 6 tiers (CEO locked — see §0.3) ──
uint16_t    rarity_w_epic       = 250;
uint16_t    rarity_w_legendary  = 45;
uint16_t    rarity_w_mythic     = 5;
uint16_t    earn_mult_epic      = 18000;    // ×1.8
uint16_t    earn_mult_legendary = 24000;    // ×2.4
uint16_t    earn_mult_mythic    = 33000;    // ×3.3
uint32_t    fed_dur_epic        = 604800;   // 7d
uint32_t    fed_dur_legendary   = 864000;   // 10d
uint32_t    fed_dur_mythic      = 1209600;  // 14d

// ── Awaken timer (new, CEO locked) ──
uint32_t awaken_dur_common    = 3600;     // 1h
uint32_t awaken_dur_uncommon  = 5400;     // 1.5h
uint32_t awaken_dur_rare      = 7200;     // 2h
uint32_t awaken_dur_epic      = 9000;     // 2.5h
uint32_t awaken_dur_legendary = 10800;    // 3h
uint32_t awaken_dur_mythic    = 10800;    // 3h

// ── WAX wake (new, on_notify handler → Treasury) ──
name     wax_contract         = "eosio.token"_n;
asset    wake_cost_common     = asset(300000000, symbol("WAX", 8));     // 3 WAX
asset    wake_cost_uncommon   = asset(500000000, symbol("WAX", 8));     // 5 WAX
asset    wake_cost_rare       = asset(1000000000, symbol("WAX", 8));    // 10 WAX
asset    wake_cost_epic       = asset(2000000000, symbol("WAX", 8));    // 20 WAX
asset    wake_cost_legendary  = asset(4000000000, symbol("WAX", 8));    // 40 WAX
asset    wake_cost_mythic     = asset(8000000000, symbol("WAX", 8));    // 80 WAX
// ⚠️ WAX forwarding: on_wax_transfer() sends WAX to cfg.fee_account (Treasury)

// ── Burn EGG refund — flat per rarity (CEO locked, §6.1) ──
uint64_t    burn_egg_common     = 8;
uint64_t    burn_egg_uncommon   = 12;
uint64_t    burn_egg_rare       = 16;
uint64_t    burn_egg_epic       = 21;
uint64_t    burn_egg_legendary  = 26;
uint64_t    burn_egg_mythic     = 30;

// ── burn_base_hatch: CEO keeps 10 HATCH ("เล่นใหญ่") ──
asset       burn_base_hatch  = asset(100000, symbol("HATCH", 4));  // unchanged

// ── Claim reward tuning (revised) ──
// payout values embedded in claimreward() action, see §5.2.1

// ── feed_cost already 0 in new config default ──
// (change default from 12 → 0)
```

> ⚠️ **หมายเหตุ:** การเก็บ wake_cost เป็น 6 fields แยกใน config — อ่านง่าย ปรับง่าย.  
> ถ้ากังวลเรื่อง RAM → ใช้ array `uint64_t wake_cost[6]` แทน (แต่ uint64_t เก็บ WAX 8dp ไม่พอ → ใช้ asset array)

### 9.2 Contract (`pockethatch.cpp`)

| Function | Change |
|----------|--------|
| `roll_egg_type()` | Extend to 6 tiers (already specced in RARITY-6TIER-SPEC.md §4.2) |
| `fed_duration_for()` | Add cases 3/4/5 |
| `earn_mult_for()` | Add cases 3/4/5 |
| `harvest()` | Add auto-awaken check (§1.4) |
| `burncreature()` | EGG refund → flat per rarity (cfg.burn_egg_<rarity>) §6.1 |
| **NEW** `awaken_duration_for()` | Per-rarity awaken timer helper |
| **NEW** `on_wax_transfer()` | `on_notify("eosio.token::transfer")` — WAX wake → Treasury |
| **NEW** `wakecost_for()` | WAX cost lookup per rarity |

### 9.3 Frontend

| File | Change |
|------|--------|
| `satiety.ts` | Update `RARITY_EARN_MULT` to non-compounded values (§4.3) |
| `CreatureCard.tsx` | Already has 6 Rarity types ✅ |
| `chain.ts` | Add awaken timer fields to config read |
| `play.ts` | Thread awaken state through `toCreature()` |
| New component | Awaken countdown timer in CreatureCard |

### 9.4 speciescfg

| Action | Detail |
|--------|--------|
| `setspecies` ×3 | Flatten existing species yields to 100/300/600/1200/2400 |
| `setspecies` ×N | New Epic/Legendary/Mythic species (need AA template IDs) |
| All species | Use flat yields per family; rarity premium from earn_mult only |

---

## 10. Migration Path

### Phase 1: Config Only (no code deploy)
1. **Flatten species yields** via `setspecies` (3 txs — 662976/662977/662978)
2. **Set feed_cost = 0** via `setconfig`
3. **Fund reward pool** ≥ 100,000 HATCH (CEO inject)
4. **Verify:** harvest earn rates match new multipliers (no double-count)

### Phase 2: Code Deploy (6-tier + awaken + WAX-wake)
1. Deploy updated `pockethatch` contract
2. `setconfig` with 6-tier weights, earn_mults, fed_durs, awaken_durs, wake costs
3. `setspecies` for Epic/Legendary/Mythic species
4. Deploy frontend with updated satiety.ts + awaken UI

### Phase 3: Calibrate (หลังรันจริง 1-2 สัปดาห์)
1. Monitor pool balance
2. Track burn activity vs pool drain rate
3. Adjust burn formula or inject HATCH as needed
4. Measure WAX wake conversion rate

---

## 11. CEO Decision Checklist

- [x] **Rarity weights:** 6900/2000/800/250/45/5 — 🔒 CEO locked
- [x] **earn_mult:** 10000/11000/14000/18000/24000/33000 — 🔒 CEO locked
- [x] **fed_dur:** 48h/72h/120h/7d/10d/14d — 🔒 CEO locked
- [x] **burn_base_hatch:** 10 HATCH เล่นใหญ่ — 🔒 CEO locked
- [x] **feed_cost = 0** — 🔒 CEO locked
- [ ] **Awaken durations:** Approve 1h/1.5h/2h/2.5h/3h/3h?
- [ ] **WAX wake pricing:** Approve 3/5/10/20/40/80 WAX?
- [ ] **WAX destination = Treasury (fee_account):** Confirm?
- [ ] **Flatten species yields:** Approve — earn_mult เป็น sole rarity premium
- [ ] **Burn EGG refund flat/rarity:** Approve 8/12/16/21/26/30?
- [ ] **Claim payouts (revised):** Approve 15/25/45/85 HATCH?
- [ ] **Satiety gate for claims:** Approve "ต้องมี fed creature"?
- [ ] **Pool initial funding:** เท่าไหร่? (แนะนำ 100K–500K HATCH, CEO inject รายเดือน)
- [ ] **Season cadence:** 30 วัน? configurable?
- [ ] **HATCH→EGG exchange:** อนุมัติ concept? (1 HATCH = 50 EGG)

---

## Appendix A: Why These Numbers — Anti-Inflation Principles

1. **Daily cap scales with rarity** — ไม่ใช่ everyone gets same cap. คนฟลุคได้ Mythic → cap ×3.3 = 792 — แต่ต้องใช้เวลาเฉลี่ย 1.3 ปีกว่าจะได้. Fair trade.

2. **Slots limit active creatures** — 3 ฟรี + 3 ซื้อ. มี 6 ตัว active ได้มากสุด. ป้องกัน infinite creature farm.

3. **Burn = sacrifice** — เผา NFT เพื่อ HATCH reward. มูลค่า reward สะท้อนความหายาก ไม่ใช่ free money.

4. **EGG = soft currency** — ใช้ทำ basic actions (hatch/evolve/feed). Inflation ควบคุมด้วย cap + sinks.

5. **HATCH = hard currency** — หายาก, deflationary, ใช้ทำ premium actions (breed/accelerate). Supply ลดลงเรื่อยๆ.

6. **WAX = real money** — แยกจาก game economy. ใช้เฉพาะ convenience features (wake, future marketplace).

7. **Pool = buffer** — HATCH ไม่ออกจาก pool ถ้า pool < payout. Dev inject เมื่อจำเป็น. ไม่ mint ใหม่.

---

## Appendix B: Comparison — v1 (Current) vs v2 (Proposed)

| Dimension | v1 (Current) | v2 (Proposed) |
|-----------|-------------|---------------|
| Rarity tiers | 3 (C/U/R) | 6 (+Epic/Legendary/Mythic) |
| Earn premium | Double-count (yield × earn_mult) | Single-layer (earn_mult ×1.0/1.1/1.4/1.8/2.4/3.3) |
| Awaken | None (instant earn) | 1–3h timer per rarity |
| WAX monetization | None | Wake = 3–80 WAX → Treasury |
| Feed cost | 12 EGG | 0 (free engagement) |
| Claim (stage 5) | 100 HATCH | 85 HATCH |
| Claim qualification | Stage ≥ 2 | Stage ≥ 2 + must be fed |
| Burn payout | 3-tier | 6-tier, 2–15,000 HATCH (CEO: เล่นใหญ่) |
| Burn EGG refund | % of hatch_cost | Flat 8–30 EGG/rarity |
| Pool size | ~79 HATCH (critical) | 100K–500K (CEO inject) |

---

*Economy V2 spec v1.0 — pending CEO approval. No chain state modified.*
