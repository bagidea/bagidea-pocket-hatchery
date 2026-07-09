# Task B — Real on-chain numbers for Poppy (swap mock → real)

Source: deployed `phgamecreatr` (code_hash 0a21adc3), verified via greymass testnet RPC, 2026-07-08.

## (i) Rarity tier mapping — CORRECT
Weights live in config (`configv2`) + each creature's rarity = its species `egg_type`:
- common   = weight **700** (70.0%)  → egg_type 0
- uncommon = weight **250** (25.0%)  → egg_type 1
- rare     = weight **50**  ( 5.0%)  → egg_type 2
(Hatch rolls these weights; the creature's tier is then fixed by the minted template's egg_type.)

## (ii) Earn is by STAGE, not rarity — real speciescfg yields
`harvest` uses `yield_for(stage - 1)` from `speciescfg` (stage 1→yield_0 … stage 5→yield_4;
**stage 0 earns 0** — index underflows and is skipped). Values are gross EGG/hr ×10⁴.

Deployed speciescfg (3 species):
| template_id | egg_type | yield_0 | yield_1 | yield_2 | yield_3 | yield_4 | yield_5 |
|-------------|----------|---------|---------|---------|---------|---------|---------|
| 662976      | 0 common | 100     | 300     | 600     | 1200    | 2400    | 4800    |
| 662977      | 1 uncom. | 110     | 330     | 660     | 1320    | 2640    | 5280    |
| 662978      | 2 rare   | 140     | 420     | 840     | 1680    | 3360    | 6720    |

Harvest math (deployed): `gross += yield_for(stage-1) * fed_hours` per creature, summed, then
clamped to `daily_egg_cap` = **240** / player / day; offline accrual capped at `offline_cap_h` = **8h**.

⚠️ Data caveat for Poppy: live creature rows use template_ids **662889 / 662906 / 662977**, but
speciescfg is keyed **662976 / 662977 / 662978**. Only 662977 overlaps → in the deployed harvest,
662889/662906 creatures find NO speciescfg row and currently earn 0. Use the table above as the
intended yield curve; flag the 662889 mismatch to Kevin/Shino separately.

## (iii) Satiety / decay — where it really comes from  ⚠️ NOT LIVE YET
Deployed config table is **`configv2`** (older schema). Confirmed live values:
- `feed_boost` = **1000** (growth added per feed)
- `feed_daily_cap` = **100** (feeds/creature/day)
- `feed_cd` = **0** (no feed cooldown)
- `harvest_cd` = 0, `daily_egg_cap` = 240, `offline_cap_h` = 8

The satiety-DECAY economy exists **only in the on-disk source (`configv3`, "Feed v2")**, which is
NOT deployed. Its formula (for when it ships):
```
fed_until  = creature.last_fed + fed_dur(rarity)
satiety%   = clamp((fed_until - now) / fed_dur(rarity), 0, 1)
fed_dur: common 100800s (28h) · uncommon 158400s (44h) · rare 273600s (76h)
earn window = [last_harvest, min(now, fed_until)], capped offline_cap_h, × earn_mult(rarity)
earn_mult: common 1.00 · uncommon 1.50 · rare 2.50 (basis points /10000)
```
On `configv2` these fields don't exist (`fed_dur_*`, `earn_mult_*` = undefined), so **the deployed
contract has no satiety decay** — a creature earns purely by stage yield × fed hours, no starvation.

### Poppy TL;DR
- Tiers 70/25/5 → real. Use them.
- Earn = stage yield table above (×10⁴ EGG/hr), cap 240/day, offline cap 8h — this is LIVE.
- Satiety decay = design only (configv3), NOT on-chain. If your mock shows decay, gate it behind a
  "Feed v2 shipped" flag until configv3 is deployed. Today: no decay, feed_boost 1000, no cooldown.
