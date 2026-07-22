# Pocket Hatchery — Creature Art Direction: "Premium · Cute · Alive"

**By:** Flamingo (Designer) · **For:** Monanisa (implement) · **Date:** 2026-07-16
**Verdict from CEO:** in-game creatures ยัง "สวยไม่พอ + นิ่งไป"

## The gap (diagnosis)
`concept-*.png` (hero art) สวยพรีเมียมอยู่แล้ว ✅ — แต่ **sprite จริงในเกม** (`art/species/svg/species/*.svg`) ยังตกห่างจาก concept มาก:
- ตัวใช้ **radial gradient แบน 2 สต็อป** → ไม่มีมิติ ไม่มี rim light
- ตาเป็น **จุดทึบ + จุดขาว** → ไม่มีประกาย
- **ท่าเดียว นิ่งสนิท** — ไม่มี idle / reaction
- **ไม่มีเงาสัมผัสพื้น** → ตัวลอย ไม่มีน้ำหนัก

เป้าหมาย = ดึง sprite ขึ้นไปหา concept โดย **คง identity เดิม** (Fire family + 12 ตัวที่มี). ไม่ใช่วาดใหม่ — คือ "ยกเกรดการเรนเดอร์".

## Concept references (target look)
| ไฟล์ | โชว์อะไร |
|---|---|
| `01-target-hero-flamefox.png` | เกรดการเรนเดอร์เป้าหมาย: rim light, ปริมาตร plush, ตาแก้ว, เงาพื้น — Fire-fox identity เดิม |
| `02-personality-poses.png` | "มีชีวิต": idle / hop ดีใจ / ง่วง / ตื่นเต้นตาดาว — squash & stretch |
| `03-eye-sparkle-shading.png` | โคลสอัพตา + shading 3 โทน (foxling mint/coral เดิม) |

---

## PUNCH-LIST — 7 ข้อที่ยกระดับ (เรียงตาม impact vs effort)

### 🥇 ทำก่อน (impact สูง / effort ต่ำ — เห็นผลทันทีในทุกตัว)

**1. ตา = "ตาแก้ว" ไม่ใช่จุด** *(effort: S)*
- iris เป็น radial gradient หลายชั้น (ขอบเข้ม → กลางสี species → ล่างสว่าง) ไม่ใช่สีทึบสีเดียว
- catch-light **2 จุด**: ดวงใหญ่มุมบนซ้าย + ดวงเล็กมุมล่างขวา (มีอยู่แล้วใน foxling.svg บางส่วน — ทำให้ชัด/ใหญ่ขึ้น)
- เพิ่ม **rim สว่างบางๆ** ขอบล่าง iris (แสงสะท้อนพื้น) + ไฮไลต์เงา "เปียก" ที่ขอบตา
- นี่คือตัวแปรเดียวที่ทำให้ตัวดู "มีชีวิต" มากที่สุด

**2. Rim light รอบ silhouette** *(effort: S)*
- เส้น/แถบสว่างบางๆ ตามขอบบน-หลังของตัว (เหมือนไฟส่องจากด้านหลัง) — ใช้ stroke สีอ่อนกว่า body 1–2 สต็อป หรือ soft-glow ที่ขอบ
- แยกตัว creature ออกจากพื้นหลัง card ทันที = ดู "ปั้น" มีปริมาตร

**3. เงาสัมผัสพื้น (contact shadow)** *(effort: S)*
- วงรีเบลอสีเข้มโปร่งใต้ตัว (ellipse + softGlow filter — มี filter อยู่แล้ว)
- ให้ creature "วางอยู่บนพื้น" ไม่ลอย = มีน้ำหนัก จับต้องได้

### 🥈 ทำต่อ (impact สูง / effort กลาง — ยกเกรดพรีเมียม)

**4. Shading 3 โทน แทน gradient แบน** *(effort: M)*
- ปัจจุบัน body = radial 2 สต็อป. เพิ่มเป็น **core shadow (ล่าง/ใต้คาง/ใต้แขน) → mid → warm highlight (บนหัว)**
- ใส่ **ambient occlusion** จุดที่ชิ้นส่วนซ้อนกัน: ใต้คาง, ซอกหู, โคนหาง, ระหว่างขา — soft ellipse สีเข้มโปร่ง
- แค่นี้ตัวจะเปลี่ยนจาก "สติกเกอร์แบน" → "ตุ๊กตาปั้น"

**5. Shape language: นุ่ม กลม เป็นพลูฟ** *(effort: M)*
- ขอบทุกชิ้นต้องกลมมน ไม่มีมุมคม (polygon หูใน foxling.svg แหลมไป — เพิ่ม corner radius / โค้งปลาย)
- หลักการ: **หัวใหญ่ ตาใหญ่ ตัวป้อม ขาสั้น** (ratio หัว:ตัว ~ 1:0.9) — chibi neoteny = ตัวขับ "น่ารัก"
- ปลายขน/หาง/หู ให้ปลายเรียวนุ่มแบบ concept ไม่ใช่ปลายตัด

### 🥉 ทำท้าย (impact "มีชีวิต" — effort สูงกว่า แต่คือหัวใจข้อ "นิ่งไป")

**6. Idle micro-animation** *(effort: M–L)*
- **หายใจ**: squash-and-stretch เบาๆ ตัว scale 1.0↔1.03 วนช้าๆ (~3–4s ease-in-out)
- **กระพริบตา**: หรี่ตาแวบ ทุก ~4–6s
- **หางแกว่ง** / หูกระตุกเบาๆ เป็นครั้งคราว
- ทำด้วย SMIL/CSS ในตัว SVG ได้เลย (มี `<animate>` ใช้แล้วใน rarity overlay) — ไม่ต้องแตะ engine

**7. Reaction states (ผูกกับ satiety — ต่อยอด Feed v2)** *(effort: M)*
- **อิ่ม/มีความสุข**: ตาโค้งยิ้ม, hop เบาๆ, ประกายรอบตัว (ดู `02-personality-poses.png` มุมขวาบน)
- **เริ่มหิว**: ตาปกติ ท่านิ่งลง สีหม่นลงนิด
- **หิวจัด (growth paused)**: ตาปรือ/ง่วง, ตัวหุบลง, ไม่มี idle bounce (มุมซ้ายล่าง `02-`)
- **ตอน Feed**: reaction ตื่นเต้นตาดาว 1 วินาที (มุมขวาล่าง `02-`) — reward feedback
- → ทำให้ art *เล่าสถานะเกม* ด้วย ไม่ใช่แค่สวย. ต่อกับ SatietyMeter/state chip ที่มีอยู่

---

## ขอบเขต & หมายเหตุ
- **คง identity:** ทั้ง 12 species เดิม + trait slots (ears/tail/forehead) + rarity overlays + gene-tint. งานนี้คือ "เรนเดอร์ให้พรีเมียมขึ้น" ไม่ใช่รีดีไซน์ตัว
- **นำร่อง 1 ตัวก่อน (แนะนำ foxling — Fire family):** ทำ #1–5 ให้จบเป็น reference สไตล์ → CEO อนุมัติ → ค่อย roll ไป 11 ตัวที่เหลือด้วยสูตรเดียวกัน
- **#6–7 (animation) เฟส 2:** แยกออกได้ถ้าจะรีบส่ง static look ก่อน
- ผมไม่แตะ SVG — เป็นโดเมน Monanisa. มี defect/ต้องปรับ direction เพิ่ม เรียกผมได้ทุกเมื่อ
