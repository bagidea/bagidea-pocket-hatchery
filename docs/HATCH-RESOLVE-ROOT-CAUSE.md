# Pocket Hatchery — `hatch`/`firsthatch` root cause #2 (live-verified 2026-07-02)

**From:** Poppy · **Zone:** web logic layer + read-only chain diagnosis. Source fix is **Kevin's** — I did not touch `pockethatch.{hpp,cpp}`.
**Replaces/extends:** `FIRSTHATCH-ROOT-CAUSE.md` (that bug — `aa_asset_row` ATTR_MAP vs `uint8[]` read-past-end — is **fixed and deployed**; `resolve_new_asset()` no longer throws "datastream read past end", it now reaches its own `check`). This doc is the **next** blocker it hits.

Every claim below was checked **live** by firing real transactions from this Windows session (via the office waxwing wallet against `phgamecreatr` @ `wax-testnet.eosphere.io`) — the thing the prior doc said couldn't be done from Windows. Reproduce: `cd web && node scripts/verify-play.mjs`.

---

## TL;DR

`mint_creature()` queues `atomicassets::mintasset` via **inline `action(...).send()`**, then **immediately** calls `resolve_new_asset(owner)` to read the just-minted asset back out of the atomicassets table. But an inline action dispatched with `.send()` has **not executed yet** at that point — it runs after the current action returns, in the same transaction. So the read-back cannot see the new mint:

- **Fresh player (0 assets in the collection):** the table is empty → `newest == 0` → `check(newest > 0, "failed to resolve minted asset_id")` throws → the whole trx reverts → the queued `mintasset` never runs → **no creature, no NFT.** This is why a brand-new player cannot hatch. *(Live-proven on `officewax123`, deterministic, twice.)*
- **Player with existing assets:** the loop returns the **highest pre-existing** asset_id (a stale one), so the creature row is written against the **wrong** asset and the genuinely-new NFT is **orphaned** (minted, but no `creatures` row). *(Live-evidence: `waxwingsuper` owns 3 NFTs in `phgamecreatr` — `…654/655/656` — but the `creatures` table has only 2 rows `…654/655`. `…656` is orphaned.)*

Same bug, two symptoms. The mint path is broken for everyone.

---

## Evidence (live, 2026-07-02)

Reproduce with `ACTOR=officewax123 node scripts/verify-play.mjs` (wallet unlocked). Verbatim `liveFire` output:

| action | result | detail |
|---|---|---|
| `initplayer` | ✅ txid `40aff91e…` | player row upsert; grants **200 starter EGG** (see `pockethatch.cpp:44` — Kevin's "bypass firsthatch crash" bootstrap) |
| `harvest` | ✅ txid `a770322a…` | action succeeds (0 EGG with no roster, but the call is healthy) |
| `hatch` | ❌ | `assertion failure with message: failed to resolve minted asset_id` |
| `firsthatch` | ❌ | `assertion failure with message: failed to resolve minted asset_id` |
| `claimreward` | ❌ | `assertion failure with message: not qualified — need at least a Juvenile` *(readable **logic** error — proves the action wiring is correct; it just needs a qualifying creature)* |

Plus the ABI diff the script runs: every gameplay action (`initplayer/hatch/feed/evolve/harvest/claimreward`) matches the **deployed** `phgamecreatr` ABI field-for-field. **The web layer is correct.** All failures are contract-side.

And the orphan-NFT smoking gun (atomicassets real assets vs the game's `creatures` table for `waxwingsuper`):

```
atomicassets assets (phgamecreatr): …654, …655, …656   ← 3 real NFTs
creatures table:                     …654, …655          ← 2 rows  → …656 orphaned
```

---

## Root cause in source

`contract/pockethatch/pockethatch.cpp`:

```cpp
// 201  uint64_t pockethatch::mint_creature(name owner, uint64_t template_id, …) {
// …
// 214      action(
// 215          permission_level{get_self(), "active"_n},
// 216          "atomicassets"_n,
// 217          "mintasset"_n,
// 218          aa_mint{ get_self(), cfg.collection, cfg.schema_name, … owner, immut, mut, {} }
// 219      ).send();                 // ← INLINE: queued, runs AFTER this action returns
// …
// 225      uint64_t asset_id = resolve_new_asset(owner);   // ← reads back BEFORE mintasset ran
```

```cpp
// 186  uint64_t pockethatch::resolve_new_asset(name owner) const {
// 190      aa_assets_t aa("atomicassets"_n, owner.value);
// 191      uint64_t newest = 0;
// 192      for (auto it = aa.begin(); it != aa.end(); ++it)
// 193          if (it->collection_name == cfg.collection && it->asset_id > newest) newest = it->asset_id;
// 197      check(newest > 0, "failed to resolve minted asset_id");   // ← throws for fresh players
```

EOSIO execution model: an inline action sent with `action::send()` is applied **after** the dispatching action completes, within the same transaction. Its state changes are visible to *later* actions in the trx, **not to the action that dispatched it**. So `resolve_new_asset` running on the line after `.send()` cannot observe the mint — for a 0-asset owner the iterator is empty.

The same pattern repeats at the second mint site (`cpp:620` mint + `cpp:629 resolve_new_asset`, the `breed` path) — it will hit the identical bug once breeding is attempted.

---

## Fix direction (Kevin's zone — verify before applying)

Stop depending on reading the just-queued asset back. **Predict the asset_id** instead:

- atomicassets assigns each new asset `asset_id = ++config.asset_counter` (the counter lives in the `atomicassets` `config` singleton). Read `atomicassets/config` → `asset_counter` **immediately before** dispatching `mintasset`; the mint will assign `counter + 1`. Use that predicted id for the `creatures` row directly.
- This removes `resolve_new_asset()` entirely (it's unsafe by construction: an inline write is never readable from the dispatching action).

Alternative if prediction feels fragile: split into two user-facing actions (mint, then register) — worse UX, not recommended.

**After the fix:** the live proof is one command — `node scripts/verify-play.mjs` should show `hatch` returning a txid AND `stateAfter.creaturesOwned` incrementing. (CEO DoD from the prior doc: a `creatures` row with `stage ≥ 1` after evolve + EGG moved by harvest. The harvest half already passes today.)

---

## What already works today (so the web is ready)

- `initplayer`, `harvest` → real txids.
- `configv2` read (`hatch_cost=150`, `evolve_cost=50`, `feed_cost=0`, `paused=0`), `players`, `creatures`, `speciescfg`, `rewardpool` reads — all live.
- The web logic seam (`web/src/play.ts`) signs + broadcasts every action through the user's browser wallet (WCW/Anchor). It is ABI-correct and routes `hatch` → `hatch` (egg_type 0) per Kevin's starter-EGG design (`cpp:44`); it does **not** call the broken `firsthatch`.

Open economy gaps (Kevin's, flagged not fixed): `rewardpool` is **empty/unfunded** → `claimreward` will throw "reward pool empty" once a player *is* qualified (today it fails earlier on "need at least a Juvenile"). And `breed`'s second mint site (`cpp:620`) carries the same resolve bug.

*Poppy — web logic + live diagnosis. Handing the source fix to Kevin.*
