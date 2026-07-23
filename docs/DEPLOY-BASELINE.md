# Pocket Hatchery — Live Chain Snapshot (2026-07-15)

> **Re-verified LIVE:** 2026-07-15 via waxsweden testnet RPC (CEO + Kevin)
> Contract: `phgamecreatr` on WAX Testnet
> Purpose: Ground-truth reference for claimreward diagnosis + economy v2 deploy planning

---

## Code Hash (LIVE)

```
SHA256 (on-chain WASM): <pending — get_raw_code_and_abi on phgamecreatr>
last_code_update:       TBD
```

> ⚠️ **DO NOT setcode while source drift exists.** Current disk source may not match deployed wasm.
> Verify source == deployed before any setcode attempt.

---

## creatrsv2 — 15 creatures (LIVE, as of 2026-07-15)

> **Table type: GLOBAL** — scope=`phgamecreatr`, key=`asset_id`, has field `owner`.
> This is NOT scoped by owner — all creatures in one table.

| asset_id | owner | template_id | stage |
|---|---|---|---|
| 1099603751833 | waxwingsuper | 662889 | 1 |
| 1099603751834 | officewax123 | 662889 | 1 |
| 1099603751835 | officewax123 | 662976 | 1 |
| 1099603751836 | waxwingsuper | 662977 | 1 |
| 1099603751838 | waxwingsuper | 662976 | 1 |
| 1099603751839 | waxwingsuper | 662889 | **2** |
| 1099603751840 | waxwingsuper | 662977 | 1 |
| 1099603751841 | waxwingsuper | 663046 | 1 |
| 1099603751842 | waxwingsuper | 662977 | **2** |
| 1099603751843 | waxwingsuper | 663046 | 1 |
| 1099603751844 | waxwingsuper | 662889 | 1 |
| 1099603751845 | waxwingsuper | 662978 | 1 |
| 1099603751846 | waxwingsuper | 662889 | 1 |
| 1099603751847 | waxwingsuper | 662889 | 1 |
| 1099603752017 | officewax123 | 662889 | 0 |

**officewax123 summary:** 3 creatures (1834 stage1, 1835 stage1, 2017 stage0) → max stage = **1**
**waxwingsuper summary:** 2 creatures at stage2 (1839, 1842) → max stage = **2** → claimreward OK

---

## spccfgv2 — 7 species (unchanged)

| template_id | family | max_stage |
|---|---|---|
| 662889 | Fire | 5 |
| 662976 | Fire | 5 |
| 662977 | Fire | 5 |
| 662978 | Fire | 5 |
| 663046 | Fire | 5 |
| 663047 | Fire | 5 |
| 663048 | Fire | 5 |

---

## configv3 — Key Fields (LIVE)

| Field | Value |
|---|---|
| `season_index` | 4 |
| `evolve_cost` | 300 (EGG) |
| `hatch_cost` | 150 |
| `breed_cost` | 5.0000 HATCH |
| `feed_cost` | 0 |

---

## claims Table (scope=phgamecreatr)

| account | claimed_season | last_claimed |
|---|---|---|
| officewax123 | 2 | 1783602696 |
| waxwingsuper | 4 | 1784103042 |

`season_index=4` → both accounts can claim next season (5). waxwingsuper just claimed S4.

---

## 🔴 officewax123 claimreward Diagnosis (CEO-VERIFIED 2026-07-15)

**Gate in contract:** `check(creature stage ≥ 2)` + `check(claimed_season < season_index)`

**officewax123 status:**
- season gate: `claimed_season=2 < season_index=4` → ✅ PASS
- stage gate: max stage among creatures = **1** → ❌ FAIL (need ≥2)
- HATCH balance: **268.0000 HATCH** → evolve cost 300 → ขาด **~32 HATCH**

**waxwingsuper status:**
- Has stage2 creatures (1839, 1842) → ✅ stage gate
- Has claimed season 4 already → must wait for season 5

### ✅ CORRECT FIX (no migrate, no setcode)

1. **Top up ~32 HATCH** to officewax123 (send from waxwingsuper or another source)
2. **Evolve creature 1834 or 1835** (stage1 → stage2): `pushaction phgamecreatr evolve {owner:"officewax123", asset_id:"1099603751834"}`
   - Cost: 300 HATCH (from officewax123 balance)
   - Prerequisite: creature must be fed (last_fed within fed_dur)
3. **Claim reward:** `pushaction phgamecreatr claimreward {owner:"officewax123"}`
   - After evolve, max stage = 2 → gate passes
   - No setcode / no migration / no table restructure needed

### ❌ WRONG APPROACH (do NOT do this)
- ~~Migrate creatures to new table~~ → unnecessary, existing table works
- ~~Setcode with new contract~~ → dangerous while source drift exists
- ~~Rewriting creatrsv2 structure~~ → binary_extension for new fields is correct, but NOT for this fix

---

## Notes
- Tables `creatures` and `speciescfg` are DEAD — do not query them
- Active tables: `creatrsv2`, `spccfgv2`, `configv3`, `claims`
- `creatrsv2` is **global scope** (scope=phgamecreatr, key=asset_id) — NOT scoped by owner
- Blazetail NFT `1099603751800` = real NFT (owner officewax123, tmpl 662977) but legacy — not in creatrsv2 (along with 1810/1707/1700). Not a claim blocker.
- rewardpool balance: TBD (verify before claim)
