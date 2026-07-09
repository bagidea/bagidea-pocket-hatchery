# Task A Plan-B (syncowner on configv2) — ⛔ DEPLOY BLOCKED, awaiting Shino

**Kevin, 2026-07-09.** Ran the pre-setcode guard (re-verify live code_hash + ABI + source-of-truth).
It FAILED on three independent points. I did **not** setcode. Details + safe paths below.

## Live ground truth (verified this session, greymass testnet)
- `phgamecreatr` **live code_hash = `0a21adc35a83e500…b05fbdb7`** (config table `configv2`, 23 actions, **no `syncowner`**).
- 3 ghosts still desynced: `…699` tbl=officewax123, `…700` tbl=waxwingsuper, `…707` tbl=waxwingsuper.
- No deployed action can rewrite `creatures.owner` (checked all 23) → the only on-chain fix IS a new `syncowner` via setcode.

## Blocker 1 — code_hash you gave ≠ live
You said “code_hash ล่าสุด **7107dc9a**”. Live is **0a21adc3** — the SAME as the first task; the contract was
**not** redeployed. `7107dc9a` matches nothing: not live, and not any wasm on disk
(`pockethatch.wasm`=0a21adc3, `pockethatch.v2.wasm`=ccbadced, `compilecheck`=f758ff). **Where does 7107dc9a come
from?** If you already built a configv2+syncowner binary that hashes 7107dc9a, send me that artifact/source — that
changes everything. Until reconciled, I can’t “compare source I’m about to build against the live hash.”

## Blocker 2 — the configv2 source that produced 0a21adc3 is GONE
- Deployed binary = `contract/pockethatch/build/pockethatch.wasm` → sha256 **0a21adc3 = live** ✅ (this IS what runs).
- But the on-disk `.cpp/.hpp` is now **configv3** (Feed-v2 decay). `compile-v2.sh` confirms it compiles to the
  SEPARATE `pockethatch.v2.wasm` (ccbadced) and was written to “never touch the Phase-A 0a21adc3 artifact”.
- ⇒ The source drifted ahead of the deployed binary. **No configv2 source tree exists on disk** (searched sources,
  backups, build dir; contract is not git-tracked). I can’t add syncowner to “the configv2 source” because it’s not here.

## Blocker 3 — a reconstruction can’t be trusted without proof
Hand-reverting configv3→configv2 then adding syncowner would replace your verified-green logic with an
**unverifiable** binary — exactly what “ห้ามแตะ logic ของ configv2 ที่รันอยู่” forbids. Toolchain is fine
(CDT 4.1.1 in WSL, `wsl` present) — the blocker is the missing source, not the compiler.

## Safe paths forward — your call (I did not proceed)
> **Exhaustive source hunt done (2026-07-09):** no file declaring `eosio::table("configv2")` exists anywhere I can
> reach — project tree, `temp/`, `tmp/`, and WSL `/home/bagidea`. The configv2 source was edited **in place** into
> configv3, with no backup and no git. So path (a) can’t be self-served, and path (b) can’t hit the 0a21adc3
> hash-gate (the deployed harvest/feed function bodies aren’t visible in any source — only in the compiled wasm —
> so a hand-reconstruction can’t be proven byte-identical). **Bottom line: I need the configv2 source FROM YOU.**
- **(a) Recover the real configv2 source** (backup / whoever wrote Phase A / the WAX-Wallet repo). Then: add ONLY
  syncowner → `wsl … cdt-cpp` → **verify the non-syncowner build reproduces 0a21adc3** → setcode. Clean + provable.
- **(b) Reconstruct configv2 + PROVE by hash-gate:** I revert the decay diff, compile, and only proceed **if the
  rebuilt wasm == 0a21adc3** (byte-proof it’s the deployed logic), then add syncowner. Verifiable, higher effort.
  I can attempt this on your go.
- **(c) Ship configv3 instead** (current source, compiles clean, Poppy already built for it) — but that lands the
  decay economy + configv2→configv3 migration, which you told me NOT to do. Out unless you change the call.
- **(d) Leave ghosts for now** — no existing action fixes owner, so without (a)/(b)/(c) the 3 stay desynced.

**Recommendation:** (a) if the configv2 source can be found; else give me the go for (b) and I’ll gate strictly on
the 0a21adc3 hash-match before anything touches chain. Patch for the syncowner block is ready either way
(`_recon/PATCH-syncowner.diff`, applies + verified).
