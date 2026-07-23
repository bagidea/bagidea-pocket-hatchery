# Economy v2 — Implementation Plan

**Author:** Kevin | **Date:** 2026-07-15 | **Status:** SPEC DRAFT — รอ CEO เคาะ  
**Source ground-truth:** `pockethatch.hpp` / `pockethatch.cpp` (as of 2026-07-15)  
**Dependencies:** Sun's `ECONOMY-AUDIT.md` (2026-07-09), `FEED-ECONOMY-V2.md` (2026-07-08), on-chain `phgamecreatr` WAX testnet  
**⚠️ CEO REVIEW (2026-07-15):** setcode เสี่ยงเกินตอน source drift อยู่; ห้ามเสนอโดยไม่ยืนยัน source==deployed ก่อน.
แนวทางที่ปลอดภัยกว่า: แก้ปัญหาเฉพาะจุดด้วย evolve creatures ที่มีอยู่ แทนการ deploy contract ใหม่.
แผนนี้พักไว้ก่อนจนกว่า CEO จะสั่งเดินหน้าต่อ

> ⚠️ **ยังไม่ทำอะไร** — เอกสารนี้คือแผน implementation เท่านั้น. No setcode/setconfig/deploy. รอ CEO approve spec แล้วถึงลงมือ.

---

## ภาพรวม 5 กลไก — สรุปหนึ่งตา

| # | Mechanism | Type | Needs Setcode? | Needs Setconfig? | Needs Setspecies? | Risk |
|---|-----------|------|:---:|:---:|:---:|------|
| 1 | **Awaken timer** — stage 0→1 อัตโนมัติ | Contract code + table schema | ✅ | ✅ | — | 🟢 binary_extension |
| 2 | **Pay WAX ปลุกทันที** — skip timer ด้วย WAX | Contract code (on_notify) | ✅ | ✅ | — | 🔴 Memo parsing, WAX stuck |
| 3 | **Satiety decay per rarity** | Config formula tweak | maybe | ✅ | — | 🟢 |
| 4 | **Burn → EGG refund** | Modify burncreature | ✅ (minor) | ✅ | — | 🟢 |
| 5 | **Fix double-count** | Setspecies admin action | — | — | ✅ | 🟢 |

---

## 1. Awaken Timer — Stage 0→1 อัตโนมัติ

### 1.1 Current State

```
mint_creature() [cpp:272-317]:
  r.stage = 0
  r.born_at = now
  r.last_fed = born_at   ← newborn starts fed

harvest() [cpp:570]:
  if (it->stage == 0) continue;   ← stage 0 earns ZERO

evolve() [cpp:488-510]:
  cur_stage from STORED field [cpp:488]
  check cur_stage < max_stage
  check g >= threshold_for(cur_stage)
  cost = evolve_cost × (cur_stage + 1)   ← stage 0→1 costs 300 EGG
  new_stage = cur_stage + 1
```

**ปัญหา:** ผู้เล่นต้องหา 300 EGG เพื่อ evolve ตัวแรก (stage 0→1). EGG มาจาก `harvest()` เท่านั้น → stage 0 harvest ไม่ได้ → chicken-and-egg trap. ผู้เล่นที่ไม่มี `firsthatch` privilege (ใช้แล้วหรือมี creature อยู่แล้ว) ติด.

### 1.2 Proposed Design

เพิ่มกลไก **"ไข่ฟักเองอัตโนมัติ"** — stage 0→1 ไม่ต้องจ่าย EGG, ไม่ต้องเรียก `evolve()`. แค่รอเวลาครบ (`awaken_dur` วินาที) หลังจาก hatch.

**Design decision — "Lazy auto-promote":** stage ไม่ advance ทันทีที่นาฬิกาครบ. แต่จะ advance ใน action ถัดไปที่ player ทำกับ creature ตัวนั้น (harvest/feed/evolve/breed/burncreature). วิธีนี้:

- ✅ ไม่ต้องมี cron job หรือ subscription สำหรับอัพเดท stage
- ✅ ไม่เปลือง CPU ประมวลผล creature ทั้งหมดทุกบล็อก
- ✅ Player ต้อง "check-in" อย่างน้อยหนึ่ง action ถึงจะได้ awaken — natural engagement
- ✅ `harvest()` loop อ่าน stage จาก creature row ปกติ — พอ `try_awaken()` เลื่อน stage เป็น 1, ก็เข้าเงื่อนไข earn ทันทีใน loop เดียวกัน

| What | Value |
|------|-------|
| Stage 0→1 cost | **0 EGG** (ฟรี) |
| Stage 1→2+ cost | จ่าย EGG ผ่าน `evolve()` เหมือนเดิม |
| Awaken auto-triggers on | `harvest()`, `feed()`, `evolve()`, `breed()`, `burncreature()` |
| Abort on | creature not in `creatrsv2`, wrong owner, creature is hungry (`now >= fed_until`) |

### 1.3 Schema Changes

#### `creature_row` [hpp:273-288] — ADD ONE FIELD

```cpp
struct [[eosio::table("creatrsv2")]] creature_row {
    uint64_t    asset_id;
    name        owner;
    uint64_t    template_id;
    uint8_t     stage;
    uint64_t    growth_base;
    uint64_t    fed_growth;
    uint32_t    born_at;
    uint32_t    last_sync;
    uint32_t    last_fed;
    uint32_t    last_bred;
    checksum256 genetics;                      // 32 bytes — was the LAST field
    // ── Economy v2: MUST be at END with binary_extension ──
    eosio::binary_extension<uint32_t> wake_at; // เมื่อถึงเวลานี้ stage auto=1
    // ^^^ binary_extension ensures OLD rows (no wake_at bytes) deserialize correctly:
    //     datastream sees end-of-row → wake_at stays empty → value_or(0) returns 0.
    //     NEW rows append 4 bytes → wake_at has value.
    //     🔴 DO NOT insert fields BEFORE genetics — that shifts byte offsets for
    //        every subsequent field → silent corruption of existing 14 creature rows.
};
```

**Why `binary_extension` + ต้องอยู่ท้าย struct:**

EOSIO CDT packs struct fields in declaration order into a contiguous byte stream with no field markers. ถ้าใส่ `uint32_t wake_at` กลาง struct (ก่อน `genetics`):
- Old row: `[asset_id:8][owner:8][template_id:8][stage:1][growth_base:8][fed_growth:8][born_at:4][last_sync:4][last_fed:4][last_bred:4][genetics:32]` = 89 bytes
- New deserializer: reads `wake_at` = first 4 bytes of `genetics` → garbage timestamp. reads `genetics` = remaining 28 bytes → corruption or deserialization failure (checksum256 expects exactly 32 bytes)

`binary_extension<T>` ที่ท้าย struct แก้ปัญหานี้: มันเป็น wrapper ที่เช็คว่า datastream มี bytes เหลือหรือไม่. ถ้าไม่มี (old row) → `wake_at` = empty → `.value_or(0)` = 0. ถ้ามี (new row) → อ่าน 4 bytes เป็น `uint32_t`.

**Why `wake_at` ไม่ใช่ `awaken_at`:** ชื่อสั้น ตรงกับ theme "ตื่น" (wake). ใช้ `uint32_t` (unix timestamp) — พอดีกับ 32-bit epoch จนถึงปี 2106.

**Migration:** ไม่ต้อง migrate เลย — `binary_extension` handle ให้อัตโนมัติ. Old rows (14 creatures) remain in `creatrsv2` table as-is. `wake_at` resolves to 0 → `try_awaken()` reconstructs `born_at + awaken_dur(rarity)` เป็น fallback. ถ้า `now >= wake_at` → auto-awaken ทันทีใน action ถัดไป. New rows (หลัง setcode) จะมี `wake_at` 4 bytes ต่อท้าย.

#### `config_row` [hpp:129-193] — ADD ONE PER-RARITY FIELD

```cpp
// ── Awaken timer (Economy v2) ──
// Egg auto-hatches to stage 1 after this many seconds. Zero = disable.
uint32_t    awaken_dur_common   = 86400;     // 24h — common eggs hatch in 1 day
uint32_t    awaken_dur_uncommon = 172800;    // 48h
uint32_t    awaken_dur_rare     = 259200;    // 72h
uint32_t    awaken_dur_epic     = 432000;    // 120h (5d)
uint32_t    awaken_dur_legendary= 604800;    // 168h (7d)
uint32_t    awaken_dur_mythic   = 864000;    // 240h (10d)
```

**Placeholder numbers** — รอ CEO + Sun กำหนด. หลักคิด: rarer = longer wait (สร้าง rarity differentiation ตั้งแต่เกิด). 24h สำหรับ common คือ "กลับมาพรุ่งนี้ก็ฟักแล้ว."

### 1.4 Code Changes

#### 1.4.1 New helper: `awaken_duration_for()` [cpp, หลัง `earn_mult_for`]

```cpp
uint32_t pockethatch::awaken_duration_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.awaken_dur_uncommon;
        case 2:  return cfg.awaken_dur_rare;
        case 3:  return cfg.awaken_dur_epic;
        case 4:  return cfg.awaken_dur_legendary;
        case 5:  return cfg.awaken_dur_mythic;
        default: return cfg.awaken_dur_common;
    }
}
```

#### 1.4.2 New helper: `try_awaken(creature, now)` [cpp]

```cpp
// Returns true if stage advanced 0→1 in this call
bool pockethatch::try_awaken(creature_row& c, const config_row& cfg,
                              const species_row& sp, uint32_t now) {
    if (c.stage != 0) return false;
    // binary_extension: old rows (no bytes) → value_or(0); new rows → actual value
    uint32_t wa = c.wake_at.value_or(0);
    if (wa == 0) {
        // Legacy creature — reconstruct wake_at from born_at
        wa = c.born_at + awaken_duration_for(cfg, sp.egg_type);
    }
    if (now < wa) return false;
    // Awaken!
    c.stage = 1;
    c.wake_at = wa;   // persist reconstructed value into binary_extension
    return true;
}
```

#### 1.4.3 Modify `mint_creature()` [cpp:302-314]

```cpp
// After sp_it lookup (add to mint_creature signature or lookup inline):
uint32_t wake_dur = awaken_duration_for(cfg, sp_row.egg_type);
// In crs.emplace — binary_extension assignment:
r.wake_at = born_at + wake_dur;   // automatically packs as present value
```

⚠️ `mint_creature` ปัจจุบันไม่รับ `species_row` — ต้องเพิ่ม parameter หรือ lookup ใน function. แนะนำ lookup จาก `template_id` (มีอยู่แล้ว).

#### 1.4.4 Modify `harvest()` [cpp:569-594]

```cpp
for (auto it = idx.lower_bound(owner.value); …) {
    // … existing sync …
    
    // ── Economy v2: auto-awaken if timer elapsed ──
    auto c_copy = *it;
    sync(c_copy, *sp_it, now);
    bool just_awakened = try_awaken(c_copy, cfg, *sp_it, now);
    if (just_awakened) {
        // Persist stage change + wake_at
        crs.modify(it, same_payer, [&](auto& r) {
            r.stage    = c_copy.stage;
            r.wake_at  = c_copy.wake_at;
            // sync already updated growth_base/last_sync
            r.growth_base = c_copy.growth_base;
            r.last_sync   = c_copy.last_sync;
        });
        // Update AA NFT
        if (nft_exists(cfg.collection, it->owner, it->asset_id)) {
            ATTR_MAP new_mut = {
                {"stage",  ATOM_ATTR((uint32_t)c_copy.stage)},
                {"growth", ATOM_ATTR(current_growth(c_copy, *sp_it, now))}
            };
            action(
                permission_level{get_self(), "active"_n},
                "atomicassets"_n, "setassetdata"_n,
                aa_setdata{get_self(), it->owner, it->asset_id, new_mut}
            ).send();
        }
    }
    
    if (c_copy.stage == 0) continue;  // still egg — skip earn
    // … rest of harvest unchanged, using c_copy.stage …
}
```

> 💡 **Alternative (cleaner):** refactor auto-awaken into a `sync_and_awaken()` helper that all actions call. หลีกเลี่ยง code duplication.

#### 1.4.5 Modify `evolve()` [cpp:454]

Stage 0→1 is now handled by auto-awaken. `evolve()` should:
- `check(cur_stage >= 1, "egg not yet awakened — wait or pay WAX to skip")` — ถ้าเป็น stage 0 และยังไม่ถึงเวลา, บอกให้รอหรือใช้ WAX
- Stage 1→2+ ทำงานเหมือนเดิม

```cpp
// At top of evolve, after sync:
bool awakened = try_awaken(c, cfg, *sp_it, now);
if (awakened) {
    // persist stage change immediately (already awakened by timer — free)
    cur_stage = c.stage;  // now 1
}
// Guard: stage must be >= 1 to evolve further
check(cur_stage >= 1, "egg not yet awakened — wait or pay WAX to skip");
// Cost for stage≥1 works as before
uint64_t cost_amount = cfg.evolve_cost * (uint64_t)(cur_stage);  // stage 1→2 costs 300×2=600? OR keep 300×(stage)?
```

⚠️ **Cost formula change:** แต่เดิม cost = `evolve_cost × (cur_stage + 1)` ทำให้ stage 0→1 = 300, stage 1→2 = 600. ถ้า stage 0→1 ฟรีผ่าน awaken, stage 1→2 ควร cost = `evolve_cost × cur_stage` (= 300×1 = 300) หรือคงไว้ที่ ×(cur_stage+1) = 600?

**Recommendation:** `cost = evolve_cost × cur_stage` — stage 1→2 costs 300, 2→3 costs 600, etc. (one "step" cheaper since first step is free). **CEO must decide.**

#### 1.4.6 Modify `feed()`, `breed()`, `burncreature()`

Call `try_awaken()` at entry. If awaken triggers, persist stage change. Same pattern as harvest — refactor to helper.

### 1.5 Migration of Existing Rows

`binary_extension` makes this a **zero-migration change**. No table wipe, no row rewrite, no table name bump.

| Scenario | `wake_at` value in datastream | `value_or(0)` | Behavior |
|----------|------------------------------|---------------|----------|
| Creature hatched BEFORE economy v2 | No bytes (empty) | `0` | `try_awaken()` reconstructs `born_at + awaken_dur(rarity)`. If time elapsed → auto-stage=1 on next action |
| Creature hatched AFTER economy v2 | 4 bytes appended | actual timestamp | Normal |
| Creature transferred to new owner | unchanged | unchanged | wake_at independent of owner |

**Why this works:**
- CDT `binary_extension<T>` wraps `std::optional<T>`.
- On serialization (new rows): if has value → packs 4 bytes. If empty → packs 0 bytes.
- On deserialization (old rows): if datastream has remaining bytes → reads as value. If datastream is at EOF → stays empty → `value_or(0)` returns 0.
- Table name stays `creatrsv2`. Struct gains 0 bytes for old rows, 4 bytes for new rows.
- RAM cost: +4 bytes per new creature (negligible — 0.000001 WAX at current rates).

> 🔴 **What NOT to do:** Insert `uint32_t wake_at` inline (between existing fields → shifts byte offsets → corrupts existing rows). Create a new table `creatrsv3` (unnecessary — `binary_extension` solves it). Use `eosio::ignore` or `[[eosio::ignore]]` (different mechanism, wrong use case).

### 1.6 Decision Points for CEO

| # | Question | Options |
|---|----------|---------|
| D1 | `awaken_dur` — เท่าไหร่ต่อ rarity? | 24h/48h/72h/5d/7d/10d (placeholder) |
| D2 | Awaken dur per-rarity หรือ flat ทุก rarity? | Per-rarity ✅ recommended |
| D3 | Evolve cost S1→S2 — 300 หรือ 600? | `evolve_cost × cur_stage` (=300) or `× (cur_stage+1)` (=600) |
| D4 | Auto-awaken ต้องเกิดตอน creature fed อยู่หรือเปล่า? | ไม่ต้อง — egg ฟักเองแม้ไม่ feed (newborn fed from birth anyway) |

---

## 2. Pay WAX ปลุกทันที — Skip Awaken Timer

### 2.1 Concern ระดับ 🔴

**นี่คือจุดที่ซับซ้อนและเสี่ยงที่สุดใน Economy v2.** การรับ WAX ใน smart contract ต้องระวังเรื่อง:
- ผู้เล่นส่ง WAX โดยไม่ได้ตั้งใจ → WAX ติดใน contract
- Memo parsing → front-end ต้อง format ถูก
- ไม่มีทาง refund อัตโนมัติจาก `on_notify`

### 2.2 Proposed Design: `on_notify("eosio.token::transfer")`

```
Pattern:    eosio.token::transfer(from, to, quantity, memo)
Filter:     to == get_self() && quantity.symbol == WAX
Memo:       "awaken:<asset_id>"  (ex: "awaken:1099603751834")
On match:   - find creature by asset_id
            - verify from == creature.owner
            - verify creature.stage == 0
            - verify now < wake_at (ยังไม่ถึงเวลาตื่น)
            - verify quantity.amount >= awaken_wax_cost(rarity)
            - advance stage to 1, update AA NFT
            - WAX stays in contract
On no match: silently return (do NOT assert — prevents WAX loss on typo)
```

### 2.3 Why `on_notify` ไม่ใช่ Separate Action

```
Option A: action awaken(owner, asset_id) → push eosio.token::transfer inline
  ❌ ไม่เวิร์ค: player auth คือ phgamecreatr::awaken → inline transfer ต้องใช้
     player@active บน eosio.token แต่ player ให้ auth เฉพาะ phgamecreatr
  ❌ ต่อให้ใช้ get_self()@active ก็จะดึง WAX จาก contract balance ไม่ใช่ player

Option B: on_notify("eosio.token::transfer") + memo
  ✅ Standard EOSIO/WAX pattern (ใช้ใน AtomicMarket, Alcor, ฯลฯ)
  ✅ Player sends WAX จาก wallet ตัวเอง → auth ถูกต้อง
  ✅ Contract ไม่ต้องกังวลเรื่องดึง token จาก player
  ⚠️ Memo parsing — ต้อง robust
  ⚠️ WAX stuck ถ้า memo ผิด — ต้องมี admin refund action
```

### 2.4 Schema Changes

#### `config_row` [hpp:129] — ADD WAX fields

```cpp
// ── WAX instant-awaken (Economy v2) ──
asset       awaken_wax_common    = asset(100000000, symbol("WAX", 8));    // 1.00000000 WAX
asset       awaken_wax_uncommon  = asset(300000000, symbol("WAX", 8));    // 3.00000000 WAX
asset       awaken_wax_rare      = asset(500000000, symbol("WAX", 8));    // 5.00000000 WAX
asset       awaken_wax_epic      = asset(1000000000, symbol("WAX", 8));   // 10.00000000 WAX
asset       awaken_wax_legendary = asset(2000000000, symbol("WAX", 8));   // 20.00000000 WAX
asset       awaken_wax_mythic    = asset(5000000000, symbol("WAX", 8));   // 50.00000000 WAX
```

**Placeholder prices** — รอ CEO. Scale: ×1/×3/×5/×10/×20/×50 × 1 WAX base.

> 💡 `asset` type ไม่ใช่ `uint64_t` — ทำให้ config เก็บ precision + symbol ได้. กันการส่งผิด token (ต้องตรง symbol("WAX",8)).

### 2.5 Code Changes

#### 2.5.1 New `on_notify` handler [cpp]

```cpp
[[eosio::on_notify("eosio.token::transfer")]]
void on_token_transfer(name from, name to, asset quantity, const std::string& memo) {
    // ── Guard: only process incoming transfers ──
    if (from == get_self() || to != get_self()) return;
    
    // ── Guard: WAX only ──
    if (quantity.symbol != symbol("WAX", 8)) return;  // silently ignore non-WAX
    
    // ── Parse memo ──
    if (memo.rfind("awaken:", 0) != 0) return;  // silently ignore non-awaken memos
    uint64_t asset_id = 0;
    try {
        asset_id = std::stoull(memo.substr(7));
    } catch (...) { return; }  // unparseable → silently ignore
    
    if (asset_id == 0) return;
    
    // ── Lookup creature ──
    config_row cfg = _cfg();
    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    if (c_it == crs.end()) return;
    if (c_it->owner != from) return;
    if (c_it->stage != 0) return;  // already awakened
    
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(c_it->template_id);
    if (sp_it == sps.end()) return;
    
    // ── Economy v2: check timer not yet elapsed ──
    uint32_t now = current_time_point().sec_since_epoch();
    uint32_t wake_dur = awaken_duration_for(cfg, sp_it->egg_type);
    uint32_t wake_at  = c_it->wake_at.value_or(0);
    if (wake_at == 0) wake_at = c_it->born_at + wake_dur;  // legacy fallback
    if (now >= wake_at) return;  // already naturally awakened — too late for WAX
    
    // ── Verify WAX amount ──
    asset required = awaken_wax_price_for(cfg, sp_it->egg_type);
    if (quantity < required) return;  // insufficient — silently ignore
    
    // ── EXCESS WAX? ──
    // ถ้าส่งเกินมา: เราเก็บไว้ทั้งหมด (ไม่ refund ส่วนเกิน). 
    // CEO may want to refund excess — เพิ่ม inline transfer back? → เสี่ยง recursive notify.
    // Decision: accept excess as "donation" — clearly documented in UI.
    
    // ── Advance stage ──
    crs.modify(c_it, same_payer, [&](auto& r) {
        r.stage    = 1;
        r.wake_at  = wake_at;
    });
    
    // ── Update AA NFT ──
    if (nft_exists(cfg.collection, from, asset_id)) {
        ATTR_MAP new_mut = {
            {"stage",  ATOM_ATTR((uint32_t)1)},
            {"growth", ATOM_ATTR(current_growth(*c_it, *sp_it, now))}
        };
        action(
            permission_level{get_self(), "active"_n},
            "atomicassets"_n,
            "setassetdata"_n,
            aa_setdata{get_self(), from, asset_id, new_mut}
        ).send();
    }
}
```

#### 2.5.2 New helpers [cpp]

```cpp
asset pockethatch::awaken_wax_price_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.awaken_wax_uncommon;
        case 2:  return cfg.awaken_wax_rare;
        case 3:  return cfg.awaken_wax_epic;
        case 4:  return cfg.awaken_wax_legendary;
        case 5:  return cfg.awaken_wax_mythic;
        default: return cfg.awaken_wax_common;
    }
}
```

#### 2.5.3 New admin action: `withdrawwax` [cpp]

```cpp
// Admin action — withdraw accumulated WAX to fee_account or designated recipient
[[eosio::action]] void withdrawwax(name to, asset quantity, const std::string& memo) {
    require_auth(get_self());
    check(quantity.symbol == symbol("WAX", 8), "WAX only");
    action(
        permission_level{get_self(), "active"_n},
        "eosio.token"_n,
        "transfer"_n,
        token_transfer{get_self(), to, quantity, memo}
    ).send();
}
```

#### 2.5.4 New admin action: `refundwax` [cpp]

```cpp
// Admin action — refund WAX when player sent wrong memo
[[eosio::action]] void refundwax(name to, asset quantity, const std::string& memo) {
    require_auth(get_self());
    // no symbol check here — admin discretion
    action(
        permission_level{get_self(), "active"_n},
        "eosio.token"_n,
        "transfer"_n,
        token_transfer{get_self(), to, quantity, memo}
    ).send();
}
```

### 2.6 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| WAX sent with wrong memo | 🔴 High | Silent return on bad memo. `refundwax` admin action for recovery. |
| WAX sent for already-awakened creature | 🟡 Medium | Guard `c_it->stage != 0` → silent return. |
| Front-end memo format mismatch | 🟡 Medium | Document memo format. Add `waxAwakenMemo(assetId)` to web contract. |
| WAX price change while player is sending | 🟢 Low | Price read from live config. `setconfig` changes take immediate effect. |
| Recursive notify loop (refund triggers on_notify) | 🔴 High | `if (from == get_self()) return;` at top of on_notify prevents loop. |

### 2.7 WAX Destination — 3 Options for CEO

WAX ที่ player จ่ายมาปลุก creature จะไปไหน? ต้องเลือก 1 ใน 3 ทาง:

| Option | Where WAX Goes | How to Get Out | Pros | Cons | Complexity |
|--------|---------------|----------------|------|------|:---:|
| **A: Treasury** 🏦 | contract balance | `withdrawwax` admin action → CEO account | ง่ายสุด. WAX สะสมเป็นรายได้โดยตรง. CEO withdraw เมื่อไหร่ก็ได้. | WAX ไม่หมุนเวียนกลับเข้าระบบเกม. ถ้าไม่อยาก "ขายของ" ชัดเจน ต้องอธิบาย narrative. | 🟢 Low |
| **B: Reward Pool** 🎁 | contract balance, earmarked for HATCH conversion | admin swaps WAX→HATCH via exchange, funds `rewardpool` | WAX กลับไปเป็น HATCH reward ให้ผู้เล่น → ระบบเกม sustain ตัวเอง. narrative "WAX ปลุก = สนับสนุน ecosystem". | ต้องมี manual step (swap WAX→HATCH off-chain/on DEX, then `fundpool`). ไม่ automated. ราคา HATCH/WAX ผันผวน. | 🟡 Medium |
| **C: Burn (Dead End)** 🔥 | contract balance, never withdrawn | ไม่มี (WAX อยู่ตลอดไป) | Deflationary — WAX หายออกจาก circulation ถาวร. narrative ชัด: "sacrifice to awaken". | WAX ไม่สร้างมูลค่าให้ใคร. เสียโอกาส revenue. ถ้า contract ถูก hack/deprecated WAX กู้คืนยาก. | 🟢 Low |

**Recommendation:** **Option A (Treasury)** — ง่ายสุด, ปลอดภัยสุด, CEO ควบคุม full custody. สามารถเปลี่ยนเป็น B ทีหลังได้ (WAX ที่สะสมไว้ → swap → fundpool) ถ้าอยากสร้าง reward loop. Option C ฟังดูเท่แต่เสีย WAX เปล่าๆ โดยไม่เกิดประโยชน์อะไร

**Implementation for all 3 options is identical in code** — WAX อยู่ที่ contract balance เหมือนกันหมด. ต่างกันแค่ intention และ admin action ที่ CEO จะเรียกภายหลัง. `withdrawwax` admin action รองรับทั้ง A, B, C.

### 2.8 Decision Points for CEO

| # | Question | Options |
|---|----------|---------|
| D5 | WAX price — เท่าไหร่ต่อ rarity? | Placeholder: 1/3/5/10/20/50 WAX |
| D6 | WAX destination? (see §2.7) | **A (Treasury)** ✅ recommended |
| D7 | ถ้าส่ง WAX เกิน — refund หรือ keep? | Keep as "donation" (ซับซ้อนน้อย). Document in UI. |
| D8 | ต้องการ `refundwax` action สำหรับกรณีฉุกเฉิน? | ✅ Yes — cheap insurance. |

---

## 3. Satiety Decay Rate per Rarity

### 3.1 Current State

Satiety formula in harvest (cpp:585-588):
```cpp
sat_ws = (fed_until - ws) * 10000 / fed_dur;   // satiety at window start
sat_we = (fed_until - we) * 10000 / fed_dur;   // satiety at window end
avg_sat = (sat_ws + sat_we) / 2;                // linear average
```

Decay is **purely linear** — satiety drops from 10000 (100%) to 0 over `fed_dur` seconds. The decay **rate** (% per second) = `100 / fed_dur` — same for all rarities. Higher rarity = longer `fed_dur` = slower **absolute** hunger (เพราะ 50% ของ 120h > 50% ของ 48h) แต่ **percentage** decay เท่ากัน.

### 3.2 What CEO Wants

> "satiety decay rate ต่อ rarity — rarity สูงหิวช้า"

Two possible interpretations:

**Interpretation A (Simple):** decay แบบ percentage ต่อวินาทีแตกต่างกันตาม rarity — Common decay เร็วกว่า Rare ในเชิง percentage.

**Interpretation B (Already Done):** fed_dur แตกต่างตาม rarity อยู่แล้ว → decay ในเชิง absolute ช้าลงสำหรับ rare อยู่แล้ว. ไม่ต้องทำอะไรเพิ่ม.

### 3.3 Recommendation: Interpretation A — Per-Rarity Decay Multiplier

ถ้า CEO ต้องการให้ percentage decay แตกต่างด้วย (นอกเหนือจาก fed_dur):

#### `config_row` — ADD `satiety_decay_bp` per rarity

```cpp
// ── Economy v2: satiety decay rate per rarity (basis points) ──
// 10000 = normal linear decay. <10000 = slower decay (gentler curve toward end).
// Formula: effective_dur = fed_dur × 10000 / decay_bp
//   decay_bp 5000  → effective_dur = fed_dur × 2   (decays half as fast)
//   decay_bp 20000 → effective_dur = fed_dur × 0.5 (decays twice as fast)
uint16_t    satiety_decay_common    = 10000;
uint16_t    satiety_decay_uncommon  = 8000;    // 20% slower
uint16_t    satiety_decay_rare      = 6500;    // 35% slower
uint16_t    satiety_decay_epic      = 5000;    // half speed
uint16_t    satiety_decay_legendary = 3500;    // 65% slower
uint16_t    satiety_decay_mythic    = 2000;    // 80% slower
```

#### Modified satiety formula [cpp:585-588]

```cpp
uint16_t decay_bp = satiety_decay_for(cfg, sp_it->egg_type);
// Scale fed_dur by decay multiplier
uint64_t effective_dur = (uint64_t)fed_dur * 10000ULL / (uint64_t)decay_bp;
uint64_t sat_ws = (uint64_t)(fed_until - ws) * 10000ULL / effective_dur;
uint64_t sat_we = (uint64_t)(fed_until - we) * 10000ULL / effective_dur;
// Clamp to [0, 10000]
if (sat_ws > 10000) sat_ws = 10000;
if (sat_we > 10000) sat_we = 10000;
uint64_t avg_sat = (sat_ws + sat_we) / 2;
```

**Effect:** decay_bp=5000 → effective_fed_dur = 2× longer → satiety drops half as fast. Over the SAME `fed_dur` window, a legendary creature's satiety drops 80% slower than common's. Combined with longer fed_dur → much gentler decay for rare creatures.

### 3.4 Decision Points for CEO

| # | Question | Options |
|---|----------|---------|
| D9 | ต้องการ per-rarity percentage decay หรือ fed_dur อย่างเดียวพอ? | Per-rarity decay ✅ recommended — เพิ่ม depth |
| D10 | ถ้าใช่ — decay_bp values? | Placeholder: 10000/8000/6500/5000/3500/2000 |

---

## 4. Recycle/Burn Pet → EGG Refund

### 4.1 Current State [cpp:852-925]

burncreature ALREADY refunds EGG:

```cpp
// [cpp:907-912]
uint64_t refund_pct;
if      (stage <= 1) refund_pct = 20;   // 20% of hatch_cost
else if (stage <= 3) refund_pct = 10;   // 10%
else                 refund_pct = 5;    // 5%
uint64_t refund = cfg.hatch_cost * refund_pct / 100;
```

Max refund: 150 × 20% = 30 EGG. ไม่คุ้มกับ evolve cost ที่จ่ายไป (300+600+...).

**ปัญหา:** refund แค่ % ของ hatch_cost — ไม่ได้นับ evolve cost ที่เสียไป. ยิ่ง stage สูง refund % ยิ่งน้อย — ตรงข้ามกับที่ CEO น่าจะต้องการ.

### 4.2 Proposed Design

เปลี่ยน formula: refund = **% ของ total EGG ที่ลงทุนใน creature นี้** (hatch + evolve ทั้งหมดที่ stage ปัจจุบัน)

```
total_spent(stage) = hatch_cost + Σ_{i=0}^{stage-1} evolve_cost × (i+1)
                     = 150 + evolve_cost × stage × (stage+1) / 2
```

ตัวอย่าง evolve_cost=300:
- Stage 0: total = 150 (hatch only)
- Stage 1: total = 150 + 300 = 450
- Stage 2: total = 150 + 300 + 600 = 1050
- Stage 3: total = 150 + 300 + 600 + 900 = 1950
- Stage 4: total = 150 + 300 + 600 + 900 + 1200 = 3150
- Stage 5: total = 150 + 300 + 600 + 900 + 1200 + 1500 = 4650

#### New formula:

```cpp
// Replace lines 907-922 in burncreature
uint64_t total_spent = cfg.hatch_cost;
if (stage > 0) {
    // Σ evolve_cost × (i) for i=1..stage
    total_spent += cfg.evolve_cost * (uint64_t)stage * (uint64_t)(stage + 1) / 2ULL;
}
uint64_t refund = total_spent * cfg.burn_egg_refund_bp / 10000ULL;
```

#### `config_row` — ADD one field

```cpp
uint16_t    burn_egg_refund_bp  = 5000;   // 50% of total EGG spent (basis points)
```

**Placeholder:** 50% = ได้คืนครึ่งหนึ่งของ EGG ที่ลงไป. **CEO ต้องกำหนด.**

### 4.3 Code Changes

**Why modify existing `burncreature` — NOT new action:**
- `burncreature` already burns NFT, pays HATCH, refunds EGG, erases creature row — เป็น single sink point สำหรับ recycle creature
- Adding a new `recycle` action creates confusion: 2 actions ที่ทำคล้ายกัน, player งงว่าอันไหนคืน EGG, เอกสารคู่มือเกมต้อง explain ทั้งสองอัน
- การแก้ formula ใน `burncreature` เดิม: 3 บรรทัดใหม่, zero risk, backward-compatible (player UX ไม่เปลี่ยน — กด burn แล้วได้ EGG มากขึ้นเฉยๆ)

Change: replace refund logic block in `burncreature()` [cpp:907-922]. No table migration. No new action. No ABI change beyond new config fields.

### 4.4 Comparison: Old vs New

| Stage | Hatch | Evolve Total | Total Spent | Old Refund | New Refund (50%) |
|-------|-------|-------------|-------------|------------|-----------------|
| 0 | 150 | — | 150 | 30 | **75** |
| 1 | 150 | 300 | 450 | 30 | **225** |
| 2 | 150 | 900 | 1,050 | 15 | **525** |
| 3 | 150 | 1,800 | 1,950 | 15 | **975** |
| 4 | 150 | 3,000 | 3,150 | 7.5 | **1,575** |
| 5 | 150 | 4,500 | 4,650 | 7.5 | **2,325** |

### 4.5 Decision Points for CEO

| # | Question | Options |
|---|----------|---------|
| D11 | Refund % of total_spent? | 50% (placeholder) |
| D12 | ต้อง scale ตาม rarity ด้วยไหม? | Current: no. Add `burn_egg_refund_bp_<rarity>`? Overkill — keep flat. |
| D13 | Refund เฉพาะ evolve ที่ stage ปัจจุบัน หรือนับว่า hatch/evolve สำเร็จทุก stage? | Count ALL EGG spent up to current stage ✅ |

---

## 5. Fix Double-Count — Flatten Species Yields

### 5.1 Current Bug (Sun's Finding, ECONOMY-AUDIT §3.1)

Species yields สำหรับ Uncommon/Rare มี rarity scaling ฝังไว้ซ้อนกับ earn_mult:

| Rarity | Species Yield | earn_mult | Compound | Should Be |
|--------|-------------|-----------|-----------|-----------|
| Common | **100** (flat) | ×1.00 | ×1.00 | ×1.00 ✅ |
| Uncommon | **110** (×1.10) | ×1.10 | ×1.21 | ×1.10 ⚠️ |
| Rare | **140** (×1.40) | ×1.40 | ×1.96 | ×1.40 ⚠️ |
| Epic+ | **100** (flat) | varies | correct | ✅ |

### 5.2 Fix

ผ่าน `setspecies` admin action (no setcode needed). 3 transactions:

| Template | Current Yields | New Yields | Action |
|----------|---------------|------------|--------|
| 662977 (Uncommon) | 110/330/660/1320/2640/5280 | **100/300/600/1200/2400/4800** | `setspecies` |
| 662978 (Rare) | 140/420/840/1680/3360/6720 | **100/300/600/1200/2400/4800** | `setspecies` |

> ⚠️ **Decision:** Common stage 5 yield = 4800, but Epic+ stage 5 yield = 3600. ควรให้เป็นค่าเดียวกันไหม?
> ถ้า flatten Uncommon/Rare → Common's 4800, Common outperforms Epic at stage 5 (4800×1.0 > 3600×1.8 = 6480? No — 4800 < 6480. OK, Epic still better.)
> 
> Common S5: 4800 × 1.00 = 4,800/hr
> Epic S5: 3600 × 1.80 = 6,480/hr  
> Legendary S5: 3600 × 2.40 = 8,640/hr
> Mythic S5: 3600 × 3.30 = 11,880/hr
>
> Looks correct — Epic+ still earn more due to earn_mult. CEO can decide later whether to unify all to the same flat yield.

### 5.3 Can Do Now

| Action | Ready? |
|--------|--------|
| Flatten 662977 yields | ✅ — `pushaction phgamecreatr setspecies '{...yields: 100/300/600/1200/2400/4800...}'` |
| Flatten 662978 yields | ✅ — same |

No contract change needed. No table migration. Pure admin action via `phgamecreatr@active`.

---

## 6. Can-Do-Now vs Needs-Design Summary

| # | Mechanism | Can Do Now? | Blocker | What To Do |
|---|-----------|:---:|---------|------------|
| 5 | **Fix double-count** (setspecies) | ✅ **YES** | ไม่มี | `pushaction phgamecreatr setspecies` สำหรับ 662977, 662978 — flatten yields → Common values. 2 tx, no setcode. |
| 1 | **Awaken timer** | ❌ | รอ D1-D4 | ต้อง setcode (binary_extension, try_awaken) + setconfig (awaken_dur_*) |
| 2 | **WAX instant awaken** | ❌ | รอ D5-D8 + D6 (WAX destination) | ต้อง setcode (on_notify handler, admin actions) + setconfig (awaken_wax_*) |
| 3 | **Satiety decay per rarity** | ❌ | รอ D9-D10 | ต้อง setcode (formula tweak) + setconfig (satiety_decay_bp_*) |
| 4 | **Burn EGG refund** | ❌ | รอ D11-D13 | ต้อง setcode (replace refund logic) + setconfig (burn_egg_refund_bp) |

**ความเห็น Kevin:** ข้อ 5 (double-count) ทำได้ทันที — แก้บั๊กจริงบนเชนโดยไม่ต้อง deploy code ใหม่. ข้อ 1-4 ต้องรอ Sun + CEO เคาะตัวเลขก่อนถึงเริ่มเขียน code ได้. ถ้าอยาก split deploy: ข้อ 1 (awaken) แก้ chicken-and-egg trap ได้ด้วยตัวเอง — deploy ได้เลยแม้ข้อ 2-4 ยังไม่พร้อม. ข้อ 2-4 ปรับแต่ง economy depth — deploy ทีหลังก็ได้.

---

## 7. Implementation Order & Dependencies

```
Phase 1: Fix double-count (no-code, immediate)
  ├─ setspecies 662977 → flat yields
  └─ setspecies 662978 → flat yields
  
Phase 2: Contract code changes (requires setcode+setabi+setconfig)
  ├─ Add fields to creature_row (wake_at)
  ├─ Add fields to config_row (awaken_dur_*, awaken_wax_*, satiety_decay_*, burn_egg_refund_bp)
  ├─ Implement auto-awaken (try_awaken + all action entry points)
  ├─ Implement on_notify("eosio.token::transfer") for WAX awaken
  ├─ Implement withdrawawx / refundwax admin actions
  ├─ Modify burncreature refund formula
  ├─ Modify satiety formula (decay multiplier)
  └─ Modify evolve cost formula (if decided)
  
Phase 3: Deploy
  ├─ Compile with CDT 4.1.1
  ├─ setcode + setabi (phgamecreatr@active)
  ├─ setconfig with ALL v2 fields (season=3 preserved)
  └─ Verify: harvest stage1 works, WAX awaken works, burn refund correct
```

### Deployment Note

⚠️ setcode overwrites contract WASM. All config, species, player, creature data stays (tables are independent of code). The new `creature_row` struct adds `eosio::binary_extension<uint32_t> wake_at` at the END — existing 89-byte rows remain valid because `binary_extension` detects EOF and stays empty. No migration script needed. New rows after deploy append 4 bytes for `wake_at`.

The only risk: if someone reads creature data DURING the deploy window (setcode→setconfig), `_cfg()` returns C++ defaults (season=0, wrong costs). Close the window by running setconfig immediately after setabi.

---

## 8. Design Decision Checklist (รอ CEO)

| # | Item | Status | Recommendation |
|---|------|--------|----------------|
| D1 | `awaken_dur` per rarity | 🔴 NEEDS DECISION | 24h/48h/72h/5d/7d/10d |
| D2 | Per-rarity or flat awaken? | 🔴 NEEDS DECISION | Per-rarity ✅ |
| D3 | Evolve cost S1→S2 | 🔴 NEEDS DECISION | `evolve_cost × cur_stage` |
| D4 | Awaken requires fed? | ✅ CLEAR | No — eggs awaken always |
| D5 | WAX awaken price per rarity | 🔴 NEEDS DECISION | 1/3/5/10/20/50 WAX |
| D6 | WAX destination? (see §2.7) | 🔴 NEEDS DECISION | A (Treasury) ✅ recommended |
| D7 | Excess WAX: refund or keep? | 🟡 NICE TO HAVE | Keep (simpler) |
| D8 | Admin `refundwax` action? | ✅ CLEAR | Yes |
| D9 | Per-rarity satiety decay? | 🟡 NICE TO HAVE | Yes — adds depth |
| D10 | `satiety_decay_bp` values | 🟡 NICE TO HAVE | 10000/8000/6500/5000/3500/2000 |
| D11 | Burn EGG refund % | 🔴 NEEDS DECISION | 50% (5000 bp) |
| D12 | Burn refund scale by rarity? | ✅ CLEAR | No — keep flat |
| D13 | Count all EGG spent? | ✅ CLEAR | Yes — hatch + all evolves |

---

## 9. Sun Coordination (docs/ECONOMY-V2.md)

**Status:** `docs/ECONOMY-V2.md` ยังไม่มี — ต้องสร้าง.

สิ่งที่ Sun ควรใส่:
- ตัวเลข final สำหรับทุก field ที่มี 🔴 NEEDS DECISION ข้างบน
- Simulation: ที่ค่าเหล่านี้ daily EGG income / burn breakeven / WAX sink rate
- Edge cases: player hatches 10 eggs → all awaken tomorrow → harvest spike

**Kevin's placeholder proposal for Sun to start from:**

```
awaken_dur:        24h / 48h / 72h / 120h / 168h / 240h
awaken_wax:        1 / 3 / 5 / 10 / 20 / 50 WAX
satiety_decay_bp:  10000 / 8000 / 6500 / 5000 / 3500 / 2000
burn_egg_refund_bp: 5000 (50%)
evolve_cost_formula: evolve_cost × cur_stage (stage 1→2 = 300, 2→3 = 600, ...)
```

---

*Implementation plan drafted 2026-07-15. Source references: `pockethatch.hpp:129-389`, `pockethatch.cpp:70-925`. No code was modified. รอ CEO review + Sun numbers.*
