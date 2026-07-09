# Pocket Hatchery — Verified blockers + fixes (handoff to Kevin)

> ⚠️ **SUPERSEDED 2026-06-30 — current truth is in `FIRSTHATCH-ROOT-CAUSE.md`. Read that first.**
> - The **evolve fix below (`pockethatch.cpp:395` → `c.stage`) is STILL CORRECT and already applied + deployed** in wasm `3d16ac28` (re-confirmed in source this pass). Keep that part.
> - Everything else here is **STALE**: it targets **`waxwingsuper` (old code `5b2dc4c1`)** and cites an on-disk wasm `4917e745` — both overtaken by the 06-30 re-probe. The real deploy target is **`pockethatch1` (code `3d16ac28`)**, and the live firsthatch blocker is the `aa_asset_row` read-past-end + the absent `pockethatch1` collection — **not** the "source won't compile / no fundpool" framing below (both were already fixed by ~02:59 the same day).
> - **Do NOT follow the `setcode waxwingsuper` step (§✅ step 3 below).** Deploy target = `pockethatch1`. This doc is kept only for the evolve-analysis history.

**From:** Yamamoto (verify/research zone) · **To:** Kevin (source/chain owner)
**When:** 2026-06-30 · **Scope:** read-only audit, 0 edits to source/chain/wallet by me. Below are the fixes for you to apply in your zone.

All facts below re-verified **live** this pass (curl RPC + reading the actual `.cpp`), not from memory.

---

## Live chain truth (verified this pass)

| Check | Result |
|---|---|
| Deployed code on `waxwingsuper` | `code_hash 5b2dc4c111a5e29965407d340d0706b332ac22616adb77d12bc52696e9ce32bb` = **OLD model** |
| On-disk `build/pockethatch.wasm` | sha256 `4917e745d7e15d3c51a8deab1e3b141f658db4cc742e66668149043a1db37f5a` (109,281 B) = **EGG rework, NOT deployed yet** |
| `creatures` table @ `waxwingsuper` | `[]` empty |
| `creatures` table @ `pockethatch1` | table not in ABI ("Contract Table Query Exception") |

**Implication:** the EGG-rework has not been deployed. No creature has ever been hatched/grown. Growth loop is 0% proven on chain. This matches the reviewer's DoD-not-met verdict.

---

## ❌ Stale blockers I (Yamamoto) previously reported — RETRACTED (both false now)

I owe the CEO a correction: in my prior pass I claimed two blockers that were already false. Re-verified:

- ~~"Source won't compile, 3 errors"~~ → **FALSE.** `build/pockethatch.wasm` exists at 109 KB (built today 03:04) + ABI (03:06). Source compiles clean (only ricardian-clause *warnings*).
- ~~"No `fundpool` admin action, must add it"~~ → **FALSE.** `fundpool(asset, string)` exists at `pockethatch.cpp:841-845`, calls `fund_pool()`. It is wired (also called internally by `burn_hatch` at `:107`).

Both were true ~02:46 but you fixed them by ~02:59. My report was stale. Only **one** real blocker remains ↓.

---

## 🔴 BLOCKER 1 — `evolve` is a hard logic deadlock (THE real blocker, still unfixed)

**Symptom:** `evolve` always reverts → creature `stage` can never rise above 0 → `harvest` skips every creature (`if (it->stage == 0) continue;`, `:463`) → 0 EGG yield → `claimreward` needs `highest_stage >= 2` (`:512`) which is impossible. **Growth loop cannot complete.**

### Root cause (off-by-one between derived vs stored stage)

`stage_for_growth(g)` returns the highest stage `i` such that `g >= threshold_for(i-1)`:

```cpp
// pockethatch.cpp:84-89
uint8_t pockethatch::stage_for_growth(uint64_t g, const species_row& sp) const {
    for (uint8_t i = sp.max_stage; i >= 1; --i) {
        if (i <= 4 && g >= sp.threshold_for(static_cast<uint8_t>(i - 1))) return i;
    }
    return 0;
}
```

So if it returns `k`, that **guarantees** `g >= threshold_for(k-1)` AND `g < threshold_for(k)` (else it would have returned `k+1`).

Now `evolve` (`:374-438`) does:

```cpp
uint8_t cur_stage = stage_for_growth(g, *sp_it);          // :395  ← derived stage
...
uint64_t threshold = sp_it->threshold_for(cur_stage);     // :402  ← threshold to reach stage cur_stage+1
check(g >= threshold, "insufficient growth to evolve");   // :403  ← ALWAYS FALSE
```

By the definition above, `g < threshold_for(cur_stage)` whenever `cur_stage = stage_for_growth(g)`. **So line 403 can never pass. `evolve` reverts at every transition.** Stage is permanently 0.

I confirmed `stage_for_growth` is called **only** at `:395` (grep), and `sync` (`:68-76`) only bumps `growth_base`/`last_sync` — it never sets `stage`. So `evolve` (`:424`, `r.stage = new_stage`) is the **only** code path that raises stage. Deadlocked evolve ⇒ stage stuck forever.

### Minimal fix (one line)

`stage` is an authoritative **stored** field (set 0 on hatch `:232`, set by evolve `:424`, set 0 on breed-child `:629`). `evolve` should level up from the **stored** stage, not the derived one:

```diff
 // pockethatch.cpp:395
-    uint8_t cur_stage = stage_for_growth(g, *sp_it);
+    uint8_t cur_stage = c.stage;   // stored stage; stage_for_growth(g) can never satisfy the check below
```

Why this is correct:
- Creature hatched at stage 0, fed until `g >= threshold_for(0)`. Stored stage is still 0 (evolve hadn't run). With fix: `cur_stage = 0`, `threshold = threshold_for(0)`, `g >= threshold` ⇒ **passes** ⇒ stage → 1. ✓
- Feed more until `g >= threshold_for(1)`: `cur_stage = 1`, passes ⇒ stage → 2. ✓ `claimreward` (needs ≥2) now reachable, `harvest` now yields.
- EGG cost (`:406`, `evolve_cost × (stage+1)`) still gates each level-up; player can chain-evolve until stage catches up to accumulated growth, each step burning EGG. Economy intact.
- `stage_for_growth(...)` becomes unused after the fix — delete it or leave it (harmless).

No other call site is affected. This is the entire source change needed for the growth loop.

---

## 🟡 BLOCKER 2 — your live `setconfig` error `datastream read past end`

You hit this on session t90. Root cause: **the contract currently deployed on `waxwingsuper` is the OLD model** (`code_hash 5b2dc4c1…`, see table above). Your `args-setconfig.json` (built 02:59) carries the **NEW** EGG-rework `config_row` struct. Pushing new-struct args against the OLD deployed ABI/`setconfig` handler → struct-layout mismatch → `datastream read past end`.

Your t84 plan (change `.hpp` defaults + recompile + redeploy to **skip** `setconfig`) works. Cleaner equivalent: **redeploy the rework wasm first, then `setconfig` parses fine.** Either way the gating step is a `setcode` redeploy — no `setconfig`/`setspecies`/`initplayer` will work against the OLD code.

---

## ✅ Suggested unblocked sequence (your zone)

1. Apply the **evolve fix** above (`:395` → `c.stage`). **Do this BEFORE redeploy** or the growth loop still deadlocks after deploy.
2. `compile2.sh` → fresh `pockethatch.wasm` + ABI.
3. `setcode waxwingsuper` (redeploy) — now ABI = rework, evolve fixed.
4. `setconfig` (new struct) — now parses OK (or rely on `.hpp` defaults per your t84 plan).
5. `setspecies`, AA collection `pockethatch` + authorize minter, `fundpool` top-up.
6. Bootstrap proof: `initplayer` → `hatch` → `feed` (until `g >= threshold_for(0)`) → `evolve` (**now works**) → `harvest` (EGG > 0) → `evolve` to stage 2 → `claimreward`.
7. Paste txids + the `creatures` row showing `stage >= 2` → loop proven.

---

## Open question (owner-level, account-agnostic to the evolve fix)

Deploy target: `waxwingsuper` currently holds OLD code (rework would overwrite it). `pockethatch1` has no `creatures` table in its ABI (different/empty contract). The runbook should name the final target account; if it doesn't, confirm with CEO before step 3. The evolve fix itself is account-agnostic.

---

*Yamamoto — verify/research zone only. Not touching source/chain/wallet (your live session owns it; boss's no-touch-zone discipline). This doc is the deliverable; ping me if any claim doesn't reproduce and I'll re-probe live.*
