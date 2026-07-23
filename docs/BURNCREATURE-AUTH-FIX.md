# BURNCREATURE-AUTH-FIX — root cause + patch

> Kevin · 2026-07-11 · **DO NOT DEPLOY** — CEO review required first

## Root Cause

`burncreature` sends inline `atomicassets::burnasset` with `permission_level{get_self(), "active"_n}`
(i.e., `phgamecreatr@active`). But `atomicassets::burnasset(asset_owner, asset_id)` checks
`require_auth(asset_owner)` — which is the **player** (e.g., `waxwingsuper`), NOT the contract.

`mintasset` and `setassetdata` work fine because their first parameter (`authorized_minter` /
`authorized_editor`) IS the contract account — `get_self()` auth matches the inline's auth.
`burnasset` is the ONLY atomicassets action where the auth-checked parameter is the **player**,
not the contract.

| atomicassets action | parameter 1 (who gets `require_auth`) | inline auth used | match? |
|---|---|---|---|
| `mintasset(authorized_minter, ...)` | contract (`get_self()`) | `phgamecreatr@active` | ✅ |
| `setassetdata(authorized_editor, ...)` | contract (`get_self()`) | `phgamecreatr@active` | ✅ |
| `burnasset(asset_owner, ...)` | **player** (`owner`) | `phgamecreatr@active` | ❌ |

### Why burns from Jul 4/8 succeeded

Chain traces show those burns had NO `burnasset` inline — the NFT was already gone
(`nft_exists` returned false), so the resilient-burn path skipped the inline entirely.

## Evidence

- **Successful burn tx** `81812ec6539a...` (Jul 8): inline trace → only `hatchtokens1::transfer`,
  NO `atomicassets::burnasset`
- **Failed burn attempts** (Jul 11): 5 attempts, 2 accounts, 2 creatures — all fail with
  `missing authority of [owner]`
- `get_raw_abi` confirms `burnasset` takes `(asset_owner, asset_id)` — first param is owner

## Fix (1 line)

```diff
-            permission_level{get_self(), "active"_n},
+            permission_level{owner, "active"_n},
```

**File:** `contract/pockethatch/pockethatch.cpp`, line 871 (in `burncreature`)

Since `burncreature` already does `require_auth(owner)` at the top (line 853), the player's
`owner@active` authority IS present in the transaction — so switching the inline to use it
is safe and sufficient.

## Alternative considered (escrow flow)

Player transfers NFT → contract, contract catches `on_notify`, burns as owner, pays HATCH.
Rejected: 50+ line change, 2-step UX, unnecessary complexity — the 1-line fix handles the
auth correctly.

## Alternative considered (add owner to authorization array)

Modify `waxwing` pushaction handler to include both signer + contract in auth array.
Rejected: requires plugin-level refactor; the contract fix is self-contained and cleaner.

## Compile status

✅ Compiles clean with CDT 4.1.1 (ricardian warnings only — pre-existing)
- WASM: 128,948 bytes
- SHA256: `37447ddede1f003e7b097467dc73bb84244a74dabd0c4a9547e13dba46bb98ac`
- Build artifact: `build/pockethatch.burnfix.wasm`

## Deployment

**HOLD — DO NOT DEPLOY.** Await CEO review and release order.
When approved, deploy via waxwing: `setcode` + `setabi` on `phgamecreatr`.
