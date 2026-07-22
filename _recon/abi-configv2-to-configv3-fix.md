# ABI Drift Fix: configv2 → configv3

**Date:** 2026-07-19  
**Status:** Ready for next setcode window

---

## The Problem

The local `live_abi.json` is **stale** — it was dumped from an older on-chain ABI and was never refreshed after the contract was updated. **Three** table names are wrong in the local dump, though the on-chain ABI is correct:

| Source Table Name | Local `live_abi.json` | On-Chain (actual) | On-Chain Query Result |
|---|---|---|---|
| `configv3` | `configv2` ❌ | `configv3` ✅ | `configv3` returns data; `configv2` = "not specified in ABI" |
| `creatrsv2` | `creatures` ❌ | `creatrsv2` ✅ | `creatrsv2` returns data; `creatures` = "not specified in ABI" |
| `spccfgv2` | `speciescfg` ❌ | `spccfgv2` ✅ | `spccfgv2` returns data; `speciescfg` = "not specified in ABI" |
| `players` | `players` ✅ | `players` ✅ | Match |
| `lastmint` | `lastmint` ✅ | `lastmint` ✅ | Match |
| `rewardpool` | `rewardpool` ✅ | `rewardpool` ✅ | Match |
| `claims` | `claims` ✅ | `claims` ✅ | Match |

### Evidence (verified 2026-07-19)
```
# configv3: ✅ data
# configv2: ❌ "Table configv2 is not specified in the ABI"
# creatrsv2: ✅ data  (creatures query FAILS)
# spccfgv2:  ✅ data  (speciescfg query FAILS)
```

### Source line references
| Source | Line | Value |
|---|---|---|
| `pockethatch.hpp` | 129 | `struct [[eosio::table("configv3")]] config_row` |
| `pockethatch.hpp` | 219 | `typedef singleton<"configv3"_n, config_row> config_t;` |
| `pockethatch.cpp` | 1056 | `uint64_t tbl = "configv3"_n.value;` |
| `pockethatch.hpp` | 298 | `struct [[eosio::table("creatrsv2")]] creature_row` |
| `pockethatch.hpp` | 314 | `typedef multi_index<"creatrsv2"_n, ...> creatures_t;` |
| `pockethatch.hpp` | 221 | `struct [[eosio::table("spccfgv2")]] species_row` |
| `pockethatch.hpp` | 265 | `typedef multi_index<"spccfgv2"_n, ...> species_t;` |

---

## Root Cause

**Good news:** The on-chain ABI IS correct — all three actual table names (`configv3`, `creatrsv2`, `spccfgv2`) match the source code and queries work.

**Problem:** The local `live_abi.json` was never refreshed after the ABI was updated on-chain (likely via `setabi` or a full `setcode`). It still reflects old table names from a previous version.

**Why `live_abi.json` matters:** Tools (waxwing, deploy scripts, block explorers) that read the local dump will try to query wrong table names and fail. The on-chain state is healthy — this is purely a documentation sync issue.

---

## Required Fix (at next setcode)

### 1. Rebuild the ABI from source

```bash
cd contract/pockethatch
# CDT will generate pockethatch.abi with correct "configv3" table name
eosio-cpp -abigen pockethatch.cpp -o build/pockethatch.wasm
```

### 2. Update `live_abi.json`

After setcode, immediately re-dump:
```bash
cleos get abi phgamecreatr > live_abi.json
```

### 3. Verify before setcode

```bash
# Confirm generated ABI says configv3 (not configv2)
grep -c '"name":"configv3"' build/pockethatch.abi     # should be 1
grep -c '"name":"configv2"' build/pockethatch.abi     # should be 0
```

### 4. Verify ALL table names match after compilation

```bash
# After CDT compile, verify EVERY table name matches source:
echo "Expected: configv3 creatrsv2 spccfgv2 players lastmint rewardpool claims"
grep -oP '"name":"\K[^"]+' build/pockethatch.abi | sort
```

### 5. Stale build artifacts to clean

These files in `contract/pockethatch/build/` may have old ABI table names:
```
build/live_abi.json
build/pockethatch.abi
build/pockethatch.v2.abi
build/pockethatch.v2.merged.abi
build/pockethatch.v3.merged.abi
build/pockethatch.new.merged.abi
build/pockethatch.merged.abi
build/pockethatch.burnfix.abi
build/pockethatch.fixed.abi
build/pockethatch.abi.pre-predict
build/pockethatch.abi.v1bak
```

After recompile + setcode, delete or update all stale ABI files.

---

## Risk

| Scenario | Risk |
|---|---|
| Setcode WITHOUT fixing ABI | `configv2` query keeps failing — no gameplay impact, but tooling (waxwing, block explorers) can't read config |
| Setcode WITH correct configv3 ABI | Zero risk — ABI matches source |
| Setabi ONLY (not setcode) | Low risk — just syncs ABI, no code change. But configv3 was already working, so only cosmetic |

---

## Recommendation

Fix during the NEXT setcode (e.g. when deploying the `name_cost` enforcement patch). Include ALL ABI table name corrections in one shot:

1. Compile with CDT → correct `configv3` in ABI
2. `setcode` + verify `configv3` query works
3. Re-dump `live_abi.json` immediately
4. Clean up stale `build/*.abi` files that still say `configv2`
