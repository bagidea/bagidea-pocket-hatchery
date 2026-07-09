# Pocket Hatchery `pockethatch1` — Live Research Report (WAX Testnet)

> วิจัยจริงบน WAX testnet · สรุปรวม 4 หัวข้อ · วันที่ 2026-07-04
> Researcher: Sahara

---

## 1. Contract Config & Reward Pool Economics

### แหล่งข้อมูล
- RPC: `https://wax-testnet.eosphere.io/v1/chain/get_table_rows`
- Tables: `configv2`, `rewardpool` @ `pockethatch1`

### ผลลัพธ์
| พารามิเตอร์ | ค่าบน chain | หมายเหตุ |
|---|---|---|
| Token contract | `hatchtokens1` | — |
| Collection | `pockethatch1` | AtomicAssets collection |
| Schema name | `creatures` | — |
| Fee account | `hatchfees1` | **ต่างจาก source code** ที่ระบุ `hatchtokens1` |
| Paused | `0` (เล่นได้) | — |
| Season | index `1`, เริ่ม `2025-06-28 16:29:34 UTC` | timestamp `1782764974` |
| RNG oracle | `testoracle11` | — |
| `hatch_cost` | `150` | หน่วยดิบ (ไม่มี symbol) |
| `evolve_cost` | `50` | **ต่างจาก source ที่เป็น 300** |
| `breed_cost` | `5.0000 HATCH` | — |
| `feed_cost` | `0` | ฟรี |
| `slot_cost` | `500` | หน่วยดิบ |
| `cosmetic_cost` | `100` | หน่วยดิบ |
| `name_cost` | `1.0000 HATCH` | — |
| `feed_cd` | `0` วิ | **ต่างจาก source ที่เป็น 3600** |
| `harvest_cd` | `0` วิ | **ต่างจาก source ที่เป็น 3600** |
| `breed_cd` | `86,400` วิ (24 ชม.) | ตรงกับ source |
| `feed_daily_cap` | `100` | **ต่างจาก source ที่เป็น 6** |
| `daily_egg_cap` | `240` | ตรงกับ source |
| `offline_cap_h` | `8` ชม. | ตรงกับ source |
| `tap_egg_cap` | `60` | ตรงกับ source |
| `install_cap_bonus` | `72` | ตรงกับ source |
| `feed_boost` | `1000` | **ต่างจาก source ที่เป็น 100** |

### Reward Pool
- **Current balance:** `1,500,000.0000 HATCH`
- **Lifetime funded:** `1,500,000.0000 HATCH`
- **Lifetime paid:** `0.0000 HATCH`
- **Bootstrap total:** `0.0000 HATCH`
- **Bootstrap released:** `15000000000` (raw integer)
- **Last release:** `2025-06-28 16:17:20 UTC`

### ข้อสังเกตสำคัญ
- ค่า config บน chain **ไม่ตรงกับ source code ใน repo** หลายจุด — โดยเฉพาะ `evolve_cost` ลดจาก 300 → 50, cooldown เป็น 0, feed_daily_cap เพิ่มเป็น 100, feed_boost เพิ่มเป็น 1000
- Reward pool มีเงินครบแต่ยังไม่มีการจ่ายออกเลย (lifetime paid = 0)

---

## 2. Species Registry & AtomicAssets Templates

### แหล่งข้อมูล
- RPC: `pockethatch1::speciescfg`
- AtomicAssets API: `https://test.wax.api.atomicassets.io/atomicassets/v1/...`

### ผลลัพธ์
- **จำนวน species ที่ config:** 1 ตัว
- **Template ID:** `662644`
- **Family:** `Fire`
- **Egg type:** `0` (common)
- **Egg weight:** `100`
- **Max stage:** `5`
- **Growth rate:** `1000` / วินาที
- **Thresholds:** Stage 1 = 1,000 | Stage 2 = 5,000 | Stage 3 = 20,000 | Stage 4 = 100,000
- **Yields (EGG/hr ×10^4):** Stage 0=100 | Stage 1=300 | Stage 2=600 | Stage 3=1,200 | Stage 4=2,400

### AtomicAssets Collection `pockethatch1`
- **Author:** `pockethatch1`
- **Market fee:** `0%`
- **Schema `creatures` fields:**
  - `genetics` — string
  - `stage` — uint32
  - `growth` — uint64
  - `name` — string
- **Templates:** 2 templates
  - `662644` — ตรงกับ speciescfg
  - `662645` — ยังไม่มี speciescfg row
- ทั้งสอง template มี `issued_supply: 0`, `max_supply: 0` (unlimited)

### ข้อสังเกตสำคัญ
- ยังมีแค่ species เดียวที่ config — อาจเป็น test data
- Schema ไม่มี field `cosmetic` ที่ source code `equipcosmetic()` พยายามจะ set ไว้

---

## 3. On-Chain Player & Creature Activity

### แหล่งข้อมูล
- RPC: `pockethatch1::creatures`, `pockethatch1::players`
- Hyperion v2: `https://test.wax.eosusa.io/v2/history/get_actions?account=pockethatch1`

### ผลลัพธ์
- **Creatures table:** ว่างเปล่า (0 rows)
- **Players table:** 2 accounts
  - `officewax123` — สร้าง `2026-06-29 20:40:34 UTC`, EGG = 200
  - `waxwingsuper` — สร้าง `2026-06-29 19:51:20 UTC`, EGG = 0
- **Action traces ทั้งหมด:** 84 รายการ
- **ประเภท action:**
  - `setconfig` 13 ครั้ง
  - `setabi` 13 ครั้ง
  - `setcode` 11 ครั้ง
  - `initplayer` 8 ครั้ง
  - `clearconfig` 8 ครั้ง
  - `newseason` 6 ครั้ง
  - `setspecies` 6 ครั้ง
  - `clearpool` 4 ครั้ง
  - `setpaused` 3 ครั้ง
  - `createtempl`, `transfer` อย่างละ 2 ครั้ง
  - อื่นๆ รวม deploy/setup actions

### ข้อสังเกตสำคัญ
- **ไม่มี gameplay action** `hatch`, `feed`, `evolve`, `breed`, `claimreward` เลย (นอกจาก `harvest` 1 ครั้ง)
- ทั้งหมดเป็นการ deploy + configure contract
- Creatures table ว่าง → ยังไม่มี creature เกิดบน testnet จริง

---

## 4. HATCH Token Economics & Contract Balances

### แหล่งข้อมูล
- RPC: `hatchtokens1::accounts`, `hatchtokens1::stat`
- Hyperion v2: HATCH transfers

### ผลลัพธ์
- **Token contract:** `hatchtokens1`
- **Symbol / precision:** `HATCH`, 4 ทศนิยม
- **Current supply:** `40,000,000.0000 HATCH`
- **Max supply:** `1,000,000,000.0000 HATCH`
- **Issuer:** `waxwingsuper`

### ยอด HATCH สำคัญ
| Account | Balance |
|---|---|
| `pockethatch1` | `30,000,001.0000 HATCH` |
| `waxwingsuper` | `9,990,039.0000 HATCH` |
| `phgamecreatr` | `9,960.0000 HATCH` |

### HATCH flows ที่เกี่ยวข้อง `pockethatch1`
- `2026-06-29 19:54` — `waxwingsuper` → `pockethatch1` `1.0000 HATCH` (memo: `direct-sign-test`)
- `2026-06-29 20:10` — `waxwingsuper` → `pockethatch1` `30,000,000.0000 HATCH` (memo: `reward pool`)
- **Total inflow = 30,000,001.0000 HATCH** → ตรงกับ balance ปัจจุบัน
- **Outflows:** ไม่มี

### ข้อสังเกตสำคัญ
- `pockethatch1` ถือ HATCH อยู่ 30M แต่ rewardpool table บันทึก balance แค่ 1.5M
- นี่หมายความว่า **มี HATCH 30M ใน contract account แต่ระบบ reward pool รับรู้แค่ 1.5M** — อีก 28.5M อยู่นอก pool invariant หรืออาจเป็น bootstrap/release accounting ที่ยังไม่ได้ set ให้ pool รับรู้
- ไม่มี breeding/feed payments เข้ามา (ตรงกับข้อ 3 ที่ไม่มี gameplay)

---

## Executive Summary

1. **Contract พร้อมใช้งาน** (paused=0, season เริ่มแล้ว) แต่ **ยังไม่มี gameplay จริง** — มีแค่ deploy + initplayer
2. **Config บน chain ต่างจาก source code** หลายจุดสำคัญ → ต้อง sync source กับ deployed config ก่อน release
3. **Reward pool มีเงิน 1.5M HATCH** แต่ contract account ถือ 30M HATCH → อาจมี accounting mismatch
4. **มีแค่ 1 species** บน testnet (Fire family, template 662644) — อาจพอสำหรับทดสอบแต่ไม่พอสำหรับ production

---

*Report generated by Sahara, 2026-07-04*
