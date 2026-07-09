# Feed Economy v2 — "Food Timer" satiety model — Kevin, 2026-07-08

**Status:** implemented in source + **compiles clean** (CDT 4.1.1). **NOT deployed** — holding for
CEO to approve the numbers, then setcode+setabi+setconfig. Phase A (`predict_asset_id`) ships first.

| artifact | value |
|---|---|
| Phase B wasm | `build/pockethatch.v2.wasm` — sha256 `d8733d5dda8c24619492cf822c0bd832613c33fd66b818aed45f9cd315297181` (recompiled 2026-07-09; prev `ccbadced…` stale) |
| Phase B ABI (deploy) | `build/pockethatch.v2.merged.abi` (merged; raw abigen omits `[[eosio::table]]` structs on CDT 4.1.1) |
| Phase A wasm (untouched) | `build/pockethatch.wasm` — sha256 `0a21adc3…` (still the staged predict fix) |

---

## The problem (v1)
`feed` only added `fed_growth` (speeds evolution) and was **free / no cooldown**. Harvest earned
purely off `stage` × offline-hours, **independent of feeding**. So a grown creature earned forever
whether or not you cared for it — feeding was cosmetic.

## The mechanic (v2) — "Food Timer"
One feed grants a creature a **window of fed time** (`fed_duration`, longer for rarer creatures).
A creature earns EGG on harvest **only for the hours it was still fed**. Food runs out → earning
stops until you feed again.

- `fed_until = creature.last_fed + fed_duration(rarity)`  (rarity = `speciescfg[template_id].egg_type`)
- `satiety% = clamp((fed_until − now) / fed_duration, 0, 1)`  ← the bar the web draws
- **No new field on `creature_row`** — reuses the existing `last_fed`. Existing creature rows keep
  deserializing unchanged (no table migration).
- **Un-gameable earn (fixed 2026-07-08 after review):** harvest credits ONLY the sub-window
  `[max(last_harvest, last_fed, now−offline_cap), min(now, fed_until)]`, scaled by the **average
  satiety** over it (linear 100%→0% across `fed_duration`). Starting at `max(…, last_fed)` means a
  feed pays only for time *after* it → feeding right before harvest gives **zero** retroactive credit.
  Starting at `max(…, now−offline_cap)` means food that ran out earlier than the cap window pays
  **zero** → neglect earns nothing even though `fed_dur ≫ offline_cap`. Verified numerically:
  exploit=0, neglect=0, daily(24h)=~58% of cap, engaged(8h)=~92%.

### Contract changes (all action signatures UNCHANGED — web calls are identical)
| action | change | file:site |
|---|---|---|
| `feed(owner, asset_id)` | charges `feed_cost` EGG, sets `last_fed=now` (refills satiety), keeps `fed_growth += feed_boost`, enforces `feed_cd` + `feed_daily_cap` | `pockethatch.cpp` feed() |
| `harvest(owner)` | per-creature earn `= yield(stage) × fed_hours × earn_mult(rarity) × avg_satiety`, window `ws=max(last_harvest,last_fed,now−offline_cap) … we=min(now,fed_until)`, `fed_hours=(we−ws)/3600`, `avg_satiety=(sat(ws)+sat(we))/2` in bp; `we≤ws → 0`; daily cap optionally ×`earn_mult(best owned rarity)` | `pockethatch.cpp` harvest() |
| `evolve(owner, asset_id)` | gate `check(now < fed_until, "creature is hungry — feed before evolving")` | `pockethatch.cpp` evolve() |
| `mint_creature` (hatch/firsthatch) | newborn starts fed: `last_fed = born_at` | `pockethatch.cpp` mint_creature() |
| helpers | `fed_duration_for(cfg, egg_type)`, `earn_mult_for(cfg, egg_type)` | `pockethatch.cpp/.hpp` |

## What Poppy needs (contract ↔ web contract)
- **Satiety bar:** read `creatures.last_fed` (existing) + rarity from `speciescfg[template_id].egg_type`
  (0=common,1=uncommon,2=rare) + `configv3.fed_dur_{common,uncommon,rare}` → compute the two formulas
  above. Poppy's "optimistic `lastFed` bump on feed" is exactly right — bar snaps to full on feed.
- **Config table renamed `configv2 → configv3`** (adding fields to `config_row` changes the ABI, and
  the codebase's precedent to avoid a read-past-end on the old blob is a table-name bump). Point web
  reads at `configv3`; nothing else on the web side changes.
- **New config fields:** `fed_dur_common/uncommon/rare` (uint32 sec), `earn_mult_common/uncommon/rare`
  (uint16 basis points, 10000=×1.0), `cap_scales_rarity` (uint8 flag).

## Proposed numbers (for CEO — all live-tunable via `setconfig`)
Tuned for "play once a day":

| param | common | uncommon | rare |
|---|---|---|---|
| `fed_dur_*` (full→empty decay) | 48h (172800) | 72h (259200) | 120h (432000) |
| `earn_mult_*` | ×1.0 (10000) | ×1.5 (15000) | ×2.5 (25000) |
| `feed_cost` (flat) | 12 EGG | 12 | 12 |
| `feed_cd` | 6h (21600) | " | " |
| `feed_daily_cap` | 3 / creature / day | " | " |
| `offline_cap_h` | 8h (unchanged) | | |
| `daily_egg_cap` | 240 (unchanged) | | |

`fed_dur` is now the **decay window** (satiety falls 100%→0% over it), no longer a hard on/off timer.
Bigger `fed_dur` = a gentler daily decay curve; neglect past `offline_cap` earns 0 regardless, so
`fed_dur` can be generous without re-opening the exploit. Once-a-day common ≈ 58% of the 8h cap;
feeding closer to harvest pushes toward ~92%. All live-tunable — CEO's to set.

**CEO decision — 1 knob:** `daily_egg_cap 240` caps every rarity, so the earn multiplier only shows
if the cap scales. `cap_scales_rarity=1` (recommended) → daily cap ×`earn_mult(best owned)`;
`=0` → flat cap (rarity edge then comes only from longer `fed_duration` + higher species yields).

## Deploy shape (Phase B — DO NOT run until CEO approves numbers)
Three actions, in order, **as one atomic-ish sequence** (all as `phgamecreatr@active`):
1. `setcode` — `build/pockethatch.v2.wasm` (`d8733d5d…`)
2. `setabi` — `build/pockethatch.v2.merged.abi` (config table now **`configv3`**)
3. `setconfig` — **`build/_setconfig_v3_READY.json`** (staged)

⚠️ **Migration is NOT free — the config table renames `configv2 → configv3`.** The live `configv2`
row (`season_index=1`, `season_started=1783454322`, `rng_oracle=phgamecreatr`, all costs) becomes
invisible to the v2 ABI. `configv3` starts empty; `_cfg()` returns struct **defaults** via
`get_or_default` (no crash — but defaults carry `season_index=0`, `collection=pockethatch1`, wrong
costs). Until `setconfig` runs, **`firsthatch`/`claimreward` revert** (`season_index==0`) and the
economy is on wrong numbers. **`_setconfig_v3_READY.json` already carries `season_index=1` +
`season_started` + `rng_oracle` + all costs**, so running it immediately after `setcode`+`setabi`
restores the live season and applies the v2 fields in one shot. Do not deploy setcode without it.

`creature_row` is unchanged → existing creatures are safe (no row migration).

*Kevin — mechanic implemented + anti-gaming fixed (verified: exploit/neglect=0), wasm builds clean
(`d8733d5d…` as of 2026-07-09 recompile), deploy-ready ABI + season-safe setconfig staged. Holding for CEO number-approval.*
