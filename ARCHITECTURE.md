# ARCHITECTURE — Pocket Hatchery

> *How the pieces fit.* This sits between the **why** (VISION.md) and the **what** (CONTRACT.md). It explains the model a builder needs to internalize before reading a single action signature.

---

## 1. Accounts & dependencies

Five accounts matter. On testnet, boss's `waxwingsuper` creates + funds them.

| Account | Hosts | Role | Who controls it |
|---|---|---|---|
| **`pockethatch`** | **the game contract** (this design) | All game logic, the AtomicAssets collection author, the HATCH token issuer. | Game contract (its own code) |
| **`hatchtokens1`** | standard `eosio.token` instance | The **HATCH** token (transfer/issue/retire). Issuer = `pockethatch`. | Standard eosio.token code |
| **`atomicassets`** | standard AtomicAssets NFT contract | Mints/stores/mirrors the creature NFTs. We **call** it, we don't own it. | WAX standard (read-only for us) |
| **`atomicmarket`** | standard AtomicMarket | NFT trading. We **read** trades; fees route to house. | WAX standard |
| **`<house>`** *(e.g. `hatchfees1`)* | — | Receives marketplace + premium fees. | Boss / ops |

```
                         ┌──────────────────────────────────────────────┐
   PLAYER (signs only)   │             wax blockchain                    │
   ─────────────────     │                                               │
   WAX Cloud Wallet ─┐   │   ┌─────────────┐    inline issue/retire      │
   (web, primary)    ├───┼──►│ pockethatch │◄────────────────────┐       │
   waxwing           ┤   │   │ (game logic)│                     │       │
   (Office, 2ndary)  ┘   │   └─────┬───────┘   inline mint/setdata│       │
        same ABI,        │         │                          ┌──┴─────┐ │
        same actions     │         ▼                          │        │ │
                         │   ┌──────────┐  ┌────────────┐  ┌──┴────┐   │ │
                         │   │atomicassets│ │hatchtokens1│  │ tables│  │ │
                         │   │  (NFTs)   │  │  (HATCH)   │  │(state)│  │ │
                         │   └────┬─────┘  └─────┬──────┘  └───────┘  │ │
                         │        │              │                    │ │
                         │        ▼              ▼                    │ │
                         │   NFT trade      Alcor DEX            ┌────┴────┐
                         │   (atomicmarket) (HATCH↔WAX)           │house acct│
                         └────────────────────────────────────────┴─────────┘
```

**Two currencies (per TOKENOMICS, adopted — see RECONCILIATION §3):** 🥚 **EGG** is an *internal* contract balance (not an `eosio.token` — never traded, no DEX pair; its inflation is gameplay-only, never financial). 🐣 **$HATCH** is the tradeable `eosio.token` at `hatchtokens1`, **fixed 100M supply forever**, and is **never minted as a gameplay reward** — it only leaves the escrow reward pool.

**The contract never holds custody long-term.** Tokens flow in for an instant during a paid action (inline transfer from player → contract → immediately `retire`/burn or forward). Creatures are always in the player's wallet as standard NFTs.

---

## 2. Why "mutable NFT" + "lazy growth" together

Two EOSIO facts make the whole design possible:

1. **AtomicAssets NFTs have per-asset `mutable_data`.** The collection's authorized minter (our contract) can update it via `atomicassets::setassetdata`. So a creature's **look/stage** can change on-chain without re-minting a new NFT.
2. **EOSIO contracts can read `current_time_point()`** — the block's timestamp, agreed by all block producers, unforgeable by any single client.

Combining them: the creature's **state of growth** is *computed* from the clock (lazy), and its **visible form** is *mirrored* into the NFT at discrete evolve taps. The contract's own tables stay authoritative; the NFT `mutable_data` is a derived display cache.

> ⚠ **Display vs. truth:** `mutable_data` is a mirror for marketplaces/explorers. **All balance-affecting logic reads the contract tables + the clock**, never the mirror. A bad/stale mirror can never break the economy. (Only `pockethatch` can write the mirror anyway.)

---

## 3. The lazy growth model (the heart of the game)

A creature has a **growth value** `G` that monotonically increases. Its **stage** is a pure function of `G`.

### 3.1 The formula

```
G(creature, now) =  creature.growth_base        ← checkpointed time-growth (synced on every touch)
                  + creature.fed_growth         ← discrete boosts from feeding
                  + Δt × rate(species)          ← live lazy growth since last sync

   where  Δt = now − creature.last_sync   (seconds, asserted ≥ 0 — block time is monotonic)
          rate(species) = growth-per-second from the species config (see CONTRACT.md)
```

**Stage =** `stageForGrowth(species, G)` — a deterministic threshold map, e.g.
```
species "drake":   G <  100   → Stage 0 EGG
                   G <  1_000 → Stage 1 HATCHLING
                   G <  10_000→ Stage 2 JUVENILE
                   G <  40_000→ Stage 3 ADULT
                   G ≥ 40_000 → Stage 4 ELDER (terminal)
```

### 3.2 `sync()` — the checkpoint (run at the top of every interaction)

```
sync(creature, now):
    creature.growth_base += (now − creature.last_sync) × rate(species)   // fold lazy growth in
    check(no overflow)
    creature.last_sync   = now
```

After `sync`, the live `Δt` term is zero until time passes again. `growth_base` only ever grows by folded real time. This is identical in spirit to how DeFi contracts compute "pending rewards" — battle-tested, no per-second transaction needed.

### 3.3 Why this is cheat-proof
- **Can't fake time:** `Δt` comes from `current_time_point()`. A client can't claim "10 hours passed."
- **Can't double-count feeding:** `fed_growth` is a monotonic counter incremented only inside the `feed` action under its cooldown guard.
- **Can't skip evolution:** `evolve` recomputes `G` fresh and asserts `G ≥ threshold(stage+1)`. Idempotent — calling it twice does nothing the second time.
- **Passive growth costs nothing:** no transaction is required for a creature to grow. The chain's clock does the work for free. The player only transacts to *act* (feed/evolve/harvest/breed).

### 3.4 What the NFT mirror shows
On `evolve`, the contract calls `atomicassets::setassetdata(collection, schema, asset_id, { "stage": <n>, "growth": <G>, "name": ... })` so marketplaces and explorers render the up-to-date creature. Between evolves, `G` is still computable by anyone via `get_table_rows` + current block time — the web UI does exactly this to show a live progress bar **without a transaction**.

---

## 4. Wallet parity — "same ABI, either wallet"

The boss's hard requirement: **both the web (WAX Cloud Wallet) and waxwing call the contract identically.** This is enforced by design, not by hope.

> ✅ **Verified by Sahara (WALLET-INTEGRATION.md §0):** WCW — now the passkey **"MyCloudWallet"** — **DOES support wax-testnet.** Sahara proved it from the connector source (`@wharfkit/wallet-plugin-cloudwallet` 1.6.5): the testnet chainId `f16b1833…8a12` ships in the default `supportedChains` (`// … new wallet`), and `login()` binds whatever chain you hand the SessionKit. So the boss's "เล่นด้วย WCW" (เส้น ก) bar is **satisfiable on testnet**, not mainnet-only.
> - **wax-testnet (dev now):** **WCW (MyCloudWallet)** + **Anchor** + **waxwing** — all three work.
> - **wax-mainnet (prod):** **WCW (MyCloudWallet)** primary + Anchor + waxwing.
>
> The web client uses **WharfKit SessionKit** (one codebase) and ships **WCW + Anchor together on both chains** — it does **not** strip WCW from testnet; the player picks at login. The **ABI is identical** across every wallet on **both** chains. (An earlier draft of this section wrongly said "WCW is mainnet-only / does not work on testnet" — that inverted Sahara's proof and is corrected here. See RECONCILIATION §4.) **Anchor + faucet key is the dev signer we lean on** for the automated testnet proving run (signs with an imported key, no popup) — not because WCW can't, but because it's the most reliable for repeatable proving; waxwing is the convenient in-Office signer. WCW parity is confirmed in that same testnet run (one manual passkey login to witness), not deferred to mainnet.

- Both wallets are just **EOSIO transaction signers.** To push an action they each produce the same `{ account, name, data, authorization }` blob defined by the ABI.
- Therefore the contract must be **purely on-chain and self-describing** in the hot path:
  - ✅ All costs paid by **inline transfers authorized by the player's own `@active`** (which they already granted by signing). No "deposit first" side-pool that would need wallet-specific wiring.
  - ✅ All args are **plain ABI fields** (`name`, `uint64`, `asset`, `time_point_sec`). No off-chain signature or oracle dependency in the gameplay path.
  - ✅ RNG uses **on-chain block entropy** for testnet, with a clean swap to the **`orng.wax`** oracle for mainnet (one action shape, both wallets can sign). See CONTRACT.md §8.
- **Consequence for the client:** `webClient.hatch(eggType)` and `waxwing.hatch(eggType)` build the *exact same* `push_action("pockethatch", "hatch", {owner, egg_type}, [owner@active])`. Zero contract-side branching. This is what "both wallets call the same ABI" actually means.

> waxwing's role: it's the **Office-native** signer. Same transaction, but it lives inside our app, can batch/automate (auto-harvest, auto-feed), and signs without a browser redirect. That's the funnel's "power user" lane.

---

## 5. RAM — who pays for what

WAX charges RAM to the account that creates a table row (the `ram_payer` arg to `db_store`). The contract chooses the payer deliberately.

| Resource | RAM paid by | When |
|---|---|---|
| Contract code + ABI | **House** | deploy |
| `config`, `speciescfg` (global) | **House** | deploy / admin |
| `players` row (per player) | **Player** | `initplayer` / first `hatch` |
| `creatures` row (per creature) | **Player** | `hatch` / `breed` |
| AtomicAssets NFT asset row | **Player** | `hatch` / `breed` (inline `mintasset` with player as `ram_payer`) |
| `mutable_data` growth on `evolve`/`setname` | **Player** (within existing asset allocation; house top-up only if it overflows) | `evolve`/`setname` |

**Principle: players pay for their own stuff; the house pays only for shared/global state.** This caps our RAM liability at a constant (code + global tables) no matter how big the game gets — the same pattern proven across healthy WAX games. Players with no RAM get a clear, honest error ("buy RAM") — never a silent house subsidy.

---

## 6. The no-ponzi economy (model)

> ⚠ **SUPERSEDED — the canonical economy is now Sun's `TOKENOMICS.md` (dual-currency escrow), adopted per RECONCILIATION §3.** The single-token decaying-emission model below was Yamamoto's v1; it is *strictly weaker* against the ponzi failure mode (a decaying mint is still a mint from nothing — the Axie/StepN death-spiral vector). Retained here as design history only. **The real economy lives in TOKENOMICS.md.**
>
> What changes: 🥚 **EGG** (internal, non-tradeable) becomes the free-to-play reward; 🐣 **$HATCH** (fixed 100M) is paid **only** from the fee-funded escrow pool, **never minted for gameplay**. What survives: the mint/sink/cap philosophy and on-chain publishability of all constants.

Three knobs, tuned together, keep the economy from becoming a ponzi:

```
   MINT (claim)                         SINK (burn)                       CAP (anti-farm)
   ───────────                          ───────────                       ──────────────
   HATCH issued to players              HATCH retired on every            per-player daily
   by a DECAYING emission schedule:     progression action:              ceiling on claimable
                                       hatch · feed · evolve ·          HATCH (+ per-action
   emission(t) = E0 · (1−d)^t            breed · accelerate · cosmetic    cooldowns + feed
   (E0 = season start rate,             → supply shrinks as players       daily cap)
    d  = decay per season,               play hard)                         → no one farm-spams
    t  = seasons elapsed)                                                    → bots don't drain
```

### Why it can't become a ponzi
- **Rewards are minted from a schedule, not from deposits.** A claimant's HATCH is newly issued under a public, decaying budget — it is *not* taken from a newer player's wallet. New players bring NFTs + trade volume (→ fees) and growth; they are not the funding source for old players.
- **Every mint has a sink counterpart.** The more a player advances (evolve/breed), the more HATCH they burn. Aggressive players are net **removers** of supply, not net adders. The system leans deflationary under heavy play.
- **Daily cap + cooldowns** make passive bot-farming pointless: sitting 24/7 doesn't beat a human playing once a day. Yield favors *breadth* (diverse creatures, breeding skill) over *spam*.
- **House revenue is fees + a fixed token position, never a tax on withdrawals.** There is no "can't cash out" trap — HATCH is liquid on Alcor from genesis-sale seeding.

### Token: `HATCH`
- Standard `eosio.token` at `hatchtokens1`, issuer `pockethatch`. Precision **4** (tunable in config).
- Max supply is **not** the danger; the **emission rate + sinks** are. We publish both on-chain (`config` table) so they're auditable.

> *Future (v2): a premium `GEM` token for cosmetics/acceleration — a second sink rail. Out of scope for v1; the design leaves a clean seam.*

---

## 7. Data flow — one full lifecycle

A new player hatches, grows, evolves, breeds, and trades. Each step shows who signs, what moves, and which guard fires. (Action signatures + exact guards live in CONTRACT.md.)

```
1. CONNECT WCW (web) — no tx
2. hatch(egg_type)          player signs
      └─ inline transfer HATCH(player→contract) → retire (SINK)
      └─ inline atomicassets::mintasset  (player pays RAM)
      └─ write creatures row              (player pays RAM)
      └─ write/ensure players row         (player pays RAM)
      └─ set born_at = now, growth_base = 0, last_sync = now
3. (real time passes; creature grows lazily — no tx)
4. feed(asset_id)           player signs   GUARD: now ≥ last_fed + FEED_CD ; daily feed cap
      └─ optional tiny HATCH burn (SINK)
      └─ fed_growth += FEED_BOOST ; last_fed = now
5. evolve(asset_id)         player signs   GUARD: G ≥ threshold(stage+1)
      └─ sync() then recompute G
      └─ inline transfer HATCH(player→contract) → retire (SINK)
      └─ stage++ ; inline atomicassets::setassetdata (mirror)
6. harvest()                player signs   GUARD: now ≥ last_harvest + HARVEST_CD ; daily EGG cap not hit ; offline cap
      └─ yield = roster power × Δt, capped to (daily_egg_cap − egg_harvested_today)
      └─ egg_balance += yield   (🥚 EGG, internal credit — NO token transfer)
      └─ update egg_harvested_today (+ reset on new day)
   claimreward(season)      player signs   GUARD: payout ≤ rewardpool.balance
      └─ inline hatchtokens1::transfer(rewardpool → player, payout)   (🐣 HATCH FROM ESCROW — never issue)
7. breed(parent_a, parent_b) player signs  GUARD: both off breed-CD ; genetics blend
      └─ inline transfer HATCH(player→contract) → retire (SINK, biggest one)
      └─ inline mintasset offspring (blended genetics) (player pays RAM)
      └─ set both parents last_bred = now
8. (player lists creature on atomicmarket — outside our contract; standard trade)
9. atomicassets::transfer notification → on_nt_transfer updates creatures.owner
      (so the buyer can farm the creature they just bought)
```

---

## 8. Security posture (principles — details in CONTRACT.md §8)

- **Kill-switch:** a `paused` flag in `config` hard-stops hatch/feed/evolve/harvest/claimreward/breed. First line of defense on a bug or economic attack.
- **Authorization discipline:** every action asserts `require_auth(player)`; admin actions assert `require_auth(contract)`. Inline transfers reuse the player's already-granted auth — never forge a signature.
- **Overflow/underflow guards:** `growth_base`/`fed_growth` are `check`'d against overflow; every `Δt` is asserted `≥ 0`.
- **RNG honesty:** testnet uses on-chain block entropy (explicitly weak, fine for testnet); mainnet swaps to `orng.wax` — documented as the one swap point.
- **RAM DoS:** all player-paid writes use the player as `ram_payer`; the contract never accepts an unbounded row it pays for.
- **No re-entrancy surface:** inline actions are to trusted standard contracts (`atomicassets`, `hatchtokens1`); order is transfer→retire→mutate so a partial failure can't mint without burning.

---

## 9. SYNC points (open seams for the team)

| Who | Owns | Status |
|---|---|---|
| **Monanisa / Flamingo** | Web app + Office panel **visual/UX** — the creature look, the evolve moment, the pocket metaphor. The loop must *feel* good. | ⏳ Not started — not a blocker for contract build. |
| **Kevin / contract eng** | Implement CONTRACT.md → deploy `pockethatch` + `hatchtokens1` to wax-testnet. | ⏳ Blocked on this design being signed off. |
| **Poppy / waxwing** | Confirm waxwing pushes identical actions (parity smoke test) once ABI exists. | ⏳ After ABI. |
| **House / ops** | Create `pockethatch`, `hatchtokens1`, `hatchfees1` accounts on testnet; fund from `waxwingsuper`; seed HATCH liquidity. | ⏳ |

---

## 10. What's deliberately deferred (v1 scope)

- Battle / PvP using creatures (v2 game plugin, reads same NFTs).
- Crafting / item system (v2).
- Premium `GEM` token rail (v2 sink).
- Seasons, leaderboards, meta-progression (arrives with the Office plugin layer).
- Our own marketplace plugin (v1 uses atomicmarket; we read fees).

v1 = **the core loop, done right, proven on testnet.** Everything above plugs in later without redesign.
