# CONTRACT — `pockethatch` (smart contract design)

> Implementer-ready design of the game contract. **Not deployed yet** — this is paper. Every action carries the three markers the boss asked for:
> - ⏱ **time-guard** — where `current_time_point()` is asserted (anti-cheat)
> - 💾 **RAM-payer** — who buys the row
> - 🔥 **sink** — where HATCH is burned (anti-ponzi)
>
> Signatures are EOSIO C++ flavored for clarity; they're spec-level, not paste-compile code. Validate exact AtomicAssets/eosio.token action names against chain at deploy time (see §10).

---

## 0. Accounts & contracts (recap)

| Account | What | Notes |
|---|---|---|
| `pockethatch` | **this game contract**; collection author; HATCH issuer | All actions below live here. |
| `hatchtokens1` | `eosio.token` for **HATCH** (precision 4) | issuer = `pockethatch`. |
| `atomicassets` | standard WAX NFT contract | we call: `mintasset`, `setassetdata`, `burnasset`, `transfer`. |
| `hatchfees1` | house fee sink | receives swept fees. |

**Payment model (decided):** costs are paid by **inline transfers** authorized by the player's own `@active` (granted in the same trx), then **retired** by the contract in-action. We register **no** `eosio.token::transfer` on_notify — the HATCH that arrives via inline transfer is burned immediately. This keeps both wallets (WCW + waxwing) building identical actions. *We do register an `atomicassets::transfer` on_notify to track ownership — §6.*

> **Two currencies (per adopted TOKENOMICS — see RECONCILIATION §3):** 🥚 **EGG** is **not** an `eosio.token` — it's an **internal** `uint64` balance on the `players` row (`egg_balance`), mutated directly by the contract (no transfer/retire). Only 🐣 **$HATCH** (fixed **100M** supply) crosses the token-contract boundary, and it is **never minted for gameplay** — it leaves only the escrow `rewardpool` (§1.5). This doc's v1 described HATCH minted on `claim`; that is superseded — see §2.5 + §6 banners.

---

## 1. Tables

### 1.1 `config` — singleton (house pays RAM)

```cpp
// scope: contract itself, singleton
struct [[eosio::table]] config_row {
    name      token_contract   = "hatchtokens1"_n;
    symbol    token_symbol     = symbol("HATCH", 4);
    name      collection       = "pockethatch"_n;
    name      schema_name      = "creatures"_n;
    name      fee_account      = "hatchfees1"_n;
    bool      paused           = false;          // kill-switch
    // costs
    asset     hatch_cost       = asset{10,  "HATCH"};   // 🔥
    asset     evolve_cost      = asset{5,   "HATCH"};   // 🔥 (base; scales by stage)
    asset     breed_cost       = asset{50,  "HATCH"};   // 🔥
    asset     feed_cost        = asset{0,   "HATCH"};   // 🔥 (free in v1; tunable)
    // cooldowns (seconds)
    uint32_t  feed_cd          = 3600;           // ⏱ per creature
    uint32_t  harvest_cd       = 3600;           // ⏱ per player (EGG harvest throttle)
    uint32_t  breed_cd         = 86400;          // ⏱ per parent
    // caps — 🥚 EGG (idle/tap reward; NON-tradeable). Values per TOKENOMICS §3.2.
    //   (Office-install bonus = +30% → 312 / 12h / +90; gated by an install flag, not this default.)
    uint32_t  feed_daily_cap   = 6;              // feeds/creature/day
    uint64_t  daily_egg_cap    = 240;            // net EGG/player/day (web default)
    uint32_t  offline_cap_h    = 8;              // max offline EGG accrual (hours)
    uint64_t  tap_egg_cap      = 60;             // +tap-bonus EGG/player/day
    // feed boost
    uint64_t  feed_boost       = 100;            // growth per feed
    // season — drives rewardpool bootstrap decay + season/milestone HATCH payouts.
    //   (NO HATCH mint schedule here: HATCH is fixed 100M, paid only from rewardpool §1.5.)
    uint16_t  season_index     = 0;
    uint32_t  season_started   = 0;              // ⏱ time_point_sec
    // RNG
    name      rng_oracle       = "orng.wax"_n;   // mainnet; "" on testnet → block entropy
};
```

### 1.2 `speciescfg` — per species (house pays RAM)

Keyed by AtomicAssets `template_id`. Defines the growth curve + yield + rarity weight for each species. House-authored, never player-editable.

```cpp
struct [[eosio::table]] species_row {
    uint64_t   template_id;          // primary key (= atomicassets template_id)
    uint64_t   growth_rate;          // growth-per-second (lazy Δt multiplier)
    uint64_t   thresholds[5];        // G thresholds for stage 1..5 (stage 0 = egg, always at hatch)
    uint64_t   stage_yield[5];       // 🥚 EGG-per-hour gross yield per stage (×10^4) — per TOKENOMICS §3.1
                                     //   (e.g. Hatchling 1.0, Juvenile 3.0, Adult 6.0, Evolved 10.0 EGG/hr)
    uint8_t    max_stage;            // terminal stage (usually 4 = Elder)
    uint16_t   egg_weight;           // rarity weight in the hatch pool (sum = total)
    std::string family;              // e.g. "drake", "slime", "spirit"
};
```

### 1.3 `players` — per player (**player pays RAM**)

```cpp
struct [[eosio::table]] player_row {
    name        account;             // primary key
    uint32_t    created_at;          // ⏱
    // 🥚 EGG (internal, non-tradeable — the free-to-play reward currency)
    uint64_t    egg_balance;         // spendable EGG (feed/hatch/evolve/slot/cosmetic)
    uint32_t    last_harvest;        // ⏱ — last EGG harvest (idle accrual checkpoint)
    uint32_t    harvest_day;         // ⏱ day-index of egg_harvested_today
    uint64_t    egg_harvested_today; // vs daily harvest cap (per TOKENOMICS §3.2)
    // 🐣 HATCH (tradeable, escrow-funded — see rewardpool §1.5)
    uint32_t    feeds_today;         // helper, optional aggregate
    uint32_t    feed_day;            // ⏱ day-index of feeds_today
    uint64_t    total_egg_farmed;    // lifetime stats (display)
    uint64_t    total_hatch_burned;  // lifetime stats (display)
};
```

### 1.4 `creatures` — per creature (**player pays RAM**) — THE core table

```cpp
struct [[eosio::table]] creature_row {
    uint64_t   asset_id;             // primary key (= atomicassets asset_id, 1:1 with NFT)
    name       owner;                // secondary index (so "get my creatures" is cheap)
    uint64_t   template_id;          // species (→ speciescfg)
    uint8_t    stage;                // 0..max_stage (mirrored; recompute before trusting)
    uint64_t   growth_base;          // checkpointed lazy growth (synced on every touch)
    uint64_t   fed_growth;           // discrete feeding boosts (monotonic)
    uint32_t   born_at;              // ⏱ baseline
    uint32_t   last_sync;            // ⏱ last sync() checkpoint
    uint32_t   last_fed;             // ⏱ feed cooldown
    uint32_t   last_bred;            // ⏱ breed cooldown
    checksum256 genetics;            // immutable traits set at hatch (rarity/affinity/look seed)
};
// indexes: by_owner (owner) ; primary = asset_id
```

`currentGrowth(c, now)` is **not stored** — it is computed (ARCHITECTURE §3.1) wherever needed. `stage` is stored only as a cache/mirror of the last `evolve`; **always** `sync()` + recompute before any guard that depends on it.

> No `balances`/deposit table exists. We never custody HATCH *for the player*.

### 1.5 `rewardpool` — escrow for HATCH payouts (house pays RAM)

The single mechanism that makes the economy non-ponzi: **HATCH gameplay rewards can only leave this pool, and the pool is funded by real fee revenue + a fixed decaying bootstrap allocation** (per TOKENOMICS §1, §4.3). `payout ≤ pool_balance` is a hard on-chain check.

```cpp
// scope: contract itself, singleton
struct [[eosio::table]] rewardpool_row {
    asset    balance;            // HATCH currently available for payouts
    asset    bootstrap_total;    // fixed bootstrap allocation (decays, has a sunset)
    uint64_t bootstrap_released; // how much of bootstrap already released
    uint32_t last_release;       // ⏱ — last bootstrap-decay release checkpoint
    asset    lifetime_funded;    // fees + sponsor that flowed in (display)
    asset    lifetime_paid;      // rewards paid out (display)
};
```

Funding flows in from: (a) the **"to-pool" half of HATCH sinks** (breed/premium — §2.6), (b) **on-chain fee routing** (DEX swap share, AtomicMarket royalty share — wired when the marketplace/DEX plugin lands), (c) the **decaying bootstrap release** (a fixed schedule with a sunset date — *not* an open faucet). **There is no `eosio.token::issue` path for gameplay rewards.**

---

## 2. Actions — gameplay (player-auth; callable by WCW **and** waxwing identically)

All gameplay actions begin with `require_auth(owner)` and `check(!cfg.paused, "game paused")`.

### 2.1 `initplayer(name owner)`
Create the `players` row if missing. Idempotent.
- 💾 RAM-payer: **owner**
- ⏱ none
- 🔥 none
- *Can be auto-called by `hatch` on first play; exposed standalone for explicit onboarding.*

### 2.2 `hatch(name owner, uint64 egg_type)` — mint a new creature
- 💾 RAM-payer: **owner** (creatures row + atomicassets asset via inline `mintasset`)
- ⏱ `born_at = last_sync = now`
- 🔥 **burn `hatch_cost` HATCH**
- Flow:
  1. ensure player row (else init).
  2. RNG → pick `template_id` by `egg_weight` within `egg_type` pool; hash genetics. *(testnet: block entropy `tapos_block_num/prefix`; mainnet: `orng.wax` — §8)*
  3. **inline** `hatchtokens1::transfer(owner → contract, hatch_cost, "hatch")` using owner's auth.
  4. **inline** `hatchtokens1::retire(hatch_cost, "hatch burn")`.  🔥
  5. **inline** `atomicassets::mintasset(collection, schema, template_id, owner, immutable{genetics}, mutable{stage:0}, owner)` — **owner is ram_payer**.
  6. write `creatures` row (owner ram_payer): stage 0, growth_base 0, fed_growth 0.
- *Optional rate-limit: `owner` can't hatch more than N/`hatch_cd`. v1: cost-only.*

### 2.3 `feed(name owner, uint64 asset_id)` — boost growth
- 💾 RAM-payer: **owner** (in-place row update — minimal)
- ⏱ **guard:** `now ≥ last_fed + feed_cd`; **daily cap:** `creature feed count today < feed_daily_cap` (reset by ⏱ day-index)
- 🔥 burn `feed_cost` (0 in v1)
- Flow: `sync()`; `fed_growth += feed_boost`; `last_fed = now`; increment feed counter.

### 2.4 `evolve(name owner, uint64 asset_id)` — advance stage + mirror to NFT
- 💾 RAM-payer: **owner** (mutable_data grow inside existing asset; house top-up only on overflow)
- ⏱ **guard:** after `sync()`, `currentGrowth ≥ thresholds[stage+1]` AND `stage < max_stage`
- 🔥 burn `evolve_cost × stage+1` (scaling)
- Flow: `sync()`; assert threshold; `stage++`; **inline** `hatchtokens1::transfer(owner→contract, cost)` + `retire`. 🔥; **inline** `atomicassets::setassetdata(... mutable{stage, growth})` (mirror). Idempotent: a second call with no new threshold does nothing.

### 2.5 Reward accrual — split into TWO actions (per adopted TOKENOMICS)

> ⚠ **RECONCILED** (RECONCILIATION §3). The old single `claim` that minted HATCH via `eosio.token::issue` is gone — that was a faucet and is the ponzi vector we cut at the root. It is now two actions with **two different currencies**:
> - **`harvest(owner)`** → credits 🥚 **EGG** (internal `egg_balance`, NON-tradeable) — the free-to-play idle/tap reward. Daily-capped + offline-accrual-capped. **No token transfer, no `issue`.**
> - **`claimreward(owner)`** (season / milestone) → pays 🐣 **HATCH out of the escrow `rewardpool`**, asserting `payout ≤ pool.balance`. **Never `issue`.**
>
> The yield *math* (roster power × Δt, capped) is unchanged from the v1 design; only the *output currency* flipped from HATCH-mint → EGG-credit, and the HATCH path moved to the pool.

#### 2.5a `harvest(name owner)` — collect idle/tap EGG (capped)
- 💾 RAM-payer: **owner** (player row update)
- ⏱ **guard:** `now ≥ player.last_harvest + cfg.harvest_cd`; **daily cap:** `player.egg_harvested_today < cfg.daily_egg_cap`; **offline cap:** `elapsed_h ≤ cfg.offline_cap_h`; reset `egg_harvested_today`/`harvest_day` when the ⏱ day rolls (`reset_daily_if_new_day`, §5).
- 🔥 none (EGG is an internal balance, not a burnable token)
- Flow:
  ```
  reset_daily_if_new_day(player, now)                       // ⏱ — uses player.harvest_day
  power    = Σ_{creature owned} stage_yield[stage_of(c)]     // 🥚 EGG/hr gross (TOKENOMICS §3.1)
  elapsed_h = min((now − player.last_harvest)/3600, cfg.offline_cap_h)   // offline cap
  gross    = power × elapsed_h
  yield    = min(gross, cfg.daily_egg_cap − player.egg_harvested_today)  // daily cap
  player.egg_balance         += yield                        // 🥚 INTERNAL CREDIT — no token transfer
  player.egg_harvested_today += yield ; player.last_harvest = now
  player.total_egg_farmed    += yield                        // lifetime stat (display)
  ```
- *No `eosio.token` call at all. EGG exists only as `players.egg_balance` (§1.3) and is spent on feed/hatch/evolve/slot/cosmetic sinks (§2.3/2.2/2.4 + TOKENOMICS §3.3). It can never reach a DEX (rule #2).*

#### 2.5b `claimreward(name owner)` — season / milestone HATCH payout from escrow
- 💾 RAM-payer: **house** (rewardpool row update — this is house-side reward settlement, not player data)
- ⏱ **guard:** `now ≥ cfg.season_started`; player qualifies for the season/milestone tier being claimed (season logic, v1 minimal).
- 🔥 none on the payout itself; the HATCH sinks that *refilled* this pool (breed/premium — §2.6, TOKENOMICS §3.4) already did their part-burn/part-to-pool upstream.
- Flow:
  ```
  payout = seasonRewardTier(player, cfg.season_index)        // house-authored, capped per tier
  check(payout ≤ pool.balance, "reward pool empty")          // RULE #1 — structurally can't overpay
  pool.balance       -= payout
  pool.lifetime_paid += payout
  inline hatchtokens1::transfer(rewardpool → owner, payout, "season reward")   // 🐣 FROM ESCROW
  ```
- ***Never `hatchtokens1::issue`.** The HATCH leaving the pool was put there by fee routing + the to-pool half of HATCH sinks + a fixed, decaying, **sunset** bootstrap allocation (rewardpool §1.5, TOKENOMICS §4.3). Payout ≤ what real activity funded. There is no `season_minted` / `season_budget` mint assert anymore — that faucet language is removed.*

### 2.6 `breed(name owner, uint64 parent_a, uint64 parent_b)` — offspring with blended genetics
- 💾 RAM-payer: **owner** (new creature row + new NFT)
- ⏱ **guard:** `now ≥ last_bred + breed_cd` for **both** parents; distinct parents; same-family allowed, cross-family costs more (tunable).
- 🔥 **burn `breed_cost`** (the biggest sink — mirrors Axie-style breeding economies)
- Flow: RNG blend genetics (hash of parent genetics + block entropy); **inline** transfer+retire `breed_cost` 🔥; **inline** `mintasset` offspring (owner ram_payer); write creature row; set both `last_bred = now`.

### 2.7 `accelerate(name owner, uint64 asset_id, asset amount)` — pay HATCH → instant growth (sink + pay-to-progress)
- 💾 RAM-payer: **owner**
- ⏱ none (this deliberately bends time **by paying**, the only sanctioned time-skipping)
- 🔥 **burn `amount` HATCH**
- Flow: `sync()`; `growth_base += amount.value × accel_rate`; **inline** transfer+retire `amount`. 🔥. *(Office-plugin premium lane — funnels desktop install; optional in v1 core.)*

### 2.8 `setname(name owner, uint64 asset_id, string new_name)` — cosmetic
- 💾 RAM-payer: **owner** (mutable_data)
- ⏱ none
- 🔥 small burn (tunable, can be 0)
- Flow: validate length; **inline** `setassetdata(mutable{name})`.

### 2.9 `burncreature(name owner, uint64 asset_id)` — RAM-hygiene exit
- 💾 RAM-payer: **owner** (RAM **refunded** to original payer on atomicassets burn)
- ⏱ none
- 🔥 none
- Flow: assert owner; **inline** `atomicassets::burnasset(owner, asset_id)`; erase `creatures` row. *(So players aren't stuck with dead RAM.)*

---

## 3. Actions — admin / economy (**contract-auth**: `require_auth(get_self())`)

| Action | Purpose | Markers |
|---|---|---|
| `setconfig(...)` | Tune any `config` field (costs/caps/rates/season). | 💾 house |
| `setspecies(...)` | Upsert a `speciescfg` row (new species, balance). | 💾 house |
| `setpaused(bool)` | **Kill-switch.** Stops hatch/feed/evolve/harvest/claimreward/breed. | ⏱ immediate |
| `newseason(...)` | Advance `season_index`; roll the `rewardpool` bootstrap decay forward (escrow — **not** a mint) + open the season/milestone `claimreward` tiers. | ⏱ (pool reset) |
| `withdraw(name token_contract, asset quantity, name to, string memo)` | Sweep any HATCH that accumulated at the contract (e.g. fee shares) to `fee_account`. | — |

> `setconfig`/`setspecies` are the **balance levers** — changing costs/caps/emission is how we steer the live economy without redeploying code. All changes are on-chain and auditable (the boss's transparency bar).

---

## 4. Notifications

### `on_nt_transfer` — `[[eosio::on_notify("atomicassets::transfer")]]`
Fires whenever a creature NFT moves (market sale, gift, our own mint).
```
for each asset_id in asset_ids:
    if creature_row exists (it's one of ours):
        creatures[asset_id].owner = to          // keep table in sync
    else:
        ignore (not our collection / not a creature)
```
- 💾 RAM: if the row must grow, payer stays the original creator-side allocation; we **do not** pay for strangers' rows.
- This is what lets a **buyer** of a creature immediately farm it — ownership in our table tracks the NFT, automatically, with no extra action.

We deliberately **do not** register `eosio.token::transfer` — HATCH arriving via inline payment is burned in-action, not handled by a deposit hook (§0).

---

## 5. `sync()` + helpers (internal, not in ABI)

```
sync(creature c, uint32 now):                       // ⏱ block time
    check(now >= c.last_sync, "time went backwards")  // guard
    uint64 dt = now - c.last_sync
    check(c.growth_base + dt*rate < MAX, "growth overflow")
    c.growth_base += dt * rate(speciescfg[c.template_id])
    c.last_sync   = now

currentGrowth(c, now) = c.growth_base + c.fed_growth   // call only after sync()

reset_daily_if_new_day(player, now):                 // ⏱ day-index from time_point
    if day_index(now) != player.harvest_day:
        player.egg_harvested_today = 0 ; player.harvest_day = day_index(now)
```

---

## 6. Economy math (anti-ponzi, in one place)

> ⚠ **SUPERSEDED by `TOKENOMICS.md`** (adopted — RECONCILIATION §3). The emission-mint formula below (`budget(s) = E0·(1−d)^s`, minted via `eosio.token::issue`) is **replaced** by the dual-currency escrow model: 🥚 EGG is minted internally for harvest (bounded by daily + offline caps); 🐣 HATCH is **fixed 100M**, paid only from `rewardpool`. The *structural principle* below (mint/sink/cap) survives; the *mint mechanics do not*. **Use TOKENOMICS §3–4 for all numbers.**

```
SEASON EMISSION BUDGET
   budget(s) = E0 · (1 − d)^s                 // E0, d, s from config
   assert  season_minted + yield ≤ budget(s)   // inside claim()

NET SUPPLY  ≈  Σ claims(mint) − Σ burns(hatch+evolve+breed+accelerate+cosmetic)

CLAIM YIELD  = min( roster_power · Δt , daily_cap − daily_claimed )
   roster_power = Σ stage_yield[stage]   over creatures the player owns

WHY IT CAN'T PONZI
   • mint is from a public decaying budget, not from deposits
   • every progression burns HATCH (heavy players are net removers)
   • daily cap + cooldowns neutralize bot farming
   • house earns fees + fixed position, never a withdrawal tax
```
All constants above are in `config`/`speciescfg` and tunable without code change. The web UI reads them live to show honest rates.

---

## 7. ABI (sketch — the contract self-describes; both wallets consume this)

```json
{
  "version": "eosio::abi/1.2",
  "structs": [
    { "name": "hatch",      "fields": [ {"name":"owner","type":"name"}, {"name":"egg_type","type":"uint64"} ] },
    { "name": "feed",       "fields": [ {"name":"owner","type":"name"}, {"name":"asset_id","type":"uint64"} ] },
    { "name": "evolve",     "fields": [ {"name":"owner","type":"name"}, {"name":"asset_id","type":"uint64"} ] },
    { "name": "harvest",    "fields": [ {"name":"owner","type":"name"} ] },
    { "name": "claimreward","fields": [ {"name":"owner","type":"name"} ] },
    { "name": "breed",      "fields": [ {"name":"owner","type":"name"}, {"name":"parent_a","type":"uint64"}, {"name":"parent_b","type":"uint64"} ] },
    { "name": "accelerate", "fields": [ {"name":"owner","type":"name"}, {"name":"asset_id","type":"uint64"}, {"name":"amount","type":"asset"} ] },
    { "name": "setname",    "fields": [ {"name":"owner","type":"name"}, {"name":"asset_id","type":"uint64"}, {"name":"new_name","type":"string"} ] },
    { "name": "initplayer", "fields": [ {"name":"owner","type":"name"} ] },
    { "name": "burncreature","fields": [ {"name":"owner","type":"name"}, {"name":"asset_id","type":"uint64"} ] },
    { "name": "setconfig",  "fields": [ /* config_row */ ] },
    { "name": "setspecies", "fields": [ /* species_row */ ] },
    { "name": "setpaused",  "fields": [ {"name":"paused","type":"bool"} ] },
    { "name": "newseason",  "fields": [ /* ... */ ] },
    { "name": "withdraw",   "fields": [ {"name":"token_contract","type":"name"},{"name":"quantity","type":"asset"},{"name":"to","type":"name"},{"name":"memo","type":"string"} ] }
  ],
  "actions": [
    { "name":"hatch","type":"hatch","ricardian_contract":"..." },
    { "name":"feed","type":"feed" }, { "name":"evolve","type":"evolve" },
    { "name":"harvest","type":"harvest" }, { "name":"claimreward","type":"claimreward" }, { "name":"breed","type":"breed" },
    { "name":"accelerate","type":"accelerate" }, { "name":"setname","type":"setname" },
    { "name":"initplayer","type":"initplayer" }, { "name":"burncreature","type":"burncreature" },
    { "name":"setconfig","type":"setconfig" }, { "name":"setspecies","type":"setspecies" },
    { "name":"setpaused","type":"setpaused" }, { "name":"newseason","type":"newseason" },
    { "name":"withdraw","type":"withdraw" }
  ],
  "tables": [
    { "name":"config","type":"config_row","scope":"name" },
    { "name":"speciescfg","type":"species_row","index_type":"i64","key_names":["template_id"],"key_types":["uint64"] },
    { "name":"players","type":"player_row","index_type":"i64","key_names":["account"],"key_types":["name"] },
    { "name":"creatures","type":"creature_row","index_type":"i64",
      "key_names":["asset_id"],"key_types":["uint64"],
      "secondary_indexes":[ {"name":"by_owner","type":"i64","field":"owner"} ] },
    { "name":"rewardpool","type":"rewardpool_row","scope":"name" }
  ]
}
```

**Wallet parity proof:** WCW and waxwing each build, for example,
`push_action("pockethatch","hatch",{owner, egg_type}, [owner@active])`. Identical bytes, identical on-chain effect. The contract never branches on signer. ✅

---

## 8. Security considerations

| Risk | Mitigation |
|---|---|
| **Client lies about time/growth** | All growth derived from `current_time_point()`; never an arg. ⏱ everywhere. |
| **RNG manipulation** | testnet: `tapos_block_num`+`tapos_block_prefix`+`owner`+`now` hash (documented weak). **mainnet: `orng.wax` oracle** (single swap point in `hatch`/`breed`). |
| **Integer overflow** | `check` on every `growth_base` add; `Δt ≥ 0` asserted. |
| **RAM DoS on house** | All player rows use player as `ram_payer`; contract pays only code + global tables. |
| **Re-entrancy / partial state** | Order: `require_auth` → guards → **transfer** → **retire** → mutate → mirror. A failure between transfer and retire is fine (HATCH sits at contract, swept by `withdraw`); no mint-without-burn path. |
| **Economic attack (mass farm)** | Daily EGG cap + harvest cooldown + offline-accrual cap (EGG is non-tradeable anyway); `claimreward` payout ≤ `rewardpool.balance` (escrow, can't overpay); `setpaused` kill-switch. |
| **Lost ownership sync** | `on_nt_transfer` keeps `creatures.owner` = NFT owner; `burncreature` cleans rows. |
| **Admin key compromise** | Admin actions are `require_auth(get_self())` → gated by the contract account's permission, which boss controls with a multisig/standard key policy. Document; consider 2-of-2 multisig on mainnet. |

> `require_auth(get_self())` for admin actions means they're invoked as inline calls the contract sends to itself *after* an authorizing trigger — in practice the house calls them via the contract account's active key. Pin down the exact authorization trigger (direct vs. a `propose`/`exec` admin path) at implementation; the *intent* is house-only.

---

## 9. What's explicitly out of v1 scope
Battle/PvP · crafting · `GEM` premium token · seasons UI/leaderboards · our own marketplace plugin. All seam cleanly onto this design later (ARCHITECTURE §10).

---

## 10. Testnet deploy checklist (DO NOT execute YET — design sign-off first)

Boss's bar: real transactions on wax-testnet, not mocks. When green-lit:

1. **Create accounts** on wax-testnet from `waxwingsuper`: `pockethatch`, `hatchtokens1`, `hatchfees1`. (waxwing `newaccount`, `buyram`, `stake`.)
2. **Deploy `eosio.token`** to `hatchtokens1`; `create` HATCH (issuer `pockethatch`, max supply). `issue` genesis allocation.
3. **Deploy `pockethatch`** contract + ABI.
4. **AtomicAssets collection**: `createcol(collection=pockethatch, ...)`, `createschema(creatures)`, create templates per species (with `burnable`, `transferable`, `mutable`).
5. **Init config** (`setconfig`) + species (`setspecies`).
6. **Prove the loop with real tx** (the deliverable): `initplayer` → `hatch` (see NFT mint + HATCH burn) → wait/feed → `evolve` (see stage change on the NFT) → `harvest` (see 🥚 EGG credited to `egg_balance`, under daily cap — **NOT** a token transfer) → `claimreward` (see 🐣 HATCH paid **from `rewardpool`**, `payout ≤ pool.balance`) → `breed`. Verify each via waxwing `history`/`account` + atomicassets asset read + table reads (`players`, `creatures`, `rewardpool`).
7. **Verify the lazy-growth claim**: read a creature row, compute `currentGrowth` from the returned `last_sync` + live block time, confirm it matches the on-chain evolve gate. *(This is the "truth, not theatre" proof — the growth is real and recomputable.)*
8. **Parity smoke test**: push the same `hatch` via **multiple signers on testnet** and assert identical table effects. **WCW (MyCloudWallet) works on testnet** (per Sahara's WALLET-INTEGRATION.md §0 — testnet chainId is in the connector's `supportedChains`), so the run covers it too: push via **WCW** (the one manual passkey-login round to witness, WALLET-INTEGRATION §6 ก), via **Anchor** (faucet private key — the reliable repeatable signer), and via **waxwing**. The three must produce byte-identical actions and identical on-chain effect — that is the boss's "เล่นด้วย WCW / same ABI" bar proven on testnet, not deferred to mainnet. (Mainnet then re-confirms with small real funds, same code, env switch only.)
