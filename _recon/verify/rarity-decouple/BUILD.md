# Rarity-Decouple Deploy — BUILD.md

**Date:** 2026-07-23  
**Purpose:** Decouple rarity from species — any species can hatch at any rarity  
**Status:** ✅ DEPLOYED + VERIFIED on wax-testnet

---

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 + WSL 2 (Ubuntu) |
| CDT | 4.1.1 |
| CDT binary | `/home/bagidea/cdt/bin/cdt-cpp` |
| Source | `contract/pockethatch/pockethatch.{hpp,cpp}` |
| Contract | `phgamecreatr` @ wax-testnet |

---

## Build Command

```bash
/home/bagidea/cdt/bin/cdt-cpp \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core \
  -I "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch" \
  -o "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/_recon/verify/rarity-decouple/pockethatch.wasm" \
  "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/pockethatch.cpp" \
  --abigen
```

---

## Artifacts

| File | Size | SHA256 |
|---|---|---|
| pockethatch.wasm | 162,849 bytes | `002ffa9bde5f67bda98ace406a91c37562a654e1cc373ebd4422cb909e72376c` |
| pockethatch.abi | 20,033 bytes | (auto-generated, tables merged post-compile) |

---

## Deploy TXs (wax-testnet)

| Step | TX ID |
|---|---|
| setpaused (true) | `22cb792330982a13037f821fe561c067853c690191d5e9c6eed4347b529c7059` |
| setcode | `2b9a88eecc9d39072d70bf73c112a48862e5e3958a29459c26e805a093519704` |
| setabi | `c0106f717b1b7cac15831a2f287c867703dec303a64ef0e91e50c1ac2886ab04` |
| clearcreatrs | `cdd430336a498ac28167f57b3149434a60bbfcb60ad042beb012b91f0dfd946c` |
| setpaused (false) | `7325c61db29f19d7399590c85e9f9fe0fc2365920f00cfb76143e6e07cec264c` |

---

## On-Chain Verification

```
code_hash: 002ffa9bde5f67bda98ace406a91c37562a654e1cc373ebd4422cb909e72376c
```

Matches compiled wasm ✅

---

## Rarity Decoupling Proof

5 test hatches via `waxwingsuper`:

| asset_id | template_id | egg_type |
|---|---|---|
| 1099603752354 | 662977 (Fire) | 0 (Common) |
| 1099603752355 | 662889 (Fire) | 1 (Uncommon) |
| 1099603752356 | 662889 (Fire) | 0 (Common) |
| 1099603752357 | 662976 (Fire) | 1 (Uncommon) |
| 1099603752358 | 662889 (Fire) | 0 (Common) |

**Template 662889 produced BOTH egg_type=0 AND egg_type=1** — same species, different rarities. ✅

NFT immutable data verified: `{"rarity":"2","genetics":"..."}` — rarity stored on-chain.

---

## Changes Summary

### Contract (`pockethatch.hpp`)
- Added `uint8_t egg_type` to `creature_row` (trailing field — no layout break for new rows)
- Added `clearcreatrs()` admin action
- Changed `pick_template()` signature: no longer takes `egg_type` param (picks from ALL species)
- Changed `mint_creature()` signature: added `egg_type` param

### Contract (`pockethatch.cpp`)
- `pick_template()`: picks from ALL species weighted by `egg_weight` (ignores species `egg_type`)
- `mint_creature()`: stores `rarity` in NFT immutable data + `egg_type` in creature_row
- `hatch()` / `firsthatch()`: pass `rolled_egg_type` through to mint
- `breed()`: rolls independent `egg_type` for offspring + picks species from ALL
- `clearcreatrs()`: uses low-level DB API (avoids deserialization of old-layout rows)
- All economy reads changed from `sp_it->egg_type` to `c_it->egg_type`:
  - `evolve()` satiety gate, `accelerate()` satiety gate
  - `harvest()` awaken_dur, fed_dur, earn_mult
  - `claimreward()` fed_dur
  - `burncreature()` burn payout + EGG refund
  - `on_wax_transfer()` wake cost
