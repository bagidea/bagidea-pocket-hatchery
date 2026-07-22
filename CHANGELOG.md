# Changelog — Pocket Hatchery

## @deprecated: pockethatch1 (2026-07-19)
**pockethatch1 is officially deprecated.** The contract (`3d16ac28`) is a dead pre-6-tier shell with zero creatures. All live systems point to `phgamecreatr` (`424eef18`, 7 tables, configv3). The 30M HATCH parked in `pockethatch1` is intentionally left untouched — no recovery unless a future kill/redeploy decision is made. See `MEMORY.md` for the full deprecation notice.

## Unreleased — rename goes on chain

Frontend + plugin, **plus a contract fix** (`setcode` only — the regenerated ABI is byte-identical to the deployed one, so no `setabi`).

### Contract — every write to NFT mutable data now MERGES

`atomicassets::setassetdata` replaces an asset's whole mutable map; it is not a patch. All three call sites built a fresh map, so each one silently deleted the attributes it did not personally rebuild:

- `evolve` wrote `{stage, growth}` → **wiped the player's `name`** on the first evolve after a rename. With local nicknames gone, that was permanent data loss.
- `setname` wrote `{stage, growth, name}` → wiped a `cosmetic` bought with EGG.
- `equipcosmetic` wrote `{stage, growth, cosmetic}` → wiped the name.

All three now read the asset's current mutable data back, edit only their own attribute and hand the rest through. Decoding lives in `contract/pockethatch/aa_mutdata.hpp` (attributes are a tagless `[varuint id][value]` stream, so the value types come from the collection's `schemas` row) and mirrors `chain.ts` `decodeAssetName()`. No migration needed: the NFT itself stays the source of truth, so names already on chain are preserved by the merge.

`contract/pockethatch/test/test_mutdata.cpp` compiles that header natively and runs it against the real mutable bytes of assets 1099603751834 / 1099603752017 — 21/21, including a byte-exact decode→encode round trip and a witness that the old rebuild-the-map approach does drop the name.

### Rename input caps by bytes, not characters

`setname` checks `new_name.size() <= 32` — `std::string::size()` is **bytes**. The input capped with `maxLength={32}` (UTF-16 units), so a Thai or emoji name could pass the UI and be rejected by the chain after the player had already signed. `clampCreatureName()` now trims by UTF-8 byte length, cutting whole code points so no character is left broken. `web/scripts/verify-name-bytecap.mjs` — 11/11 on the live panel (Thai · emoji · ASCII).

### Frontend / plugin

- **Renaming a creature now signs `setname`** instead of writing a local preference. The contract forwards to `atomicassets::setassetdata`, so the name lands in the NFT's own mutable data — it shows in any wallet and follows the creature when it is traded.
- **Names are read back off chain.** `chain.ts` decodes the `name` attribute straight out of `atomicassets.assets.mutable_serialized_data` (RPC, not an indexer, so a post-tx poll can't read a lagging index). The creature card, the farm and the collection search all read that one value.
- **Fixes "I renamed it but the farm didn't change."** The farm used the species name and the card used a plugin-side nickname, so the two could never agree. Both now show `Creature.nickname` (the NFT name) with the species name as the fallback.
- **Local nicknames removed** from `prefs.ts` and from the plugin's `nickname` command (which now refuses and points at the chain action). Pins stay local — they are a view preference with no on-chain meaning. Old `nicknames` maps in `prefs.json` are ignored, never read back.
- **In-flight state** — a card shows "Saving name on chain…" from the signature until the read node returns the new name, and the rename controls are withdrawn while the tx is in flight. The displayed name stays the confirmed on-chain one until then.
- **No fee charged in the UI.** `configv3.name_cost` is 1 HATCH but the deployed contract does not enforce it (verified: balance 268 → 268 across a rename), so the UI deducts nothing rather than drifting from the chain.
- **Farm name tags no longer render mirrored** — the agent's facing flip was mirroring the label with the sprite.

Verified on wax-testnet as `officewax123`:

| Asset | Name written | txId |
|-------|--------------|------|
| 1099603751834 | `Ember Queen` | `05bbea5e9d43458b669aec04ab658dc061d40f2e63eb2ce018d51fc6b75f3942` |
| 1099603752017 | `Sparkplug` | `518b7cd5bbf8da7495eff82372037b823c7335a476b6115cf462c2de72a9ee02` |

Read back from `atomicassets.assets` mutable data and confirmed identical on the card, in the farm and via the AtomicAssets API — `web/scripts/verify-onchain-rename.mjs` (8/8) and `web/scripts/verify-rename-pending.mjs` (4/4).

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
