# Pocket Hatchery — Contract Diagnosis (READ-ONLY investigation)

> **Updated 2026-07-10 by Kevin (re-audited)** — original report had material inaccuracies.
> This is a corrected, read-only investigation. NO action has been taken.

---

## The Contradiction (RESOLVED ✅)

**Claim from original report:** `pockethatch1` is empty, untouched 10 days.
**Reality from PROOF-OF-LOOP:** game loop proven through this morning with creatures, 268 HATCH, rewardpool 5,014 HATCH.

**Resolution:** The frontend targets `phgamecreatr`, NOT `pockethatch1`. Two different contracts.

---

## PART 1: Frontend Contract Target

### Single source of truth

`web/src/network.ts:42`:
```ts
contract: 'phgamecreatr',
```

ALL code paths resolve from this:
- `chain.ts:14` — `CONTRACT_ACCOUNT = ACTIVE_NET.contract` → `phgamecreatr`
- `contract.ts:6` — `CONTRACT_ACCOUNT = getActiveNetwork().contract` → `phgamecreatr`
- `chain.ts:24` — reads from `configv3` table (only exists on phgamecreatr; pockethatch1 has `configv2`)
- `waxwing.ts:157` — waxwing push path → `phgamecreatr`

**Stale comments** (non-functional, just outdated text):
- `contract.ts:4` says `testnet = pockethatch1` — outdated comment
- `play.ts:23` says `Contract: pockethatch1` — outdated comment
- `demoGame.ts:11,20,40` reference `pockethatch1` — offline demo only

---

## PART 2: Two Contracts — State Comparison

| | **pockethatch1** (DEAD) | **phgamecreatr** (ACTIVE) |
|---|---|---|
| Created | Jun 29 | Jul 1 |
| code_hash | `3d16ac28` (buggy v0.1.0) | `d8733d5d` (fixed v0.2.0) |
| Config table | `configv2` | `configv3` |
| creatures (total) | **0** (empty) | **34** |
| creatures (officewax123) | **0** | **2** (1099603751699, 1099603751800) |
| players (officewax123) | egg_balance=200, stale | egg_balance=302, active TODAY |
| speciescfg entries | 1 (662644 Fire) | **3** (662976/662977/662978 Fire) |
| speciescfg MISSING | — | **662889** ❌ (was removed by Kevin — notes.md:4) |
| rewardpool | 1,500,000 HATCH (stale) | 5,014 HATCH (active, 92 paid) |
| Active key | `EOS6u4i4jM...` (WIF unknown) | `EOS5tbKgsc...` (WIF IN WALLET ✅) |
| Frontend uses? | NO | **YES** (all actions push here) |

### Creature reference

| Shorthand | asset_id | template_id | owner | stage | speciescfg |
|-----------|----------|-------------|-------|-------|------------|
| #1699 | `1099603751699` | **662889** | officewax123 | 0 | **MISSING** ❌ |
| #1800 | `1099603751800` | 662977 | officewax123 | 2 | PRESENT ✅ |

Both creatures are on `phgamecreatr` collection (AtomicAssets) and `phgamecreatr` contract (game state).

---

## PART 3: What's Actually Broken

### 1. Template 662889 speciescfg MISSING (root cause of "feed blocked")

**Source confirms:** `notes.md:4` (Kevin, Jul 9): _"template 662889 species removed (24 creatures frozen)"_

The contract code (`pockethatch.cpp`) requires speciescfg for EVERY action:
- `hatch`/`firsthatch`: `check(sp_it != sps.end(), "species not found")` — line 326/370
- `feed`: same check — line 396
- `evolve`: same check — line 455
- `breed`: same check — line 688
- `accelerate`: same check — line 792

Creature #1699 (1099603751699, template 662889) cannot be fed/evolved because its species was removed from speciescfg.

### 2. Creature #1800 is fine — speciescfg exists

Template 662977 is in speciescfg on phgamecreatr with full thresholds. Creature is at stage 2 already.

### 3. `pockethatch1` buggy WASM is irrelevant

The frontend doesn't use `pockethatch1`. The `3d16ac28` ATTR_MAP bug is real but academic — no game actions target this contract.

---

## PART 4: Fix Required (read-only assessment)

**Only 1 action needed:**

```
pushaction phgamecreatr setspecies
  signer: phgamecreatr@active (key IN wallet ✅)
  data: species_row for template 662889
```

**No deploy. No key import. No new account. No ABI changes.**

The contract `phgamecreatr` already has:
- ✅ Fixed WASM `d8733d5d` (v0.2.0)
- ✅ Full ABI with correct table names
- ✅ Active game state (34 creatures, 3 players, rewardpool 5,014 HATCH)
- ✅ Speciescfg for templates 662976, 662977, 662978
- ✅ configv3 with correct season/parameters

**Missing:** speciescfg entry for template 662889 (removed by Kevin on Jul 9, freezing 24 creatures).

### Key that can sign

| Account | Permission | Key | In wallet? |
|---------|-----------|-----|------------|
| `phgamecreatr` | active | `EOS5tbKgscZ67nrRpLydFPR1rAGqbhLpy5eZY5CGAwPK2UQGgw9BK` | ✅ YES |
| `pockethatch1` | active | `EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX` | ❌ NO |

---

## PART 5: Original Report Errors (corrected)

| Claim | Correction |
|-------|-----------|
| "pockethatch1 tables empty" | 4/5 tables have data — but contract is still dead (creatures=0) |
| "ABI table names broken (underscore, >13 chars)" | Confused struct names with table names. Actual table names (`configv2`, `rewardpool` etc.) are valid EOSIO names |
| "Fix needs deploy to pockethatch1" | `phgamecreatr` already has d8733d5d — no deploy needed |
| "Key missing, blocked" | Key for `phgamecreatr` IS in wallet — `pockethatch1` key is the one missing |

---

## CEO Decision Points

**Q: pockethatch1 หรือ phgamecreatr?**
A: `phgamecreatr` — 100% of game state and frontend traffic is here.

**Q: ต้อง deploy มั้ย?**
A: ไม่ต้อง — `d8733d5d` อยู่แล้ว

**Q: ต้องใช้ key อะไร sign?**
A: `phgamecreatr@active` — กุญแจอยู่ใน wallet แล้ว (`PUB_K1_5tbKgsc...`)

**Q: แก้ยังไง?**
A: 1 คำสั่ง — `setspecies` template 662889 ลง `phgamecreatr`

**Q: ต้องทำอะไรก่อน confirm?**
A: หา parameters ของ species 662889 จากของเดิม (เช็ค tx history ตอนที่ Kevin เคยลงไว้ก่อน remove)
