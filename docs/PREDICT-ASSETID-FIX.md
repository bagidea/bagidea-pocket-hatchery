# Pocket Hatchery — mint asset_id fix (predict, not read-back) — Kevin, 2026-07-08

**Zone:** contract source fix + staged deploy. **NOT deployed** — waiting on CEO "go".
Every claim below is live-verified against WAX testnet (`wax-testnet.eosphere.io`) — no guessing.

---

## TL;DR — the brief said "pick_template crash"; that was a red herring

`pick_template` does **not** crash. A hatch **succeeded on chain today** (2026-07-08 13:15:30):
`hatch{owner:waxwingsuper, egg_type:0}` → `logmint asset 1099603751799, template 662977` →
the byeggtype secondary index resolved 662977 correctly and AtomicAssets minted the NFT.

The real, live-proven bug is the **mint asset_id binding** in `mint_creature` (and the
identical `breed` second mint site): both read the asset_id back *after* dispatching the
inline `mintasset`. An inline action queued with `.send()` executes **after** the dispatching
action returns — so the read-back (whether iterating the owner's assets *or* reading the
`lastmint` singleton fed by the `logmint` notification) returns the **previous** mint's id,
never this one.

Result on chain (verified this pass):
- **Orphan NFTs** (minted, no `creatures` row): `…656, …658, …704, …799`
- **Ghost creature row** (row exists, no backing NFT): `…659`

This is Poppy's 2026-07-02 `resolve_new_asset` bug (see `HATCH-RESOLVE-ROOT-CAUSE.md`). The
prior "fix" swapped table-iteration → `lastmint` singleton but kept the **identical timing
hazard**, so it never actually fixed it.

---

## Live evidence

| Check | Result | Source |
|---|---|---|
| deployed contract account | **`phgamecreatr`** (NOT pockethatch1 / waxwingsuper) | config has rarity fields + speciescfg 662976/7/8 |
| deployed wasm sha256 | `7107dc9a…` == on-disk `build/pockethatch.wasm` (pre-fix) | `get_code` + `sha256sum` |
| `hatch` today 13:15:30 | ✅ minted asset 1099603751799 / template 662977 | `get_actions` |
| speciescfg byeggtype idx | egg_type 0→662976, 1→662977, 2→662978 (all resolve) | `get_table_rows` idx_pos=2 |
| creatures vs real AA assets | 4 orphan NFTs, 1 ghost row | table cross-check |
| atomicassets `config.asset_counter` | 1099603751800 (last mint was …799) | `get_table_rows` |
| → AA assigns id = counter-at-mint | **799 + 1 = 800**; next mint gets current counter | arithmetic proof |

---

## The fix (source)

Predict the asset_id from the AtomicAssets global counter **before** dispatch. AA assigns each
new asset `id = current asset_counter`, then increments — so the value read immediately before
`mintasset.send()` is exactly the id this mint will receive.

**Files (both gitignored — contract lives outside the office monorepo):**
`contract/pockethatch/pockethatch.hpp`, `contract/pockethatch/pockethatch.cpp`

1. **hpp** — new AA config singleton mirror + helper decl:
   ```cpp
   struct aa_config_row {
       uint64_t asset_counter;
       int32_t  template_counter;
       uint64_t offer_counter;
       std::vector<std::pair<std::string,std::string>> collection_format;
       std::vector<extended_symbol>                     supported_tokens;
   };
   typedef singleton<"config"_n, aa_config_row> aa_config_t;
   // ...
   uint64_t predict_asset_id() const;   // added next to resolve_new_asset
   ```
2. **cpp** — `predict_asset_id()` reads `atomicassets/config.asset_counter`.
3. **cpp** — `mint_creature` (cpp:257) and `breed` (cpp:688): replace the
   `last_mint_t lm; lm.get(); asset_id = mint.asset_id;` block with
   `uint64_t asset_id = predict_asset_id();` **placed before** the `mintasset.send()`.
4. `on_logmint` + the `lastmint` singleton are left in place (dead writer, harmless) to
   minimise the diff — removing a notify handler is riskier than leaving it inert.

`resolve_new_asset()` is now fully unused but kept (no behavioural impact).

---

## Build — verified reproducible

CDT 4.1.1 (WSL): `bash compile2.sh`

| | sha256 |
|---|---|
| deployed / pre-fix wasm | `7107dc9aa3f18e67e552d87133ee546d50670eca44386471e05950fc76691bcf` |
| **new wasm (this fix)** | `0a21adc35a83e500f745625287a876c7a5aeb2ebf5527b525b605f57b05fbdb7` |

Compiles clean (only cosmetic "no ricardian contract" warnings).

### ABI: **unchanged → setabi NOT required**
`predict_asset_id` is a private helper and `aa_config_row` is an external-table mirror, not a
contract table. No action/table/struct exposed changes. Deploy is **setcode only**.

> ⚠️ Toolchain gotcha for whoever deploys: CDT 4.1.1 `--abigen` does **not** emit the
> `[[eosio::table]]` structs (players/creatures/rewardpool/claims/lastmint) — `build/pockethatch.abi`
> is missing them. The canonical, on-chain-matching ABI is **`build/pockethatch.merged.abi`**
> (verified == deployed ABI on tables/actions/structs/types/variants this pass). Do **not**
> `setabi` with the raw `pockethatch.abi`. Since this fix doesn't touch the ABI anyway, the
> correct move is: **skip setabi entirely.**

---

## Deploy commands — STAGED, DO NOT RUN until CEO says go

Prereq: waxwing wallet unlocked, network = wax-testnet, actor = `phgamecreatr`.

**setcode only** (via the office waxwing `pushaction`):
```powershell
# from contract/pockethatch/build/
$wasm = [IO.File]::ReadAllBytes("pockethatch.wasm")
$hex  = -join ($wasm | % { $_.ToString('x2') })
$body = @{ cmd='pushaction'; args="eosio setcode `"{\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$hex\`"}`" --actor phgamecreatr" } | ConvertTo-Json -Compress
[IO.File]::WriteAllText("_setcode_predict.json",$body,[Text.Encoding]::UTF8)
curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@_setcode_predict.json"
```
(The existing `deploy-waxwing.ps1` also does setabi with the broken `pockethatch.abi` — **do not
use it as-is**; setcode-only is what this fix needs.)

---

## Post-deploy proof (DoD)

1. `initplayer` a fresh account → `hatch` → confirm a **new** `creatures` row whose `asset_id`
   equals the freshly minted AA asset (no orphan, no ghost). Check:
   ```
   asset_counter before hatch == new creature.asset_id == the logmint asset_id
   ```
2. Verify `creatures` asset_ids now form a 1:1 set with real AA assets for that owner.
3. (Optional cleanup, separate action) reconcile the 4 pre-existing orphan NFTs / 1 ghost row —
   **not** part of this code fix; flag to CEO.

*Kevin — root cause live-proven, source fixed, wasm built + reproducible, ABI confirmed
unchanged, deploy staged. Holding for CEO go before setcode. Contracts repo push still on hold.*
