# FIRE-RUNBOOK — prove the full loop in one unlock session

> **Author:** Kevin · **Date:** 2026-07-09 · **Wallet: LOCKED at write time.**
> Every value below is **live-verified** against `phgamecreatr` on WAX testnet
> (`https://testnet.waxsweden.org`, `get_table_rows`) at head `2026-07-09T09:14:31Z`
> (≈ unix `1783588471`). Nothing here signs or broadcasts — it's the exact fire
> order for the boss to run **after** unlocking, so the whole
> feed→evolve→breed→claim/harvest→burn loop can be proven in one go.

---

## 0. Ground truth (live, verified today)

| thing | value |
|---|---|
| contract | `phgamecreatr` |
| live code_hash | `d8733d5d…297181` = **v0.2.0 / configv3 (Feed-v2)** — deployed ✅ |
| token | `hatchtokens1` · `HATCH` (4 dp) · EGG = internal balance (not a token) |
| collection / schema | `phgamecreatr` / `creatures` |
| season_index | `1` (active) · pool balance **79.0000 HATCH** |
| creatures on chain | **25** |
| **good templates** (have `speciescfg`) | `660000`, `662976`, `662977`, `662978` |
| **broken templates** (NO `speciescfg`) | `662889` (×20 creatures), `662906` (×2) — see `docs/TEMPLATE-662889-ROOTCAUSE.md` |

### Signer accounts held in the wallet (from `accounts`, public info only)
| account | perm | role | EGG | HATCH |
|---|---|---|---|---|
| **waxwingsuper** | active *(selected)* | main player + owns the good creatures | 95 978 | 9 990 202 |
| officewax123 | active | secondary player | 50 | 248 |
| **phgamecreatr** | active | **admin / contract key** (setconfig, newseason, setspecies…) | — | 9 548 |

> ⚠️ **On the "creature fed:0 on a good template":** it does **not exist yet**.
> Live chain has zero `last_fed:0` creatures on a good template — the only
> `last_fed:0` rows are all on the broken `662889`/`662906` templates. The
> **fed:0 good creature is produced by the `breed` step below** (breed sets the
> child's `last_fed = 0` and inherits parent A's template `662977`). So the loop
> **creates** it, then feeds+evolves it. This is the correct, self-contained path.

### The two good creatures we breed from (both `waxwingsuper`, template `662977` = uncommon)
| asset_id | stage | last_fed | fed_until | breed-ready? |
|---|---|---|---|---|
| `1099603751707` | 0 | 1783585879 | 1783845079 (**fed**) | `last_bred=0` → ✅ |
| `1099603751804` | 1 | 1783584880 | 1783844080 (**fed**) | `last_bred=0` → ✅ |

---

## 1. Canonical fire order (maps to the boss's loop)

Fire these **as `waxwingsuper@active`** unless marked ADMIN. Each block lists the
exact action, args, the **precondition** (already checked live), and the
**expected result**. Run top-to-bottom.

> **How to fire** (wallet already unlocked): one line per action via the waxwing
> daemon. Bodies are pure ASCII, so inline JSON is safe on Windows. Template:
> ```bash
> curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
>   -H "content-type: application/json" \
>   -d '{"cmd":"pushaction","contract":"phgamecreatr","action":"<ACTION>","from":"<SIGNER>","data":<DATA>}'
> ```
> (Or use the game's SignSheet — same actions, confirm-before-broadcast gate.)

---

### STEP A — `breed` → mints the fed:0 good-template creature  🟢 fireable now
Proves **breed** + the player-funded inline HATCH split (40% burn / 60% pool).

```json
{"cmd":"pushaction","contract":"phgamecreatr","action":"breed","from":"waxwingsuper",
 "data":{"owner":"waxwingsuper","parent_a":"1099603751707","parent_b":"1099603751804"}}
```
- **Precondition (live-checked):** both parents owned by `waxwingsuper`, both
  `last_bred=0` (no cooldown), `breed_cost = 5.0000 HATCH`, balance 9.99M HATCH ✅.
  `parent_a` is `662977` → child inherits `662977` (a **good** template) ✅.
- **Expected:** new creature row, `template_id=662977`, `stage=0`, **`last_fed=0`**,
  `owner=waxwingsuper`; 2.0000 HATCH burned + 3.0000 HATCH → pool; a new NFT minted.
- **➜ GET THE CHILD ID** (needed by B and C). Read the newest asset for the owner:
  ```bash
  curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_table_rows \
    -H 'content-type: application/json' \
    -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"creatures","limit":1,"reverse":true}'
  ```
  Call that id **`$CHILD`** below (it will be > `1099603751804`).

---

### STEP B — `feed $CHILD`  🟢 fireable now (no cooldown: child `last_fed=0`)
Proves **feed** + the internal EGG spend (`feed_cost = 12 EGG`).

```json
{"cmd":"pushaction","contract":"phgamecreatr","action":"feed","from":"waxwingsuper",
 "data":{"owner":"waxwingsuper","asset_id":"$CHILD"}}
```
- **Precondition:** `feed_cd=21600` but child `last_fed=0` → cooldown auto-passes ✅;
  `feeds_today=1` of cap `3` → room ✅; EGG 95 978 ≥ 12 ✅.
- **Expected:** child `last_fed=now` (satiety → full), `fed_growth += feed_boost(100)`,
  player EGG −12, `feeds_today → 2`.

---

### STEP C — `evolve $CHILD`  🟢 fire a few seconds after B
Proves **evolve** (stage 0→1) + the NFT `setassetdata` mirror.

```json
{"cmd":"pushaction","contract":"phgamecreatr","action":"evolve","from":"waxwingsuper",
 "data":{"owner":"waxwingsuper","asset_id":"$CHILD"}}
```
- **Precondition:** Feed-v2 hunger gate `now < fed_until` — satisfied because B just
  fed it ✅. Growth gate `g ≥ thresh_1 (1000)`: `growth_rate=1000/s`, so a few seconds
  of sync after breed already clears 1000 ✅. `evolve_cost = 300 × (stage+1) = 300 EGG`,
  balance ok ✅. NFT held by owner ✅.
- **Expected:** child `stage → 1`, EGG −300, NFT mutable `stage=1` mirrored.
- **⏱ note:** if it reverts `insufficient growth to evolve`, wait ~2–3 s and re-fire
  (growth is still accruing). It will pass.

---

### STEP D — `harvest`  🟢 fireable now
Proves **harvest / earn** (EGG credited by fed-hours × avg-satiety × rarity mult).

```json
{"cmd":"pushaction","contract":"phgamecreatr","action":"harvest","from":"waxwingsuper",
 "data":{"owner":"waxwingsuper"}}
```
- **Precondition:** `harvest_cd=3600`; `last_harvest=1783584855` → cooldown cleared at
  `1783588455` (already past) ✅. Player owns fed, stage≥1 creatures (751804 stage1 +
  the just-evolved child) → non-zero earn ✅.
- **Expected:** `egg_balance` increases (capped by `daily_egg_cap=240 ×` best rarity
  mult, `cap_scales_rarity=1`); `last_harvest=now`.

---

### STEP E — `claimreward`  🔴 BLOCKED → needs 1 ADMIN action first
Proves **claim** (season HATCH payout from pool).

- **Blocker (live-verified):** `claims` table shows **`waxwingsuper.claimed_season = 1`**
  and `officewax123.claimed_season = 1`, and `season_index = 1`. The contract gate is
  `check(claimed_season < season_index)` → **both accounts already claimed S1** →
  `claimreward` reverts `already claimed this season`.
- **Unblock — choose ONE (decision for boss):**

  **E-opt1 — bump the season (ADMIN, `phgamecreatr@active`):**
  ```json
  {"cmd":"pushaction","contract":"phgamecreatr","action":"newseason","from":"phgamecreatr",
   "data":{"bootstrap_release":"0.0000 HATCH"}}
  ```
  → `season_index → 2`. Then fire claim as the player:
  ```json
  {"cmd":"pushaction","contract":"phgamecreatr","action":"claimreward","from":"waxwingsuper",
   "data":{"owner":"waxwingsuper"}}
  ```
  - **Precondition after bump:** `waxwingsuper` owns stage-4 creatures →
    `highest_stage ≥ 2` qualifies ✅; pool `79 HATCH ≥ payout` (stage-4 = 50 HATCH) ✅.
  - **Expected:** `waxwingsuper` +50.0000 HATCH, `claimed_season → 2`, pool −50.

  **E-opt2 — use a fresh, never-claimed qualifying account** (no admin, but needs a
  new account that owns a stage≥2 creature — not currently set up). Slower.

  > Recommendation: **E-opt1** (one admin tx, we hold `phgamecreatr@active`).
  > Bumping the season is a real game event — confirm the boss *wants* S2 opened
  > before firing, since it also re-opens claim for every other player.

---

### STEP F — `burncreature`  🟢 fireable now (doubles as cleanup)
Proves **burn** (NFT burn + HATCH-from-pool payout + EGG refund). Burn one of the
**broken `662889`** creatures — proves burn **and** removes a dead-weight creature.

```json
{"cmd":"pushaction","contract":"phgamecreatr","action":"burncreature","from":"waxwingsuper",
 "data":{"owner":"waxwingsuper","asset_id":"1099603751703"}}
```
- **Why 751703:** owned by `waxwingsuper`, `stage=0`, template `662889` (broken, earns
  nothing anyway). `burncreature` tolerates the missing `speciescfg` (`egg_type` defaults
  to 0/common) ✅.
- **Precondition:** owned by signer ✅; pool `79 HATCH ≥ payout`. Stage-0 common payout
  `= burn_base 10 × 0.2 × 1 = 2.0000 HATCH` ✅.
- **Expected:** NFT `1099603751703` burned; `waxwingsuper` +2.0000 HATCH (pool −2) +
  EGG refund (`hatch_cost 150 × 20% = 30 EGG`); creature row erased (25 → 24).

---

## 2. Quick map: boss's loop → steps above

| loop stage | step | signer | status |
|---|---|---|---|
| **feed** | B | waxwingsuper | 🟢 now (on the bred child) |
| **evolve** | C | waxwingsuper | 🟢 now (after B) |
| **breed** | A | waxwingsuper | 🟢 now (fire FIRST — it mints the fed:0 child B/C use) |
| **claim** | E | phgamecreatr→waxwingsuper | 🔴 needs `newseason` first (boss decision) |
| **harvest** | D | waxwingsuper | 🟢 now |
| **burn** | F | waxwingsuper | 🟢 now |

> **Mechanical order to actually fire:** **A → B → C → D → (E-opt1 admin) → F.**
> (Breed must precede feed/evolve because it creates the fed:0 good creature; the
> boss's conceptual "feed→evolve→breed" is preserved — we just fire breed first so
> feed/evolve have a clean, cooldown-free subject.)
>
> **Alt for feed/evolve without breeding first:** existing good creature
> `1099603751804` (stage 1, template 662977) is on `feed_cd` until ≈ `1783606480`
> (`2026-07-09T14:14:40Z`). After that time you can `feed`→`evolve` it directly and
> reorder to the literal feed→evolve→breed sequence.

---

## 3. What's ready vs blocked (one glance)

- 🟢 **Ready to fire now (no admin, no wait):** breed, feed, evolve, harvest, burn.
- 🔴 **Blocked on a boss decision:** claimreward — requires `newseason` (admin, we hold
  the key) to open Season 2, or a fresh unclaimed account. Not a bug — the season-claim
  gate is working as designed; S1 was already claimed by both office accounts.

*All preconditions above were checked against live chain state at
`2026-07-09T09:14:31Z`. Cooldowns are time-based — re-verify `last_fed`/`last_harvest`
if firing many hours later.*
