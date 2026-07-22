# ECONOMY-AUDIT.md — Pocket Hatchery Chain Audit

**Auditor:** Sun (จิตวิทยาเชิงบวก + เศรษฐกิจเกม)  
**Date:** 2026-07-09  
**Scope:** Read-only audit of `phgamecreatr` vs `pockethatch1` on WAX testnet  
**Source ground-truth:** `pockethatch.hpp` (as of 2026-07-09), `pockethatch.cpp`, `web/src/satiety.ts`, `deploy/species-config.json`  
**Chain data:** Live RPC reads from WAX Sweden testnet at block ~415,328,208 (~09:06 UTC 2026-07-09). All chain values match their C++ defaults — no divergence from deployed code.

---

## 1. Executive Summary

`phgamecreatr` is the **active** contract running its **C++ defaults** (as defined in `pockethatch.hpp`). 3 players, 25 creatures, season 1 active. `pockethatch1` is a **shell** — has species config and a 1.5M HATCH reward pool but no `configv3` table in its ABI and zero creatures.

**Verdict:** The contract is operating exactly as its code defines — not "sandbox" or "divergent," just **running defaults**. Cost/cap params (hatch 150, feed 12, daily cap 240) are production-suitable. Rarity tier distribution (70/25/5% via `rarity_w_*` = 700/250/50) is testnet-oriented by design (labelled "Boss-locked testnet" in hpp:162). The primary risk is a **double-count in the earn path** (§3.1) and a critically **low reward pool** (79 HATCH, §3.2). The double-count exists because both `speciescfg` yields AND `earn_mult` carry rarity scaling, and the harvest formula multiplies them. This is **not production-safe for the reward-pool reason alone**, regardless of other params.

---

## 2. Live Chain Data (vs C++ Defaults)

### 2.1 Contract Identity

| Field | phgamecreatr | pockethatch1 |
|-------|-------------|-------------|
| Last code update | 2026-07-09 08:11 UTC | — |
| Config table | `configv3` ✅ | **NOT IN ABI** ❌ |
| Species table | 4 species | 1 species (662644) |
| Players | 3 | 2 |
| Creatures | 25 | **0** |
| Collection name | `phgamecreatr` | — |
| Token contract | `hatchtokens1` | — |

### 2.2 configv3 — phgamecreatr (live) vs C++ Defaults (`pockethatch.hpp`)

> **All live values match their C++ defaults.** Where the C++ default itself was updated on 2026-07-09 to reflect verified chain state, the comment in the source documents that explicitly.

| Parameter | Live (chain) | C++ Default (hpp) | Notes |
|-----------|-------------|-------------------|-------|
| `hatch_cost` | 150 | 150 (hpp:136) | ✅ |
| `evolve_cost` | 300 | 300 (hpp:137) | ✅ |
| `breed_cost` | 5.0000 HATCH | 5.0000 HATCH (hpp:138) | ✅ |
| `feed_cost` | 12 | 12 (hpp:139) | ✅ |
| `slot_cost` | 500 | 500 (hpp:140) | ✅ |
| `cosmetic_cost` | 100 | 100 (hpp:141) | ✅ |
| `feed_cd` | 21,600 (6h) | 21,600 (hpp:145) | ✅ |
| `harvest_cd` | 3,600 (1h) | 3,600 (hpp:146) | ✅ |
| `breed_cd` | 86,400 (24h) | 86,400 (hpp:147) | ✅ |
| `feed_daily_cap` | 3 | 3 (hpp:149) | ✅ |
| `daily_egg_cap` | 240 | 240 (hpp:150) | ✅ |
| `offline_cap_h` | 8 | 8 (hpp:151) | ✅ |
| `tap_egg_cap` | 60 | 60 (hpp:152) | ✅ |
| `feed_boost` | 100 | 100 (hpp:154) | ✅ |
| `fed_dur_common` | 172,800 (48h) | 172,800 (hpp:177) | ✅ |
| `fed_dur_uncommon` | 259,200 (72h) | 259,200 (hpp:178) | ✅ |
| `fed_dur_rare` | 432,000 (120h) | 432,000 (hpp:179) | ✅ |
| `earn_mult_common` | 10,000 (×1.00) | 10,000 (hpp:180) | ✅ |
| `earn_mult_uncommon` | 11,000 (×1.10) | 11,000 (hpp:181) | ✅ "verified from speciescfg 2026-07-09" |
| `earn_mult_rare` | 14,000 (×1.40) | 14,000 (hpp:182) | ✅ "verified from speciescfg 2026-07-09" |
| `cap_scales_rarity` | 1 | 1 (hpp:183) | ✅ |
| `rarity_w_common` | 700 | 700 (hpp:165) | ✅ Tier distribution: 70% Common |
| `rarity_w_uncommon` | 250 | 250 (hpp:166) | ✅ Tier distribution: 25% Uncommon |
| `rarity_w_rare` | 50 | 50 (hpp:167) | ✅ Tier distribution: 5% Rare |
| `season_index` | 1 | 0 | Deployed `newseason` called once |
| `burn_base_hatch` | 10.0000 HATCH | 10.0000 HATCH (hpp:170) | ✅ |

**Rarity distribution note:** `rarity_w_*` (700/250/50 → 70%/25%/5%) controls the tier roll in `roll_egg_type()` (cpp:206-216). This is a **separate layer** from `speciescfg.egg_weight` (100/65/22), which distributes species *within* a tier in `pick_template()` (cpp:184-204). The hpp:162-164 comment explicitly distinguishes them. The 70/25/5 distribution is the C++ default and is labelled "Boss-locked testnet" — it is **not** compared against any separate production target because none exists in the codebase for this parameter.

> ⚠️ **Legacy doc caveat:** `deploy/species-config.json` `_earn_formula` note still references ×1.5/×2.5 multipliers, but that note predates the 2026-07-09 C++ update. The hpp defaults are now the authoritative design reference.

### 2.3 speciescfg — phgamecreatr (live)

| template_id | Family | egg_type | Rarity | Yield (stages 1-5) | egg_weight |
|------------|--------|----------|--------|---------------------|------------|
| 660000 | Test | 0 | Common | 100/300/600/1200/2400 | 100 |
| 662976 | Fire | 0 | Common | 100/300/600/1200/2400 | 100 |
| 662977 | Fire | 1 | Uncommon | **110**/330/660/1320/2640 | 65 |
| 662978 | Fire | 2 | Rare | **140**/420/840/1680/3360 | 22 |

> ⚠️ **Yields are per-rarity, NOT flat per family.** Uncommon yields = 1.1× common, Rare = 1.4× common. Since `earn_mult` in configv3 also carries ×1.10/×1.40, the harvest formula multiplies both layers → **double-count** (see §3.1). This is the central structural finding of this audit.

These 4 species are the C++ defaults with no divergence. `deploy/species-config.json` describes a future plan with 11 species across 5 families, flat yields per family, and earn_mult carrying the rarity premium — but that plan is not yet deployed.

### 2.4 Reward Pool

| Field | phgamecreatr | pockethatch1 |
|-------|-------------|-------------|
| Balance | **79 HATCH** | **1,500,000 HATCH** |
| Lifetime funded | 101 HATCH | 1,500,000 HATCH |
| Lifetime paid | 22 HATCH | 0 HATCH |

> 🔴 **phgamecreatr pool is critically low** — max claim payout is 100 HATCH (stage 5). The pool can sustain at most 1 more claim. pockethatch1 has 1.5M HATCH that has never been touched.

### 2.5 Players (phgamecreatr)

| Account | EGG Balance | Total Farmed | HATCH Burned | Creatures |
|---------|------------|-------------|-------------|-----------|
| waxwingsuper | 95,978 | 100,480 | 40,000 | 23 |
| officewax123 | 50 | 0 | 0 | 2 |
| phgamecreatr | 200 | 0 | 0 | 0 (self) |

> 🔴 **EGG anomaly:** waxwingsuper has farmed 100,480 EGG (~17,000/day) while the daily cap is 240. This is physically impossible under current rules. Likely explanation: the cap was enforced later; or this is a dev test account with manual seeding (no admin EGG-grant action exists in the contract, so the mechanism is unclear). On testnet this has no financial impact but suggests the config history is not fully documented.

### 2.6 Creatures — Summary

| Stage | Count | Owner |
|-------|-------|-------|
| 0 (Egg) | 7 | waxwingsuper 6, officewax123 1 |
| 1 (Hatchling) | 8 | waxwingsuper 8 |
| 2 (Juvenile) | 4 | waxwingsuper 3, officewax123 1 |
| 3 (Adult) | 1 | waxwingsuper 1 |
| 4 (Evolved) | 3 | waxwingsuper 3 |
| **Total** | **25** | |

20 on template 662889 (old Emberling NFT), 2 on 662906, 3 on 662977 (Fire uncommon). 3 creatures have `last_fed=0` (never fed).

---

## 3. Gap Analysis & Risks

### 3.1 🔴 HIGH: Earn Multiplier Double-Count

**Root cause:** The rarity premium is applied in **two separate layers** that the harvest formula multiplies together:

```
gross += sp_it->yield_for(idx_yield) * fed_h
       * (uint64_t)mult / 10000ULL       ← earn_mult from configv3
       * avg_sat / 10000ULL;             ← linear satiety
```
— `pockethatch.cpp:580-582`

Layer A — `speciescfg` yields (stored per-species):
- Common (662976): yield = 100 (×1.00 base)
- Uncommon (662977): yield = 110 (×1.10 vs common)
- Rare (662978): yield = 140 (×1.40 vs common)

Layer B — `configv3.earn_mult` (stored in config singleton):
- Common: 10000 (×1.00)
- Uncommon: 11000 (×1.10)
- Rare: 14000 (×1.40)

**Effective compound multiplier per rarity:**

| Rarity | Layer A (yield) | Layer B (earn_mult) | Compound | If only one layer |
|--------|----------------|--------------------|-----------|-------------------|
| Common | ×1.00 | ×1.00 | **×1.00** | ×1.00 ✅ |
| Uncommon | ×1.10 | ×1.10 | **×1.21** | ×1.10 ⚠️ +10% |
| Rare | ×1.40 | ×1.40 | **×1.96** | ×1.40 ⚠️ +40% |

**Impact:** Uncommon creatures earn 21% more than Common instead of the intended 10%. Rare earns 96% more instead of 40%. This is not economy-breaking but dilutes rarity differentiation and is almost certainly unintentional — the harvest code was written when species yields were assumed flat (one family = one yield ladder), then per-rarity yields were deployed without removing the earn_mult scaling.

**The `species-config.json` design intent confirms this:** its `_earn_formula` says "within a family, ALL rarities share ONE flat yield ladder. The rarity premium is applied ONCE, only via config earn_mult." The current deployment does the opposite — yields carry rarity AND earn_mult carries rarity.

**Fix (choose one):**
1. **Flatten speciescfg yields** — set all Fire species (662976/662977/662978) to identical yields (100/300/600/1200/2400), keep earn_mult at 10000/11000/14000. This aligns with `species-config.json` design. ✅ Recommended.
2. **Set all earn_mult to 10000** — leave species yields as-is, remove the config-layer multiplier. Simpler, but loses the ability to tune rarity premium via config alone.

### 3.2 🔴 HIGH: Reward Pool — Near Empty

79 HATCH balance. Max single claim: 100 HATCH (stage 5 Elder). The pool cannot survive even one more high-tier claim. With `claimreward` being the primary HATCH faucet for free players, an empty pool = broken reward loop.

pockethatch1 holds 1.5M HATCH in its reward pool, completely unused. If the pockethatch1 code matches, this HATCH could be withdrawn and re-deposited into phgamecreatr, but pockethatch1 has no `configv3` table, so `withdraw()`'s escrow guard (`hpp:1072-1088`) may fail (it references `cfg.token_contract` which requires a `configv3` singleton).

### 3.3 🟡 MEDIUM: EGG Balance Anomaly

waxwingsuper: 100,480 EGG farmed in ~6 days. Under current `daily_egg_cap=240` with `cap_scales_rarity=1` and best rarity ×1.40 → cap = 336/day → max ~2,016 over 6 days. The 50× gap cannot be explained by config. Likely a pre-cap-era artifact. Testnet impact: zero (no real value). But for a clean testnet that exercises actual F2P balance, the EGG surplus masks real economy behavior.

### 3.4 🟢 LOW: species-config.json is Stale

`deploy/species-config.json` references `earn_mult` ×1.5/×2.5 in its `_earn_formula` note — values that the C++ code has since been updated away from (hpp:180-182 now says 10000/11000/14000). The JSON's `_note` about "Do NOT bake rarity into yields" is correct design guidance but its specific multiplier numbers are outdated. Should be sync'd.

### 3.5 🟢 INFO: pockethatch1 Has Different Species Template IDs

pockethatch1 species: 662644 (Fire common). phgamecreatr species: 660000, 662976-662978. Different template ID sets — not a bug, just different deployment histories. A migration would need species re-push.

---

## 4. What Needs Action (Priority-Ordered)

| # | Item | Current State | Target | Effort |
|---|------|--------------|--------|--------|
| 1 | **Double-count** | species yields × earn_mult compound | Only one layer should carry rarity | 1 `setspecies` ×3 + maybe 1 `setconfig` |
| 2 | **Reward pool** | 79 HATCH | 100,000+ HATCH for safety | 1 `fundpool` tx (needs HATCH token) |
| 3 | **EGG anomaly** | 100K on waxwingsuper | Optional: reset to 200 | No admin action exists; would need code |
| 4 | **species-config.json** | Stale earn_mult refs | Update to match C++ | Doc edit only |
| 5 | **Rarity tier distribution** | 70/25/5% (C++ default) | Boss-designated target | 1 `setconfig` (when target is decided) |

---

## 5. CEO Decision Options

### Option A: Fix phgamecreatr In-Place ⭐ Recommended

**What:** Resolve double-count by flattening speciescfg yields. Fund reward pool. Everything else stays as C++ defaults (which already provide production-suitable cost/cap params).

**Pros:**
- 3 players and 25 creatures preserved
- Season 1 already active
- Frontend already points here
- 3 transactions: `setspecies` ×3 (or ×1 if refactored) + `fundpool` ×1

**Cons:**
- WaxwingSuper's 96K EGG stays (testnet-only concern)
- Species template IDs are non-standard (660000, 662976-662978 vs the 11-species plan)

**Steps:**
1. `setspecies` Fire common/uncommon/rare: all yields → 100/300/600/1200/2400 (flat)
2. Verify `earn_mult` stays at 10000/11000/14000 (already correct)
3. `fundpool` with ≥100,000 HATCH
4. Update `species-config.json` earn_mult refs to 1.0/1.1/1.4

### Option B: Migrate to pockethatch1

**What:** Abandon phgamecreatr. Deploy `configv3` table + full 11-species set to pockethatch1. Redirect frontend. 1.5M HATCH pool already in place.

**Pros:** Clean slate. Full 11-species roster. No EGG anomaly.

**Cons:** All 25 creatures orphaned. 3 players lose progress. Must push `configv3` table (not in current ABI — needs code redeploy). Season counter resets.

### Option C: Status Quo (no changes)

**What:** Leave as-is for continued development/testing.

**Pros:** Zero work.

**Cons:** Reward pool will run dry. Double-count persists. Any real players joining face a broken reward loop.

---

## 6. Sun's Recommendation

> **Option A — Flatten speciescfg yields on phgamecreatr, fund the pool, done.**

การทำงานทั้งหมดคือแก้ double-count ด้วยการ flatten species yields ให้เป็น flat per family — ทำให้ rarity premium มาจาก `earn_mult` เพียงที่เดียวตามที่ `species-config.json` ตั้งใจไว้ตั้งแต่แรก. แล้วเติม HATCH เข้า reward pool.

ส่วน `rarity_w_*` (700/250/50 → 70/25/5%) — อันนี้เป็น C++ default ที่ Kevin ตั้งใจไว้สำหรับ testnet ("Boss-locked") อยู่แล้ว. ถ้าอยากปรับเป็น distribution อื่นก็แค่ `setconfig` อีก 1 tx แต่ไม่ใช่ blocker.

**Timeline:** 3-4 transactions. ไม่มี downtime. chain state ไม่หาย.

**สิ่งที่หนูเป็นห่วงที่สุด:** Reward pool แห้ง. 79 HATCH เหลืออยู่นี่ ถ้ามีคน claim อีกครั้งเดียว pool อาจไม่พอจ่าย → `claimreward` revert → player เจอ error "reward pool empty — try again later" โดยไม่เข้าใจว่าทำไม. ถึงแม้ testnet จะไม่มีมูลค่าจริง แต่เสียประสบการณ์ทดสอบ. เติม pool ก่อน อย่างอื่นทีหลังได้.

**Checklist ก่อน CEO เคาะ:**

- [ ] **Flatten species yields?** (Yes → 1 `setspecies` per rarity. 3 txs total for 662976/662977/662978)
- [ ] **Fund pool: เท่าไหร่?** (แนะนำขั้นต่ำ 100,000 HATCH สำหรับ testnet ระยะสั้น)
- [ ] **rarity_w_*: เปลี่ยนจาก 700/250/50?** (ถ้าใช่ → target distribution + 1 `setconfig` tx)
- [ ] **EGG reset?** (optional — testnet only, ไม่มี admin action ใน contract)
- [ ] **ใครเซ็น?** (`phgamecreatr@active` — on-chain key: `EOS5tbKgscZ67nrRpLydFPR1rAGqbhLpy5eZY5CGAwPK2UQGgw9BK`)

---

*Audit completed 2026-07-09. Read-only — no chain state was modified. All chain values verified against C++ defaults in `pockethatch.hpp` (as of 2026-07-09).*
