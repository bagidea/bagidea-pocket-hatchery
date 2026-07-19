# Runbook — deploy `slotcfg` (slot-cost staircase + cosmetic unequip + anti-cheat)

**Date:** 2026-07-20 · **Target:** `phgamecreatr` (wax-testnet) · **Status:** ✅ **ยิงแล้ว — ยืนยันบนเชน**

| | |
|---|---|
| code_hash บนเชน | `ee7a150f91f0a1a463c836999d5cd889b71402d953910803a0f9b2203d5105f2` |
| setpaused(true) | `b499b0a7cdbc4bbe79fa073ef7c9f088536f73c8a088538967245fad3e58b190` |
| setcode | `c6cfee2111884510d839675bb3eb5578ffa801930d4ee5645251bb6dd127eb32` |
| setabi | `4fcc2e762039c6d792890e16911c567a90b25a4857df2ced21f61bc5840a6a5f` |
| setconfig (paused=false) | `97a8fae878607331eee71ca9bb272a1e89a255e53b4876e01b556f3a3ce68531` |

> ยิงเป็น 4 tx ไม่ใช่ 1 — waxwing `pushaction` ส่งได้ทีละ action และ path ที่ยิงหลาย
> action พร้อมกันต้องใช้รหัสผ่าน wallet ซึ่งไม่ควรวิ่งผ่าน shell/แชท จึงปิดช่องว่าง
> ด้วยการ **pause ก่อน** แล้วปลดตอน setconfig — ระหว่างทางไม่มีใครยิง action ได้เลย
> (ทุก player action เช็ค `!cfg.paused`) fail แล้วเกมค้างสถานะ paused = ปลอดภัย

---

## สิ่งที่เปลี่ยนในซอร์ส

| # | จุด | สรุป |
|---|---|---|
| a | `config_row` | ถอด `name_cost` ออก (CEO ล็อก: rename ฟรี — ไม่มีโค้ดไหนอ่านมันอยู่แล้ว) |
| b | `unlockslot` | อ่าน `slot_cost` / `slot_cost_5` / `slot_cost_6` จาก config + ย้าย range-check ขึ้นก่อน shift (แก้ UB เดิม) |
| c | `equipcosmetic` | `cosmetic_tmpl == 0` → `aa_erase_attr` (ถอดของตกแต่ง) แทนที่จะเขียนค่า `"0"` |

## Layout: วางทับที่เดิมของ `name_cost` (ไม่เลื่อนทั้งแถว)

`name_cost` เป็น `asset` = **16 B** พอดีกับ `uint64 × 2` เลยวาง `slot_cost_5` +
`slot_cost_6` **ตรงตำแหน่งเดิมของมัน** (หลัง `cosmetic_cost`) ทุกฟิลด์ตั้งแต่
`install_cap_bonus` ลงไปจึง offset เท่าเดิมทั้งหมด

พิสูจน์แล้ว (encode แถวจริงจากเชนด้วย ABI เก่า → decode ด้วย ABI ใหม่, 412 B เท่ากัน):

```
old row read with new struct — differences:
  slot_cost_5 = 10000              (= amount ของ name_cost)
  slot_cost_6 = 79454013573124     (= symbol raw ของ 4,HATCH)
  ...ฟิลด์อื่นอีก 62 ตัว ตรงหมด
```

→ ช่วงหลัง `setcode` ก่อน `setconfig` **`equipcosmetic` ยังทำงานปกติ**
(`cosmetic_cost` = 100 ไม่ขยับ) เสียแค่ `unlockslot` ช่องที่ 5/6 ที่จะ
**คิดแพงเกิน** (10000 EGG / ค่ามหาศาล) — เป็นทางที่ปลอดภัย ไม่ใช่ทางที่โดนขูด
และถ้ายิง 3 action ในทรานแซคชันเดียว ช่องว่างนี้เท่ากับศูนย์

> รายงานรอบก่อนเขียนว่า "cosmetic_cost จะกลายเป็น 1200" — **ผิด** และ
> "เลี่ยงไม่ได้" ก็ **ไม่จริง** แก้ตามข้างบนแล้ว

## Artifacts

| ไฟล์ | ขนาด | sha256 |
|---|---|---|
| `contract/pockethatch/build/pockethatch.slotcfg.wasm` | 162,692 B | `ee7a150f91f0a1a463c836999d5cd889b71402d953910803a0f9b2203d5105f2` |
| `contract/pockethatch/build/pockethatch.slotcfg.deploy.abi` | 18,438 B (→ 3,917 B binary) | live ABI สลับเฉพาะ `config_row` |
| `deploy/args-setconfig-phgamecreatr.json` | 64 ฟิลด์ | gen จากแถว `configv3` จริงบนเชน |

ตรวจว่า artifact บนดิสก์ยังตรงกับที่อยู่บนเชน (ดึง wasm จริงมาเทียบไบต์):

```sh
cd contract/pockethatch && node build/verify-onchain-wasm.cjs
# → local/chain 162,692 B  ee7a150f…  ✅ byte-identical
```

⚠️ ซอร์สที่ HEAD **ใหม่กว่า** ของบนเชนแล้ว — commit `17cebf8` ย้ายกฎ anti-cheat ไป
`ph_rules.hpp` (+ กัน uint32 wrap ใน `is_sated`) build ได้ `ae75ce30…` / 162,761 B เก็บไว้
เป็น `build/pockethatch.rules.wasm` **ยังไม่ deploy** — build ของ slotcfg ต้อง checkout
`1eaad85` ถึงจะได้ `ee7a150f…` (ยืนยันแล้ว: build ซ้ำใน worktree สะอาด = byte-identical)

⚠️ hash เดิมที่เคยรายงานไว้ (`f5aaa759…`) **ใช้ไม่ได้** — เป็นไฟล์ค้างจากบิลด์ก่อนหน้า
(layout เก่า) เพราะ `cdt-cpp` ที่ `-o` ชื่อไม่ตรง contract class จะ error ที่ abigen
แล้ว **ไม่เขียนไฟล์ทับ** ต้องใส่ `-contract=pockethatch` เสมอ — ดู `build/BUILD.md`

Build command (WSL, CDT 4.1.1) — ลบไฟล์เก่าทิ้งก่อนแล้ว build ใหม่ ได้ hash เดิมซ้ำ 3 รอบ:

```bash
cd contract/pockethatch
/home/bagidea/cdt/bin/cdt-cpp \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core \
  -I . -contract=pockethatch \
  -o build/pockethatch.slotcfg.wasm pockethatch.cpp --abigen
```

Test: `g++ -std=c++17 -I . -o /tmp/t test/test_mutdata.cpp && /tmp/t` → **21/21 ผ่าน**

## RAM

| | bytes |
|---|---|
| quota | 2,145,585 |
| usage | 1,632,365 |
| **ว่าง** | **513,220** |
| ต้องใช้ (wasm × 2 + abi × 2 + slack 40 KB) | 374,178 |
| **เหลือกันชน** | **+139,042** |

ก่อนหน้านี้ว่าง 363,220 → กันชนติดลบ 37,312 เมื่อรวม ABI ด้วย
ซื้อเพิ่ม 150,000 B แล้ว — tx `35d049ff9a92c0490f4b2459702209644687308f6e3c0538a1a56e8b2ab099c7`
(−8.21 WAX, เหลือ 28.09 WAX)

## ลำดับยิง (ที่ใช้จริง)

```
0. phgamecreatr::setpaused true   ← ปิดเกมกันช่องว่างระหว่างขั้น
1. eosio::setcode  phgamecreatr  ← build/pockethatch.slotcfg.wasm
2. eosio::setabi   phgamecreatr  ← build/pockethatch.slotcfg.deploy.abi
3. phgamecreatr::setconfig       ← deploy/args-setconfig-phgamecreatr.json (paused=false → เปิดเกมคืน)
```

- **ไม่ต้อง `clearconfig`** — แถวขนาดเท่าเดิม (412 B) และ `setconfig` เขียนทับทั้งแถว
- ตารางอื่น (`players` / `creatrsv2` / `claims` / `spccfgv2` / `lastmint` / `rewardpool`) ไม่กระทบ
- `setconfig` ตั้ง `paused=false` = คืนสถานะเดิมของเกมในขั้นสุดท้าย

Verify หลังยิง:
```bash
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_code \
  -d '{"account_name":"phgamecreatr","code_as_wasm":1}'   # code_hash = ee7a150f…
curl -s -X POST https://testnet.waxsweden.org/v1/chain/get_table_rows \
  -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"configv3","limit":1}'
# → slot_cost 500 / cosmetic_cost 100 / slot_cost_5 1200 / slot_cost_6 2500, ไม่มี name_cost
```

---

## Anti-cheat hardening (Rose audit 23/23 → 3 ช่องโหว่จริง)

| # | จุด | แก้ว่าอะไร |
|---|---|---|
| 1 | `equipcosmetic` | whitelist: template ต้องมีจริงใน `atomicassets::templates` scope = `cfg.collection` **และ** อยู่ใน schema คอสตูม · `cosmetic_tmpl == 0` = ถอด ผ่านได้เสมอ ไม่เช็ค whitelist ไม่คิด EGG |
| 2 | `burncreature` | fail-closed: คิดยอด payout แล้ว `check(pool.balance >= payout)` **ก่อน** burnasset — ของเดิมเบิร์นก่อนแล้วค่อย `if (pool >= payout)` = pool แห้งเมื่อไหร่ผู้เล่นเสีย NFT ฟรี |
| 3 | `accelerate` | เพิ่ม satiety gate ชุดเดียวกับ `evolve` — เดิมจ่าย HATCH ลัดข้ามระบบความอิ่มได้ |

⚠️ **ชื่อ schema คอสตูมถูก hardcode เป็น `"cosmetics"_n`** (`#define COSMETIC_SCHEMA`)
ไม่ได้ใส่เป็นฟิลด์ใน `config_row` เพราะจะทำให้แถวยาวขึ้น (412 → 420 B) แล้วต้อง
`clearconfig` ก่อน `setconfig` ทุกครั้ง — ไม่คุ้มเสี่ยงกับ layout ที่เพิ่งพิสูจน์ทีละฟิลด์
**ตอนนี้คอลเลกชันยังไม่มี schema ชื่อ `cosmetics`** (มีแค่ `creatures` / `creaturesv2`)
→ `equipcosmetic` ที่ tmpl ≠ 0 จะ revert ทุกกรณี = fail-closed จนกว่าจะสร้าง schema +
template คอสตูมจริง (UI ยังไม่เรียก action นี้ที่ไหน จึงไม่กระทบผู้เล่น)

## พิสูจน์หลังยิง

### A) positive

| เคส | tx | ผล |
|---|---|---|
| `equipcosmetic` tmpl 0 (ถอด, ฟรี) | `b0ff54eae5e93f7827d127301b248d9ac2d5fdd5c3627650b969de0b7fdfece5` | key `cosmetic` หายจริง เหลือ `{name:"Ember Queen", stage:1, growth:811856500}` · EGG 60 → **60** (ไม่คิดเงิน) |
| `setname` → "Poppy QA" | `8d111bf434991e33f2753a2591c7e8ddff4be45c06ad640adcb535b572e5f38e` | `{name:"Poppy QA", stage:1, growth:811856500}` — stage/growth ไม่หาย |
| `feed` | `0057f371fc538192565d87a6f66e7d9ebe004f5334e109ccb2ff6acdf604fb19` | อิ่มแล้ว |
| `evolve` #1 | `a73771af42079744c27474354ef97ace67b996fbe3737271dea1de08166487ae` | stage 1 → 2 |
| `setname` → "Rose Audit" | `94e19322f7d5090774a683d430d095b5e4283755c5e2219c12068392ce1f814a` | ตั้งชื่อทับ |
| `evolve` #2 | `ad7012264908ff67f34f66c3ce235333847371cc3a5914a6f9f8f227711a264a` | **`{name:"Rose Audit", stage:3, growth:718028200}`** — ชื่อรอด evolve |
| `accelerate` บนตัวที่อิ่ม | `826fcf688b682ccbe5047773cc17e4579bfcd50235bae466224beb0369b9c1ba` | ผ่านตามปกติ |

`configv3` หลังยิง: `paused=0 · slot_cost=500 · cosmetic_cost=100 · slot_cost_5=1200 · slot_cost_6=2500 · ไม่มี name_cost · 64 ฟิลด์`

### B) negative — ยิงจากบัญชีผู้เล่นธรรมดา `officewax123` ทุกเคสต้อง revert

| เคส | ผล |
|---|---|
| `setconfig` | ✅ `missing authority of phgamecreatr` |
| `setspecies` | ✅ `missing authority of phgamecreatr` |
| `fundpool` | ✅ `missing authority of phgamecreatr` |
| `withdraw` | ✅ `missing authority of phgamecreatr` |
| `equipcosmetic` tmpl `999999999` | ✅ `assertion failure with message: cosmetic template not found in collection` |
| `equipcosmetic` tmpl `662889` (มีจริง แต่ schema `creatures`) | ✅ `assertion failure with message: template is not a cosmetic` |
| `feed` บน asset ของคนอื่น | ✅ `assertion failure with message: not your creature` |
| `evolve` บน asset ของคนอื่น | ✅ `assertion failure with message: not your creature` |
| `accelerate` บนตัวที่หิว | ✅ `assertion failure with message: creature is hungry — feed before accelerating` |

9/9 revert — ไม่มีเคสไหนหลุด
