# Pocket Hatchery — "insufficient EGG to hatch" Diagnosis (READ-ONLY)

> Poppy · 2026-07-11 · investigation for Shino. NO deploy, NO code change yet —
> waiting on Kevin to confirm contract + whether the rarity cost multiplier is intended.
> Live-verified against **phgamecreatr** (WAX testnet) RPC eosphere.io.

---

## The report

CEO: UI shows EGG "300+", but on-chain `egg_balance` (officewax123) = 152. Pressing
Hatch for the 2nd creature throws **"insufficient EGG to hatch"**.

## Root cause: hatch cost is rarity-scaled (server-rolled), but the button only shows the base cost

`contract/pockethatch/pockethatch.cpp:322-335`:

```cpp
uint64_t rolled_egg_type = roll_egg_type();          // server rolls rarity — caller's egg_type IGNORED
...
uint64_t cost_mult[] = {1, 3, 10};                   // common×1, uncommon×3, rare×10
uint64_t hatch_egg_cost = cfg.hatch_cost * cost_mult[rolled_egg_type];
check(p_it->egg_balance >= hatch_egg_cost, "insufficient EGG to hatch");   // ← the assert CEO saw
```

Live config (`configv3`): `hatch_cost=150`, rarity weights `700/250/50`.

| rarity | odds | real cost | at egg=152 |
|--------|------|-----------|------------|
| common | 70% | **150** | ✅ pass |
| uncommon | 25% | **450** | ❌ assert |
| rare | 5% | **1,500** | ❌ assert |

The UI button reads `({game.hatchCost} EGG)` = `configv3.hatch_cost` = flat **150**
(`web/src/App.tsx:497`, fed by `play.ts` `setHatchCost(state.config.hatch_cost)`).
So it promises "150 EGG" but the tx can charge up to 1,500. At 152 EGG the hatch
asserts ~30% of the time (whenever the server rolls uncommon/rare). This string is
the ONLY source of "insufficient EGG to hatch" in the whole contract → confirmed cause.

## (1) Where the EGG number comes from — it's REAL, not projected

- `App.tsx:456` renders `r.egg` = `player.egg_balance` (`play.ts:298`, `toResources`),
  read raw from the `players` table, polled every 20s (`play.ts:397`).
- **No client-side accrual.** No `accru`/`projected` anywhere. `last_harvest` is used
  only for the harvest-cooldown countdown, never added to the EGG chip.
- **Verified in the deployed bundle** (`web/dist/assets/*.js`): mapper `yD` returns
  `egg: egg_balance` verbatim — dist matches source, no stale projection code. No rebuild needed.
- **"300 vs 152" is a timing artifact, not a bug.** Live `egg_balance` now = **152**
  (matches Shino). Kevin saw **302** earlier today; 302 − 152 = 150 = one common hatch.
  A new creature (`asset 1099603751834`, template 662889) was born between the two reads.
  The UI showed 302 correctly, then the balance genuinely dropped on-chain.

## (2) Slot is NOT the blocker — confirm to Kevin

- `hatch()` (cpp:313-348) has **no slot check and no creature-count limit** at all —
  you can hatch unlimited creatures.
- `unlockslot` (cpp:915, cost 500/1200/2500) is a **separate action, never called by
  hatch**, and **not wired into the web app anywhere** (`slot_cost?` is only an unused
  type field in `chain.ts:37`; there is no `unlockslot` call in the frontend).
- Its error string is "insufficient EGG to **unlock slot**" — a different message.
- Conclusion: `slot_cost=500` is dead config the contract does not enforce on hatch.
  If a slot gate is desired, it must be ADDED to the contract first (needs a deploy).

## (3) Proposed fix (web-only, pending green light)

1. Show the cost as a range on the button: `(150–1,500 EGG · rolled by rarity)`
   instead of `(150 EGG)`, so the flat number stops misleading players.
2. Client-side pre-check before signing in `hatch()` (mirror the existing `evolve`/`breed`
   guards): if `egg < 150` block with a clear message; if `150 ≤ egg < 1500` allow the
   click but WARN "an uncommon (450) / rare (1500) roll may exceed your balance and the
   tx will revert — harvest more first to be safe." Prevents click-until-assert.
3. (Cleaner, needs Kevin + deploy) Make hatch cost deterministic — charge the flat base
   150 for every rarity. Then the web can honestly show 150.

## Open questions for Kevin before implementing

- (a) Contract = `phgamecreatr` — confirmed, matches Kevin's POCHATCH1-DIAGNOSIS.md ✅
- (b) Is the ×1/×3/×10 rarity cost multiplier intended, or should hatch cost be flat?
  This decides whether the fix is web-only (options 1+2) or also touches the contract (option 3).

## Related note (not this bug)

The new creature `1099603751834` is template **662889**, which is now present again in
`spccfgv2` (egg_type 0, Fire) — Kevin re-added it, so feed/evolve on it are no longer
blocked. Templates on phgamecreatr now: 662889/662976 (common), 662977 (uncommon), 662978 (rare).
