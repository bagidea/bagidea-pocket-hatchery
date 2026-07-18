# Changelog — Pocket Hatchery

## 0.3.1 (2026-07-18) — web render polish
Frontend-only (no contract change). Plugin bundle → 0.2.8.

- **Blink bug fixed** — the eye blink was scaling an `<ellipse>` eyelid `ry` 0→12 from the eye centre, which read as a coloured bar/circle popping in the middle of the eye. Replaced with a proper closed-eye state (eyelid fill + closed lid curve + lashes) toggled by opacity — no scaling. Affects the 2 blinking species (foxling, flicker).
- **Farm 60fps** — 21 live filter-heavy SVGs re-rasterised every frame → baked each creature to a bitmap once (`rasterizeCreatureBitmap`), farm renders `<img>`. Single-creature view stays full SVG.
- **Collection grid smooth** — grid cards default to the baked bitmap; live sparkle SVG only on hover/focus/pin (labs stay live).

## 0.2.0 (2026-07-09 — deployed)
**code_hash**: `d8733d5dda8c24619492cf822c0bd832613c33fd66b818aed45f9cd315297181`
**Network**: wax-testnet · **Contract**: `phgamecreatr`

### Deploy transactions
| Step | Action | txId |
|------|--------|------|
| setcode | eosio::setcode | `a3bd8567cd6dc25239e3edf158a3f00b2722b2defae4ed5db12ef4cee3359886` |
| setabi | eosio::setabi | `ddb3404ca6d7355fed4db1511c313888907bee1d4084dcbc14248ededce29ad4` |
| setconfig | phgamecreatr::setconfig | `c4bc88276589393bd8518e28da94f95c066768979d988e122bb14f7f0009372d` |
| verify: initplayer | phgamecreatr::initplayer | `15f19ad4be74d7834376d7af1d8ed96297c537ccfc774c24a94cb43db50a6023` |
| verify: hatch | phgamecreatr::hatch | `f506b17d15e0ca8fb6520b5afe8b99e8308bf289506ac21dedaf2c139800df31` |
| verify: harvest | phgamecreatr::harvest | `0f43e17d52c1f05465e43d7a08f597b65cce8473f2676f42c7cf4223b622dbd8` |

### Speciescfg rebuild (CDT index migration)
| Action | txId |
|--------|------|
| clearspecies | `b0e662f4e55534c0863a06cfe3ce19e37f04dfcf7f220d5ba4f42955443a91e1` |
| setspecies 662976 | `f1d4e3c2daf66415fe6117ad230df74b69ca707e711ccc3acbb37dae2bd5cc98` |
| setspecies 662977 | `06cf5d7c437a336702f40f3273381516b84b70d08080aa3129d01c81b1356f3f` |
| setspecies 662978 | `a28beb6c2a5ed6a554377560242c7205e7d497a43b9f03d74a59553681d61ab4` |

### Verified ✅
- configv3 live with all Feed v2 fields (fed_dur, earn_mult, feed_cd/harvest_cd/feed_daily_cap/feed_cost)
- initplayer/harvest/hatch work end-to-end
- NFT mint via AtomicAssets confirmed (collection phgamecreatr)
- Harvest uses Feed v2 window-based earn with cap_scales_rarity=1

### Known issues
- Template 662889 (used by 20 legacy creatures) has DB-level corruption — cannot be re-added to speciescfg. Legacy creatures blocked on feed/evolve until migration.
- feed cooldown (6h) prevents immediate post-hatch test — correct Feed v2 anti-spam behavior.
- accelerate inline token transfer needs authorization fix (WharfKit pushaction auth scope).
### Feed v2 — Satiety Economy
**Contract: `pockethatch.cpp` (configv3)**
- **New config table `configv3`** with Feed v2 fields:
  - `fed_dur_common/uncommon/rare` (48h/72h/120h) — how long a feed lasts
  - `earn_mult_common/uncommon/rare` (×1.00/×1.10/×1.40) — harvest yield multipliers
  - `cap_scales_rarity` (1) — daily EGG cap scales with best owned rarity
- **`feed` reworked**: EGG cost (12), cooldown (6h), daily cap (3/creature), growth boost reduced (1000→100)
- **`harvest` reworked**: window-based earn with satiety averaging; `last_fed` gates retroactive credit (no feed-then-harvest exploit)
- **`evolve`**: satiety gate — hungry creatures can't evolve
- **`mint_creature`**: newborns start fully fed (`last_fed = born_at`)
- **Config defaults corrected**: `rarity_w_*`=700/250/50 (70/25/5%), `earn_mult_*` matched to speciescfg yields

**Web (`web/src/`)**
- `satiety.ts`: `RARITY_EARN_MULT` corrected to {1.0, 1.1, 1.4} (was mock {1.0, 1.5, 2.5})
- `chain.ts`: `CONFIG_TABLE` ready for configv3 swap (swap point ③)
- `chain.ts`: stale comment fixed (pockethatch1→phgamecreatr)
- `play.ts`: harvest earn wired through `BASE_EARN_BY_STAGE × RARITY_EARN_MULT`

**Infra**
- `VERSION` file created (0.2.0)
- `RELEASE.md` release convention documented
- `CHANGELOG.md` created
- `deploy-v2.ps1`: automated 3-step deploy (setcode→setabi→setconfig)

### Data note
All existing creatures use template 662889 (NOT in speciescfg: 662976/7/8 Fire family).
Species lookup falls back → common curve. Template 662889 added to speciescfg TBD.

## 0.1.0 (2026-07-02 — deployed)
- Initial deployment at `phgamecreatr` (WAX testnet)
- configv2: basic hatch/feed/evolve/harvest/breed/claimreward/burncreature loop
- 3 Fire species (662976 common, 662977 uncommon, 662978 rare)
- code_hash: `0a21adc3`
