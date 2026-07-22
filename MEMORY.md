# Pocket Hatchery — Project Memory

## @deprecated: pockethatch1 (2026-07-19)

`pockethatch1` (code_hash `3d16ac28…`) is **DEAD** — a pre-6-tier contract shell deployed on WAX testnet during early development. It has **zero creatures**, a stale `configv2`, and no local build matches its on-chain WASM.

**Everything is canonically on `phgamecreatr`** (code_hash `424eef18…`, 7 tables: configv3, players, creatrsv2, rewardpool, spccfgv2, claims, speciescfg). The frontend, plugin, and on-chain config all point to `phgamecreatr`.

### On-chain state (do NOT touch without CEO approval)
- `pockethatch1` holds **30,000,001.0000 HATCH** (1.5M in `rewardpool` table, ~28.5M unregistered in account balance)
- **No recovery action has been taken.** The tokens are safely parked in a dead contract.
- Recover **only if** a future decision is made to kill/redeploy `pockethatch1`. At that point, transfer HATCH via `pockethatch1@active` (key is in waxwing wallet) → `phgamecreatr` or `waxwingsuper`.

### Deploy scripts
Most deploy scripts under `deploy/` reference `pockethatch1` as CONTRACT/COLLECTION. These are **historical artifacts** — the live deploy pipeline targets `phgamecreatr`. See `deploy/lib.sh` (stamped `# DEPRECATED`) for the original deploy setup.

### Reference
- Full diagnosis: `docs/POCHATCH1-DIAGNOSIS.md`
- Live on-chain audit: `ECONOMY-AUDIT.md`
- AtomicAssets collection: `phgamecreatr` (author: phgamecreatr, schema: creatures)
- Deploy target since 2026-07-01: `phgamecreatr` only
