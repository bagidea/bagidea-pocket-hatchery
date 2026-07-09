# Pocket Hatchery — Deploy + Economy RUNBOOK

> **Owner of this runbook:** Yamamoto (GLM) — knowledge handoff, **read-only**.
> **Owner of the contract source + redeploy + economy numbers:** Kevin.
> **Chain target:** WAX **testnet** (chain_id `f16b1833…`).
>
> **What this is:** a faithful summary of the toolchain the project already uses, so Kevin
> can rebuild + redeploy the (fixed) contract and stand the economy up without rediscovering
> every step. **It is NOT a deploy and NOT a to-do list for me** — I did not touch the chain,
> the wallet, or the source this turn. Everything below is reconstructed from the files in
> `contract/`, `deploy/`, `build/DEPLOY.md`, and the contract source.
>
> **Every private key, public key, and password below is a PLACEHOLDER (`<…>`).** Never paste
> real secrets into this doc. See §11 for the live secret-exposure problem you'll inherit.

---

## ⚡ LIVE ON-CHAIN REALITY — verified by Yamamoto via RPC, 2026-06-29 ~20:05 UTC

> **This section supersedes the stale "NOT verified / assume not run" wording in §10 below.**
> I re-probed WAX testnet (chain_id `f16b1833…`, RPC `waxtestnet.greymass.com` + Hyperion
> `wax-testnet.eosphere.io`) directly. **Setup is DONE. The gameplay loop has NEVER run.** Every
> claim below is backed by a live table read or a real txid (all blocks < LIB → confirmed/irreversible).

### What actually happened on chain (real txids, all 2026-06-29 19:43–19:55 UTC)

| Step | Block | txid (short) | Observable delta |
|---|---|---|---|
| `buyrambytes` 1,536,000 B → `pockethatch1` | 413676619 | `e5f50b4e…` | **payer `waxwingsuper` −85.065 WAX**, `pockethatch1` +1.5 MB RAM |
| `setcode` `hatchtokens1` (eosio.token) | 413676981 | `4fe4fb24…` | token contract live |
| `create` HATCH (issuer waxwingsuper, max 1 B) | 413676984 | `40ad1c49…` | `stat` row created |
| `issue` 10,000,000 HATCH → waxwingsuper | 413676987 | `cd0bc44c…` | waxwingsuper +10 M HATCH |
| `setcode` `pockethatch1` (1st deploy) | 413676796 | `828a8575…` | game contract live |
| AA `createcol`/`createschema`/`createtempl` | 413677276–282 | `e1ba5aa4…`/`6a2c6b69…`/`3e474d52…` | collection `pockethatch1`, schema `creatures`, **template_id 662644** |
| `setconfig` | 413677455 | `66e3fde1…` | config row written (collection `pockethatch1` ✅, fee_account `hatchfees1`) |
| `setspecies` | 413677456 | `4a3e617e…` | `speciescfg` row, template 662644, family Fire, max_stage 5 |
| `newseason` | 413677460 | `54c2c93f…` | season_index 1, season_started 1782762626 |
| `initplayer` waxwingsuper (×3, upsert) | 413677568/848/413678679 | `eb9ade5d…`/`a011c428…`/`eaa77315…` | `players` row = waxwingsuper |
| `transfer` 1 HATCH waxwingsuper→pockethatch1 (memo `direct-sign…`) | 413677979 | `448b2aca…` | waxwingsuper −1, **pockethatch1 holds 1.0000 HATCH** (orphaned — no on_notify) |
| `setcode` `pockethatch1` (**2nd deploy / redeploy**) | 413679079 | `fbba64e3…` | contract re-set after a fix attempt |

### Current state (live table reads)

- **HATCH**: supply `10,000,000.0000`, issuer `waxwingsuper`; waxwingsuper holds `9,999,999.0000`, `pockethatch1` holds `1.0000` (= the orphaned test transfer; not burned, not pooled).
- **`creatures` = 0 rows. `rewardpool` = 0 rows.** The mint/hatch/grow loop has produced **zero** state. The single registered player `waxwingsuper` has `total_hatch_burned = 0`, `egg_balance = 0`, `total_egg_farmed = 0`.
- **`speciescfg` = 1 row** (template 662644 ✅). **`players` = 1 row** (waxwingsuper).
- **`hatchfees1` does NOT exist on chain** (`get_account` → error `3060002 account_query_exception`). config points `fee_account` at a non-existent account.
- **`hatchroot111` exists but is inert**: created 19:42:34 UTC, ram_quota 9594 (~9.5 KB), 0 net/cpu used, 0 game actions. A dead orphan — the "separate root-creator" role was never wired into the game.

### Why the loop was never provable on this deploy (deterministic, not a guess)

`burn_hatch()` (`contract/pockethatch/pockethatch.cpp:91–109`) fires two inline actions:
1. `hatchtokens1::transfer` with `permission_level{from=waxwingsuper, active}` → needs **waxwingsuper** auth.
2. `hatchtokens1::retire` with `permission_level{pockethatch1, active}` → standard eosio.token does `require_auth(st.issuer)`, issuer = **waxwingsuper**.

Live `get_account waxwingsuper`: `active` permission has `accounts=[]` (key-only, EOS4xELM…) — **no `pockethatch1@eosio.code` linkage**. So `pockethatch1` cannot satisfy `waxwingsuper`'s authority for either inline action → **`hatch` (and every burn-bearing action: feed/evolve/breed/accelerate) reverts with "missing authority of waxwingsuper"** until Kevin either (a) links `pockethatch1@eosio.code → waxwingsuper@active`, or (b) finishes Sun's EGG-model rework (internal `uint64` balance, no `retire`).

### ⚠️ Two things my earlier report got WRONG (corrected for the record)
1. **"Blocked / waiting on testnet-WAX funding approval" was FALSE.** waxwingsuper paid all RAM and the full setup (create/issue/config/species/season/initplayer) completed in one ~12-min window. There was never a funding blocker.
2. **"Game key 100% separate from waxwing" was FALSE in practice.** `waxwingsuper` is simultaneously the **HATCH issuer**, the **RAM payer for every account**, the **only registered player**, and the **owner/authority every game action needs**. The planned separate-role account `hatchroot111` is a dead 9.5 KB orphan. Do not claim separation.

> **What's left for Kevin (his zone: source + redeploy + economy):** fix the `retire` auth (link eosio.code
> or finish the EGG rework) → redeploy → then a `hatch`/`feed`/`evolve`/`harvest` smoke loop can actually
> mint a creature and prove the loop. Also create `hatchfees1` or repoint `fee_account` before any fee path
> runs. I did **not** push any gameplay tx — that is chain/wallet work outside my read-only handoff zone.

---

## 0. Read first — the account-name landmine

There are **two different contract names floating around the repo, and they are not interchangeable.**

| Role | Name used by `deploy/lib.sh` (the live scripts) | Name in `build/DEPLOY.md` + contract header defaults |
|---|---|---|
| Contract account (hosts `pockethatch.wasm`) | **`pockethatch1`** (12 chars ✅ free name) | `pockethatch` (11 chars ❌ **premium name → needs a winning name-auction bid**) |
| Token contract (eosio.token, HATCH) | **`hatchtokens1`** | `hatchtokens1` ✅ (same) |
| Fee account | `hatchfees1` (referenced in config) | `hatchfees1` |
| AtomicAssets collection | **`pockethatch1`** | `pockethatch` |
| AtomicAssets schema | `creatures` | `creatures` ✅ |
| Creator / token issuer / player | **`waxwingsuper`** | `waxwingsuper` ✅ |

**Why the split:** `pockethatch` is 11 characters. On WAX, names < 12 chars are *premium* and can
only be claimed by winning a `bidname` auction ("no active bid for name" was the original blocker).
`pockethatch1` is 12 chars = a free `system newaccount` name. The deploy scripts therefore target
**`pockethatch1` for everything on-chain** and use it as the collection name too.

⚠️ **Landmines that follow from this (Kevin must fix, do NOT just run these files as-is):**
- `build/DEPLOY.md` Phase 2/4 and `contract/pockethatch/pockethatch.hpp` config defaults still say
  `pockethatch`. The contract's hardcoded `config_row` defaults are
  `token_contract=hatchtokens1, collection=pockethatch, schema_name=creatures, fee_account=hatchfees1`.
  If you deploy and never call `setconfig`, the contract points at a collection name **it cannot mint
  into** (the real collection is `pockethatch1`). → After deploy you MUST `setconfig` with the real names.
- `deploy/args-setconfig.json` (newest) already corrects `collection`→`pockethatch1`, but the older
  root-level `setconfig-body.json` still says `collection:"pockethatch"`. **Use `args-setconfig.json`,
  not `setconfig-body.json`.** And double-check `collection` before every `setconfig` push.
- `deploy/step-check.sh` still probes the non-existent `pockethatch` account (line 8). Cosmetic, but
  fix it to `pockethatch1` so the probe actually means something.
- `hatchfees1` is referenced as `fee_account` but **no step script creates that account.** Either
  create it (12-char free name, like hatchtokens1) or point `fee_account` at an account that exists.
  Today the contract never actually transfers to `fee_account` in any code path (it's vestigial), so
  the safest immediate move is `fee_account = waxwingsuper` until the fees tap is wired.

---

## 1. Toolchain prerequisites (WSL / Ubuntu)

All deploy work happens in **WSL (Ubuntu)**. The scripts assume user `bagidea`, home `/home/bagidea`.

```
Leap (cleos + keosd)        /home/bagidea/leap/usr/bin/cleos
                            /home/bagidea/leap/usr/bin/keosd
                            (LD_LIBRARY_PATH must include /home/bagidea/leap/usr/lib)
CDT (cdt-cpp compiler)      extracted under /tmp/cdt-extract   ← see §2
python3                     used by atomicassets template resolver + lib helpers
```

- **cleos/keosd come from Leap**, not CDT. The scripts hard-code `~/leap/usr/bin/...`.
- **RPC endpoints (WAX testnet, same chain_id):**
  - `https://waxtestnet.greymass.com` — `deploy/lib.sh` default (the verify harness uses this)
  - `https://testnet.waxsweden.org` — `build/DEPLOY.md` uses this
  - Pick one and keep it consistent; both are healthy. Override via `PH_RPC=https://…`.

---

## 2. Build the contract (CDT + the 4 source patches)

### 2.1 CDT version — a discrepancy to resolve

- `build/DEPLOY.md` says: *"Compiled with CDT 3.1.0"* and the patches are labelled "for CDT 3.1.0".
- `compile.sh` (the script that actually built the `.wasm` in `build/`) points at **CDT 4.1.1**:
  ```
  CDT_INCLUDE="/tmp/cdt-extract/usr/opt/cdt/4.1.1/include"
  BIN="/tmp/cdt-extract/usr/bin/cdt-cpp"
  ```

The 4 patches below are CDT API-migration fixes and apply to **both** 3.1.0 and 4.1.1. Decide which
CDT you want and be consistent; re-verify the on-chain code hash after you redeploy (§5). I could not
confirm from disk which CDT produced the current `build/pockethatch.wasm` — treat the version as
**unverified** (§10) and recompile.

### 2.2 Install CDT (pattern the scripts use)

CDT is **extracted, not installed**, into `/tmp/cdt-extract`:

```bash
# In WSL. Replace <cdt.deb> with the canonical WAX CDT deb for your chosen version (3.1.0 or 4.1.1).
#   ⚠️ I did NOT download/verify a specific deb URL this turn — confirm the official WAX CDT source
#      before trusting a URL. Community path many WAX devs use: the cc42/wax-cdt Docker image.
mkdir -p /tmp/cdt-extract
dpkg -x <cdt.deb> /tmp/cdt-extract
# After extract you should see:
#   /tmp/cdt-extract/usr/bin/cdt-cpp
#   /tmp/cdt-extract/usr/opt/cdt/<VERSION>/include
```

### 2.3 The 4 source patches (from `build/DEPLOY.md` §Patches)

These are applied to `contract/pockethatch/pockethatch.hpp` + `pockethatch.cpp` so the source
compiles under modern CDT. They are **already present** in the current source files (verified by
reading the source — `_cfg()/_pool()` are `const`, `checksum256(arr)` constructor is used, etc.):

1. **`_cfg()` / `_pool()` declared `const`** — both header declarations and the cpp definitions
   carry `const` (they're pure readers). Header: `config_row _cfg() const;` / `rewardpool_row _pool() const;`.
2. **`checksum256::hash(arr)` → `checksum256(arr)`** — the old `hash()` factory was removed; use the
   constructor that takes a byte array directly.
3. **Double-hash blend → `sha256(...data(), 32)`** — in `breed()`, the old
   `checksum256::hash(checksum256::hash(gblend))` was replaced with
   `sha256(reinterpret_cast<const char*>(checksum256(gblend).data()), 32)`.
4. **Fixed-size arrays expanded to named fields** — `species_row.thresholds[4]` + `stage_yield[5]`
   were exploded into individual fields `thresh_1..4` + `yield_0..4` with `threshold_for()` /
   `yield_for()` accessor methods (CDT/multi_index dislikes raw fixed arrays in rows). This is the
   shape already in `pockethatch.hpp`.

### 2.4 Compile

The shipped path (`compile.sh`):

```bash
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
# adjust CDT_INCLUDE version to match what you extracted (4.1.1 as-is, or 3.1.0)
/tmp/cdt-extract/usr/bin/cdt-cpp \
  -I /tmp/cdt-extract/usr/opt/cdt/4.1.1/include \
  -I "$SRC" \
  -o "$SRC/build/pockethatch.wasm" \
  "$SRC/pockethatch.cpp" \
  --abigen          # also emits pockethatch.abi
```

Alternative (CMake, if you have CDT installed system-wide): `contract/pockethatch/CMakeLists.txt` uses
`find_package(cdt)` + `add_contract(pockethatch pockethatch pockethatch.cpp pockethatch.hpp)`. The
`cdt-cpp` one-liner above is what the project actually shipped, so prefer it.

Output goes to `contract/pockethatch/build/pockethatch.{wasm,abi}` (current artifacts: wasm ≈ 98 KB,
abi ≈ 9 KB — per `build/DEPLOY.md`).

---

## 3. Keys & wallet hygiene (PLACEHOLDERS ONLY)

> 🔴 **Never commit a private key or password.** The repo currently violates this — see §11.
> Everything below uses `<…>` placeholders.

### 3.1 Generate a keypair for the contract account

```bash
CLEOS=/home/bagidea/leap/usr/bin/cleos
$CLEOS create key --to-console      # prints Private: <CONTRACT_PRIV>  Public: <CONTRACT_PUB>
```
Save `<CONTRACT_PRIV>` somewhere offline **outside the repo** (e.g. `~/.ph/pockethatch1.priv`, chmod 600).
The public key is bound to the account at `newaccount` time (§4).

### 3.2 keosd wallet (clean-slate)

`deploy/step-setup-wallet.sh` is the reference. Summary:

```bash
KEOSD_DIR=~/.ph/keosd
pkill -x keosd; rm -rf ~/.ph/keosd ~/eosio-wallet
mkdir -p ~/.ph/keosd/wallets && chmod 700 ~/.ph/keosd/wallets

LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib nohup /home/bagidea/leap/usr/bin/keosd \
  --data-dir "$KEOSD_DIR" --config-dir "$KEOSD_DIR" \
  --wallet-dir "$KEOSD_DIR/wallets" --unlock-timeout 999999999 \
  >~/.ph/keosd.log 2>&1 &
sleep 3

# create wallet, capture the master password
WPW="$($CLEOS wallet create --to-console 2>&1 | grep -oE 'PW[0-9A-Za-z]+' | head -1)"
echo "$WPW" > ~/.ph/wallet.pw && chmod 600 ~/.ph/wallet.pw     # NEVER commit ~/.ph/

# import every key you need (contract + token + creator)
$CLEOS wallet import --private-key <CONTRACT_PRIV>
$CLEOS wallet import --private-key <TOKEN_PRIV>
# …then SHRED any plaintext key dump you pulled from waxwing (see 3.3)
rm -f ~/.ph/*.key
```

### 3.3 Pulling keys out of the waxwing keystore (the `_dump-keys.cjs` path)

`deploy/_dump-keys.cjs` decrypts every key in the waxwing keystore's `wax-testnet` bucket and writes
each to `~/.ph/<account>@<perm>.key` **inside WSL, outside the repo**, then you import + shred. Flow:

```bash
# from Windows (node), with the keystore master password in env — NEVER inline the real pw
HATCH_KEYSTORE_PW=<KEYSTORE_MASTER_PW> node deploy/_dump-keys.cjs
# → writes ~/.ph/<acct>@<perm>.key files, prints only a fingerprint (…abcd)
# then in WSL: import each, then rm -f ~/.ph/*.key   (step-setup-wallet.sh does this)
```

⚠️ `_dump-keys.cjs` reads the password exclusively via `process.env.HATCH_KEYSTORE_PW` — no default fallback. The env var MUST be set or the script exits with an error.

---

## 4. Create accounts — ORDER MATTERS

Ordering: **(1) `waxwingsuper` already exists as creator → (2) create `hatchtokens1` → (3) create
`pockethatch1` → then deploy code onto each.** RAM + stake are bought **at `newaccount` time** via
`--buy-ram-kbytes` + `--stake-net/--stake-cpu`; you do not need a separate `buyram` for the initial
allocation (the separate waxwing `buyram` in `build/DEPLOY.md` Phase 3 is an alternate path).

`waxwingsuper` is the **creator / token issuer / first player** — it is **not** a contract host. (The
brief mentioned `set contract waxwingsuper`; that's a mis-statement — the contract account is
`pockethatch1`. `waxwingsuper` only signs as creator.)

### 4.1 Token account (`deploy/step-setup-token.sh` §3)
```bash
$CLEOS -u "$RPC" system newaccount waxwingsuper hatchtokens1 \
  <TOKEN_PUB> <TOKEN_PUB> \
  --stake-net '0.10000000 WAX' --stake-cpu '0.50000000 WAX' \
  --buy-ram-kbytes 200 \
  -p waxwingsuper@active
```

### 4.2 Contract account (`deploy/step-create-account.sh`)
```bash
$CLEOS -u "$RPC" system newaccount waxwingsuper pockethatch1 \
  <CONTRACT_PUB> <CONTRACT_PUB> \
  --stake-net '0.50000000 WAX' --stake-cpu '2.00000000 WAX' \
  --buy-ram-kbytes 1500 \
  -p waxwingsuper@active
```
1500 KB up front: code+abi ≈ 110 KB, rest for tables + AtomicAssets metadata rows the contract will
create as players mint.

> Need more RAM later? `buyram` via the waxwing panel (`buyram {from:waxwingsuper, receiver:pockethatch1, bytes:N}`)
> or `cleos system buyrambytes waxwingsuper pockethatch1 <bytes>`. **Always before** the table fills,
> not after a `set contract` OOM.

---

## 5. Deploy the eosio.token + pockethatch contracts

### 5.1 Token contract on `hatchtokens1` (`deploy/step-setup-token.sh` §4–6)
```bash
# grab the canonical eosio.token wasm+abi straight off the chain
$CLEOS -u "$RPC" get code eosio.token -c deploy/contracts/eosiotoken.wasm -a deploy/contracts/eosiotoken.abi

$CLEOS -u "$RPC" set contract hatchtokens1 deploy/contracts eosiotoken.wasm eosiotoken.abi \
  -p hatchtokens1@active

# create HATCH: issuer = waxwingsuper, precision 4, max 1,000,000,000.0000
$CLEOS -u "$RPC" push action hatchtokens1 create \
  '["waxwingsuper","1000000000.0000 HATCH"]' -p hatchtokens1@active

# issue the bootstrap supply to the issuer/player (10,000,000.0000 HATCH here)
$CLEOS -u "$RPC" push action hatchtokens1 issue \
  '["waxwingsuper","10000000.0000 HATCH","bootstrap"]' -p waxwingsuper@active

# verify
$CLEOS -u "$RPC" get currency balance hatchtokens1 waxwingsuper HATCH
$CLEOS -u "$RPC" get currency stats   hatchtokens1 HATCH
```

### 5.2 Game contract on `pockethatch1` (`deploy/step-deploy-contract.sh`)
```bash
BUILD=".../contract/pockethatch/build"     # files are named pockethatch.*, NOT after the 12-char account
$CLEOS -u "$RPC" set contract pockethatch1 "$BUILD" pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active

# verify code hash + that the ABI exposes the gameplay actions
$CLEOS -u "$RPC" get code pockethatch1
$CLEOS -u "$RPC" get abi  pockethatch1 | grep -oE '"name": ?"(hatch|feed|evolve|initplayer|setconfig|setspecies|harvest|claimreward)"'
```
⚠️ After Kevin's source fix + recompile, **compare `get code pockethatch1` hash against the freshly
built wasm** to confirm the new code actually landed.

> **Burn-mechanism dependency (read before assuming `hatch/feed/evolve` work):**
> `burn_hatch()` does `transfer player→self` then `retire` signed by `pockethatch1@active`.
> Standard `eosio.token::retire` requires **the issuer's** authority. The issuer here is
> `waxwingsuper`, **not** `pockethatch1` — so `retire` will fail with missing auth unless either
> (a) the token is issued by `pockethatch1`, or (b) `waxwingsuper` grants `hatchtokens1@eosio.code`
> / retire authority to `pockethatch1`. **This is almost certainly part of what Sun's audit flagged
> as "เผา HATCH ผิด".** It is Kevin's to fix in source/economy — I only flag it.

---

## 6. AtomicAssets — collection, schema, "minter"

> AtomicAssets has **no `setminter` action.** Minting authority = being listed in the collection's
> `authorized_accounts`. Our contract mints via inline `atomicassets::mintasset` using its own
> (`pockethatch1@active`) auth, so `pockethatch1` **must be in its own collection's
> `authorized_accounts`** — which `createcol` sets below. That *is* the "set minter" step.

Reference: `deploy/step-setup-atomicassets.sh` + `deploy/args-aa-*.json`. All three actions are
`push action atomicassets <act> <args.json> -p pockethatch1@active`.

### 6.1 createcol (`args-aa-createcol.json`)
```json
{"author":"pockethatch1","collection_name":"pockethatch1","allow_notify":false,
 "authorized_accounts":["pockethatch1"],"notify_accounts":[],"market_fee":0.0,"data":[]}
```
`authorized_accounts:["pockethatch1"]` is what lets the contract mint. `createcol` errors if the
collection already exists — treat that as OK (idempotent).

### 6.2 createschema (`args-aa-createschema.json`) — must match the contract's ATTR_MAP keys
```json
{"authorized_creator":"pockethatch1","collection_name":"pockethatch1","schema_name":"creatures",
 "schema_format":[
   {"name":"genetics","type":"string"},
   {"name":"stage","type":"uint32"},
   {"name":"growth","type":"uint64"},
   {"name":"name","type":"string"}
 ]}
```
⚠️ These four attribute names/types **must match what the contract writes**. Source writes
`immutable:{genetics: string(hex)}` and `mutable:{stage: uint32, growth: uint64, name: string}`
(setname adds `name`). If the schema and the contract's ATTR_MAP drift, `mintasset`/`setassetdata`
fail. Keep them in lockstep when you change the source.

### 6.3 createtempl (`args-aa-createtempl.json`)
```json
{"authorized_creator":"pockethatch1","collection_name":"pockethatch1","schema_name":"creatures",
 "transferable":true,"burnable":true,"max_supply":0,"immutable_data":[]}
```
`max_supply:0` = unlimited. **AtomicAssets assigns the `template_id` for you** — do not assume it's 1.
Resolve it from the chain after creation, then feed the **real** id into `setspecies` (§7.2):

```bash
$CLEOS -u "$RPC" get table atomicassets pockethatch1 templates --lower 0 --limit 10
# → read the assigned template_id(s); one species/template in v1
```

---

## 7. Post-deploy configuration (wired by `deploy/step-setup-config.sh` — verify it actually ran)

**There IS a step script for this:** `deploy/step-setup-config.sh` runs all three config actions in
order, then verifies them on chain:
1. `setconfig` ← `deploy/args-setconfig.json`
2. `setspecies` ← `deploy/args-setspecies.json` (hardcoded `template_id=662644`)
3. `newseason '{}'` ← empty args (see §7.3 — this does **not** seed the reward pool)
4. then `get table … config` + `get table … speciescfg` to confirm they landed.

⚠️ **Still verify, don't blindly trust the step.** The three pushes are config-only; the reward pool
is **not** seeded by this step (§7.3). And whether the step actually ran on chain (vs. was written but
never dispatched) is **unverified** by me (§10) — run the `get table config`/`speciescfg` checks in §9
to confirm before assuming the contract is configured.

### 7.1 setconfig — use the corrected names
Push `deploy/args-setconfig.json` (the newest one, `collection:"pockethatch1"`), **not** the root
`setconfig-body.json` (which still says `pockethatch`). Verify these fields before pushing:
```bash
$CLEOS -u "$RPC" push action pockethatch1 setconfig "$(cat deploy/args-setconfig.json)" -p pockethatch1@active
```
Two config flavours exist in the repo — the **costs are identical in both** (`hatch 1 / evolve 0.5 /
breed 5 HATCH`, `feed_cost 0`). They differ only in cadence/collection:
- `deploy/args-setconfig.json` — **testnet fast-test + correct collection**: `collection:"pockethatch1"`,
  `feed_cd:0, harvest_cd:0, feed_daily_cap:100, feed_boost:1000`.
- `setconfig-body.json` (root) — **slower cadence + wrong collection**: `collection:"pockethatch"`,
  `feed_cd:3600, harvest_cd:3600, feed_daily_cap:6, feed_boost:100`.

Also: **`fee_account:"hatchfees1"` points at an account that doesn't exist** (§0). Set it to
`waxwingsuper` (or create `hatchfees1`) until the fee tap is actually wired.

### 7.2 setspecies — use `deploy/args-setspecies.json` (template_id=662644)
**Two species files exist; only one is correct:**
- ✅ **`deploy/args-setspecies.json`** — `template_id:662644` (the real id AA assigned on testnet),
  `growth_rate:1000`, `thresh_1..4 = 1000/5000/20000/100000`, `yield_0..4 = 100/300/600/1200/2400`.
  **This is what `deploy/step-setup-config.sh` pushes — use it.**
- ❌ `setspecies-body.json` (root) — stale template: `template_id:1`, `growth_rate:100`,
  `thresh_1..4 = 10000/100000/500000/2000000`, `yield_0..4 = 0/10/30/60/120`. **Do NOT use it** —
  `template_id:1` only works if AA assigned id 1, which it did not.

`662644` must match a template that actually exists under collection `pockethatch1` — re-resolve via
§6.3 (`get table atomicassets pockethatch1 templates`) before pushing, in case the collection was recreated:
```bash
$CLEOS -u "$RPC" push action pockethatch1 setspecies "$(cat deploy/args-setspecies.json)" -p pockethatch1@active
```
The species row fields: `growth_rate`, `thresh_1..4` (stage-up growth thresholds), `yield_0..4`
(EGG/hr ×10⁴ per stage), `max_stage` (1..5), `egg_weight` (hatch-pool rarity weight), `egg_type`
(0/1/2 = common/uncommon/rare), `family`.

### 7.3 newseason + reward pool — funding actions EXIST, but `fund_pool` is accounting-only
`claimreward` pays HATCH **out of the on-chain `rewardpool` singleton** (hard check cpp:523–528:
`pool.balance >= payout`, then `pool.balance -= payout` + an inline `transfer` of real HATCH to the player).

**The source is NOT missing funding actions — they exist:**
- **`fundrewardpool(asset amount, string source)`** (cpp:843) — admin (`require_auth(get_self())`),
  calls `fund_pool`. This is the manual top-up lever Sun's audit asked about.
- **`newseason(asset bootstrap_release)`** (cpp:821) — admin; bumps `season_index` + `season_started`,
  and when `bootstrap_release.amount > 0` it funds the pool **and** writes
  `rewardpool.bootstrap_released += amount` + `last_release = now` (cpp:832–839). So those fields are
  **not dead** — they track the bootstrap releases.

⚠️ **But `fund_pool` (cpp:121) is accounting-only:** it does `pool.balance += amount` +
`lifetime_funded += amount` and **nothing else — it does NOT move real HATCH.** So crediting the pool
via `fundrewardpool`/`newseason` only bumps the *number*. For `claimreward` to actually pay out, the
contract must also **hold** that much real HATCH on its `hatchtokens1` balance (the payout is a real
inline transfer; `withdraw`'s guard `sweepable = contract_balance − pool.balance`, cpp:866–871, exists
precisely to stop the admin draining what the pool accounted for). **So seeding = fund the accounting
AND get real HATCH onto `pockethatch1` (issue/transfer), in the same amount — or payouts throw
"reward pool empty" / the token transfer fails.**

Note `breed` does it correctly end-to-end (cpp:578–587): it both transfers `owner→self` of the 60%
pool portion **and** calls `fund_pool` — real tokens + accounting together. The admin actions only do
the accounting half, so they need a matching external transfer that `breed` performs inline.

⚠️ **The shipped step does NOT seed the pool.** `deploy/step-setup-config.sh` calls `newseason '{}'`
(empty/zero asset). The `if (bootstrap_release.amount > 0)` branch (cpp:832) is skipped so no funding
happens; and `newseason`'s `check(bootstrap_release.symbol == HATCH_SYM)` (cpp:823) will reject a
zero/empty asset unless the dispatcher fills HATCH, so `{}` most likely reverts outright. **To actually
seed the pool: call `newseason '{"bootstrap_release":"<N>.0000 HATCH"}'` (preferred — also books the
bootstrap) OR call `fundrewardpool`** — and ensure the contract holds that HATCH first.

This is the economy surface Sun's audit is about (the "ponzi ช่อง" + payout shape: `breed` is the only
*organic* inflow, 60% of the breed fee). Kevin owns the fix; I only document the shape.

---

## 8. Economy summary (so the redeploy wires the right thing)

Two currencies, by design (Sun's TOKENOMICS §0–1):

| | 🥚 **EGG** (soft, in-game) | 🐣 **$HATCH** (hard, tradeable on Alcor) |
|---|---|---|
| Stored where | `players.egg_balance` (**internal int, NOT a token**) | `hatchtokens1` eosio.token balance |
| Created by | `harvest` (credits internally) | `issue` at genesis only — **never minted as gameplay reward** (Sun rule #1) |
| Sink | `hatch/feed/evolve/breed/accelerate` costs, daily caps | burns (retire) + reward-pool payouts |
| Tradeable | ❌ no DEX pair (intentional) | ✅ |

**Token flows in the contract (what Kevin is fixing):**
- `hatch` → burns `hatch_cost` HATCH (`burn_hatch`) → mints creature NFT.
- `feed` → burns `feed_cost` (0 in v1) + adds `feed_boost` growth (cooldown + daily cap).
- `evolve` → burns `evolve_cost × (stage+1)` → `stage++` → mirrors `stage/growth` to NFT via `setassetdata`.
- `breed` → splits `breed_cost`: **40% burned, 60% → reward pool** (the pool's only *gameplay* inflow; admin can also credit it via `fundrewardpool`/`newseason` — §7.3).
- `accelerate` → burns a chosen HATCH amount → converts to growth (1 HATCH = 100 growth).
- `harvest` → computes roster power (Σ `yield_for(stage-1)` per creature) × elapsed hours (capped) → credits EGG internally. **No token transfer.**
- `claimreward` → pays HATCH **from `rewardpool.balance`** (20/30/50/100 HATCH by highest stage 2/3/4/5). Fails if pool empty.
- `withdraw` → admin drain, also clamped by the pool invariant for HATCH.

**Known-broken spots for Kevin (flagged by Sun; do NOT fix here — I'm read-only):**
1. **Burn correctness** — `retire` auth mismatch (§5.2). If the issuer isn't `pockethatch1` (or hasn't delegated retire/code auth), every burn-bearing action (`hatch/feed/evolve/breed/accelerate`) reverts.
2. **Reward pool funding is half-wired** — admin actions `fundrewardpool` (cpp:843) and `newseason(bootstrap_release)` (cpp:821) DO exist and `bootstrap_released`/`last_release` are live, but `fund_pool` (cpp:121) is **accounting-only** (`pool.balance += amount`, no token move). The shipped step calls `newseason '{}'` which does **not** seed it. So at launch the pool is breed-funded only and `claimreward` deadlocks until breeding happens OR you explicitly fund (accounting + real HATCH) — see §7.3.
3. **Ponzi shape** — payouts to early players come from later players' breed fees with no bounded sink-to-source ratio and no season reset of qualification; needs the vesting/sunset/throttle design from TOKENOMICS §4.3 + §10.
4. **Name drift** — config defaults vs deployed names (§0); `setconfig` is mandatory, not optional.

---

## 9. Quick verification (read-only, safe to run anytime)

```bash
CLEOS=/home/bagidea/leap/usr/bin/cleos
RPC=https://waxtestnet.greymass.com
$CLEOS -u "$RPC" get info                                  # chain_id f16b1833…
$CLEOS -u "$RPC" get account pockethatch1                  # RAM/CPU/NET, created
$CLEOS -u "$RPC" get code  pockethatch1                    # code hash
$CLEOS -u "$RPC" get table pockethatch1 pockethatch1 config
$CLEOS -u "$RPC" get table atomicassets pockethatch1 templates   # assigned template_ids
$CLEOS -u "$RPC" get currency balance hatchtokens1 waxwingsuper HATCH
```
Via the waxwing plugin (read-only cmds only — do **not** run unlock/confirm/newaccount/buyram):
```bash
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" \
  -d '{"cmd":"account","args":"pockethatch1"}'
```

---

## 10. What I verified vs. did NOT (honest scope)

**Verified by reading (this turn, read-only):**
- The 4 source patches are **already applied** to the current `pockethatch.{hpp,cpp}` (const helpers, `checksum256(arr)` ctor, `sha256(...data(),32)` blend, expanded `thresh_*`/`yield_*` fields + accessors).
- Built artifacts exist: `build/pockethatch.{wasm,abi}`.
- The deploy step scripts (`deploy/step-*.sh`, `lib.sh`, atomicassets args) are **internally consistent** and reference each other correctly; the ordering in §§4–7 is the order they imply.
- The economy/token-flow description in §8 matches the actual source line-for-line.

**NOT verified by me (treat as untrusted until Kevin confirms):**
- **On-chain state of any account/contract.** I did not run `cleos` against WAX, did not push any transaction, did not touch the wallet. Whether `pockethatch1` / `hatchtokens1` / the collection / templates actually exist on testnet right now — **unverified.** Run §9 to check.
- **Which CDT version produced the shipped `.wasm`** (3.1.0 per DEPLOY.md vs 4.1.1 per `compile.sh`). Recompile and re-hash.
- **That the shipped `.wasm` matches the current source** (source may have been edited after the last build). Rebuild before trusting.
- **Whether `setconfig`/`setspecies`/`newseason` actually ran on chain.** There IS a step script for all three (`deploy/step-setup-config.sh`, see §7) — so they are *scripted*, not unwired. But whether that script was ever dispatched against testnet, and whether each push actually executed (vs. asserted), I did **not** verify. Run the `get table config` / `speciescfg` checks in §9 to confirm. Separately, the reward pool being **seeded** is unverified and unlikely — `newseason '{}'` does not fund it (§7.3).
- **The exact CDT `.deb` source/URL** (§2.2) — confirm the official WAX CDT package before downloading.
- **That `hatch/feed/evolve/breed` actually succeed on chain** — the retire-auth issue (§5.2) predicts they won't as-is. Needs Kevin's source fix + live test.

---

## 11. 🔴 Secret exposure you'll inherit (rotate + scrub before any redeploy/public)

Real private keys + the waxwing keystore master password are currently sitting **in the repo tree**
(this is a known open issue). **Do not paste any of them into this doc or any new file.** Locations to
scrub (values redacted here on purpose):
- `contract/pockethatch/build/DEPLOY.md` — plaintext contract WIF ("Private: 5…" + matching public).
- `contract/pockethatch/build/deploy.sh` — same WIF hardcoded as `PRIVKEY=`.
- `deploy/lib.sh` — same WIF + pubkey as `CONTRACT_PRIV`/`CONTRACT_PUB`.
- `deploy/_dump-keys.cjs` — reads keystore master password from `HATCH_KEYSTORE_PW` env var (no default; scrubbed 2026-07-08).
- `.secrets/` — live keys, `env.sh`, `hatch-keys.json`, `.hatch_wallet.pw`, faucet scripts.
- `extract-key.js` (root) — key extraction with creds.

**Before redeploy:** (1) generate a **fresh** contract keypair and use it instead of the leaked WIF;
(2) rotate the waxwing keystore master password; (3) scrub the values from the files above (replace
with `<PLACEHOLDER>`); (4) confirm `.gitignore` covers `.secrets/`, `~/.ph/`, `*.key`, and
`daemon/journal.jsonl.bak`. The leaked WIF should be considered compromised — do not reuse it for a
mainnet deploy.

---

*End of runbook. Handoff to Kevin for source fix + redeploy + economy wiring. — Yamamoto*
