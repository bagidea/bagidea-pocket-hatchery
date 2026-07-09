# Task A — Ghost-NFT owner reconcile (phgamecreatr) — FINAL

**Verified live 2026-07-09 (Kevin).** RPC `waxtestnet.greymass.com` + AtomicAssets `test.wax.api.atomicassets.io`.
Two independent methods agree (AA bulk `?ids=` + per-asset `/assets/{id}`). Script: `_recon/reconcile.mjs`.

## 1) Ghost count = **3**, not 5

24 creature rows total, 0 missing on AA, **3 desynced** (`creatures.owner` ≠ real AA owner):

| asset_id       | creatures.owner | AA owner (real) | stage | burned | correct action |
|----------------|-----------------|-----------------|-------|--------|----------------|
| 1099603751699  | officewax123    | waxwingsuper    | 0     | no     | set owner→**waxwingsuper** |
| 1099603751700  | waxwingsuper    | officewax123    | 0     | no     | set owner→**officewax123** |
| 1099603751707  | waxwingsuper    | officewax123    | 0     | no     | set owner→**officewax123** |

The brief's two examples (…700, …707 → officewax123) are correct. There is a **3rd** ghost (…699) drifting
the *other* direction (table says officewax, chain says waxwing). "5 ghosts" is not supported by live data — it's 3.

## 2) Root cause (why an on_notify handler ALONE cannot fix P2P)

AtomicAssets `transfer` only does `require_recipient(from)` + `require_recipient(to)` → the notification reaches
**only the two accounts in the transfer**, never a third-party contract. In the current hold-in-wallet model,
creatures live in USER wallets, so a `waxwingsuper → officewax123` P2P transfer never notifies `phgamecreatr`
→ `creatures.owner` drifts. All 3 ghosts are exactly user↔user transfers → matches this limitation.

## 3) Deployed vs source — READ THIS BEFORE ANY setcode

- **Deployed** (code_hash `0a21adc3`) = **configv2** schema. ABI has **no `syncowner`** action, no `fed_dur/earn_mult`
  fields. Actions: hatch/feed/evolve/harvest/breed/claimreward/withdraw/… (verified from `get_abi`).
- **On-disk source** (`contract/pockethatch/`) = **configv3** — newer, adds the whole Feed-v2 decay economy
  **and already contains** an `on_notify("atomicassets::transfer")` handler (`on_assets_transfer`, cpp:1110)
  that sets `r.owner = to`. **It is NOT deployed.**
- ⚠️ That handler is **necessary-but-insufficient**: even deployed it only fires when `phgamecreatr` is a transfer
  party (custody deposit/withdraw, mint-out) — it still **cannot** catch pure user↔user P2P. Do not mistake it
  for a P2P fix. Also: deploying configv3 to "get the handler" would silently ship the entire decay economy too.

## 4) Fix options — pick one, do NOT setcode/setabi yet (review first)

### Option A (recommended, minimal) — admin `syncowner` action
The `syncowner` code touches only the `creatures` table, whose layout is **identical in configv2 and configv3**,
so the action itself is schema-independent. Diff: `_recon/PATCH-syncowner.diff` (generator: `_recon/gen-patch.cjs`).

⚠️ **Base-tree caveat (do not skip):** the ONLY on-disk source is **configv3** (`contract/pockethatch/*` —
`[[eosio::table("configv3")]]`). There is no configv2 source tree, only the deployed configv2 *ABI* under `build/`.
So this diff applies to the **configv3** source; compiling+deploying the patched tree ships **configv3** — the
entire Feed-v2 decay economy AND a `configv2 → configv3` singleton migration (old config abandoned, must re-`setconfig`).
To land `syncowner` on TODAY's configv2 binary with **no** economy change, someone must first reconstruct/strip a
configv2 source; the `syncowner` block then drops in **unchanged** (creatures table is identical). Shino decides
which base to ship — that call is a prerequisite, not a detail.

**Diff validation (verified 2026-07-09, Kevin):** `git apply --check -p1` ✅ and `patch -p1 --dry-run` ✅ both pass;
a real `patch -p1` apply yields hpp decl + cpp impl and is **content-identical** to the intended result. Hunk
headers are self-consistent (`@@ -311,6 +311,11 @@`, `@@ -1126,3 +1126,18 @@`). NOTE: do **not** add `--recount`
— the source files are CRLF and git-apply's `--recount` misbehaves against CRLF working trees (fails on a
correctly-counted patch); it's a leniency flag for *malformed* headers, which this is not. Bulletproof fallback:
`node _recon/gen-patch.cjs` regenerates byte-perfect CRLF sources under `_recon/patchgen/b/` to copy over the tree.
```cpp
// hpp — add action decl (near other [[eosio::action]] decls)
[[eosio::action]] void syncowner(std::vector<uint64_t> asset_ids, name new_owner);

// cpp — admin-only owner reconcile
void pockethatch::syncowner(std::vector<uint64_t> asset_ids, name new_owner) {
    require_auth(get_self());                         // admin-only (get_self / fee_account perm)
    creatures_t crs(get_self(), get_self().value);
    for (auto id : asset_ids) {
        auto it = crs.find(id);
        check(it != crs.end(), "no creature row for asset");
        if (it->owner != new_owner)
            crs.modify(it, same_payer, [&](auto& r){ r.owner = new_owner; });
    }
}
```
Reconcile the 3 ghosts (after review + deploy):
```
syncowner '{"asset_ids":[1099603751699],"new_owner":"waxwingsuper"}'
syncowner '{"asset_ids":[1099603751700,1099603751707],"new_owner":"officewax123"}'
```
Pair with an off-chain AA-transfer-history watcher that calls `syncowner` on drift → keeps it correct with
near-zero contract change. **Pros:** tiny diff, no model/economy change, fixes today. **Cons:** needs the
off-chain watcher for ongoing drift (unavoidable given the protocol limit above).

### Option B (structural, roadmap) — custody/deposit model
Require a creature be transferred INTO `phgamecreatr` to be "active"/earning; then the contract IS a transfer
party and the existing `on_assets_transfer` (`to == get_self()` → owner = from) captures it; a `withdraw`
returns it. Owner can never drift. **Pros:** self-correcting on-chain. **Cons:** bigger UX + panel change,
users must deposit; only fixes drift for deposited creatures.

## Recommendation
Add **Option A `syncowner`** to clear the 3 ghosts now, and run an off-chain watcher for ongoing sync. Because the
only on-disk source is configv3, Shino must first choose the base to build+deploy: **(a)** ship the configv3 tree
(accepts the decay economy + config migration — Poppy is already built for it), or **(b)** reconstruct a configv2
source and drop the same unchanged `syncowner` block in (owner fix only, no economy change). Put Option B (custody)
on the roadmap. **Nothing applied — awaiting @Shino review + base-tree decision before any setcode/setabi.**
