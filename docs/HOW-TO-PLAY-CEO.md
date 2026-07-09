# 🥚 Pocket Hatchery — วิธีเล่น (สำหรับ CEO)

> ยืนยันสด 2026-07-09 บน **panel จริง** (plugin `pocket-hatchery` v0.2.2 ที่ deploy อยู่)
> บัญชี `waxwingsuper` · WAX **Testnet** · contract `phgamecreatr`
> ทุก action ผ่านการเดินจริง + แคปหน้าจอ (harness: `web/scripts/playflow-panel.mjs` → **ALL CHECKS PASSED**)

หลักการปลอดภัย: ทุกปุ่มในเกม **ไม่ยิงเข้าเชนทันที** — มันเปิด "ใบเซ็น" (amber Sign sheet)
ให้ดูก่อนว่าจะส่ง action/บัญชี/contract/data อะไร แล้วค่อยกด **🔏 Sign** ถึงจะ broadcast จริง
กด **Cancel** ได้ตลอด ไม่มีอะไรขึ้นเชน

---

## ขั้นที่ 0 — เปิด plugin
เปิด 🥚 **Pocket Hatchery** จากออฟฟิศ → เจอหน้า Landing มีปุ่มเชื่อมกระเป๋า 2 ทาง:
- **Connect (WAX Cloud Wallet)** — เชื่อมด้วยกระเป๋าเว็บ WCW
- **Connect via waxwing** — เชื่อมด้วยกระเป๋า waxwing ในออฟฟิศ (ที่เราใช้ทดสอบ)

📸 `web/screenshots/playflow/01-landing.png`

## ขั้นที่ 1 — เชื่อมกระเป๋า → เข้า Dashboard
กด **Connect via waxwing** → เข้าหน้าเกม เห็นสถานะจริงจากเชน:
- แถบบน: 🥚 **EGG 96,740** · ⚡ **ENERGY 98** · 💎 **$HATCH 9,990,202**
- การ์ดสัตว์ **22 ตัว** (art วาดจากยีนจริงของแต่ละตัว — Fluffle/Buzzle/Foxling/Sproutling/Wisp/Flicker/Dracling/Owlet ฯลฯ)

📸 `web/screenshots/playflow/02-dashboard.png`

> **ถ้าเป็นบัญชีใหม่ (ยังไม่เคยเล่น):** ระบบจะให้ทำ **initplayer** ก่อน (สร้างโปรไฟล์ผู้เล่นบนเชน)
> ครั้งแรกที่ฟักจะเป็น **firsthatch**. บัญชี `waxwingsuper` ทำ initplayer ไปแล้ว จึงเข้า dashboard ตรงเลย

## ขั้นที่ 2 — ฟักไข่ (Hatch)
กดปุ่มส้ม **🥚 Hatch Egg (150 EGG)** ตรงกลางบน → ใบเซ็นเด้ง:

| ช่อง | ค่า |
|---|---|
| Game action | **Hatch** |
| Action | `hatch` |
| Account | `waxwingsuper` |
| Contract | `phgamecreatr` |
| Data | `{"owner":"waxwingsuper","egg_type":0}` |
| Network | WAX Testnet · testnet |

กด **🔏 Sign** เพื่อฟักจริง (ใช้ 150 EGG) → ได้สัตว์ตัวใหม่เป็น NFT เพิ่มในคอลเลกชัน

📸 `web/screenshots/playflow/03-hatch-sign.png`

## ขั้นที่ 3 — ให้อาหาร (Feed)
ในการ์ดแต่ละตัวมีมิเตอร์ความอิ่ม + ปุ่ม **🍎 Feed now! · Free** (ฟรี ไม่เสีย token) → กด → ใบเซ็น:

| ช่อง | ค่า |
|---|---|
| Action | `feed` |
| Account | `waxwingsuper` |
| Contract | `phgamecreatr` |
| Data | `{"owner":"waxwingsuper","asset_id":"1099603751655"}` |

Feed ทำให้มิเตอร์ความอิ่มเต็ม → สัตว์โตต่อได้ (ความอิ่มลดตามเวลาแยกตาม rarity: Common 48h / Uncommon 72h / Rare 120h)

📸 `web/screenshots/playflow/04-feed-sign.png`

## ขั้นที่ 4 — วิวัฒนาการ (Evolve)
เมื่อ growth ถึงเกณฑ์ ปุ่ม **✨ Evolve · 50 HATCH** จะกดได้ → ใบเซ็น:

| ช่อง | ค่า |
|---|---|
| Action | `evolve` |
| Account | `waxwingsuper` |
| Contract | `phgamecreatr` |
| Data | `{"owner":"waxwingsuper","asset_id":"1099603751655"}` |

เสีย 50 HATCH เลื่อน stage (Baby → Juvenile → Adult → Elite → Max). ตัวที่ถึง **🏆 MAX LEVEL** ปุ่มจะปิด

📸 `web/screenshots/playflow/05-evolve-sign.png`

## ขั้นที่ 5 — เก็บเกี่ยว EGG (Harvest)
ปุ่มล่างซ้าย **🌾 Harvest EGG** — โชว์อัตราจริง เช่น `+5,800 EGG/hr · 14 creatures` → กด → ใบเซ็น:

| ช่อง | ค่า |
|---|---|
| Action | `harvest` |
| Account | `waxwingsuper` |
| Contract | `phgamecreatr` |
| Data | `{"owner":"waxwingsuper"}` |

เก็บ EGG ที่สัตว์ผลิตสะสม (ยิ่ง stage สูง ยิ่งได้มาก) มี cooldown ระหว่างรอบ

📸 `web/screenshots/playflow/06-harvest-sign.png`

## ขั้นที่ 6 — เคลมรางวัล (Claim Reward)
ปุ่มล่างขวา **🎁 Claim Reward** — โชว์ผลตอบแทนจริง เช่น `+50 HATCH (stage 4)` → กด → ใบเซ็น:

| ช่อง | ค่า |
|---|---|
| Action | `claimreward` |
| Account | `waxwingsuper` |
| Contract | `phgamecreatr` |
| Data | `{"owner":"waxwingsuper"}` |

จ่ายเป็น HATCH ตาม stage สูงสุดที่มี (stage 2=20 / 3=30 / 4=50 / 5=100 HATCH) เคลมได้ครั้งเดียวต่อ season

📸 `web/screenshots/playflow/07-claim-sign.png`

---

## สรุปลูปการเล่น
```
เปิด plugin → Connect via waxwing → (บัญชีใหม่: initplayer)
   → Hatch (150 EGG)  →  Feed (ฟรี, ให้อิ่ม)  →  Evolve (50 HATCH, เลื่อน stage)
   → Harvest (เก็บ EGG จากสัตว์)  →  Claim Reward (รับ HATCH ตาม stage)  → วนซ้ำ
```

**หมายเหตุความปลอดภัยที่พิสูจน์แล้ว**
- ทุกปุ่มเปิดใบเซ็นด้วย action/account/contract/data ที่ถูกต้อง 100% (เดินจริงครบทั้ง 6 action)
- ไม่มีอะไรขึ้นเชนจนกว่าจะกด **🔏 Sign** — การทดสอบนี้กด **Cancel** ทุกครั้ง (ไม่ broadcast)
  เพราะ Kevin กำลังรัน chain loop บน `waxwingsuper` อยู่พร้อมกัน จึงไม่ยิงทับ
- ตอนกด Sign จริง ถ้ากระเป๋าถูกล็อกจะเด้งให้ปลดล็อกก่อน (by-design — เป็นรหัสของ CEO)
