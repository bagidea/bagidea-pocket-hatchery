# Config Field Enforcement Audit — phgamecreatr (pockethatch v3)

**Date:** 2026-07-19  
**Source:** `contract/pockethatch/pockethatch.cpp` + `contract/pockethatch/pockethatch.hpp`  
**Live config:** `configv3` table on WAX testnet (verified via `get_table_rows`)

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ **Enforced** | Config value is read AND applied in contract logic (cost deduction, guard, etc.) |
| ❌ **Ghost** | Config value is declared in struct + persisted on-chain but NEVER used in any action — economy does NOT match config |
| ⚠️ **Partial** | Config value is used but only conditionally or with a fallback that bypasses it |

---

## Audit Table

| # | Config Field | Type | Live Value (testnet) | Status | Enforced At | Notes |
|---|---|---|---|---|---|---|
| 1 | `token_contract` | name | `hatchtokens1` | ✅ | `burn_hatch:160`, `breed:784`, `claimreward:737`, `burncreature:967`, `sweepableHatch:1142`, `withdraw:1156` | Used everywhere HATCH transfers happen |
| 2 | `collection` | name | `phgamecreatr` | ✅ | `resolve_new_asset:274`, `nft_exists:305`, `mint_creature:331`, `evolve:556`, `setname:902`, `equipcosmetic:1032`, `burncreature:935`, `breed:821`, `on_logmint:1183` | Collection identity for NFT operations |
| 3 | `schema_name` | name | `creatures` | ✅ | `mint_creature:331`, `breed:821` | Schema for NFT mint |
| 4 | `fee_account` | name | `phgamecreatr` | ✅ | `on_wax_transfer:1253` | Guarded: `!= get_self()` prevents self-transfer |
| 5 | `paused` | bool | `0` | ✅ | `hatch:366`, `firsthatch:401`, `feed:435`, `evolve:494`, `harvest:575`, `claimreward:675`, `breed:748`, `accelerate:861`, `unlockslot:992`, `equipcosmetic:1016` | 10 action gates |
| 6 | `hatch_cost` | uint64 | `150` | ✅ | `hatch:378` | Deducted as EGG from player |
| 7 | `evolve_cost` | uint64 | `300` | ✅ | `evolve:534` | Multiplied by `(stage+1)` |
| 8 | `breed_cost` | asset | `5.0000 HATCH` | ✅ | `breed:772` | 40% burn, 60% → pool |
| 9 | `feed_cost` | uint64 | `0` | ✅ | `feed:465` | Guard `if (cfg.feed_cost > 0)` — currently 0 (free feeding, CEO locked) |
| 10 | **`slot_cost`** | uint64 | `500` | ❌ **Ghost** | — | `unlockslot:999-1003` uses **hardcoded** staircase (500/1200/2500/geometric). Config value is **completely ignored**. |
| 11 | `cosmetic_cost` | uint64 | `100` | ✅ | `equipcosmetic:1025` | Deducted as EGG |
| 12 | **`name_cost`** | asset | `1.0000 HATCH` | ❌ **Ghost** | — | `setname:899` reads config with `_cfg()` but **never uses `cfg.name_cost`** — no token deduction of any kind. Known bug (this audit). |
| 13 | **`install_cap_bonus`** | uint64 | `72` | ❌ **Ghost** | — | Never referenced in ANY source file. Intended to increase daily EGG cap after install — never wired. |
| 14 | `feed_cd` | uint32 | `21600` | ✅ | `feed:449` | 6h cooldown per creature |
| 15 | `harvest_cd` | uint32 | `3600` | ✅ | `harvest:586`, `claimreward:692` | 1h cooldown per player |
| 16 | `breed_cd` | uint32 | `86400` | ✅ | `breed:759-760` | 24h per parent |
| 17 | `feed_daily_cap` | uint32 | `3` | ✅ | `feed:462` | Max feeds/creature/day |
| 18 | `daily_egg_cap` | uint64 | `240` | ✅ | `harvest:656` | Net EGG/player/day (scales with rarity if `cap_scales_rarity`) |
| 19 | `offline_cap_h` | uint32 | `8` | ✅ | `harvest:602` | Max offline EGG accrual window |
| 20 | **`tap_egg_cap`** | uint64 | `60` | ❌ **Ghost** | — | Never referenced in contract. Likely frontend-only parameter that was never wired server-side. |
| 21 | `feed_boost` | uint64 | `100` | ✅ | `feed:475` | Growth points per feed |
| 22 | `season_index` | uint16 | `4` | ✅ | `firsthatch:402`, `claimreward:680,689`, `newseason:1115` | Season tracking |
| 23 | `season_started` | uint32 | `1784060782` | ✅ | `newseason:1116` | Timestamp of season start |
| 24 | **`rng_oracle`** | name | `phgamecreatr` | ❌ **Ghost** | — | Declared but never read. `make_seed:190` uses `tapos_block_prefix()` + `tapos_block_num()` + `transaction_size()` + `current_time_point()` — fully block-entropy based. Oracle integration not wired. |
| 25-30 | `rarity_w_common` … `rarity_w_mythic` | uint16 | `6900/2000/800/250/45/5` | ✅ | `roll_egg_type:250-264` | Rarity tier roll weights |
| 31 | `burn_base_hatch` | asset | `10.0000 HATCH` | ✅ | `burncreature:952` | Base × stage_mult × rarity_mult |
| 32-37 | `fed_dur_common` … `fed_dur_mythic` | uint32 | various (48h–14d) | ✅ | `fed_duration_for:94-102` used in `harvest:509,633,705` + `evolve:509` | Satiety duration by rarity |
| 38-43 | `earn_mult_common` … `earn_mult_mythic` | uint16 | various (×1.00–×3.30) | ✅ | `earn_mult_for:106-114` used in `harvest:647` | Harvest yield multiplier by rarity |
| 44 | `cap_scales_rarity` | uint8 | `1` | ✅ | `harvest:657` | If 1, daily cap × best owned rarity earn_mult |
| 45-50 | `awaken_dur_*` | uint32 | various (1h–3h) | ✅ | `awaken_duration_for:118-126` used in `harvest:613` | Auto-awaken timer by rarity |
| 51 | `wax_contract` | name | `eosio.token` | ✅ | `on_wax_transfer:1255` | WAX token contract |
| 52-57 | `wake_cost_*` | asset | various (3–80 WAX) | ✅ | `wake_cost_for:130-137` used in `on_wax_transfer:1241` | WAX cost to skip awaken timer |
| 58-63 | `burn_egg_*` | uint64 | various (8–30) | ✅ | `burn_egg_for:142-150` used in `burncreature:974` | Flat EGG refund on burn |

---

## Summary

| Category | Count | Fields |
|---|---|---|
| **Enforced ✅** | 58 | All properly wired config values |
| **Ghost ❌** | 5 | `slot_cost`, `name_cost`, `install_cap_bonus`, `tap_egg_cap`, `rng_oracle` |
| **Partial ⚠️** | 0 | — |

### Impact Assessment

| Ghost Field | Impact | Risk if Set to Wrong Value |
|---|---|---|
| `slot_cost` (500) | **Low** — hardcoded values work; config value is cosmetic | Changing config has ZERO effect → confusing for admin |
| `name_cost` (1.0000 HATCH) | **Medium** — players rename for free, economy leak | Admin thinks renaming costs 1 HATCH but it's free |
| `install_cap_bonus` (72) | **Low** — feature not implemented yet | Value is aspirational; no runtime effect |
| `tap_egg_cap` (60) | **Low** — frontend-only parameter | Contract doesn't enforce tap limit |
| `rng_oracle` | **Medium** — RNG currently block-based (predictable by block producers) | Oracle not integrated; testnet-OK but mainnet risk |

### Recommended Priority for Fix

1. 🔴 `name_cost` — has economic value, actively used by players (setname is live)
2. 🟡 `rng_oracle` — security concern for mainnet launch
3. 🟡 `slot_cost` — confusing admin UX, low economic impact
4. 🟢 `install_cap_bonus` — not wired, but feature isn't built yet
5. 🟢 `tap_egg_cap` — frontend concern, contract doesn't need it
