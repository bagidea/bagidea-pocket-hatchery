# Pocket Hatchery — `firsthatch` real root cause (live-verified 2026-06-30)

**From:** Yamamoto · **Zone:** read-only diagnosis + source/ops fix applied (Kevin dead ~40min; boss said "fix now").
**Replaces:** the earlier `BLOCKER-EVOLVE-FIX.md` variant-mismatch speculation — that was **wrong** (re-verified live: the `ATOM_ATTR` variant MATCHES atomicassets exactly). This doc is the corrected, ABI-diff-proven root cause.

Every claim below was checked **live** against WAX testnet RPC (`waxtestnet.greymass.com`) + the deployed atomicassets ABI this pass. No guessing.

---

## TL;DR — why no creature has ever been minted

Two **independent** live-verified blockers. Both must be fixed for the loop to run:

1. **SOURCE BUG (the read-past-end):** `aa_asset_row` (`pockethatch.hpp:32`) declares the last two fields as `ATTR_MAP`, but atomicassets' real `assets_s` row stores them as **opaque `uint8[]` serialized byte blobs**. `resolve_new_asset()` iterates the owner's assets and deserializes raw bytes as a variant map → `datastream read past end` → `firsthatch` reverts → mint rolled back atomically → `creatures` stays empty. **Fixed this pass (hpp edit).**
2. **SETUP GAP:** the atomicassets **collection `pockethatch1` does not exist** on chain (`collections` table scope=pockethatch1 = 0 rows, confirmed via RPC + indexer API), even though schema `creatures` + 2 templates exist → state is inconsistent. `mintasset` would `require_find` the collection and assert before ever reaching the deserialize step. Needs `(re)createcol` + authorize minter.

The evolve deadlock fix (`cpp:402 = c.stage`) is **already applied and deployed** in wasm `3d16ac28` — confirmed in source this pass. It is **not** the current blocker (it only matters after a creature exists).

---

## Evidence (live)

| Check | Result | Source |
|---|---|---|
| `pockethatch1` code_hash | `3d16ac28…` | `get_code_hash` |
| on-disk `build/pockethatch.wasm` sha256 | `3d16ac28…` (**== deployed**) | `sha256sum` |
| `waxwingsuper` code_hash | `5b2dc4c1…` (**OLD, unchanged**) | `get_code_hash` |
| `pockethatch1` ABI tables | `configv2, speciescfg, players, creatures, rewardpool` (**complete, correct**) | `get_abi` |
| `creatures` table @ pockethatch1 | empty (0 rows) | `get_table_rows` |
| configv2 @ pockethatch1 | collection=`pockethatch1`, schema=`creatures`, season=1 (active), paused=0 | `get_table_rows` |
| atomicassets `ATOM_ATTR` order | `int8,int16,…,string,+vectors` | `get_abi atomicassets` |
| pockethatch `ATOM_ATTR` order | **identical** ✅ | `pockethatch.hpp:16-26` |
| schema `creatures` format | `genetics:string, stage:uint32, growth:uint64, name:string` | atomicassets `schemas` |
| `attr_hex()` return type | `std::string` (**== schema genetics:string**) ✅ | `pockethatch.cpp:11` |
| atomicassets real `assets_s` row | …`backed_tokens:asset[]`, `immutable_serialized_data:uint8[]`, `mutable_serialized_data:uint8[]` | `get_abi atomicassets` |
| pockethatch `aa_asset_row` (before fix) | …`backed_tokens`, `immutable_data:ATTR_MAP`, `mutable_data:ATTR_MAP` ❌ | `pockethatch.hpp:32-43` |
| atomicassets `collections` scope=pockethatch1 | **0 rows** (absent) | `get_table_rows` + indexer API |
| atomicassets `schemas` scope=pockethatch1 | 1 (`creatures`) | `get_table_rows` |
| atomicassets `templates` scope=pockethatch1 | 2 (`662644`,`662645`, max=0, issued=0) | `get_table_rows` |

**Read-past-end mechanism:** atomicassets pre-serializes each asset's attribute data into a flat byte blob and stores it opaquely. `resolve_new_asset()` (`cpp:186-199`) opens a `multi_index<"assets"_n, aa_asset_row>` on `atomicassets` scoped to the owner and **iterates every row**. multi_index deserializes the whole row into `aa_asset_row`; the two `ATTR_MAP` fields try to parse the opaque blob as `vector<pair<string, ATOM_ATTR>>` (varint lengths + variant indices + values) → the bytes don't conform → reads past the buffer → throw. Because the throw is inside the `firsthatch` transaction, the inline `mintasset` (which had succeeded) is rolled back with it. No creature persists. **Nothing else in the code reads `immutable_data`/`mutable_data` from this struct** (grep-confirmed), so the fix is safe.

---

## Fix applied this pass

### 1. Source — `aa_asset_row` (`pockethatch.hpp:32-43`)
Last two fields `ATTR_MAP` → `std::vector<uint8_t>` to match `assets_s`:
```cpp
std::vector<uint8_t> immutable_serialized_data;
std::vector<uint8_t> mutable_serialized_data;
```
`resolve_new_asset()` only reads `collection_name` + `asset_id`, so raw bytes are both correct and sufficient.

### 2. Iron wall — WIF scrubbed from every active deploy script/doc
Boss rule: no WIF on disk. Was hardcoded in 6 places; all shell/doc copies now inject in-process via `PH_CONTRACT_PRIV` env with fail-loud `${PH_CONTRACT_PRIV:?…}` guards:
- `deploy/lib.sh` (the cited file — sourced by every step script)
- `deploy/setup-wallet.sh:51`
- `contract/pockethatch/build/deploy.sh:10`
- `contract/pockethatch/build/DEPLOY.md` (keypair block + import line)

**Still open (flagged, not deleted — destructive, owner-owned):** `.secrets/hatch-keys.json` holds the WIFs in plaintext; the persistent-keosd architecture in `setup-wallet.sh` writes `wallet.pw` + `*.key` files under `~/.ph/`. Both belong to the [[secret-exposure-2026-06-26]] rotation scope — **rotate the contract key before any mainnet-adjacent work; the exposed WIF must be considered burned.**

---

## ⚠️ What I could NOT do from here (honest)

I cannot fire chain transactions from this Windows session — `cleos`/`keosd`/the deploy key live on the WSL/Linux deploy box. So the **loop is still not proven on chain** by me. What I *did* is remove the guesswork: the source bug is fixed and verified by ABI diff, the setup gap is identified, and the remaining work is mechanical. Whoever has the deploy box (Kevin when he's back, or me if the boss hands me the box + authorizes the zone) runs the sequence below.

---

## How to PROVE the loop — defer to the canonical runbook

> **The full deploy mechanics live in `DEPLOY-RUNBOOK.md` (~500 lines, the original). It is the single
> source of truth** for toolchain, recompile, `setcode`, AtomicAssets `createcol`/`createschema`/`createtempl`,
> `setconfig`/`setspecies`/`newseason`, key hygiene, and economy wiring. Do **not** re-derive them here —
> that would just create a second, drifting source. This root-cause doc adds only the **firsthatch-specific
> deltas** that ride on top of the runbook:

1. **Source fix is baked into the source you compile.** Ensure the `aa_asset_row` change (§"Fix applied this pass") is present in `pockethatch.{hpp,cpp}` before `compile2.sh`. The fresh wasm sha256 will therefore **differ from the currently-deployed `3d16ac28`**. → Runbook §2 (build), §5.2 (deploy).
2. **Collection `pockethatch1` is ABSENT on chain right now** (`atomicassets` `collections` scope=`pockethatch1` = 0 rows, verified 2026-06-30 this pass — see Evidence; CEO re-confirmed). So `createcol` (Runbook §6.1) is **MANDATORY**, not "already done" — and it must run before any `mintasset`/`firsthatch`. ⚠️ **Open discrepancy (chain-zone, escalated to CEO):** Runbook §LIVE (2026-06-29) records a `createcol` txid (`e1ba5aa4…`) as if it persisted, yet the 06-30 re-probe finds the `collections` row absent (and schemas/templates under that scope still exist — a state that should not be reachable via the standard AA actions, so the mechanism is unresolved). Re-verify with `get table atomicassets pockethatch1 collections` (Runbook §9) before minting; do not trust either doc over a fresh read.
3. **Deploy target = `pockethatch1` (code `3d16ac28`), NOT `waxwingsuper` (stale `5b2dc4c1`)** — see "Deploy-target disclosure" below. ⚠️ Any frontend/panel still pointed at `waxwingsuper` (Poppy's UI did) must be **repointed to `pockethatch1`** or it reads stale/empty game state. Frontend is Poppy's zone — flag it, don't edit it.

**Proof acceptance (boss's DoD):** a `creatures` row exists with `stage ≥ 1` after a real `evolve`, and `harvest` moved EGG. Paste the txids + the row. A txid alone is not success — verify the state mutation landed.

---

## Deploy-target disclosure (DECIDED 2026-06-30 by CEO)

The rework wasm `3d16ac28` is deployed on **`pockethatch1`** (12-char free name), NOT on `waxwingsuper`. `waxwingsuper` still holds OLD code `5b2dc4c1`. Rationale (architecturally correct): `pockethatch` is 11 chars = a premium name needing a name-auction bid (the original "no active bid for name" blocker); `pockethatch1` is 12 chars = free. The config (`configv2.collection = pockethatch1`) already targets pockethatch1. **CEO confirmed 2026-06-30: the target stays `pockethatch1`. Do NOT `setcode waxwingsuper` — it is the issuer/player account, not a contract host; repoint any consumer still reading it (notably Poppy's frontend, which was pointed at `waxwingsuper`) to `pockethatch1`.**

---

## Corrections to my own earlier claims (scar)

- ~~"ATOM_ATTR variant order mismatch causes read-past-end"~~ → **FALSE.** Variant matches atomicassets exactly. Real cause is the `ATTR_MAP`-vs-`uint8[]` field-type mismatch in `aa_asset_row`. (Same scar as before: I claimed a root cause from memory without an ABI diff. The ABI diff this pass killed it in one shot.)
- ~~"on-disk wasm = 4917e745, not deployed"~~ → **STALE.** On-disk wasm is now `3d16ac28` == deployed. Source compiles and is live.
- ~~"ABI missing config/species/cfg tables"~~ → **wrong table names.** Real names are `configv2`/`speciescfg`; ABI is complete and correct.

*Yamamoto — diagnosis + source/ops fixes applied this pass. Loop proof pending the Linux deploy box. Re-probe every claim live before acting; do not trust this doc blindly.*
