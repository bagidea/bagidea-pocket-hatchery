# Payload Analysis — Pocket Hatchery 6-Tier Deployment

**Prepared by:** Kevin  
**For:** Shino (pre-CEO review)  
**Date:** 2026-07-10  
**Baseline:** Shino's chain-verified numbers (waxsweden live)

---

## (A) setconfig — 44 fields, not 18

The new contract's `config_row` has **44 fields** (see `pockethatch.abi`). Shino's "18 field" likely refers to the 6-tier extension fields:

| Category | Fields | Count |
|----------|--------|-------|
| Rarity weights | rarity_w_common, uncommon, rare, epic, legendary, mythic | 6 |
| Earn multipliers | earn_mult_common through mythic | 6 |
| Fed durations | fed_dur_common through mythic | 6 |
| Cap scaling | cap_scales_rarity | 1 |
| **Total "new" fields** | | **19** |

The remaining 25 fields are legacy config (costs, cooldowns, caps, season, etc.).

**Key principle:** `setconfig` replaces the ENTIRE singleton row. Every field not in the spec MUST be carried forward from chain. Since the current chain ABI is corrupted (hex-encoded), we can't query configv3 directly. The payloads below use Shino's verified values for confirmed fields and hpp defaults for unverified fields.

### Fields verified by Shino (waxsweden live):
- rarity_w: 700/250/50 (common/uncommon/rare)
- earn_mult: 10000/11000/14000
- fed_dur: 172800/259200/432000
- hatch_cost=150, evolve_cost=300, breed_cost="5.0000 HATCH", feed_cost=12
- season_index=3, season_started=1783659821

### Fields UNVERIFIED (using hpp defaults):
- rarity_w_epic=25, rarity_w_legendary=10, rarity_w_mythic=5
- earn_mult_epic=18000, legend=24000, mythic=33000
- fed_dur_epic=604800, legend=864000, mythic=1209600
- cap_scales_rarity=1
- slot_cost=500, cosmetic_cost=100, name_cost="1.0000 HATCH"
- install_cap_bonus=72, feed_cd=21600, harvest_cd=3600, breed_cd=86400
- feed_daily_cap=3, daily_egg_cap=240, offline_cap_h=8, tap_egg_cap=60
- feed_boost=100, rng_oracle="phgamecreatr"

⚠️ **Shino should verify these unverified fields before deploy.**

---

## (B) pick_template(egg_type) — Mechanism

### How it works:
```cpp
uint64_t pick_template(uint64_t egg_type) const {
    species_t sps(get_self(), get_self().value);         // reads spccfgv2 table
    auto idx = sps.get_index<"byeggtype"_n>();            // secondary index on egg_type

    // Sum all egg_weight for species matching this egg_type
    uint64_t total_weight = Σ egg_weight where egg_type == param
    check(total_weight > 0, "no species for this egg type");

    // Roll random, pick weighted
    uint64_t roll = make_seed() % total_weight;
    // walk rows, return template_id when cumulative > roll
}
```

### Flow: hatch → roll_egg_type() → pick_template(egg_type) → mint_creature(template_id)

`roll_egg_type()` uses config.rarity_w_* weights to pick egg_type (0-5).
`pick_template(egg_type)` then picks a species WITHIN that tier from spccfgv2.

### Current state:
- spccfgv2 (old name: speciescfg) has 4 entries: 662889, 662976, 662977, 662978
- 663046/47/48 exist as AtomicAssets templates but NOT in spccfgv2
- After setcode, old speciescfg data is ORPHANED (new contract reads spccfgv2)
- **MUST rebind ALL 7 species** (4 existing + 3 new)

### setspecies payload needed:
- Payload 4: 662889 (Emberling, egg_type=0) — rebind
- Payload 5: 662976 (Emberling, egg_type=0) — rebind
- Payload 6: 662977 (Blazetail, egg_type=1) — rebind
- Payload 7: 662978 (Drakember, egg_type=2) — rebind
- **Payload 8: 663046 (Foxling Epic, egg_type=3) — NEW**
- **Payload 9: 663047 (Foxling Legendary, egg_type=4) — NEW**
- **Payload 10: 663048 (Foxling Mythic, egg_type=5) — NEW**

### ⚠️ Data migration note:
After setcode, these tables are ORPHANED (new contract uses different table names):
- configv2 → configv3 (old config inaccessible)
- speciescfg → spccfgv2 (old species inaccessible)
- creatures → creatrsv2 (old creatures inaccessible)

Tables that SURVIVE: players, rewardpool, claims (same names, compatible structs).

---

## (C) Smoke Test — Forcing an Epic Hatch

### Problem:
Normal hatch() calls roll_egg_type() which uses config rarity weights. If rarity_w_epic=0, Epic can never roll.

### Solution:
**2-step setconfig approach:**
1. **setconfig #1 (smoke-test)**: rarity_w_epic=1, ALL other rarity weights=0
   → Every hatch = Epic (guaranteed). Contract is paused so no players can exploit.
2. Hatch → verify template 663046 issued_supply 0→1
3. **setconfig #2 (real)**: rarity weights 6900/2000/800/250/45/5
4. Unpause contract

This uses exactly 2 setconfig calls matching Shino's queue. The smoke test window (step 1-3) has only Epic rollable, and contract is paused so no external players can exploit.

### Smoke test account:
Use `waxwingsuper` (already has player row, egg_balance=0 — initplayer auto-grants 200 starter EGG, enough for 150 EGG hatch).

---

## (D) setconfig Real Weights — CEO LOCKED

| Tier | egg_type | Weight | % |
|------|----------|--------|-----|
| Common | 0 | 6900 | 69.00% |
| Uncommon | 1 | 2000 | 20.00% |
| Rare | 2 | 800 | 8.00% |
| Epic | 3 | 250 | 2.50% |
| Legendary | 4 | 45 | 0.45% |
| Mythic | 5 | 5 | 0.05% |
| **Total** | | **10000** | **100%** |

Earn multipliers: ×1.0 / ×1.1 / ×1.4 / ×2.0 / ×3.2 / ×5.0 (Sun adjusted)
Fed durations: 48h / 72h / 120h / 168h / 240h / 336h

---

## Complete Queue (single unlock → all in one session)

**UPDATED 2026-07-10** — All 3 reviewer issues resolved.

| # | Action | Notes |
|---|--------|-------|
| 1 | `clearconfig` | **OLD contract** — purge incompatible binary before setcode |
| 2 | `setcode` | New wasm (pockethatch.wasm, 129KB) |
| 3 | `setabi` | **Merged ABI** (pockethatch.merged.abi: 44 fields + 7 tables) |
| 4 | `setpaused(true)` | Lock during setup |
| 5 | `setspecies` 663046 (NEW Epic, egg_type=3) | Fire family base yields |
| 6 | `setspecies` 663047 (NEW Legendary, egg_type=4) | Fire family base yields |
| 7 | `setspecies` 663048 (NEW Mythic, egg_type=5) | Fire family base yields |
| 8 | `setconfig` (smoke-test) | epic=1, others=0 → every hatch = Epic |
| 9 | `hatch` waxwingsuper → Epic | Smoke test |
| 10 | **Verify** 663046 issued 0→1 | curl nfttemplates |
| 11 | `setconfig` (real weights) | 6900/2000/800/250/45/5 |
| 12 | Verify configv3 + spccfgv2 | get_table_rows now works (7 tables in ABI) |

**Key changes from v1:**
- ❌ Removed 4 species rebinds (spccfgv2 survives setcode — verified on chain)
- ✅ Added clearconfig BEFORE setcode (old binary incompatible with 44-field struct)
- ✅ Switched setabi to merged ABI (pockethatch.merged.abi — 7 tables)
- ✅ All numeric config fields chain-echoed from live configv3 (raw hex decode)

---

## ⚠️ Resolved Issues (from reviewer)

1. **[FIXED] ABI tables section**: Generated `pockethatch.merged.abi` with 7 tables (configv3, spccfgv2, players, creatrsv2, lastmint, rewardpool, claims). 44-field config_row. All latest fields present.

2. **[FIXED] Config fields echo from chain**: All numeric fields decoded from live configv3 raw hex (212 bytes). All match hpp-defaults (no offline tuning). 5 name-type fields used from deploy-6tier.ps1 (byte order mismatch in raw decode).

3. **[FIXED] Species rebinds removed**: spccfgv2 is live on chain with 4 rows (verified). Only 3 NEW species (663046/47/48) need binding. No unnecessary rebinds.
