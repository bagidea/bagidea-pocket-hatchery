# Task B — Satiety / decay + yield spec for Poppy — FINAL

Read from real contract source `contract/pockethatch/pockethatch.cpp|.hpp` (Feed-v2 / **configv3**) and
live speciescfg on deployed `phgamecreatr` (code_hash `0a21adc3`), verified 2026-07-09 (Kevin).

## ⚠️ First, the split you must design around
- **Deployed today = configv2** (verified via `get_abi`). It has **NO satiety decay**. Live config values
  (from brief, confirmed schema): `feed_boost=1000`, `feed_daily_cap=100`, `feed_cd=0`, `harvest_cd=0`,
  `offline_cap_h=8`. On configv2 a creature earns purely by stage-yield × fed-hours — no starvation.
- **Decay economy = configv3 source, NOT deployed.** The formula below is what ships *when* configv3 goes live.
  → **Gate any decay/satiety UI behind a "Feed-v2 live" flag.** Today: no decay.

## 1) Satiety model (configv3 source)
One `feed` sets `last_fed = now` → refills satiety to 100%. Food then decays linearly to 0 over `fed_dur(rarity)`:
```
fed_until   = last_fed + fed_dur(rarity)
satiety%(t) = clamp((fed_until - t) / fed_dur(rarity), 0, 1)   // 100% → 0% linear
```
`fed_dur` by rarity (hpp — **use these, source-verified**):
| rarity (egg_type) | fed_dur        | earn_mult |
|-------------------|----------------|-----------|
| common (0)        | 172800s = **48h**  | ×1.00 (10000 bp) |
| uncommon (1)      | 259200s = **72h**  | ×1.50 (15000 bp) |
| rare (2)          | 432000s = **120h** | ×2.50 (25000 bp) |

> Note: an earlier draft said 28/44/76h — **wrong/stale**. Source is 48/72/120h.

## 2) Harvest earn (configv3) — un-gameable window
Per creature, per `harvest(owner)`:
```
ws = max(last_harvest, last_fed, now - offline_cap_h*3600)   // start
we = min(now, fed_until)                                     // end
if we <= ws: earn 0            // out of food / neglected across the whole cap window
fed_h   = floor((we - ws) / 3600)                            // integer hours, 0 → skip
avg_sat = ((fed_until-ws) + (fed_until-we)) / 2 * 10000 / fed_dur   // avg satiety over window, bp
earn   += yield_for(stage-1) * fed_h * earn_mult/10000 * avg_sat/10000
```
- **stage 0 earns 0** (skipped). stage 1→yield_0 … stage 5→yield_4.
- `ws` starts at `max(…, last_fed)` → feeding right before harvest gives ZERO retro credit (kills feed-then-harvest).
- `ws` starts at `max(…, now-offline_cap)` → food that ran out before the cap window pays nothing.
- Daily cap = `daily_egg_cap` (deployed configv2 = 240 per player/day); optionally × best owned rarity's
  earn_mult if `cap_scales_rarity=1`. Offline accrual capped at `offline_cap_h` = 8h.

## 3) Yield per stage — live speciescfg (deployed, verified on-chain)
EGG/hr gross ×10⁴ (raw table values):
| template_id | egg_type   | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | yield_5 |
|-------------|------------|---------|---------|---------|---------|---------|---------|
| 662976      | 0 common   | 100     | 300     | 600     | 1200    | 2400    | 4800    |
| 662977      | 1 uncommon | 110     | 330     | 660     | 1320    | 2640    | 5280    |
| 662978      | 2 rare     | 140     | 420     | 840     | 1680    | 3360    | 6720    |

⚠️ **Data mismatch to flag:** live creature rows use template_ids **662889 / 662906 / 662977**, but speciescfg
is keyed **662976 / 662977 / 662978**. Only **662977** overlaps → in deployed harvest, 662889/662906 creatures
find no speciescfg row and earn 0. Use this table as the intended yield curve; the 662889 mismatch is a
separate contract/data bug (owned by Kevin/Shino), not a Poppy concern.

## Poppy TL;DR
- **Today (configv2, live): NO decay.** feed_boost 1000, no cooldowns, earn = stage-yield × fed-hours, cap 240/day, offline 8h.
- **Decay (configv3, when shipped):** satiety 100%→0% linear over 48/72/120h by rarity; earn scaled by avg satiety
  over the window × rarity mult (×1.0/1.5/2.5); stage 0 = 0. Gate this behind a "Feed-v2 live" flag.
- Yield curve = the speciescfg table above (×10⁴ EGG/hr).
