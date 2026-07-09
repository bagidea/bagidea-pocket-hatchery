# Pocket Hatchery — REWORK-SPEC.md

> **ผู้เขียน:** Sun (tokenomics auditor) — แปลงผล audit → implementer-ready spec
> **ผู้รับ:** Kevin (contract owner)
> **สถานะ:** read-only spec — ห้ามแก้ .cpp/.hpp ใน spec นี้, ห้ามแตะ chain จริง
> **วัตถุประสงค์:** ทำให้ contract testnet-playable + ตรงกับ anti-ponzi spine ใน TOKENOMICS.md + CONTRACT-MODEL.md
> **อ้างอิง:** TOKENOMICS.md (Sun), CONTRACT-MODEL.md (Yamamoto), pockethatch.cpp/.hpp (Kevin, deployed)

---

## 🚨 Priority Legend

| Tag | ความหมาย |
|-----|----------|
| 🔴 **MUST-FIX** | ถ้าไม่แก้ = testnet เล่นไม่ได้ หรือ ponzi risk โดยตรง |
| 🟡 **SHOULD-FIX** | ไม่ block testnet แต่เศรษฐกิจบิดเบี้ยวถ้าขาด |
| 🟢 **DEFER** | v1 ใช้ placeholder ได้, ไม่กระทบ anti-ponzi |

---

## 🔴 R1 — Fix EGG vs HATCH cost types (DRIFT #1)

**ปัญหา:** `hatch_cost`, `evolve_cost`, `feed_cost` ถูกประกาศเป็น `asset(symbol("HATCH",4))` → ทุก action พื้นฐานเผา HATCH จริง = เกมกลายเป็น pay-to-play, EGG ไร้ความหมาย

**อ้างอิง:** TOKENOMICS §2 (row "ผู้เล่นเสีย"), §3.1 (feed-ratio), §3.3 (lump EGG sink); CONTRACT-MODEL §1.1 line 36, §2 action signatures

### (a) การแก้ source

#### R1.1 — `.hpp` config_row (line 101-105): เปลี่ยน type ของ cost พื้นฐาน

```cpp
// ❌ ปัจจุบัน (line 102-105)
asset       hatch_cost       = asset(10, symbol("HATCH", 4));
asset       evolve_cost      = asset(5,  symbol("HATCH", 4));
asset       breed_cost       = asset(50, symbol("HATCH", 4));
asset       feed_cost        = asset(0,  symbol("HATCH", 4));

// ✅ แก้เป็น
uint64_t    hatch_cost       = 150;     // EGG (TOKENOMICS §3.3)
uint64_t    evolve_cost      = 300;     // EGG base, คูณด้วย (stage+1) ใน action
uint64_t    slot_cost        = 500;     // EGG slot ที่ 4 (เพิ่ม field ใหม่, TOKENOMICS §3.3)
uint64_t    cosmetic_cost    = 100;     // EGG reroll (เพิ่ม field ใหม่, TOKENOMICS §3.3)

// 🐣 HATCH sinks — คงเป็น asset (ถูกต้องตาม TOKENOMICS §3.4)
asset       breed_cost       = asset(50000, symbol("HATCH", 4));  // 5.0000 HATCH
asset       premium_egg_cost = asset(100000, symbol("HATCH", 4)); // 10.0000 HATCH (เพิ่ม)
asset       listing_boost    = asset(10000, symbol("HATCH", 4)); // 1.0000 HATCH (เพิ่ม)
asset       name_cost        = asset(10000, symbol("HATCH", 4)); // 1.0000 HATCH (เพิ่ม)

// 🥚 feed_cost กลายเป็น 0 (free v1) — คงเป็น uint64_t หรือเติม feed_cost = 0 ก็ได้
// แต่ CONTRACT-MODEL §1.1 ระบุ feed_cost เป็น uint64 EGG ด้วย — สำหรับ v1 = 0
uint64_t    feed_cost        = 0;       // free in v1
```

**หมายเหตุ precision:** ปัจจุบันค่าตั้งต้น `.hpp` เป็นค่า **ในหน่วย smallest unit**:
- `asset(10, HATCH,4)` = 0.0010 HATCH (default) — แต่ live config = 1.0000 HATCH
- `asset(50000, HATCH,4)` = 5.0000 HATCH
- EGG `uint64` = หน่วยของ EGG โดยตรง (ไม่มีทศนิยม) — ค่า 150 = 150 EGG

#### R1.2 — `.hpp` config_row: เพิ่ม field ที่ CONTRACT-MODEL กำหนดแต่ยังไม่มี

```cpp
// เพิ่มใน config_row (ต่อจากบรรทัด 119)
uint32_t    offline_cap_h    = 8;        // มีแล้ว ✅
uint64_t    tap_egg_cap      = 60;       // มีแล้ว ✅
uint64_t    install_cap_bonus = 72;      // +72 = 312 total (CONTRACT-MODEL §1.1)
asset       bootstrap_daily_release = asset(0, symbol("HATCH", 4)); // (CONTRACT-MODEL §1.1)
uint16_t    royalty_bps      = 400;      // 4% (CONTRACT-MODEL §1.1)
uint16_t    buyback_share_bps = 200;     // 2% (CONTRACT-MODEL §1.1)
```

#### R1.3 — `.cpp` `hatch()` (line 210-270): แก้จาก burn_hatch → mutate egg_balance

```cpp
// ❌ ปัจจุบัน (line 223-224)
// ── Burn hatch_cost HATCH ──
burn_hatch(owner, cfg.hatch_cost, "hatch");

// ✅ แก้เป็น
// ── Deduct hatch_cost EGG from player ──
players_t ps(get_self(), get_self().value);
auto p_it = ps.find(owner.value);
check(p_it != ps.end(), "player not initialized");
check(p_it->egg_balance >= cfg.hatch_cost, "insufficient EGG to hatch");
ps.modify(p_it, same_payer, [&](auto& r) {
    r.egg_balance -= cfg.hatch_cost;
});
```

#### R1.4 — `.cpp` `evolve()` (line 326-382): แก้จาก burn_hatch → mutate egg_balance

```cpp
// ❌ ปัจจุบัน (line 357-359)
uint64_t cost_amount = cfg.evolve_cost.amount * (uint64_t)(cur_stage + 1);
burn_hatch(owner, asset(cost_amount, HATCH_SYM), "evolve");

// ✅ แก้เป็น
uint64_t cost_amount = cfg.evolve_cost * (uint64_t)(cur_stage + 1);
players_t ps(get_self(), get_self().value);
auto p_it = ps.find(owner.value);
check(p_it != ps.end(), "player not initialized");
check(p_it->egg_balance >= cost_amount, "insufficient EGG to evolve");
ps.modify(p_it, same_payer, [&](auto& r) {
    r.egg_balance -= cost_amount;
});
```

#### R1.5 — `.cpp` `feed()` (line 272-324): แก้จาก burn_hatch → mutate egg_balance

```cpp
// ❌ ปัจจุบัน (line 306)
burn_hatch(owner, cfg.feed_cost, "feed");

// ✅ แก้เป็น
if (cfg.feed_cost > 0) {
    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");
    check(p_it->egg_balance >= cfg.feed_cost, "insufficient EGG to feed");
    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance -= cfg.feed_cost;
    });
}
```

> **⚠ หมายเหตุ feed_cost scaling:** ปัจจุบัน feed_cost เป็นค่าคงที่ 0 (free v1). TOKENOMICS §3.1 ออกแบบ feed-ratio ที่เพิ่มตาม stage (30%→80% ของ production). การ implement feed scaling แบบ per-stage ต้องคำนวณ `feed_cost = species.yield_for(stage) × feed_ratio / 100` ตอน feed — **DEFER ไป phase ถัดไป**, v1 ใช้ free feed พอเล่นได้ก่อน

### (b) Acceptance test — R1

| # | สิ่งที่ตรวจบน chain | วิธีตรวจ | Expected |
|---|-------------------|---------|----------|
| AT-R1.1 | `hatch` ไม่ทำ HATCH transfer | ดู trace ของ tx hatch: ต้องไม่มี inline `hatchtokens1::transfer` | only `atomicassets::mintasset` + table row ops |
| AT-R1.2 | `players.egg_balance` ลดลงหลัง hatch | `cleos get table pockethatch pockethatch players -L <account>` ก่อน/หลัง hatch | diff = −hatch_cost (150) |
| AT-R1.3 | `evolve` ไม่ทำ HATCH transfer | ดู trace ของ tx evolve | only `atomicassets::setassetdata` + table ops |
| AT-R1.4 | `players.egg_balance` ลดลงหลัง evolve | get table ก่อน/หลัง evolve | diff = −evolve_cost×(stage+1) |
| AT-R1.5 | `breed` ยังคงทำ HATCH transfer + retire | ดู trace ของ tx breed | มี `hatchtokens1::transfer` + `hatchtokens1::retire` (40% burn) + `hatchtokens1::transfer` (60% → contract → pool) |
| AT-R1.6 | `egg_balance` ถูกใช้เป็น source of truth | grep `burn_hatch` ใน gameplay actions (ไม่นับ breed/accelerate/setname) | ต้องไม่เหลือ `burn_hatch` ใน `hatch`/`evolve`/`feed` |

### (c) Priority

🔴 **MUST-FIX** — ถ้าไม่แก้ = HATCH ถูกเผาทุก action พื้นฐาน → เกมเป็น pay-to-play → ผู้เล่นใหม่เข้าไม่ได้ → ponzi โดยโครงสร้าง (ผู้เล่นต้องซื้อ HATCH จากผู้เล่นเก่าเพื่อเล่น = เงินคนใหม่จ่ายให้คนเก่า)

---

## 🔴 R2 — Implement EGG sinks (DRIFT #2)

**ปัญหา:** `egg_balance` มีแต่ทางเข้า (`harvest`) ไม่มีทางออก → EGG สะสมพุ่งอย่างเดียว ไร้ sink ดูดกลับ → เฟ้อในเชิงเกมเพลย์ → ขัด TOKENOMICS §3 ที่ออกแบบ sink/faucet ratio ≥ 1.0

### (a) การแก้ source

#### R2.1 — Sink ใน `hatch` (R1.3 ทำแล้ว) ✅
→ `egg_balance -= hatch_cost` = 150 EGG (TOKENOMICS §3.3)

#### R2.2 — Sink ใน `evolve` (R1.4 ทำแล้ว) ✅
→ `egg_balance -= evolve_cost × (stage+1)`:
- Stage 0→1 (Hatchling→Juvenile): 300 EGG
- Stage 1→2 (Juvenile→Adult): 600 EGG
- Stage 2→3 (Adult→Evolved): 900 EGG
- Stage 3→4 (Evolved→Elder): 1200 EGG

> **⚠ calibrate:** TOKENOMICS §3.3 กำหนด evolve เป็น lump: 300 / 800 / 2000 — ถ้าตามนี้ค่าตั้งต้นต้องแก้เป็น `evolve_cost = 300` แล้วสูตร `× (stage+1)` ให้ผล 300/600/900/1200 ซึ่งต่ำกว่า spec. **ให้ Kevin calibrate สูตรหรือใช้ lookup table.** เป้าหมาย: evolve ต้องรู้สึกเป็น sink สำคัญที่ผู้เล่นต้องวางแผน

#### R2.3 — Sink ใน `feed` (R1.5 ทำแล้ว) ✅
→ v1 feed_cost = 0 (free). v2 เพิ่ม feed-ratio scaling ตาม TOKENOMICS §3.1

#### R2.4 — เพิ่ม action `unlockslot` (ใหม่)

**CONTRACT-MODEL §2 กำหนดไว้, TOKENOMICS §3.3 ระบุ cost แบบขั้นบันได**

```cpp
// .hpp — เพิ่มใน class declaration (หลัง burncreature, line 237)
[[eosio::action]] void unlockslot(name owner, uint8_t slot_index);

// .cpp — implementation
void pockethatch::unlockslot(name owner, uint8_t slot_index) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");

    // Cost staircase: slot 4=500, 5=1200, 6=2500, etc.
    // Simple v1: 500 × 2^(slot_index - 4), capped
    uint64_t slot_cost;
    if      (slot_index == 4) slot_cost = 500;
    else if (slot_index == 5) slot_cost = 1200;
    else if (slot_index == 6) slot_cost = 2500;
    else                      slot_cost = 2500 * (1ULL << (slot_index - 6)); // double each beyond

    check(slot_index >= 4 && slot_index <= 20, "invalid slot index");
    check(p_it->egg_balance >= slot_cost, "insufficient EGG to unlock slot");

    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance -= slot_cost;
    });

    // TODO v2: store unlocked slot count in players table
}
```

#### R2.5 — เพิ่ม action `equipcosmetic` (ใหม่)

```cpp
// .hpp
[[eosio::action]] void equipcosmetic(name owner, uint64_t asset_id, uint64_t cosmetic_tmpl);

// .cpp
void pockethatch::equipcosmetic(name owner, uint64_t asset_id, uint64_t cosmetic_tmpl) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    // Verify creature ownership
    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end() && c_it->owner == owner, "not your creature");

    // Deduct EGG
    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");
    check(p_it->egg_balance >= cfg.cosmetic_cost, "insufficient EGG for cosmetic");
    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance -= cfg.cosmetic_cost;
    });

    // Mirror cosmetic template to NFT mutable data
    ATTR_MAP new_mut = {
        {"stage",    ATOM_ATTR((uint32_t)c_it->stage)},
        {"growth",   ATOM_ATTR(c_it->growth_base + c_it->fed_growth)},
        {"cosmetic", ATOM_ATTR((uint64_t)cosmetic_tmpl)}
    };
    action(
        permission_level{get_self(), "active"_n},
        "atomicassets"_n,
        "setassetdata"_n,
        aa_setdata{get_self(), owner, asset_id, new_mut}
    ).send();
}
```

### (b) Acceptance test — R2

| # | สิ่งที่ตรวจ | วิธีตรวจ | Expected |
|---|-----------|---------|----------|
| AT-R2.1 | `egg_balance` มีทางลงจริง | วนทำ hatch → evolve → equipcosmetic → unlockslot แล้ว get table | balance ลดลงตามผลรวมของทุก sink |
| AT-R2.2 | EGG sink totals track ได้ | ดู `total_egg_farmed` vs `egg_balance` + sum(sinks) | ควร reconcile กัน (total_farmed = balance + Σ sinks + harvest in-flight) |
| AT-R2.3 | `unlockslot` cost staircase | ทดสอบ slot 4,5,6 | 500, 1200, 2500 EGG |
| AT-R2.4 | `equipcosmetic` waste EGG + เขียน NFT | ดู NFT mutable data หลัง equip | มี key "cosmetic" = template_id ที่ระบุ |

### (c) Priority

🔴 **MUST-FIX** (R1+R2 คู่กัน) — ถ้า EGG เข้าได้อย่างเดียวไม่มีทางออก → EGG เฟ้อไม่จำกัด → ถึงจะขายไม่ได้ (กฎ #2) แต่ทำให้ความก้าวหน้าในเกมพัง (ทุกคนมี EGG เป็นภูเขา = evolve/hatch ไม่รู้สึกว่ามี cost) → ทำลาย game loop

---

## 🔴 R3 — Bootstrap path (chicken-and-egg deadlock)

**ปัญหา:** ผู้เล่นคนแรกต้องจ่าย HATCH เพื่อ hatch → HATCH ต้องได้จาก claimreward → claimreward ต้องมี creature stage ≥ 2 → ต้อง hatch ก่อน → deadlock

**ราก:** `newseason` แค่ increment counter ไม่ปล่อย bootstrap HATCH. ไม่มี admin action ให้ seed pool. `claiminstallbonus` ไม่อยู่. `hatchtokens1` ยังไม่สร้างบน chain.

### (a) การแก้ source

#### R3.1 — `.hpp` `newseason` เปลี่ยน signature รับ bootstrap_release

```cpp
// ❌ ปัจจุบัน (line 245)
[[eosio::action]] void newseason();

// ✅ แก้เป็น
[[eosio::action]] void newseason(asset bootstrap_release);
```

#### R3.2 — `.cpp` `newseason` เพิ่ม bootstrap release logic

```cpp
// ✅ แทนที่ (line 708-716)
void pockethatch::newseason(asset bootstrap_release) {
    require_auth(get_self());
    check(bootstrap_release.symbol == HATCH_SYM, "must be HATCH");

    config_t ct(get_self(), get_self().value);
    auto cfg = ct.get_or_default();
    cfg.season_index += 1;
    cfg.season_started = current_time_point().sec_since_epoch();
    ct.set(cfg, get_self());

    // ── Bootstrap release: fund reward pool from contract's HATCH balance ──
    // Only if contract actually holds enough HATCH
    if (bootstrap_release.amount > 0) {
        // Verify contract has the HATCH (must be pre-funded via token issue + transfer)
        // The actual fund_pool just updates the singleton — trust that admin pre-funded
        fund_pool(bootstrap_release, "bootstrap S" + std::to_string(cfg.season_index));

        rewardpool_t pt(get_self(), get_self().value);
        auto pool = _pool();
        pool.bootstrap_released += (uint64_t)bootstrap_release.amount;
        pool.last_release = current_time_point().sec_since_epoch();
        pt.set(pool, get_self());
    }
}
```

#### R3.3 — เพิ่ม private helper `mint_creature` + refactor `hatch` + เพิ่ม `seasonfirsthatch`

**กลยุทธ์:** extract mint logic ออกจาก `hatch()` เป็น private helper `mint_creature()` — แล้ว `hatch()` และ `seasonfirsthatch()` เรียกใช้ร่วมกัน โดย `hatch` หัก EGG ก่อนเรียก, `seasonfirsthatch` ไม่หักอะไรเลย

**Step A — `.hpp` เพิ่ม helper declaration ใน `private:` section (หลัง line 269):**

```cpp
// .hpp — เพิ่มใน private section (ต่อจาก pick_template, resolve_new_asset)
uint64_t mint_creature(name owner, uint64_t template_id, const checksum256& genetics, uint32_t born_at);
```

**Step B — `.cpp` implementation ของ `mint_creature` (แยกจาก hatch เดิม):**

```cpp
// .cpp — เพิ่ม helper ใหม่ (ก่อน gameplay actions section)
uint64_t pockethatch::mint_creature(name owner, uint64_t template_id, const checksum256& genetics, uint32_t born_at) {
    config_row cfg = _cfg();

    // ── Inline mintasset via AtomicAssets ──
    ATTR_MAP immut = {
        {"genetics", ATOM_ATTR(attr_hex(genetics))}
    };
    ATTR_MAP mut = {
        {"stage",  ATOM_ATTR((uint32_t)0)},
        {"growth", ATOM_ATTR((uint64_t)0)}
    };

    action(
        permission_level{get_self(), "active"_n},
        "atomicassets"_n,
        "mintasset"_n,
        aa_mint{
            get_self(), cfg.collection, cfg.schema_name,
            (int32_t)template_id, owner,
            immut, mut, {}
        }
    ).send();

    // ── Resolve the actual asset_id from AtomicAssets ──
    uint64_t asset_id = resolve_new_asset(owner);

    // ── Write creatures row (owner pays RAM) ──
    creatures_t crs(get_self(), get_self().value);
    crs.emplace(owner, [&](auto& r) {
        r.asset_id    = asset_id;
        r.owner       = owner;
        r.template_id = template_id;
        r.stage       = 0;
        r.growth_base = 0;
        r.fed_growth  = 0;
        r.born_at     = born_at;
        r.last_sync   = born_at;
        r.last_fed    = 0;
        r.last_bred   = 0;
        r.genetics    = genetics;
    });

    return asset_id;
}
```

**Step C — refactor `hatch()` ให้เรียก `mint_creature` (แทนที่ lines 210-270):**

```cpp
void pockethatch::hatch(name owner, uint64_t egg_type) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");
    ensure_player(owner);

    // ── RNG: pick species template ──
    uint64_t template_id = pick_template(egg_type);
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(template_id);
    check(sp_it != sps.end(), "species not found");

    // ── Deduct EGG cost (R1 fix) ──
    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");
    check(p_it->egg_balance >= cfg.hatch_cost, "insufficient EGG to hatch");
    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance -= cfg.hatch_cost;
    });

    // ── Generate genetics ──
    uint64_t seed = make_seed();
    checksum256 genetics = make_genetics(seed);

    // ── Mint via shared helper (no HATCH burn) ──
    uint32_t now = current_time_point().sec_since_epoch();
    mint_creature(owner, template_id, genetics, now);
}
```

**Step D — `.cpp` `seasonfirsthatch` (action ใหม่, แบบเต็ม):**

```cpp
// .hpp
[[eosio::action]] void seasonfirsthatch(name owner, uint64_t egg_type);

// .cpp
void pockethatch::seasonfirsthatch(name owner, uint64_t egg_type) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");
    check(cfg.season_index > 0, "no active season");

    ensure_player(owner);

    // ── Gate: only players with zero creatures (first-hatch proxy) ──
    creatures_t crs(get_self(), get_self().value);
    auto idx = crs.get_index<"byowner"_n>();
    auto it = idx.lower_bound(owner.value);
    bool has_creature = (it != idx.end() && it->owner == owner);
    check(!has_creature, "already have a creature — use regular hatch");

    // ── RNG: pick species template ──
    uint64_t template_id = pick_template(egg_type);
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(template_id);
    check(sp_it != sps.end(), "species not found");

    // ── Generate genetics ──
    uint64_t seed = make_seed();
    checksum256 genetics = make_genetics(seed);

    // ── Mint via shared helper — ZERO cost (no EGG, no HATCH) ──
    uint32_t now = current_time_point().sec_since_epoch();
    mint_creature(owner, template_id, genetics, now);
}
```

> **⚠ v1 gate limitation:** `has_creature` proxy (0 creature = new player) กันการใช้ซ้ำแบบคร่าวๆ — ผู้เล่นสามารถ burn creature แล้วเรียกใหม่ได้. **v2:** เพิ่ม `players.first_hatch_season` (`uint16`) ให้ gate แม่นยำขึ้น — แต่สำหรับ testnet v1 การมีต้นทุน burn + mint ใหม่ (RAM, CPU) ก็กัน abuse ได้พอสมควรแล้ว

#### R3.4 — ขั้นตอน off-contract (admin ทำก่อนเปิด season 1)

```
1. สร้าง token contract hatchtokens1 (eosio.token clone)
   cleos push action eosio.token create '["pockethatch", "100000000.0000 HATCH"]' -p eosio.token

2. Issue 30M HATCH ให้ pockethatch (reward pool bootstrap)
   cleos push action hatchtokens1 issue '["pockethatch", "30000000.0000 HATCH", "reward pool bootstrap"]' -p pockethatch

3. เรียก newseason พร้อม bootstrap batch แรก
   cleos push action pockethatch newseason '["1500000.0000 HATCH"]' -p pockethatch
   → rewardpool.balance = 1,500,000.0000 HATCH
```

### (b) Acceptance test — R3

| # | สิ่งที่ตรวจ | วิธีตรวจ | Expected |
|---|-----------|---------|----------|
| AT-R3.1 | ผู้เล่นใหม่ hatch ได้โดยไม่ต้องมี HATCH | สร้าง account ใหม่ → `initplayer` → `seasonfirsthatch(0)` | ✅ ได้ creature asset_id กลับมา, `egg_balance` ไม่ลด, ไม่มี HATCH transfer |
| AT-R3.2 | หลังได้ creature → harvest → claimreward ได้ | รอให้ creature โตถึง Juvenile (stage≥2) ผ่าน evolve (ใช้ EGG) → `claimreward` | ได้ HATCH จาก pool |
| AT-R3.3 | `rewardpool.balance` มีค่า > 0 หลัง newseason | `cleos get table pockethatch pockethatch rewardpool` | balance = bootstrap_release (1.5M HATCH) |
| AT-R3.4 | `hatchtokens1` token balance ของ `pockethatch` ≥ rewardpool.balance | `cleos get currency balance hatchtokens1 pockethatch` | contract ถือ HATCH จริง ≥ pool ที่รับประกันไว้ |
| AT-R3.5 | ผู้เล่นที่ใช้ `seasonfirsthatch` แล้ว เรียกซ้ำไม่ได้ | เรียก `seasonfirsthatch` ครั้งที่ 2 | assert failed: "already have a creature" |

### (c) Priority

🔴 **MUST-FIX** — ถ้าไม่มี path ให้ผู้เล่นเริ่มได้ = testnet เล่นไม่ได้เลย = เกมตายตั้งแต่เกิด

---

## 🔴 R4 — withdraw safeguard hardening (กัน admin drain escrow)

**ปัญหา:** ปัจจุบัน `withdraw` ใช้ `check(pool.balance >= quantity)` — กัน drain ได้ระดับหนึ่ง แต่ถ้ามี HATCH ใน contract ที่ "ควรเป็นของ pool แต่ยังไม่ sync เข้า pool.balance" (เช่น breed pool-portion ที่ transfer แล้วแต่ fund_pool crash กลางทาง) — `pool.balance` อาจต่ำกว่ายอดจริงที่ contract ถืออยู่ ทำให้ admin withdraw เกิน escrow โดยไม่ตั้งใจ

**CONTRACT-MODEL §3.8** ออกแบบ `sweepableHatch()` = `contract eosio balance − rewardpool.balance − buybackpool.balance` — ปลอดภัยกว่าเพราะกันที่ "ยอดจริงในกระเป๋า"

### (a) การแก้ source

#### R4.1 — `.cpp` เพิ่ม helper `sweepableHatch()` (หรือ inline ใน withdraw)

**Primary path — อ่านตาราง `accounts` ของ token contract โดยตรง (standard CDT, ไม่พึ่ง API เสริม):**

```cpp
// .hpp — เพิ่ม struct สำหรับ token table read (ก่อน config_row หรือใน private section)
struct token_account_row {
    asset    balance;
    uint64_t primary_key() const { return balance.symbol.code().raw(); }
};
using token_accounts_t = eosio::multi_index<"accounts"_n, token_account_row>;

// .cpp — เพิ่ม helper (ก่อน withdraw)
asset pockethatch::sweepableHatch() const {
    config_row cfg = _cfg();
    auto pool = _pool();

    // Read actual HATCH balance directly from hatchtokens1::accounts table
    token_accounts_t accts(cfg.token_contract, get_self().value);
    auto it = accts.find(HATCH_SYM.code().raw());
    asset contract_balance = (it != accts.end()) ? it->balance : asset(0, HATCH_SYM);

    asset escrowed = pool.balance;  // rewardpool guarantee
    // v2 เมื่อมี buybackpool: escrowed += buybackpool.balance;

    if (contract_balance <= escrowed) return asset(0, HATCH_SYM);
    return asset(contract_balance.amount - escrowed.amount, HATCH_SYM);
}
```

> **📝 หมายเหตุ:** การใช้ `multi_index` อ่านตาราง `accounts` ของ `eosio.token` เป็น pattern มาตรฐานใน Antelope CDT — token contract ทุกตัว expose ตาราง `accounts` ด้วย struct `{asset balance;}` เหมือนกัน. ไม่ต้องใช้ `eosio::token::get_balance` ซึ่งไม่มีใน CDT. ถ้าต้องการ fallback แบบ defensive: `check(it != accts.end(), "token contract has no balance row");`

#### R4.2 — `.cpp` `withdraw()` เปลี่ยน guard

```cpp
// ❌ ปัจจุบัน (line 725-731)
if (token_contract == cfg.token_contract && quantity.symbol == HATCH_SYM) {
    check(pool.balance >= quantity, "withdraw exceeds reward pool balance");
    ...
}

// ✅ แก้เป็น
if (token_contract == cfg.token_contract && quantity.symbol == HATCH_SYM) {
    asset sweepable = sweepableHatch();
    check(sweepable >= quantity, "withdraw would drain escrow");
    // ⚠ ห้ามลด pool.balance ที่นี่ — pool.balance คือ escrow guarantee
    // ที่ claimreward ใช้ตรวจสอบ. withdraw เอาเฉพาะ surplus
    // (contract_balance − pool.balance) ซึ่งอยู่นอก guarantee อยู่แล้ว.
    // ลด pool.balance = ลด guarantee หลอกๆ → claimreward จ่ายไม่ออกทั้งที่
    // contract มีเงินจริง. sweepableHatch() คือ source of truth ของ surplus.
}
```

> **📐 Invariant หลัง withdraw:** `contract_actual_balance ≥ pool.balance` เสมอ (เพราะเราไม่ยอมให้ drain ต่ำกว่า pool). `sweepableHatch()` เป็น derived value ที่คำนวณใหม่ทุกครั้งจาก contract balance จริง — ไม่มีทาง drift เพราะไม่ใช้ cache. ถ้าอนาคตมี inflow เข้า contract โดยไม่ผ่าน fund_pool (เช่น airdrop โดยตรง), `sweepableHatch()` จะเห็น surplus เพิ่มเองโดยอัตโนมัติ

### (b) Acceptance test — R4

| # | สิ่งที่ตรวจ | วิธีตรวจ | Expected |
|---|-----------|---------|----------|
| AT-R4.1 | withdraw ได้เฉพาะ surplus | สมมติ contract มี 1,500,000 HATCH, pool.balance = 1,500,000 → `withdraw(1000 HATCH)` | ❌ failed: "would drain escrow" |
| AT-R4.2 | withdraw surplus สำเร็จ | contract มี 2,000,000 HATCH, pool.balance = 1,500,000 → `withdraw(500,000 HATCH)` | ✅ success: surplus = 500,000 |
| AT-R4.3 | withdraw token อื่นไม่ถูก block | `withdraw(eosio.token, 10 WAX, ...)` | ✅ success (ไม่เข้า HATCH guard) |

### (c) Priority

🔴 **MUST-FIX** — นี่คือ enforcement point ของกฎ #1 ในมุม admin: "ห้าม drain escrow". ถ้าไม่มี = ช่อง insider risk ที่ CEO กังวลที่สุด

> **v1 simplification (ถ้า table-read approach ซับซ้อนเกิน):** ใช้ `check(pool.balance >= quantity)` เดิมไปก่อน แต่ต้อง **เพิ่ม invariant check**: ทุก `withdraw` ของ HATCH ต้อง verify ว่า `contract_actual_balance - quantity >= pool.balance` หลังหัก — ผ่านการอ่าน token table (pattern เดียวกับ R5.2). DEFER `sweepableHatch()` เต็มรูปไป v2

---

## 🟡 R5 — Bootstrap funding path (ทำให้ pool มี HATCH จริง)

**ปัญหา:** ต่อให้ R3 แก้ deadlock แล้ว — `rewardpool.balance` ต้องมี HATCH จริงใน contract ถึงจะจ่าย `claimreward` ได้. แต่ contract ไม่มีทางรับ HATCH เข้านอกจาก `breed` (ซึ่งต้องมีคนเล่นก่อน → deadlock อีกรอบ)

**CONTRACT-MODEL §1.0:** `hatchtokens1` issuer = `pockethatch` → issue 30M HATCH → โอนเข้า `pockethatch` → `newseason` ปล่อยเข้า pool

### (a) วิธีแก้ (off-contract + on-contract)

ส่วนนี้ **ส่วนใหญ่เป็น off-contract admin flow** — ไม่ต้องแก้ code มาก:

#### R5.1 — `.cpp` `newseason` ต้อง sync `rewardpool.balance` กับ bootstrap release (ทำแล้วใน R3.2 ✅)

#### R5.2 — `.cpp` `fund_pool` ถูกเรียกจาก `newseason` + `breed` เท่านั้น — เพิ่ม direct admin path พร้อม balance guard

```cpp
// .hpp — เพิ่ม admin action
[[eosio::action]] void fundrewardpool(asset amount, const std::string& source);

// .cpp
void pockethatch::fundrewardpool(asset amount, const std::string& source) {
    require_auth(get_self());
    check(amount.symbol == HATCH_SYM, "must be HATCH");
    check(amount.amount > 0, "amount must be positive");

    // ── Guard: contract must actually hold enough HATCH to back this pool increase ──
    // อ่านยอดจริงจาก token contract accounts table
    config_row cfg = _cfg();
    token_accounts_t accts(cfg.token_contract, get_self().value);
    auto it = accts.find(HATCH_SYM.code().raw());
    asset contract_balance = (it != accts.end()) ? it->balance : asset(0, HATCH_SYM);

    auto pool = _pool();
    asset new_pool_balance = pool.balance + amount;
    check(contract_balance >= new_pool_balance,
        "contract does not hold enough HATCH to back pool increase — transfer HATCH to contract first");

    fund_pool(amount, source);
}
```

> **📐 เหตุผลที่ต้องมี guard:** `fund_pool()` inflate `rewardpool.balance` โดยไม่ตรวจว่ามีเงินจริง → ถ้า admin เรียก `fundrewardpool` ด้วยจำนวนที่เกินยอด HATCH ใน contract → `claimreward` จะ `check(payout ≤ pool.balance)` ผ่าน → แต่ `transfer(get_self(), owner, payout)` จะ fail เพราะ contract มีเงินไม่พอ = **จ่าย phantom reward**. guard นี้กัน invariant: `contract_balance ≥ pool.balance` ตั้งแต่ตอนเติม pool — ไม่ใช่แค่ตอน withdraw (R4)

#### R5.3 — Admin sequence (off-contract, ทำครั้งเดียวก่อนเปิด season 1)

```bash
# 1. Deploy token contract
cleos set contract hatchtokens1 /path/to/eosio.token -p hatchtokens1

# 2. Create HATCH token
cleos push action hatchtokens1 create '["pockethatch", "100000000.0000 HATCH"]' -p hatchtokens1

# 3. Issue 30M HATCH to pockethatch (bootstrap)
cleos push action hatchtokens1 issue '["pockethatch", "30000000.0000 HATCH", "genesis reward pool"]' -p pockethatch

# 4. Verify
cleos get currency balance hatchtokens1 pockethatch
# → 30,000,000.0000 HATCH

# 5. Start season 1 with first bootstrap tranche
cleos push action pockethatch newseason '["1500000.0000 HATCH"]' -p pockethatch

# 6. Verify pool
cleos get table pockethatch pockethatch rewardpool
# → balance: 1,500,000.0000 HATCH ✅
```

### (b) Acceptance test — R5

| # | สิ่งที่ตรวจ | วิธีตรวจ | Expected |
|---|-----------|---------|----------|
| AT-R5.1 | `hatchtokens1` token stats | `cleos get currency stats hatchtokens1 HATCH` | supply = 100,000,000.0000, issuer = pockethatch |
| AT-R5.2 | `pockethatch` ถือ HATCH จริง ≥ rewardpool.balance | เทียบ `cleos get currency balance hatchtokens1 pockethatch` กับ rewardpool table | contract_balance ≥ pool.balance เสมอ |
| AT-R5.3 | `claimreward` จ่าย HATCH ได้จริง | ผู้เล่นที่ผ่าน AT-R3.2 → เรียก claimreward → เช็ค token balance หลัง claim | ได้รับ HATCH จริง เพิ่มขึ้นตาม tier |

### (c) Priority

🟡 **SHOULD-FIX** — logic ใน contract มีแล้ว (fund_pool + newseason) ขาดแค่ admin sequence off-contract + `fundrewardpool` action. ถ้า R3 ทำแล้ว testnet เล่นได้ในทางเทคนิค แต่ `claimreward` จะจ่ายไม่ออกถ้า pool ไม่มีเงิน

---

## 🟡 R6 — Missing actions from CONTRACT-MODEL

**ปัญหา:** CONTRACT-MODEL §2 กำหนด actions ที่ไม่มีใน CPP: `settlebp`, `claiminstallbonus`, `doprebuyback`, `routebuyback`, `settlefeeshare`

### R6.1 — `settlebp` (tap bonus settlement)

**CONTRACT-MODEL §3.7:** client รายงาน `tap_accrued` → contract credit เข้า `egg_balance` capped ที่ `tap_egg_cap`/วัน

**สิ่งที่ต้องเพิ่มใน `.hpp`:**
```cpp
// players table — เพิ่ม fields (มีบางส่วนแล้ว, ต้องตรวจ)
uint64_t    tap_accrued;        // client-reported tap EGG pending settlement
uint32_t    tap_day;            // day-index for tap_paid_today reset
uint64_t    tap_paid_today;     // tap EGG credited today (capped)

// action
[[eosio::action]] void settlebp(name owner);
```

**Implementation:**
```cpp
void pockethatch::settlebp(name owner) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");

    uint32_t now = current_time_point().sec_since_epoch();
    auto p = *p_it;

    // Reset tap daily counter if new day
    uint32_t today = now / DAY_SEC;
    if (today != p.tap_day) {
        p.tap_paid_today = 0;
        p.tap_day = today;
    }

    // Credit: min(client-reported tap_accrued, remaining daily tap cap)
    uint64_t credit = std::min(p.tap_accrued, cfg.tap_egg_cap - p.tap_paid_today);

    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance      += credit;
        r.tap_paid_today   += credit;
        r.tap_accrued       = 0;  // consumed
        r.tap_day           = p.tap_day;
        r.total_egg_farmed += credit;
    });
}
```

**Priority:** 🟢 **DEFER** — tap bonus เป็น secondary source. idle harvest (240/วัน) เป็น source หลักอยู่แล้ว. testnet เล่นได้โดยไม่ต้องมี tap

### R6.2 — `claiminstallbonus` (install funnel gate)

**CONTRACT-MODEL §3.6:** ตรวจว่า player ถือ exclusive template → set `players.installed = true` → ปลด `install_cap_bonus` (+72 EGG cap)

**Priority:** 🟢 **DEFER** — funnel ต้องมี exclusive template minted ก่อน → ต้องมี plugin verification path → out of scope สำหรับ testnet-playable. testnet ใช้ web defaults (240 EGG cap) พอ

### R6.3 — `doprebuyback` / `routebuyback` / `settlefeeshare` (buyback & fee mechanism)

**Priority:** 🟢 **DEFER** — buyback/fee ใช้ตอนมี DEX + NFT market volume → ยังไม่มีใน testnet. season 1-2 พึ่ง bootstrap 100% ตาม TOKENOMICS §4.3

---

## 🔵 Summary Checklist for Kevin

| # | เรื่อง | Priority | แก้ที่ | AT |
|---|-------|----------|--------|-----|
| **R1** | เปลี่ยน hatch/evolve/feed cost type จาก HATCH asset → EGG uint64 | 🔴 MUST | `.hpp` config_row + `.cpp` hatch/evolve/feed | AT-R1.1–R1.6 |
| **R2** | เพิ่ม EGG sinks: hatch/evolve/feed mutate egg_balance ลง + เพิ่ม unlockslot/equipcosmetic actions | 🔴 MUST | `.cpp` hatch/evolve/feed + สร้าง unlockslot/equipcosmetic | AT-R2.1–R2.4 |
| **R3** | Bootstrap path: newseason รับ bootstrap_release + seasonfirsthatch ปลด deadlock | 🔴 MUST | `.hpp` newseason sig + `.cpp` newseason/seasonfirsthatch | AT-R3.1–R3.5 |
| **R4** | withdraw guard: sweepableHatch() หรืออย่างน้อยเทียบ contract balance | 🔴 MUST | `.cpp` withdraw + helper | AT-R4.1–R4.3 |
| **R5** | Bootstrap funding: fundrewardpool action + admin sequence off-contract | 🟡 SHOULD | `.cpp` fundrewardpool + ทำ off-contract steps | AT-R5.1–R5.3 |
| **R6.1** | settlebp (tap bonus) | 🟢 DEFER | `.hpp`/.cpp เพิ่ม action + player fields | — |
| **R6.2** | claiminstallbonus (install funnel) | 🟢 DEFER | out of v1 scope | — |
| **R6.3** | buyback/fee actions | 🟢 DEFER | ยังไม่มี DEX/NFT volume | — |

---

## 🛡️ Anti-Ponzi Verification Map (สำหรับตรวจหลัง Kevin แก้เสร็จ)

| กฎ | บังคับที่ไหน | ตรวจสอบอย่างไร |
|-----|------------|---------------|
| **#1** — HATCH ไม่ถูกพิมพ์เป็นรางวัล | `claimreward` check `payout ≤ pool.balance` + ไม่มี `issue` ใน gameplay | grep `issue` in .cpp (ต้องไม่พบนอก admin) + ดู trace claimreward (ต้องเป็น transfer จาก contract ไม่ใช่ issue) |
| **#1** — Admin drain escrow ไม่ได้ | `withdraw` guard `sweepableHatch()` | AT-R4.1–R4.3 |
| **#2** — EGG ขายไม่ได้ | `egg_balance` = uint64 off-token; ไม่มี action แปลง EGG→HATCH | grep ทุกที่ที่ egg_balance ถูกอ่าน — ต้องไม่มี path ส่งเข้า claimreward หรือ mint HATCH |
| **#3** — รายได้จาก fee จริง | fee actions defer → bootstrap ล้วนใน S1-S2 | ตรวจว่า `newseason` bootstrap ≤ 1.5M ตาม TOKENOMICS §4.3 |

---

## 📐 v1 Testnet-Playable Definition of Done

หลัง Kevin แก้ R1–R5 (4 MUST + 1 SHOULD) — testnet ต้องรองรับ flow นี้แบบ end-to-end:

```
1. Admin สร้าง hatchtokens1 → issue 30M HATCH → newseason(1.5M HATCH)
2. ผู้เล่นใหม่: initplayer → seasonfirsthatch(egg_type=0) → ได้ Egg NFT
3. รอเวลา / feed → sync growth → evolve (ใช้ EGG, ไม่ใช้ HATCH)
4. evolve จนถึง Juvenile (stage ≥ 2) → harvest (ได้ EGG เข้า egg_balance)
5. claimreward → ได้ HATCH จริงจาก pool
6. ใช้ HATCH ที่ได้มา → breed กับ creature ตัวอื่นที่ hatch ด้วย regular hatch (ใช้ EGG)
7. breed เผา HATCH 40% → เข้า pool 60% → pool มี inflow จาก gameplay แล้ว
```

**ทุกขั้นตอนต้องทำได้โดยผู้เล่นไม่ต้องถือ HATCH มาก่อน (ยกเว้น breed)** — bootstrap ต้อง self-contained ในระบบ

---

*"อย่ากลัวที่จะแก้ของที่พัง — จงกลัวที่จะปล่อยให้มันพังแล้วไม่มีใครกล้าบอก" — Sun ☀️*
