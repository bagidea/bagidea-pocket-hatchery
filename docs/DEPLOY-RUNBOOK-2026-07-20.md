# DEPLOY RUNBOOK — pockethatch @ phgamecreatr (WAX testnet)

**Date:** 2026-07-20 · **Author:** Rose (audit) · **Fires:** Poppy
**Contract:** `phgamecreatr` (WAX testnet) · **Current code_hash (pre-deploy):** `559880bf…8859a73`
**Scope:** deploy the uncommitted working-tree fixes (unlockslot range-first + config-driven slot costs, evolve/setname/equipcosmetic mutable-data **merge** that stops wiping `name`/`cosmetic`, new `slot_cost_5/_6`, accelerate + equipcosmetic **whitelist** security gates). The cosmetic schema is **hardcoded** (`constexpr name COSMETIC_SCHEMA = "cosmetics"_n;`) — **no `config_row` field is added**, so the row stays 412 bytes.

> ⚠ **READ FIRST — why config layout MUST stay 412 bytes.** The `config_row` struct swaps
> the retired `name_cost` (an `asset` = 16 B) for two new `uint64` fields `slot_cost_5` +
> `slot_cost_6` (8 + 8 = 16 B) — **byte-for-byte identical size**, verified by Poppy. This is
> the ONLY reason we **do NOT need `clearconfig`**: the live `configv3` singleton, written by
> the old struct, still deserialises cleanly into the new struct (same total = 412 B). The
> only read-side effect is that `slot_cost_5/_6` briefly hold the old `name_cost` bytes
> (harmless garbage) until `setconfig` overwrites them. **Therefore: setcode → setconfig
> (full new row) back-to-back. No clearconfig.** (Adding ANY field to `config_row` — e.g. a
> cosmetic schema name — would shift the tail and force a `clearconfig`; CEO has explicitly
> forbidden that, which is why the schema is a compile-time constant instead.)

---

## 0. Preconditions (do NOT skip)

- [ ] Working tree compiled clean: `cd contract/pockethatch/build && ./compile-v2.sh` (or the active compile script) → produces `pockethatch.wasm` + `pockethatch.abi`. **The ABI must be regenerated** (struct changed).
- [ ] New wasm/abi byte-size known. Deploy needs RAM on `phgamecreatr` for the new code.
- [ ] **Operator key for `phgamecreatr@active` is available** (Poppy holds it). Every step below that mutates contract state is signed `phgamecreatr@active`.
- [ ] A **player key** is also available for the negative tests (e.g. `bagideasuper@active`) — must NOT be `phgamecreatr`.
- [ ] Snapshot/notes of current `configv3` + `rewardpool` + `season_index` saved (values are embedded in step 4 below; `season_index` MUST stay **`4`** so players can't re-claim).

---

## 1. Pre-flight checks (read-only — safe to run now)

### 1a. Confirm the code_hash we are about to replace
```bash
# Use any WAX testnet RPC endpoint (waxwing's selected one works)
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_code_hash \
  -H "content-type: application/json" \
  -d '{"account_name":"phgamecreatr"}'
# EXPECT: {"account_name":"phgamecreatr","code_hash":"559880bf...8859a73",...}
# If the hash differs — STOP. Someone else deployed. Re-audit before continuing.
```

### 1b. Read the LIVE configv3 (to transcribe into step 4 — do not trust memory)
```bash
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"NO-BROADCAST — read table"}' 2>/dev/null
# Read table directly instead (RPC get_table_rows):
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_table_rows \
  -H "content-type: application/json" \
  -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"configv3","json":true}'
```
Confirmed live fields (read 2026-07-20, verbatim from `get_table_rows`): `paused:0,
hatch_cost:150, evolve_cost:300, breed_cost:"5.0000 HATCH", feed_cost:0, slot_cost:500,
cosmetic_cost:100, name_cost:"1.0000 HATCH", install_cap_bonus:72, feed_cd:21600,
harvest_cd:3600, breed_cd:86400, feed_daily_cap:3, daily_egg_cap:240, offline_cap_h:8,
tap_egg_cap:60, feed_boost:100, season_index:4, season_started:1784060782,
rng_oracle:"phgamecreatr", rarity_w_{common:6900,uncommon:2000,rare:800,epic:250,
legendary:45,mythic:5}, burn_base_hatch:"10.0000 HATCH", fed_dur_{172800/259200/432000/
604800/864000/1209600}, earn_mult_{10000/11000/14000/18000/24000/33000},
cap_scales_rarity:1, awaken_dur_{3600/5400/7200/9000/10800/10800}, wax_contract:"eosio.token",
wake_cost_{3/5/10/20/40/80 WAX}, burn_egg_{8/12/16/21/26/30}`.
⚠ The live row **already contains** the full v2 tail (`awaken_dur_*`/`wake_cost_*`/`burn_egg_*`)
AND still has `name_cost`. Step 4 transcribes these values **as-is** (do NOT regenerate), only
**dropping `name_cost`** (retired) and **adding `slot_cost_5:1200` / `slot_cost_6:2500`** in its
place. `season_index` is **4** — must stay 4 (downgrading would let players re-claim).

### 1c. RAM check on the contract account
```bash
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d '{"cmd":"account","args":"phgamecreatr"}'
# Ensure RAM quota - usage > ~600 KB free (new wasm + abi + singleton rewrite).
# If tight, buyram on phgamecreatr BEFORE setcode (Poppy, signed phgamecreatr@active).
```

### 1d. Confirm cosmetic schema status (decides whether equip works post-deploy)
```bash
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" -d '{"cmd":"nftschemas","args":"phgamecreatr"}'
# LIVE: only schemas "creatures" and "creaturesv2" exist. There is NO "cosmetics" schema.
# The contract validates cosmetic templates against the hardcoded name "cosmetics" (no
# config field). ⇒ After deploy, equipcosmetic(non-zero) will REVERT for everyone until a
# "cosmetics" schema + cosmetic templates are created in AtomicAssets (see §"Cosmetics
# feature — dormant until schema exists" below). unequip (cosmetic_tmpl==0) still works.
# This is the SAFE default — no cosmetic can be forged or equipped before art ships.
```

---

## 2. DEPLOY — setabi + setcode  (Poppy, signed `phgamecreatr@active`)

Use the existing build scripts (they already encode wasm/abi hex):
`contract/pockethatch/build/deploy-6tier.ps1` or `single-tx-deploy.cjs`.

**Order matters:** `setabi` first (so node + cleos serialise the new struct), then `setcode`.

```bash
# 2a. setabi (new ABI — required because config_row + new action args changed)
<deploy script setabi phase>   # equivalent to:
#   cleos -u <rpc> set abi phgamecreatr contract/pockethatch/build/pockethatch.abi -p phgamecreatr@active

# 2b. setcode (new wasm)
<deploy script setcode phase>  # equivalent to:
#   cleos -u <rpc> set code phgamecreatr contract/pockethatch/build/pockethatch.wasm -p phgamecreatr@active
```

**Immediately after setcode the game is in a BROKEN state** (old configv3 bytes vs new
struct). Do step 3 + 4 before anyone calls a gameplay action. If practical, do 2→3→4 in
one transaction (the `single-tx-deploy.cjs` script can batch inline actions).

---

## 3. ❌ SKIP clearconfig  (NOT needed — do NOT run it)

Because the struct swap is **byte-for-byte 412 B** (`name_cost` 16 B → `slot_cost_5`+`slot_cost_6`
16 B), the live singleton deserialises cleanly into the new struct. **Do not `clearconfig`.**

- Running `clearconfig` here would **erase `season_index=4` and the rewardpool-adjacent state**
  from the singleton and force step 4 to re-type every value from notes — an unnecessary risk.
- Just go to step 4 and `setconfig` over the existing row. `singleton.set` overwrites in place.

> If, and only if, a `get_table_rows` read after setcode throws a deserialization error (it
> should not), fall back to `clearconfig` + `setconfig`. That path is the §8 rollback variant.

---

## 4. setconfig — FULL new-format row  (Poppy, `phgamecreatr@active`)

**Every field the new `config_row` ABI declares must be present.** Values = the live row
(step 1b) transcribed **as-is**, with exactly two edits: **drop `name_cost`** (retired —
renaming is free) and **add `slot_cost_5:1200` / `slot_cost_6:2500`** in its 16-byte slot.
The v2 tail (`awaken_dur_*`/`wake_cost_*`/`burn_egg_*`) is already live — copy it verbatim,
do NOT regenerate defaults. `season_index` stays **`4`** (downgrading enables re-claim).
`rng_oracle` reset to `""` (testnet block entropy — the live `"phgamecreatr"` value was a
misconfiguration; mainnet → `orng.wax`). There is **no `cosmetic_schema` field** — the schema
name is a `constexpr` in the wasm.

Write this JSON to a file to avoid shell-escaping pain, then pushaction with `--data-binary`:
```bash
# write the file first. (⚠ ignore deploy/args-setconfig.json — it is DEPRECATED, targets the
#   dead pockethatch1 contract with wrong season/rarity values. Use THIS block, verbatim.)
cat > /tmp/setconfig-v3.json <<'JSON'
{"cfg":{
  "token_contract":"hatchtokens1","collection":"phgamecreatr","schema_name":"creatures",
  "fee_account":"phgamecreatr","paused":false,
  "hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,
  "slot_cost":500,"slot_cost_5":1200,"slot_cost_6":2500,
  "cosmetic_cost":100,
  "install_cap_bonus":72,
  "feed_cd":21600,"harvest_cd":3600,"breed_cd":86400,
  "feed_daily_cap":3,"daily_egg_cap":240,"offline_cap_h":8,"tap_egg_cap":60,"feed_boost":100,
  "season_index":4,"season_started":1784060782,"rng_oracle":"",
  "rarity_w_common":6900,"rarity_w_uncommon":2000,"rarity_w_rare":800,
  "rarity_w_epic":250,"rarity_w_legendary":45,"rarity_w_mythic":5,
  "burn_base_hatch":"10.0000 HATCH",
  "fed_dur_common":172800,"fed_dur_uncommon":259200,"fed_dur_rare":432000,
  "fed_dur_epic":604800,"fed_dur_legendary":864000,"fed_dur_mythic":1209600,
  "earn_mult_common":10000,"earn_mult_uncommon":11000,"earn_mult_rare":14000,
  "earn_mult_epic":18000,"earn_mult_legendary":24000,"earn_mult_mythic":33000,
  "cap_scales_rarity":1,
  "awaken_dur_common":3600,"awaken_dur_uncommon":5400,"awaken_dur_rare":7200,
  "awaken_dur_epic":9000,"awaken_dur_legendary":10800,"awaken_dur_mythic":10800,
  "wax_contract":"eosio.token",
  "wake_cost_common":"3.00000000 WAX","wake_cost_uncommon":"5.00000000 WAX",
  "wake_cost_rare":"10.00000000 WAX","wake_cost_epic":"20.00000000 WAX",
  "wake_cost_legendary":"40.00000000 WAX","wake_cost_mythic":"80.00000000 WAX",
  "burn_egg_common":8,"burn_egg_uncommon":12,"burn_egg_rare":16,
  "burn_egg_epic":21,"burn_egg_legendary":26,"burn_egg_mythic":30
}}
JSON

curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d "{\"cmd\":\"pushaction\",\"args\":\"phgamecreatr setconfig $(cat /tmp/setconfig-v3.json) -p phgamecreatr@active\"}"
```
> If waxwing's pushaction arg parsing chokes on the embedded JSON, fall back to cleos:
> `cleos -u <rpc> push action phgamecreatr setconfig /tmp/setconfig-v3.json -p phgamecreatr@active`

---

## 5. Post-deploy verification (read-only)

```bash
# 5a. code_hash changed
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_code_hash \
  -H "content-type: application/json" -d '{"account_name":"phgamecreatr"}'
# EXPECT: a DIFFERENT hash than 559880bf…8859a73. Record the new one here: __________

# 5b. configv3 reads back with the new fields (slot_cost_5/_6, awaken_*, wake_*, burn_egg_*)
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_table_rows \
  -H "content-type: application/json" \
  -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"configv3","json":true}'
# EXPECT: paused false, season_index 4, slot_cost_5 1200, slot_cost_6 2500,
#         wake_cost_common "3.00000000 WAX", burn_egg_mythic 30, NO name_cost field,
#         NO cosmetic_schema field. (Rewardpool balance unchanged — clearconfig was NOT run.)

# 5c. rewardpool untouched (HATCH escrow intact)
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_table_rows \
  -H "content-type: application/json" \
  -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"rewardpool","json":true}'
# EXPECT: same balance as pre-deploy snapshot.
```

Smoke (positive) — one real gameplay action signed by a player to prove the new code runs:
```bash
# player reads their own collection (proves _cfg() no longer throws on the migrated singleton)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr harvest {} -p bagideasuper@active"}'
```

---

## 6. NEGATIVE TESTS — Poppy MUST run these to PROVE cheating is impossible

**Set waxwing's selected account to a normal PLAYER (`bagideasuper`), NOT `phgamecreatr`.**
Every command below must **REVERT**. Paste the actual error back into the deploy ticket.
A command that SUCCEEDS here is a P0 — stop and roll back.

### 6a. Admin actions from a player account → must revert (`missing authority of phgamecreatr`)
```bash
# setpaused (smallest arg — cleanest auth proof)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr setpaused {\"paused\":false} -p bagideasuper@active"}'

# setspecies (well-formed dummy row; auth is checked first so it still reverts, and the
# bogus template is never written because the tx fails)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr setspecies {\"sp\":{\"template_id\":999999,\"growth_rate\":1000,\"thresh_1\":1000,\"thresh_2\":5000,\"thresh_3\":20000,\"thresh_4\":100000,\"thresh_5\":0,\"yield_0\":100,\"yield_1\":300,\"yield_2\":600,\"yield_3\":1200,\"yield_4\":2400,\"yield_5\":0,\"max_stage\":5,\"egg_weight\":1,\"egg_type\":0,\"family\":\"bogus\"}} -p bagideasuper@active"}'

# fundpool
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr fundpool {\"amount\":\"1.0000 HATCH\",\"source\":\"negtest\"} -p bagideasuper@active"}'

# withdraw (tries to sweep escrow)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr withdraw {\"token_contract\":\"hatchtokens1\",\"quantity\":\"1.0000 HATCH\",\"to\":\"bagideasuper\",\"memo\":\"negtest\"} -p bagideasuper@active"}'

# setconfig (full new-format row from a player — must revert on auth)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d "{\"cmd\":\"pushaction\",\"args\":\"phgamecreatr setconfig $(cat /tmp/setconfig-v3.json) -p bagideasuper@active\"}"
```
Expected error for all five: `missing authority of phgamecreatr` (or `missing authority`).

### 6b. equipcosmetic with a bogus template → must revert (`cosmetic template not found…`)
```bash
# Replace <YOUR_ASSET_ID> with a creature asset_id the player actually owns.
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr equipcosmetic {\"owner\":\"bagideasuper\",\"asset_id\":<YOUR_ASSET_ID>,\"cosmetic_tmpl\":999999} -p bagideasuper@active"}'
```
Expected: reverts with `cosmetic template not found in cosmetics schema` (because no
`cosmetics` schema / no template 999999 exists). **No EGG charged, no NFT change.**
Counter-test (should SUCCEED, proves unequip path): same call with `cosmetic_tmpl:0`.

### 6c. feed / evolve on a creature the player does NOT own (another player's asset) → must revert
```bash
# <OTHER_ASSET_ID> = a creature owned by a DIFFERENT account.
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr feed {\"owner\":\"bagideasuper\",\"asset_id\":<OTHER_ASSET_ID>} -p bagideasuper@active"}'
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"phgamecreatr evolve {\"owner\":\"bagideasuper\",\"asset_id\":<OTHER_ASSET_ID>} -p bagideasuper@active"}'
```
Expected: reverts with `not your creature`.

### 6d. Forged / wrong token into the contract → must be rejected
```bash
# (i) Fake token contract: on_wax_transfer is bound to eosio.token::transfer ONLY,
#     so a transfer from a custom token contract never fires the handler — no state change.
#     Deploy a dummy token, then:
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"faketoken123 transfer {\"from\":\"bagideasuper\",\"to\":\"phgamecreatr\",\"quantity\":\"1.0000 FAKE\",\"memo\":\"wake:123\"} -p bagideasuper@active"}'
# EXPECT: tx succeeds on faketoken side but creature 123 is NOT woken (verify stage still 0).
#         The protection is the static on_notify binding, not a revert.

# (ii) Real WAX with a malformed wake memo → must REVERT (handler check(false) / parse fail)
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"eosio.token transfer {\"from\":\"bagideasuper\",\"to\":\"phgamecreatr\",\"quantity\":\"0.00010000 WAX\",\"memo\":\"wake:notanumber\"} -p bagideasuper@active"}'
# EXPECT: revert (memo parse). WAX NOT debited (whole tx rolls back).

# (iii) Real WAX, valid memo, but asset belongs to someone else → must REVERT
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"pushaction","args":"eosio.token transfer {\"from\":\"bagideasuper\",\"to\":\"phgamecreatr\",\"quantity\":\"3.00000000 WAX\",\"memo\":\"wake:<OTHER_ASSET_ID>\"} -p bagideasuper@active"}'
# EXPECT: revert with `not your creature`. WAX NOT debited.
```

---

## 7. Cosmetics feature — dormant until schema exists  (hand-off to the design/art team)

> **Read this even if you are not the deployer.** This section is the checklist the
> **art / AtomicAssets team** follows to *turn the cosmetics feature on* after deploy.
> No contract change is needed — the contract already validates cosmetic templates
> against the hardcoded schema name `"cosmetics"`. The feature is simply asleep until
> that schema + templates exist on chain.

### Why it reverts today (and why that is the safe state)

`equipcosmetic` (non-zero template) calls `cosmetic_template_valid(collection, "cosmetics",
tmpl)`, which looks up the `templates` table of `atomicassets`, scoped to
`phgamecreatr`, and accepts the template **only if** it exists AND its `schema_name == "cosmetics"`.
Today the collection has only `creatures` + `creaturesv2` — **no `cosmetics` schema** — so every
equip attempt reverts with `cosmetic template not found in cosmetics schema`. Nobody can forge
or equip a cosmetic until real art is published. **Unequip (`cosmetic_tmpl == 0`) always works
and charges no EGG.**

### Wake-up checklist (art / AtomicAssets team — all atomicassets actions, signed `phgamecreatr@active`)

- [ ] **1. Create the `cosmetics` schema** in collection `phgamecreatr`:
  ```bash
  # schema_format = the attributes a cosmetic template carries. Minimal viable:
  #   name (string), the rest is immutable template data you choose (image CID, slot, rarity…)
  # Run via waxwing (or cleos). Write the JSON to a file because the format array is long.
  cat > /tmp/cosmetics-schema.json <<'JSON'
  {"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"cosmetics",
   "schema_format":[["name","string"],["img","ipfs"],["slot","uint8"],["rarity","string"]]}
  JSON
  curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
    -d "{\"cmd\":\"pushaction\",\"args\":\"atomicassets createschema $(cat /tmp/cosmetics-schema.json) -p phgamecreatr@active\"}"
  ```
  > `schema_format` is `[[name,type],…]`. Adjust the attribute list to what art actually ships —
  > the contract does NOT read these; it only checks the template *exists* in this schema.

- [ ] **2. Create one or more cosmetic templates** (`createtemplate`) and **record each `template_id`**:
  ```bash
  cat > /tmp/cosmetic-tmpl-1.json <<'JSON'
  {"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"cosmetics",
   "transferable":true,"burnable":false,"max_supply":0,
   "immutable_data":[["name","Crimson Scarf"],["img","QmReplaceWithRealCID"],["slot",0],["rarity","common"]]}
  JSON
  curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
    -d "{\"cmd\":\"pushaction\",\"args\":\"atomicassets createtemplate $(cat /tmp/cosmetic-tmpl-1.json) -p phgamecreatr@active\"}"
  # ⚠ atomicassets returns the NEW template_id in the `lognewtemplate` event / hyperion trace.
  #    NOTE IT — that is the number players pass to equipcosmetic.
  ```
  > `max_supply:0` = unlimited mint. `immutable_data` values use `[name, value]` pairs; IPs image
  > is the CID as a string. **No contract deploy, no setconfig** — schema name is already hardcoded.

- [ ] **3. Smoke test — equip ONE creature** (signed by the player who owns it):
  ```bash
  # replace <ASSET_ID> (a creature the player owns) and <TMPL_ID> (from step 2)
  curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
    -d '{"cmd":"pushaction","args":"phgamecreatr equipcosmetic {\"owner\":\"bagideasuper\",\"asset_id\":<ASSET_ID>,\"cosmetic_tmpl\":<TMPL_ID>} -p bagideasuper@active"}'
  # EXPECT: success. Player's EGG drops by cosmetic_cost (100). The creature NFT's mutable
  #         data now has cosmetic = <TMPL_ID> (verify via waxwing nftasset <ASSET_ID>).
  ```

- [ ] **4. Verify unequip is free + clean**:
  ```bash
  curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
    -d '{"cmd":"pushaction","args":"phgamecreatr equipcosmetic {\"owner\":\"bagideasuper\",\"asset_id\":<ASSET_ID>,\"cosmetic_tmpl\":0} -p bagideasuper@active"}'
  # EXPECT: success, EGG unchanged, cosmetic attribute removed from the NFT.
  ```

- [ ] **5. Cheat-test — bogus template still reverts** (proves the whitelist is real):
  ```bash
  curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
    -d '{"cmd":"pushaction","args":"phgamecreatr equipcosmetic {\"owner\":\"bagideasuper\",\"asset_id\":<ASSET_ID>,\"cosmetic_tmpl\":999999} -p bagideasuper@active"}'
  # EXPECT: revert "cosmetic template not found in cosmetics schema". No EGG charged.
  ```

**Done = cosmetics live.** No involvement from the contract/deploy team is required at any step.

---

## 8. Rollback (if a P0 found)

There is no in-place rollback of game state. If a critical bug surfaces:
1. `setpaused true` (Poppy, `phgamecreatr@active`) — freezes all gameplay actions:
   ```bash
   curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
     -d '{"cmd":"pushaction","args":"phgamecreatr setpaused {\"paused\":true} -p phgamecreatr@active"}'
   ```
2. Re-deploy the previous known-good wasm/abi (from git HEAD), then re-run setconfig
   with the **old** layout (re-add `name_cost`, drop `slot_cost_5/_6`). There is no
   `cosmetic_schema` field to worry about in either layout.
3. Do NOT clearconfig before the rollback setconfig unless you also restore season_index=4
   and the rewardpool — otherwise players could re-claim.

---

## 9. Sign-off

- [ ] code_hash recorded (new): __________
- [ ] configv3 reads back with all new fields, season_index=4, no name_cost, no cosmetic_schema
- [ ] rewardpool balance unchanged
- [ ] 6a all 5 reverted on auth
- [ ] 6b bogus equip reverted; unequip (tmpl 0) succeeded
- [ ] 6c feed/evolve on another player's asset reverted
- [ ] 6d fake token ignored; bad-memo & not-your-creature WAX reverted (WAX not debited)
- [ ] Poppy + CEO signed
