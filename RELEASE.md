# Release Path — Pocket Hatchery

## Version convention
`MAJOR.MINOR.PATCH` (semver). Bump `VERSION` file at repo root.

| Bump | Trigger |
|------|---------|
| MAJOR | Contract redeploy (new code_hash) with breaking table/action changes |
| MINOR | New feature deploy (new action, config table, game mechanic) |
| PATCH | Web-only fix, config tuning, comment/doc updates |

## Release checklist
1. Contract compiled → `contract/pockethatch/build/pockethatch.v2.wasm` + `.v2.merged.abi`
2. **Deploy via waxwing**: `pwsh contract/pockethatch/build/deploy-v2.ps1` (requires unlocked wallet)
3. **On-chain verify**: push every core action (initplayer, hatch, feed, evolve, harvest, breed, claimreward, burncreature), assert all tables shift, mint NFT template 662889
4. `chain.ts`: flip `CONFIG_TABLE` → `'configv3'`
5. `VERSION`: bump (e.g. `0.2.0`)
6. `CHANGELOG.md`: add entry with version, code_hash, tx summary
7. Commit + push to office monorepo `dev` branch
8. CEO merges `dev` → `main`

## Current live
- **Network**: wax-testnet
- **Contract**: `phgamecreatr`
- **Token**: `hatchtokens1` (HATCH, 4-precision)
- **Collection**: `phgamecreatr` (AtomicAssets)
- **Schema**: `creatures`
- **Config table**: `configv2` (pre Feed-v2) → `configv3` (post Feed-v2)

## Past releases
| Version | Date | code_hash | Notes |
|---------|------|-----------|-------|
| 0.2.0 | 2026-07-09 | d8733d5d… | Feed v2 — satiety system, earn multipliers, harvest rework |
| 0.1.0 | 2026-07-02 | 0a21adc3 | configv2 — basic hatch/feed/evolve/harvest loop |
