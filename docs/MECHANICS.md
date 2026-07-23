# Pocket Hatchery -- Mechanics & Economy Reference

**Audience:** Developers and economy designers. Not a player guide -- see
`HOW-TO-PLAY-CEO.md` for the player-facing explanation and `REFERENCE.md` (TBD)
for the API/schema reference.

**Contract:** `phgamecreatr` (wax-testnet) | **Token:** `hatchtokens1` (`HATCH`, 4 dp) | **Verified:** block ~416M. All numbers match deployed bytecode.

## 1. Core Mechanics

### 1.1 Hatch -- Rarity Roll & Species Selection

```
roll_egg_type() → egg_type ∈ {0..5}
pick_template(egg_type) → template_id
mint_creature(owner, template_id, genetics, now)
```

**rarity roll** (`roll_egg_type`, pockethatch.cpp:248-265):

```
total_weight = w_common + w_uncommon + w_rare + w_epic + w_legendary + w_mythic
roll = make_seed() % total_weight
acc = 0

acc += w_common;     if roll < acc → egg_type = 0 (Common)
acc += w_uncommon;   if roll < acc → egg_type = 1 (Uncommon)
acc += w_rare;       if roll < acc → egg_type = 2 (Rare)
acc += w_epic;       if roll < acc → egg_type = 3 (Epic)
acc += w_legendary;  if roll < acc → egg_type = 4 (Legendary)
return 5                                       (Mythic)
```

Live weights (configv3, w_total = 10,000):

| egg_type | Tier      | Weight | P(hatch) | E[hatches] |
|----------|-----------|--------|----------|------------|
| 0        | Common    | 6900   | 69.00%   | 1.4        |
| 1        | Uncommon  | 2000   | 20.00%   | 5          |
| 2        | Rare      | 800    | 8.00%    | 12.5       |
| 3        | Epic      | 250    | 2.50%    | 40         |
| 4        | Legendary | 45     | 0.45%    | 222        |
| 5        | Mythic    | 5      | 0.05%    | 2,000      |

**species roll** (`pick_template`, pockethatch.cpp:226-246): Once the rarity tier
is fixed, we sum `egg_weight` from all `spccfgv2` rows sharing that `egg_type`,
then do a weighted selection. The live chain has 7 species across 6 tiers
(2 species share egg_type=1).

**Cost:** `hatch_cost = 150 EGG` (flat -- no rarity multiplier). Deducted from
the player's internal `egg_balance`. The `egg_type` parameter from the caller is
**ignored**; the contract always rolls server-side RNG.

**firsthatch** (pockethatch.cpp:398-429): Identical to hatch but costs zero EGG
and is gated on the player owning zero creatures. Used for onboarding.

### 1.2 Feed -- Satiety Economy

```
feed(owner, asset_id)
```

**Cooldown:** `feed_cd = 21600` (6 h) per creature.  
**Daily cap:** `feed_daily_cap = 3` per creature.  
**Cost:** `feed_cost = 0` EGG (CEO-locked: free feeding).  
**Effect:** Adds `feed_boost = 100` growth points instantly, and resets the
satiety timer: `last_fed = now`. The creature is considered "fed" until
`now < last_fed + fed_dur(rarity)`.

**fed_dur by rarity** (seconds):

| egg_type | Tier      | fed_dur      | Human    |
|----------|-----------|-------------|----------|
| 0        | Common    | 172,800     | 48 h     |
| 1        | Uncommon  | 259,200     | 72 h     |
| 2        | Rare      | 432,000     | 120 h    |
| 3        | Epic      | 604,800     | 7 d      |
| 4        | Legendary | 864,000     | 10 d     |
| 5        | Mythic    | 1,209,600   | 14 d     |

Satiety decays **linearly**: `satiety(now) = clamp((fed_until - now) / fed_dur, 0, 1)`.
A hungrier creature earns proportionally less (see harvest).

### 1.3 Harvest -- EGG Faucet

```
harvest(owner)
```

**Cooldown:** `harvest_cd = 3600` (1 h) per player.  
**Daily cap:** `daily_egg_cap = 240` (scales with rarity, see below).

**Earning formula** (pockethatch.cpp:625-651) -- per creature, per harvest window:

```
ws = max(last_harvest, last_fed, now - offline_cap)
we = min(now, fed_until)
if we <= ws → earns 0 (out of food across the whole window)

fed_h = (we - ws) / 3600                // integer hours
sat_ws = (fed_until - ws) * 10000 / fed_dur    // satiety at window start (bp)
sat_we = (fed_until - we) * 10000 / fed_dur    // satiety at window end   (bp)
avg_sat = (sat_ws + sat_we) / 2               // linear average (bp)

earn = yield_for(stage - 1) * fed_h * earn_mult(rarity) / 10000 * avg_sat / 10000
```

Key properties: **(a)** `ws >= last_fed` kills the feed-then-harvest exploit
(zero retroactive credit). **(b)** `ws >= now - offline_cap` penalizes neglect.
**(c)** `avg_sat` is linear (not discrete) -- a creature at 30% satiety earns
30%.

**Offline cap:** `offline_cap_h = 8` -- earnings beyond 8 h ago are lost.
**Stage requirement:** `stage >= 1`. Stage 0 creatures are excluded (auto-awaken
at harvest start; see SS1.9).

**Daily cap with rarity scaling** (pockethatch.cpp:656-657):

```
best_mult = max over all owned creatures: earn_mult for their rarity, if they earned > 0 this harvest
if cap_scales_rarity: cap = daily_egg_cap * best_mult / 10000
yield = min(gross, remaining_cap)
```

| Best Rarity Owned | `best_mult` | Daily Cap |
|-------------------|-------------|-----------|
| Common            | 10000       | 240       |
| Uncommon          | 11000       | 264       |
| Rare              | 14000       | 336       |
| Epic              | 18000       | 432       |
| Legendary         | 24000       | 576       |
| Mythic            | 33000       | 792       |

All tiers hit cap in ~2.4 h at stage 1 full satiety -- the earn rate and cap scale
with the same multiplier, so time-to-cap is constant.

### 1.4 Evolve -- Stage Advancement

```
evolve(owner, asset_id)
```

**Pre-conditions:**
1. Creature must be fed (`now < last_fed + fed_dur`).
2. `cur_stage < max_stage`.
3. `g = growth_base + fed_growth >= threshold_for(cur_stage)`.

**Cost:** `evolve_cost * (cur_stage + 1) = 300 * (cur_stage + 1)` EGG.

| Evolve       | Threshold   | Cost (EGG) |
|-------------|-------------|------------|
| 0 -> 1      | thresh_1    | 300        |
| 1 -> 2      | thresh_2    | 600        |
| 2 -> 3      | thresh_3    | 900        |
| 3 -> 4      | thresh_4    | 1200       |
| 4 -> 5      | thresh_5    | 1500       |
| **Total**   |             | **4,500**  |

**Stage determination:** `stage_for_growth(g)` iterates `i` from `max_stage` down
to 1 and returns the highest stage `i` where `g >= threshold_for(i-1)`. The
evolve action uses the **stored** `c.stage` (not `stage_for_growth(g)`) as the
authoritative current stage -- this prevents an off-by-one where
`stage_for_growth(g)` always returns the highest eligible stage, making the
threshold check always fail.

**Post-evolve:** `stage` is incremented on the `creatrsv2` row, and
`setassetdata` is called on the AtomicAssets NFT to mirror `stage` and `growth`
in the mutable data.

### 1.5 Breed -- Offspring & HATCH Burn

```
breed(owner, parent_a, parent_b)
```

**Pre-conditions:**
- `parent_a != parent_b`.
- Both parents owned by `owner`.
- Both past `breed_cd = 86400` (24 h) since their `last_bred`.
- Both synced before reading growth.

**Cost:** `breed_cost = 5.0000 HATCH`, split:
- **40% (2.0000 HATCH)** -- burnt via `burn_hatch()` (transferred to contract,
  permanently locked).
- **60% (3.0000 HATCH)** -- transferred to contract and added to the reward pool
  via `fund_pool()`.

**Genetics blending:** Per-byte selection from either parent based on seed,
then `sha256(gblend)`. Offspring inherits `parent_a.template_id` (v1). Offspring
starts at `stage=0, growth=0, last_fed=now`; both parents get `last_bred = now`.

### 1.6 Accelerate -- Pay HATCH for Growth

```
accelerate(owner, asset_id, amount)
```

**Pre-condition:** `amount.symbol == HATCH`, `amount.amount > 0`.

**Conversion:** `growth += amount.amount * 100`.  1.0000 HATCH = 100 growth
points.

**Cost:** The entire amount is burnt via `burn_hatch()`. There is no pool
calls `fund_pool()`, so accelerate HATCH enters the reward pool (same as breed). This means accelerate HATCH can circulate back out through claimreward and burncreature.

### 1.7 Claim Reward -- Seasonal HATCH Payout

```
claimreward(owner)
```

**Gates:**
1. **Season gate:** `claimed_season < season_index` (one claim per season per
   player). Stored in the `claims` table (contract scope), **not** the player
   row.
2. **Cooldown:** `now >= last_claimed + harvest_cd` (defense-in-depth).
3. **Stage qualification:** Must own at least one creature `stage >= 2`
   (Juvenile).
4. **Satiety gate:** Must own at least one creature that is currently fed
   (`now < last_fed + fed_dur`).

**Payout by highest owned stage:**

| Highest Stage | Payout (HATCH) |
|---------------|-----------------|
| 2 (Juvenile)  | 15.0000          |
| 3 (Adult)     | 25.0000          |
| 4 (Evolved)   | 45.0000          |
| 5 (Final)     | 85.0000          |

(Stored as `base[idx] * 10000` in uint64, then constructed as `asset(amt, HATCH_SYM)`.)

**Pool guard:** Payout reverts if `rewardpool.balance < payout`. Payout is
deducted from the pool before transfer (CEI pattern: claims table updated first,
then pool updated, then inline transfer).

### 1.8 Burn Creature -- Sacrifice for HATCH + EGG

```
burncreature(owner, asset_id)
```

**HATCH payout formula:**

```
payout = burn_base_hatch * stage_mul[stage] / 10 * rarity_mul[egg_type] / 10
```

Multiplier tables:

| Stage | stage_mul (raw) | Actual mult |
|-------|-----------------|-------------|
| 0     | 2               | x0.2        |
| 1     | 5               | x0.5        |
| 2     | 10              | x1.0        |
| 3     | 20              | x2.0        |
| 4     | 50              | x5.0        |
| 5     | 100             | x10.0       |

| egg_type | Tier      | rarity_mul (raw) | Actual mult |
|----------|-----------|------------------|-------------|
| 0        | Common    | 10               | x1          |
| 1        | Uncommon  | 30               | x3          |
| 2        | Rare      | 100              | x10         |
| 3        | Epic      | 250              | x25         |
| 4        | Legendary | 600              | x60         |
| 5        | Mythic    | 1500             | x150        |

**Sample payouts (burn_base_hatch = 10.0000 HATCH):**

| Stage | Common | Uncommon | Rare | Epic  | Legendary | Mythic   |
|-------|--------|----------|------|-------|-----------|----------|
| 0     | 2      | 6        | 20   | 50    | 120       | 300      |
| 1     | 5      | 15       | 50   | 125   | 300       | 750      |
| 2     | 10     | 30       | 100  | 250   | 600       | 1,500    |
| 3     | 20     | 60       | 200  | 500   | 1,200     | 3,000    |
| 4     | 50     | 150      | 500  | 1,250 | 3,000     | 7,500    |
| 5     | 100    | 300      | 1,000| 2,500 | 6,000     | 15,000   |

**EGG refund** (flat per rarity, independent of stage):

| egg_type | Tier      | Refund |
|----------|-----------|--------|
| 0        | Common    | 8      |
| 1        | Uncommon  | 12     |
| 2        | Rare      | 16     |
| 3        | Epic      | 21     |
| 4        | Legendary | 26     |
| 5        | Mythic    | 30     |

**Flow:** Resilient NFT burn (`burnasset` only if NFT still exists) -> HATCH
payout from pool (CEI pattern) -> EGG refund -> erase creature row.

### 1.9 Awaken -- Stage 0 to 1 Transition

A freshly hatched or bred creature starts at `stage = 0` (egg/infant). It cannot
earn EGG, be evolved, or be bred until it reaches `stage >= 1`.

**Timer:** `born_at + awaken_dur(rarity)`.

| egg_type | Tier      | awaken_dur | Note         |
|----------|-----------|------------|--------------|
| 0        | Common    | 3,600      | 1 h          |
| 1        | Uncommon  | 5,400      | 1.5 h        |
| 2        | Rare      | 7,200      | 2 h          |
| 3        | Epic      | 9,000      | 2.5 h        |
| 4        | Legendary | 10,800     | 3 h          |
| 5        | Mythic    | 10,800     | 3 h (capped) |

**Auto-awaken in harvest:** At harvest start, all `stage==0` creatures with
elapsed timer are collected and promoted to `stage=1`, then earn in the same loop.

**WAX wake:** Player sends WAX via `eosio.token::transfer` with memo
`"wake:<asset_id>"`. Validates amount per rarity, sets `stage=1`, retains WAX
in-contract (`fee_account = get_self()`).

| Rarity    | WAX Cost |
|-----------|----------|
| Common    | 3        |
| Uncommon  | 5        |
| Rare      | 10       |
| Epic      | 20       |
| Legendary | 40       |
| Mythic    | 80       |
---
## 2. Economy & Tokenomics

### 2.1 EGG -- Soft Internal Currency

EGG is **not a token** -- a `uint64_t egg_balance` field in `players`. No
symbol, no transfers, internal accounting only.

**Faucets:**

| Source          | Type    | Max/Rate                       |
|-----------------|---------|--------------------------------|
| Harvest         | Regular | 240-792/day (rarity-scaled)   |
| initplayer      | One-time| 200 (starter grant)            |
| Burn EGG refund | Occasional | 8-30 per burn (flat/rarity) |

**Sinks:**

| Sink           | Cost (EGG)              | Frequency       |
|----------------|-------------------------|-----------------|
| Hatch          | 150                     | Per roll        |
| Evolve         | 300 x (stage+1)         | Per evolve      |
| Slot unlock    | 500 / 1,200 / 2,500...  | Per slot        |
| Cosmetic equip | 100                     | Per equip       |
| Feed           | 0 (free)                | --              |

**Entry-level balance check (Common, 240 EGG/day):**
1 hatch + free feed = 150 EGG. Net +90/day. Evolve 0->1 costs 300 EGG (~4 days
of surplus). Sustainable with room to progress.

### 2.2 HATCH -- Hard Deflationary Token

HATCH (`hatchtokens1`, 4 decimals) is the premium currency. It is a standard
`eosio.token` fungible token.

**Faucets (into circulation):**

| Source         | From     | Scale                           |
|----------------|----------|---------------------------------|
| Claim reward   | Pool     | 15-85 HATCH/season      |
| Burn creature  | Pool     | 2-15,000 HATCH/burn             |

**Sinks (destroyed from circulation):**

| Source         | Mechanism                        | Rate            |
|----------------|----------------------------------|-----------------|
| Breed (40%)    | `burn_hatch()` -- locked in contract | 2.0000/breed |
| Accelerate     | `burn_hatch()` -- locked in contract | 1.0000 = 100 growth |

**Pool (buffer, not faucet):**

| Source         | To Pool       | Rate                |
|----------------|---------------|---------------------|
| Breed (60%)    | `fund_pool()` | 3.0000 HATCH/breed  |
| Bootstrap      | `fundpool()`  | Admin inject        |

The reward pool is a `singleton<"rewardpool">` that tracks: `balance`,
`lifetime_funded`, `lifetime_paid`, `bootstrap_total`, `bootstrap_released`,
`last_release`.

**Key invariant:** `withdraw` enforces `contract_balance >= pool.balance`. HATCH
from breed (40%) and accelerate is locked in-contract with no path back except
through the pool guard -- effectively **burnt**.

**Live pool state (phgamecreatr @ block ~416M):**
`balance = 149,930 HATCH`, `lifetime_funded = 150,124 HATCH`,
`lifetime_paid = 194 HATCH`.

### 2.3 WAX -- Real-Value Monetization

WAX flows through `on_notify("eosio.token::transfer")` (pockethatch.cpp:1213).
Current use: wake (skip awaken timer). WAX lands in the contract and stays there
(`fee_account = get_self()`); the `withdraw` admin action can sweep WAX to any
destination.

WAX has no impact on EGG/HATCH game balance.
---
## 3. NFT & Creatures

### 3.1 AtomicAssets Integration

**Collection:** `phgamecreatr` | **Schema:** `creatures`

The contract issues 3 inline AtomicAssets actions:

| Action          | When                        | Auth                  |
|-----------------|-----------------------------|-----------------------|
| `mintasset`     | hatch, firsthatch, breed    | `get_self()@active`   |
| `setassetdata`  | evolve, setname, equipcosmetic | `get_self()@active`|
| `burnasset`     | burncreature                | `owner@active`        |

**Schema `creatures` attributes:**

| Field    | Type    | Mutable | Description                         |
|----------|---------|---------|-------------------------------------|
| genetics | string  | No      | 64-char hex of 256-bit gene         |
| stage    | uint32  | Yes     | 0=egg, 1=hatchling, 2=juvenile, ...|
| growth   | uint64  | Yes     | Total accumulated growth points     |
| name     | string  | Yes     | Player-set nickname (max 32 chars)  |
| cosmetic | uint64  | Yes     | Cosmetic template ID                |

**Asset ID prediction:** Reads `atomicassets::config.asset_counter` BEFORE
dispatching `mintasset` -- the only way to know the new ID within the same
action, preventing orphaned creature rows.

**NFT transfer tracking:** `on_assets_transfer` handler syncs `creatrsv2.owner`.

**Resilient NFT ops:** `evolve`/`setname`/`equipcosmetic` check `nft_exists()`
and revert if the NFT was transferred away. `burncreature` calls `burnasset` only
if the NFT still exists; otherwise skips the burn but still pays out.

### 3.2 6-Tier Rarity System

All 7 live species on phgamecreatr:

| template_id | egg_type | Tier      | growth_rate | Yield profile            | max_stage |
|-------------|----------|-----------|-------------|--------------------------|-----------|
| 662889      | 0        | Common    | 1000        | 100/300/600/1200/2400/4800 | 6       |
| 662976      | 1        | Uncommon  | 1000        | 100/300/600/1200/2400/4800 | 6       |
| 662977      | 1        | Uncommon  | 1000        | 100/300/600/1200/2400/4800 | 6       |
| 662978      | 2        | Rare      | 1000        | 100/300/600/1200/2400/4800 | 6       |
| 663046      | 3        | Epic      | 600         | 100/300/600/1200/2400/4800 | 6       |
| 663047      | 4        | Legendary | 500         | 100/300/600/1200/2400/4800 | 6       |
| 663048      | 5        | Mythic    | 150         | 100/300/600/1200/2400/3600 | 6       |

All species use **flat yields** (100/300/600/1200/2400) per the harvest fix
(double-count removal). Mythic stage 5 yields 3600 (vs 4800 for all others).
Rarity premium comes exclusively from `earn_mult`.

### 3.3 Growth System

**Passive growth** (`sync`, pockethatch.cpp:70-78):

```
dt = now - last_sync
growth_base += dt * growth_rate
last_sync = now
```

**Current total** (`current_growth`, pockethatch.cpp:80-84):

```
g = growth_base + fed_growth + (now - last_sync) * growth_rate
```

`fed_growth` is a lump-sum from `feed` boosts (currently `feed_boost = 100` per
feed). It is NOT multiplied by time -- it's a one-time injection.

**Evolution thresholds** for each species:

| template_id | Tier      | thresh_1 | thresh_2 | thresh_3 | thresh_4  | thresh_5   |
|-------------|-----------|----------|----------|----------|-----------|------------|
| 662889      | Common    | 1K       | 5K       | 20K      | 100K      | 200K       |
| 662976      | Uncommon  | 1K       | 5K       | 20K      | 100K      | 200K       |
| 662977      | Uncommon  | 1K       | 5K       | 20K      | 100K      | 200K       |
| 662978      | Rare      | 1K       | 5K       | 20K      | 100K      | 200K       |
| 663046      | Epic      | 3K       | 15K      | 60K      | 200K      | 350K       |
| 663047      | Legendary | 4K       | 20K      | 80K      | 250K      | 450K       |
| 663048      | Mythic    | 15K      | 80K      | 280K     | 900K      | 1,800K     |

Passive evolve times: Common 0->5 in ~3.3 days, Epic in ~7.9 days, Mythic in
~162 days (4->5 alone: ~11.6 weeks).

### 3.4 Genetics & RNG

**Seed generation** (`make_seed`, pockethatch.cpp:190-203):

```
seed = words[0] ^ words[1] ^ words[2] ^ words[3]   // tx_hash (sha256)
     ^ tapos_block_prefix()
     ^ tapos_block_num()
     ^ now
```

Mixes tx_hash, block entropy, and timestamp.

**Genetics generation** (`make_genetics`, pockethatch.cpp:206-224):

```
x = seed ^ 0xdeadbeefcafebabe
x ^= x >> 12; x ^= x << 25; x ^= x >> 27        // xorshift64* mixer
y = x * 0x2545F4914F6CDD1D
y ^= y >> 33; y *= 0xFF51AFD7ED558CCD; y ^= y >> 33

g[0] = seed                               // word 0
g[1] = y                                  // word 1
g[2] = seed ^ y ^ 0x5F1A3B2C9D4E6F08      // word 2
g[3] = y ^ 0x7A3B1C4D5E6F7089             // word 3
```

Result: `checksum256` stored on-chain. Lower 64 bits = rendering gene; bits
64-255 = breeding entropy. See `docs/GENE-SPEC.md` for full bit layout.
---
## 4. Tables

### 4.1 configv3 (singleton)

Scope: `get_self()`. Stores all tunable parameters. See `config_row` in
`pockethatch.hpp:129-218` for the full struct (50+ fields). Key fields:

| Field             | Type     | Default    | Description                         |
|-------------------|----------|------------|-------------------------------------|
| token_contract    | name     | hatchtokens1 | HATCH token contract              |
| collection        | name     | phgamecreatr | AA collection                     |
| schema_name       | name     | creatures | AA schema name                      |
| fee_account       | name     | hatchtokens1 | WAX fee destination               |
| paused            | bool     | false     | Global pause flag                   |
| hatch_cost        | uint64   | 150       | EGG cost per hatch                  |
| evolve_cost       | uint64   | 300       | Base EGG cost per evolve            |
| breed_cost        | asset    | 5.0000 HATCH | Cost per breed                   |
| feed_cost         | uint64   | 0         | EGG cost per feed (free)            |
| daily_egg_cap     | uint64   | 240       | Net EGG/player/day                  |
| offline_cap_h     | uint32   | 8         | Max offline earning window (h)      |
| cap_scales_rarity | uint8    | 1         | Daily cap x best earn_mult          |
| season_index      | uint16   | varies    | Active season number                |
| burn_base_hatch   | asset    | 10.0000 HATCH | Base for burn payout formula    |
| rarity_w_*        | uint16   | 6 fields  | Rarity distribution weights         |
| fed_dur_*         | uint32   | 6 fields  | Satiety duration per rarity         |
| earn_mult_*       | uint16   | 6 fields  | Harvest multiplier per rarity (bp)  |
| awaken_dur_*      | uint32   | 6 fields  | Awaken timer per rarity (s)         |
| wake_cost_*       | asset    | 6 fields  | WAX wake cost per rarity            |
| burn_egg_*        | uint64   | 6 fields  | EGG refund per rarity on burn       |

### 4.2 spccfgv2 (multi_index)

Scope: `get_self()`. Primary key: `template_id`. Secondary index: `by_egg_type`.

| Field        | Type     | Description                           |
|--------------|----------|---------------------------------------|
| template_id  | uint64   | AtomicAssets template ID              |
| growth_rate  | uint64   | Growth points per second              |
| thresh_[1-5] | uint64   | Growth required for each stage        |
| yield_[0-5]  | uint64   | EGG/hr (x10000) for each stage        |
| max_stage    | uint8    | Terminal stage (1-6)                  |
| egg_weight   | uint16   | Weight for species roll within tier   |
| egg_type     | uint64   | Rarity tier 0-5                       |
| family       | string   | Species family name                   |

### 4.3 players (multi_index)

Scope: `get_self()`. Primary key: `account`.

| Field               | Type     | Description                        |
|---------------------|----------|------------------------------------|
| account             | name     | WAX account                        |
| created_at          | uint32   | Unix timestamp of initplayer       |
| egg_balance         | uint64   | Internal EGG balance               |
| last_harvest        | uint32   | Last harvest timestamp             |
| harvest_day         | uint32   | Day bucket for daily cap reset     |
| egg_harvested_today | uint64   | Eggs harvested in current day      |
| feeds_today         | uint32   | Feed count in current day          |
| feed_day            | uint32   | Day bucket for feed cap reset      |
| total_egg_farmed    | uint64   | Lifetime EGG earned                |
| total_hatch_burned  | uint64   | Lifetime HATCH burnt (x10^4)       |

Daily resets are lazy: `reset_daily_if_new_day()` checks `now/86400` against
day buckets and zeroes counters on a new day.

### 4.4 creatrsv2 (multi_index)

Scope: `get_self()`. Primary key: `asset_id`. Secondary index: `by_owner`.

| Field        | Type        | Description                          |
|--------------|-------------|--------------------------------------|
| asset_id     | uint64      | AtomicAssets NFT asset ID             |
| owner        | name        | Current holder (mirrors NFT owner)   |
| template_id  | uint64      | Species template ID                  |
| stage        | uint8       | 0-5 (0=sleeping, 5=final)            |
| growth_base  | uint64      | Passive growth accumulated           |
| fed_growth   | uint64      | Growth from feed boosts               |
| born_at      | uint32      | Hatch/breed timestamp                 |
| last_sync    | uint32      | Last growth sync timestamp           |
| last_fed     | uint32      | Last feed timestamp (satiety anchor) |
| last_bred    | uint32      | Last breed timestamp (cooldown)       |
| genetics     | checksum256 | 256-bit genetic data                 |

### 4.5 claims (multi_index)

Scope: `get_self()`. Primary key: `account`. Separated from `players` to avoid
migrations. Gate: `claimed_season < cfg.season_index`.

| Field          | Type     | Description                     |
|----------------|----------|---------------------------------|
| account        | name     | WAX account                     |
| last_claimed   | uint32   | Timestamp of last claim         |
| claimed_season | uint16   | Last season the player claimed  |

### 4.6 lastmint (singleton)

Updated by `on_logmint`. Tracks the most recent mint (debugging).

| Field    | Type   |
|----------|--------|
| asset_id | uint64 |
| owner    | name   |

### 4.7 rewardpool (singleton)

Scope: `get_self()`. Tracks all HATCH flowing through the pool.

| Field              | Type     | Description                          |
|--------------------|----------|--------------------------------------|
| balance            | asset    | HATCH available for payouts          |
| bootstrap_total    | asset    | Total bootstrap allocation           |
| bootstrap_released | uint64   | Cumulative bootstrap released (x10^4)|
| last_release       | uint32   | Timestamp of last bootstrap release  |
| lifetime_funded    | asset    | Total HATCH ever added to pool       |
| lifetime_paid      | asset    | Total HATCH ever paid from pool      |
---
## 5. Notification Handlers & Admin Actions

**Notifications** (inbound from other contracts):

| Notification               | Handler              | Purpose                           |
|----------------------------|----------------------|-----------------------------------|
| `atomicassets::logmint`    | `on_logmint`         | Records last minted asset         |
| `atomicassets::transfer`   | `on_assets_transfer` | Syncs creature owner on NFT sale  |
| `eosio.token::transfer`    | `on_wax_transfer`    | WAX wake (memo `wake:<id>`)       |

**Admin** (`get_self()` auth): `setconfig`, `setspecies`, `rmspecies`,
`setpaused`, `clearconfig`, `clearpool`, `clearspecies`, `newseason`, `fundpool`,
`withdraw`. See `pockethatch.hpp:358-368`.

## Cross-References
`HOW-TO-PLAY-CEO.md` | `REFERENCE.md` (TBD) | `ECONOMY-V2.md` | `RARITY-6TIER-SPEC.md` |
`GENE-SPEC.md` | `DEPLOY-RUNBOOK.md` | `FEED-ECONOMY-V2.md` |
Contract: `contract/pockethatch/pockethatch.cpp`, `.hpp`
