# Pocket Hatchery -- Contract Reference, Ops Runbook & FAQ

> **Live on:** WAX Testnet (chain_id `f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12`)
> **Contract:** `phgamecreatr` | **Token:** `hatchtokens1` (HATCH, 4 decimals)
> **Source:** `contract/pockethatch/` | **ABI:** `pockethatch.v3.merged.abi`
> **Last verified:** 2026-07-19 -- all table values read live from `phgamecreatr` @ wax-testnet.
>
> **Sibling docs:** `GAME-GUIDE.md` (player-facing) | `MECHANICS.md` (design rationale) |
> `ECONOMY-V2.md` (CEO-locked numbers) | `DEPLOY-RUNBOOK.md` (legacy `pockethatch1` deploy)

---

## 1. Contract Action Reference

All actions live on `phgamecreatr`. Every player action requires `owner` auth (the player's
WAX account). Admin actions require `phgamecreatr@active`.

### 1.1 Player Actions

#### `initplayer` -- create player profile
```
owner: name
```
- Idempotent (upsert). Must be called once before `harvest` or `firsthatch`.
- Creates a row in `players` with `created_at=now`, zero balances.
- Auth: `owner@active`

#### `firsthatch` -- first free hatch for a new player
```
owner: name, egg_type: uint64
```
- Only succeeds when `egg_type == 0` AND the player has never minted a creature.
- Grants one free creature (no EGG/HATCH cost). Subsequent hatches use `hatch`.
- Auth: `owner@active`

#### `hatch` -- spend EGG to mint a new creature
```
owner: name, egg_type: uint64
```
- Costs `hatch_cost` EGG (150) deducted from `players.egg_balance`.
- Uses `roll_egg_type()` to select a species template by weighted RNG.
- Mints an AtomicAssets NFT (template from `spccfgv2`, schema `creatures`).
- Newborn: `stage=0`, `born_at=now`, `last_fed=born_at`, `last_sync=now`.
- Uses `predict_asset_id` for the inline mint (asset_id is deterministic but
  cannot be read back in the same transaction).
- Auth: `owner@active`

#### `feed` -- feed a creature, restore satiety
```
owner: name, asset_id: uint64
```
- Costs `feed_cost` EGG (currently 0 -- free).
- Sets `last_fed=now`, adds `feed_boost` growth (100).
- Enforces `feed_cd` (21600s = 6h) per-creature cooldown.
- Enforces `feed_daily_cap` (3) per-creature per UTC day.
- Creature must exist and belong to `owner`.
- Auth: `owner@active`

#### `evolve` -- advance a creature's stage
```
owner: name, asset_id: uint64
```
- Costs `evolve_cost` EGG (300) per attempt.
- Creature must NOT be hungry (`now < last_fed + fed_duration_for(rarity)`).
- Total growth (`growth_base + fed_growth`) must meet the threshold for the
  next stage (from `spccfgv2.thresh_N`).
- Increments `stage` (max `max_stage`, typically 5).
- Updates NFT mutable data (`stage`, `growth`) via `setassetdata`.
- Auth: `owner@active`

#### `harvest` -- collect EGG from all your creatures
```
owner: name
```
- No cost. Requires `initplayer` done. Must respect `harvest_cd` (3600s = 1h).
- Sums per-creature EGG earned since last harvest:
  `yield_for(stage) * fed_hours * earn_mult(rarity) * avg_satiety`
- Window: `[max(last_harvest, last_fed, now-offline_cap), min(now, fed_until)]`.
- `avg_satiety` is linear average over the window (not discrete tiers) -- blocks
  feed-then-harvest exploits.
- Capped per UTC day by `daily_egg_cap * best_earn_mult / 10000` (when
  `cap_scales_rarity=1`).
- Auto-awakens stage-0 creatures whose `awaken_duration` has elapsed.
- Auth: `owner@active`

#### `breed` -- combine two parents to produce an offspring
```
owner: name, parent_a: uint64, parent_b: uint64
```
- Costs `breed_cost` (5.0000 HATCH): 40% burned (retired), 60% sent to reward pool.
- Both parents must be at max stage, fed, and belong to `owner`.
- Enforces `breed_cd` (86400s = 24h) per-parent.
- Offspring inherits blended genetics via `sha256(genetics_a, genetics_b)`.
- Offspring starts `stage=0`. Template selected by weighted RNG from parental egg_types.
- Auth: `owner@active`

#### `accelerate` -- spend HATCH for instant growth
```
owner: name, asset_id: uint64, amount: asset
```
- Converts HATCH to growth at 1 HATCH = 100 growth points.
- Creature must be fed. Growth credited to `fed_growth`.
- HATCH is burned (transferred to contract then retired).
- Auth: `owner@active`

#### `claimreward` -- claim seasonal HATCH payout
```
owner: name
```
- No params beyond owner. Payout based on highest-stage fed creature owned:
  stage 2=15, stage 3=25, stage 4=45, stage 5=85 HATCH (code: `base[] = {0,0,15,25,45,85} × 10^4`).
- Can claim **once per season** (tracked in `claims` table, scoped by account).
- Requires at least one creature at stage >= 2 AND fed (`now < last_fed + fed_dur`).
- Payout comes from `rewardpool.balance` -- reverts if pool is insufficient.
- Auth: `owner@active`

#### `burncreature` -- destroy a creature for HATCH + EGG refund
```
owner: name, asset_id: uint64
```
- Refunds `burn_egg_<rarity>` EGG (flat per rarity: 8/12/16/21/26/30).
- Pays HATCH from reward pool: `burn_base_hatch * stage_mul / 10 * rarity_mul / 10`.
- Has `nft_exists` check -- if the NFT was already burned externally, the
  table row is still cleaned up (resilient burn).
- Auth: `owner@active`

#### `equipcosmetic` -- apply a cosmetic template to a creature
```
owner: name, asset_id: uint64, cosmetic_tmpl: uint64
```
- Costs `cosmetic_cost` EGG (100).
- Auth: `owner@active`

#### `setname` -- name your creature
```
owner: name, asset_id: uint64, new_name: string
```
- Costs `name_cost` (1.0000 HATCH). Updates NFT mutable `name` attribute.
- Auth: `owner@active`

#### `unlockslot` -- unlock an additional creature slot
```
owner: name, slot_index: uint8
```
- Costs EGG per slot: slot 4=500, slot 5=1200, slot 6=2500, doubles thereafter.
- Default is 3 free slots; max purchasable slots = `install_cap_bonus / 12` (6 with current config).
- Auth: `owner@active`

### 1.2 Admin Actions

All require `phgamecreatr@active` auth.

| Action | Params | Notes |
|--------|--------|-------|
| `setconfig` | `cfg: config_row` | Replaces the entire `configv3` singleton. All fields must be present. |
| `setspecies` | `sp: species_row` | Upserts a row in `spccfgv2`. Template must exist in AtomicAssets. |
| `rmspecies` | `template_id: uint64` | Removes a species row. |
| `clearspecies` | _(none)_ | Wipes the entire `spccfgv2` table. |
| `clearconfig` | _(none)_ | Wipes `configv3`. Contract falls back to C++ defaults. |
| `clearpool` | _(none)_ | Wipes `rewardpool`. Use only in disaster recovery. |
| `newseason` | `bootstrap_release: asset` | Increments `season_index`, resets `season_started`. If `bootstrap_release.amount > 0`, funds the pool. |
| `fundpool` | `amount: asset, source: string` | Credits `rewardpool.balance` + `lifetime_funded`. **Accounting only** -- does NOT move real HATCH. You must separately transfer HATCH to the contract. |
| `setpaused` | `paused: bool` | Emergency pause. When `true`, all player actions revert. |
| `withdraw` | `token_contract, quantity, to, memo` | Withdraw tokens from contract balance. Guarded: `withdrawable = contract_balance - pool.balance` (prevents draining the reward pool). |

### 1.3 Tables

| Table | Scope | Key | Purpose |
|-------|-------|-----|---------|
| `configv3` | singleton | -- | All tunable parameters (costs, cooldowns, rarity weights, caps). **Replaced whole on `setconfig`.** |
| `spccfgv2` | contract | `template_id` | Species definitions: growth thresholds, yields, egg_weight, family. |
| `players` | contract | `account` | Per-player state: egg_balance, harvest timers, daily counters. |
| `creatrsv2` | contract | `asset_id` | Every living creature: owner, template, stage, growth, timers, genetics. |
| `claims` | contract | `account` | Seasonal claim tracker (`last_claimed`, `claimed_season`). **Separate from `players`.** |
| `lastmint` | contract | `asset_id` | Last minted asset_id (cached for `predict_asset_id`). |
| `rewardpool` | singleton | -- | HATCH pool balance, lifetime funded/paid, bootstrap release tracking. |

---

## 2. Deploy / Ops Runbook

### 2.1 Network & Accounts

```
Chain:        WAX Testnet
Chain ID:     f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12
RPC:          https://waxtestnet.greymass.com
Contract:     phgamecreatr
Token:        hatchtokens1  (HATCH, 4 decimals)
Collection:   phgamecreatr
Schema:       creatures
Issuer:       waxwingsuper
```

### 2.2 Admin Key Requirements

- `phgamecreatr@active` -- needed for all admin actions (`setconfig`, `setspecies`,
  `newseason`, `fundpool`, `setpaused`, `withdraw`, `clear*`).
- The contract's inline actions (mint, transfer, retire) use `phgamecreatr@active`
  and `phgamecreatr@eosio.code`.
- `waxwingsuper` is the HATCH issuer -- `retire` authority must be delegated if
  the contract burns HATCH.

### 2.3 How To: setconfig

`setconfig` replaces the **entire** `configv3` row. Always read the current row
first, modify only the fields you intend to change, and push the full struct back.

```bash
# Read current, then push full row (read-modify-write)
cleos -u https://waxtestnet.greymass.com get table phgamecreatr phgamecreatr configv3
cleos -u https://waxtestnet.greymass.com push action phgamecreatr setconfig \
  "$(cat config_payload.json)" -p phgamecreatr@active
```
**Critical:** Always carry forward `season_index` + `season_started` -- losing them
breaks `firsthatch` and `claimreward`.

### 2.4 How To: setspecies

```bash
cleos -u https://waxtestnet.greymass.com push action phgamecreatr setspecies \
  '{"template_id":663048,"growth_rate":150,"thresh_1":15000,"thresh_2":80000,
    "thresh_3":280000,"thresh_4":900000,"thresh_5":1800000,
    "yield_0":100,"yield_1":300,"yield_2":600,"yield_3":1200,"yield_4":2400,"yield_5":3600,
    "max_stage":5,"egg_weight":5,"egg_type":5,"family":"Fire"}' \
  -p phgamecreatr@active
```

- `template_id` must exist under collection `phgamecreatr` in AtomicAssets.
- All species yields must be flat -- `earn_mult` is the sole rarity premium (gotcha 3.2).

### 2.5 How To: newseason

```bash
# Seed the pool while starting a new season
cleos -u https://waxtestnet.greymass.com push action phgamecreatr newseason \
  '{"bootstrap_release":"50000.0000 HATCH"}' -p phgamecreatr@active
```

- Bumps `season_index`, resets `season_started`. Credits pool if `bootstrap_release.amount > 0`.
- **Then transfer real HATCH** so the pool is actually funded:
  ```bash
  cleos -u https://waxtestnet.greymass.com push action hatchtokens1 transfer \
    '["waxwingsuper","phgamecreatr","50000.0000 HATCH","pool seed"]' -p waxwingsuper@active
  ```

### 2.6 Pool Management

**Monitor:**
```bash
cleos -u https://waxtestnet.greymass.com get table phgamecreatr phgamecreatr rewardpool
cleos -u https://waxtestnet.greymass.com get currency balance hatchtokens1 phgamecreatr HATCH
```
**Red flags:** `rewardpool.balance` near 0 (claims/burns revert). Contract HATCH < pool balance (drift).

**Top up:** (1) Transfer real HATCH to `phgamecreatr`. (2) Call `fundpool`:
```bash
cleos -u https://waxtestnet.greymass.com push action phgamecreatr fundpool \
  '{"amount":"50000.0000 HATCH","source":"manual-topup"}' -p phgamecreatr@active
```
**Withdrawal guard:** `withdraw` enforces `sweepable = contract_balance - pool.balance`.

### 2.7 Emergency Procedures

| Scenario | Action |
|----------|--------|
| Exploit active | `setpaused(true)` -- blocks all player actions immediately |
| Pool drained | `fundpool` + transfer real HATCH; investigate drain cause |
| Config corruption | `clearconfig` then `setconfig` with known-good values |
| Species misconfigured | `setspecies` with corrected row (upsert) or `rmspecies` |
| Full reset | `clearpool` + `clearspecies` + `clearconfig`, then re-seed |

---

## 3. Known Issues & Gotchas

### 3.1 `configv3` is a singleton -- setconfig replaces the entire row

There is no "update one field" action. Every `setconfig` call must carry the complete
`config_row` struct. If you omit a field, it will be set to its C++ default (likely 0 or
empty name). **Always read-modify-write, never push partial configs.**

Most dangerous to lose: `season_index`, `season_started`, `collection`, `token_contract`,
`rng_oracle`. Losing `collection` means the contract tries to mint into a non-existent
AtomicAssets collection.

### 3.2 Species yields must be flat -- earn_mult is the sole rarity premium

The harvest formula multiplies `species_yield * earn_mult`. If species rows carry
different yields per rarity (e.g., Common=100, Rare=140), the rarity premium compounds
(yield_ratio * earn_mult_ratio). This was the "double-count bug" identified in
`ECONOMY-AUDIT.md`.

**Fix:** All species within a family must have identical `yield_*` values.
The `earn_mult` config fields are the single source of rarity-based earn scaling.

### 3.3 `claimreward` uses the `claims` table -- scoped separately from `players`

The `claims` table is scoped by `account` under the **contract** scope
(`phgamecreatr`/`phgamecreatr`), NOT under the player row. Querying `players` for claim
state returns nothing -- it will look like the player "never claimed" even if they did.

```bash
# Correct -- claims table, not players table
cleos get table phgamecreatr phgamecreatr claims --lower waxwingsuper --limit 1

# Wrong -- players table has no claim data
cleos get table phgamecreatr phgamecreatr players --lower waxwingsuper
```

### 3.4 `harvest` uses avg_satiety, not discrete tiers

The feed-then-harvest exploit is blocked because harvest computes the **average satiety**
over the earning window `[ws, we]`, not a snapshot at harvest time. If a creature was
starving for 23 hours and you feed right before harvest, the average satiety is near zero
and you earn almost nothing. The formula:

```
ws = max(last_harvest, last_fed, now - offline_cap)
we = min(now, fed_until)
avg_satiety = (satiety(ws) + satiety(we)) / 2   (linear interpolation)
```

### 3.5 `predict_asset_id` for inline mint

AtomicAssets assigns asset IDs sequentially. The contract uses a deterministic prediction
(`lastmint.asset_id + 1`) to know the new creature's asset_id before the inline
`mintasset` completes. This is necessary because inline actions in the same transaction
cannot read each other's side effects. The `lastmint` table caches the last known ID.

If `predict_asset_id` drifts (e.g., another minter in the same block), the
`creatrsv2` row will point to a non-existent or wrong NFT. This is rare but worth knowing.

### 3.6 `burncreature` nft_exists check

`burncreature` first checks if the AtomicAssets NFT still exists. If the NFT was already
burned externally (via AtomicAssets `burnasset`), the contract still cleans up the
`creatrsv2` row and refunds EGG. This prevents orphaned table rows.

### 3.7 `on_assets_transfer` auto-updates owner

When a creature NFT is transferred (AtomicAssets `transfer`), the contract's
`on_assets_transfer` notification handler updates `creatrsv2.owner` automatically.
The creature and its growth/rarity travel with the NFT.

---

## 4. On-Chain Data Reference

All values verified live from `phgamecreatr` @ wax-testnet as of 2026-07-19.

### 4.1 configv3 (live singleton)

```
token_contract     = hatchtokens1
collection         = phgamecreatr
schema_name        = creatures
fee_account        = phgamecreatr
paused             = 0
hatch_cost         = 150        (EGG)
evolve_cost        = 300        (EGG)
breed_cost         = 5.0000 HATCH
feed_cost          = 0          (free)
slot_cost          = 500        (EGG, base for slot 4)
cosmetic_cost      = 100        (EGG)
name_cost          = 1.0000 HATCH
install_cap_bonus  = 72         (bonus creature capacity)
feed_cd            = 21600      (6h, seconds)
harvest_cd         = 3600       (1h, seconds)
breed_cd           = 86400      (24h, seconds)
feed_daily_cap     = 3          (per creature per UTC day)
daily_egg_cap      = 240        (base, scaled by earn_mult)
offline_cap_h      = 8          (max offline earn hours)
tap_egg_cap        = 60
feed_boost         = 100        (growth per feed)
season_index       = 4
season_started     = 1784060782
rng_oracle         = phgamecreatr
cap_scales_rarity  = 1          (daily cap *= best earn_mult/10000)
burn_base_hatch    = 10.0000 HATCH
```

### 4.2 Rarity Parameters (6 tiers)

| Field | Common(0) | Uncommon(1) | Rare(2) | Epic(3) | Legendary(4) | Mythic(5) |
|-------|-----------|-------------|---------|---------|-------------|-----------|
| `rarity_w` | 6900 | 2000 | 800 | 250 | 45 | 5 |
| `earn_mult` (bp) | 10000 | 11000 | 14000 | 18000 | 24000 | 33000 |
| `fed_dur` (s) | 172800 | 259200 | 432000 | 604800 | 864000 | 1209600 |
| `awaken_dur` (s) | 3600 | 5400 | 7200 | 9000 | 10800 | 10800 |
| `wake_cost` (WAX) | 3 | 5 | 10 | 20 | 40 | 80 |
| `burn_egg` | 8 | 12 | 16 | 21 | 26 | 30 |
| Drop chance | 69% | 20% | 8% | 2.5% | 0.45% | 0.05% |
| E[hatches] | 1.4 | 5 | 12.5 | 40 | 222 | 2000 |

- WAX contract: `eosio.token`
- `cap_scales_rarity=1`: daily cap = 240 * best_earn_mult / 10000

### 4.3 spccfgv2 -- Species Table (7 species, all family "Fire")

| template_id | egg_type | growth_rate | thresh_1 | thresh_2 | thresh_3 | thresh_4 | thresh_5 | yields (stage 0-5) | egg_wt | max_stage |
|-------------|----------|-------------|----------|----------|----------|----------|----------|-------------------|--------|-----------|
| 662889 | 0 (Common) | 1000 | 1K | 5K | 20K | 100K | 200K | 100/300/600/1200/2400/4800 | 100 | 5 |
| 662976 | 1 (Uncommon) | 1000 | 1K | 5K | 20K | 100K | 200K | 100/300/600/1200/2400/4800 | 65 | 5 |
| 662977 | 1 (Uncommon) | 1000 | 1K | 5K | 20K | 100K | 200K | 100/300/600/1200/2400/4800 | 65 | 5 |
| 662978 | 2 (Rare) | 1000 | 1K | 5K | 20K | 100K | 200K | 100/300/600/1200/2400/4800 | 22 | 5 |
| 663046 | 3 (Epic) | 600 | 3K | 15K | 60K | 200K | 350K | 100/300/600/1200/2400/4800 | 10 | 5 |
| 663047 | 4 (Legendary) | 500 | 4K | 20K | 80K | 250K | 450K | 100/300/600/1200/2400/4800 | 10 | 5 |
| 663048 | 5 (Mythic) | 150 | 15K | 80K | 280K | 900K | 1800K | 100/300/600/1200/2400/3600 | 5 | 5 |

Notes:
- All yields are flat per-stage across rarities (100/300/600/1200/2400/...) -- earn_mult is the sole rarity premium.
- Growth thresholds increase with rarity (harder to evolve rarer creatures).
- `egg_weight` determines proportional selection during `hatch` RNG roll.

### 4.4 rewardpool -- Status

```
balance          = 149,930.0101 HATCH
lifetime_funded  = 150,124.0101 HATCH
lifetime_paid    = 194.0000 HATCH
```

- Pool is healthy (~150K HATCH available for claims and burn payouts).
- Lifetime paid is low relative to pool -- payout volume is still light.
- Monitor `balance` regularly; top up when it drops below 10,000 HATCH.

### 4.5 Slot Cost Progression

| Slot | Cost (EGG) | Notes |
|------|-----------|-------|
| 1-3 | Free | Default for all players |
| 4 | 500 | First purchased slot |
| 5 | 1,200 | |
| 6 | 2,500 | |
| 7+ | Doubles each | Capped by `install_cap_bonus / 12` |

---

## 5. FAQ / Troubleshooting

### "Why can't I harvest?"

1. **No `initplayer`** -- call `initplayer` first.
2. **Cooldown** -- `harvest_cd` (1h) must have passed since `last_harvest`.
3. **No earning creatures** -- need at least one creature at stage >= 1 that is fed. Stage-0 creatures still in awaken timer do not earn.

### "Why did my evolve revert?"

1. **Hungry** -- `now >= last_fed + fed_duration_for(rarity)`. Feed first.
2. **Insufficient growth** -- `growth_base + fed_growth` must meet `spccfgv2.thresh_N`.
3. **Already max stage** -- `stage == max_stage` (typically 5).
4. **NFT transferred away** -- `owner` check fails.

### "Why is claimreward failing?"

1. **Already claimed** this season (`claims.claimed_season == season_index`).
2. **No qualifying creature** -- need stage >= 2 AND fed.
3. **Pool empty** -- `rewardpool.balance < payout`. Needs `fundpool` or `newseason`.
4. **No `initplayer`** -- must initialize first.

### "What happens if I transfer my creature NFT?"

`on_assets_transfer` auto-updates `creatrsv2.owner`. Growth, stage, fed state, and genetics all travel with the NFT. The new owner can immediately use the creature.

### "How is slot cost calculated?"

Slots 1-3 free. Slot 4: 500, slot 5: 1200, slot 6: 2500 EGG. Slot 7+ doubles each. Max purchasable = `install_cap_bonus / 12` (6; 9 total slots max).

### "What happens to my EGG if I transfer my whole account?"

EGG is in the `players` table, bound to your WAX account -- not a token. If you sell the account, EGG goes with it. To extract value, burn creatures for HATCH (tradeable) and transfer that.

### "How do I check my claim status?"

```bash
cleos -u https://waxtestnet.greymass.com get table phgamecreatr phgamecreatr claims \
  --lower <your_account> --limit 1
```
`claimed_season == season_index` means already claimed.

### "Why is the contract paused?"

`configv3.paused == 1` blocks all player actions. Only `phgamecreatr@active` can `setpaused(false)`.

---

*Reference maintained by the Pocket Hatchery team. Last updated 2026-07-19 from live chain.
Cross-reference `docs/ECONOMY-V2.md` for CEO-locked numbers and design rationale,
`docs/GAME-GUIDE.md` for player-facing instructions,
and `docs/DEPLOY-RUNBOOK.md` for the legacy `pockethatch1` deployment history.*
