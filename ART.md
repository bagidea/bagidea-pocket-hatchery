# 🎨 Pocket Hatchery — Art Direction (ART.md)

> เกมฟาร์มสัตว์ NFT น่ารัก เล่นบนเว็บ · มุมมอง isometric · creature วิวัฒนาการหลาย stage
> **โจทย์หลักจากบอส: "กราฟิกต้องสวย/ทันสมัย" — นี่คือจุดที่เราต้องชนะ**
> เขียนโดย Monanisa (Designer) · v0.1 · 2026-06-26

---

## 0. North Star (ทิศทางในประโยคเดียว)

> **"Cozy-premium creature collector"** — ตัวละครฟูนุ่ม กลมน่ากอด เรนเดอร์สไตล์ soft-3D
> วางบนฟาร์ม isometric อบอุ่นแบบเช้าวันใหม่ คุณภาพระดับ premium mobile game
> ไม่ใช่ pixel-art แบบ GameFi รุ่นเก่า และไม่ใช่ 3D เหมือนจริงเย็นชา — แต่คือ **"ภาพวาด 3 มิติที่อยากเอามือไปจิ้ม"**

เป้าหมายอารมณ์: **อบอุ่น · มีเวทมนตร์ · มีความหวัง · น่าสะสม** — ผู้เล่นเห็นแล้วต้อง "อยากเลี้ยงต่อ"

---

## 1. Benchmark — เทียบกับเกมฟาร์ม/GameFi ชั้นนำ

| เกม | จุดแข็งที่ขโมยมา | จุดอ่อนที่เราจะไม่ทำ |
|---|---|---|
| **Axie Infinity** | ระบบ collectible + breeding ติดตลาด | อาร์ตแข็ง ไม่น่ารัก ดู "เกมการเงิน" → เราต้อง **น่ารักกว่ามาก** |
| **Sunflower Land** | farm loop ชัด, on-chain | pixel-art ดูเก่า/generic → เราเลือก **soft-3D ทันสมัย** |
| **Pixels** | โลกฟาร์มกว้าง social | top-down pixel แบนๆ → เราใช้ **isometric มีมิติ + แสงสวย** |
| **Cookie Run Kingdom** | ตัวละคร juicy, แสง premium, micro-animation | (เป็น bar ของเรา) |
| **Ooblets / Palia / Cozy Grove** | โทน cozy, รูปทรงกลมมน, painterly | — |
| **Pokémon / Neko Atsume** | ความผูกพันกับ creature, evolution มี "ช่วงเวลา" | — |

**สรุป bar:** GameFi ส่วนใหญ่แพ้เรื่อง "ความสวย/ความน่ารัก" เพราะโฟกัสที่เศรษฐกิจ
เราพลิกเกมด้วย **อาร์ตระดับเกมมือถือ premium** บนกลไก on-chain — นั่นคือช่องว่างที่เราชนะได้จริง
**Quality bar ที่ยึด = ภาพ creature hero (อ้างอิงข้อ 8)** ทุก asset ต้องไปให้ถึงระดับนั้น

---

## 2. Visual Style — กฎการเรนเดอร์

- **รูปแบบ:** Stylized **soft-3D render look** (จะทำเป็น 3D จริงแล้ว bake เป็น sprite/atlas หรือวาด 2.5D ก็ได้ แต่ "หน้าตา" ต้องเป็นแบบนี้)
- **รูปทรง (form):** กลม · มน · อวบ (chunky/rounded) — ไม่มีมุมแหลมคม, silhouette อ่านออกแม้ย่อเล็ก
- **พื้นผิว (texture):** painterly นุ่ม + ขนฟูมีรายละเอียด (soft fur), หลีกเลี่ยง texture สมจริงเย็นๆ
- **เส้นขอบ:** ไม่ใช้เส้น outline สีดำหนา; ใช้ **rim light + ambient occlusion** แยกตัวละครออกจากพื้นหลังแทน
- **แสง (lighting) — หัวใจของความสวย:**
  - Key light = golden-hour อุ่น (เช้า/บ่ายอ่อน)
  - Fill = ฟ้าเย็นอ่อนๆ กันเงาตาย
  - **Rim light เด่นชัด** รอบขอบตัว creature (ตัวเกือบทุกตัวต้องมี)
  - soft shadow + contact shadow ใต้ตัวเสมอ (ห้ามตัวลอย)
- **ความอิ่มสี:** pastel-vibrant — สดพอให้สดใส แต่ลด saturation ลงนิดให้ดู cozy ไม่จัดจ้าน
- **Depth:** depth-of-field อ่อนๆ ที่ฉาก, sparkle/particle เวทมนตร์ประปราย (ใช้อย่างมีรสนิยม ไม่รก)

---

## 3. Color Palette (พร้อม hex สำหรับ dev)

### Core / Brand
| บทบาท | ชื่อ | HEX | ใช้ที่ไหน |
|---|---|---|---|
| Base / canvas | Cream | `#FFF6E9` | พื้นหลัง UI, studio bg |
| Sky | Soft Sky | `#A8DCF0` | ท้องฟ้า, panel เย็น |
| Grass primary | Mint Green | `#8FD694` | สนามหญ้า, สถานะ common |
| Grass deep | Meadow | `#5BB572` | เงาหญ้า, contrast |
| Sun / CTA | Golden | `#FFCB6B` | ปุ่มหลัก, ไข่เรืองแสง, แสงอุ่น |
| Pop / cute | Coral Pink | `#FF9EB5` | accent น่ารัก, heart, love |
| Magic / rare | Lavender | `#C9A8FF` | เวทมนตร์, aura, ระดับ epic |
| Soil | Warm Earth | `#C49A6C` | ดิน, path, ไม้ |
| Ink (ข้อความ) | Soft Navy | `#3A3A52` | ตัวอักษร, ไม่ใช้ดำสนิท |

### Rarity tiers (สีประจำระดับ — ใช้ทั้งกรอบการ์ด/aura/ป้าย)
| ระดับ | สี | HEX | สัญญะ |
|---|---|---|---|
| Common | เขียวมิ้นต์ | `#8FD694` | สงบ ปลอดภัย |
| Rare | ฟ้า | `#5FB8E8` | เย็น พิเศษขึ้น |
| Epic | ม่วงลาเวนเดอร์ | `#B07BE8` | เวทมนตร์ |
| Legendary | ทอง + iridescent | `#FFD86B` + เหลือบรุ้ง | ของหายากสุด, มี aura เคลื่อนไหว |

> **Accessibility:** ข้อความบนพื้นใช้ Soft Navy `#3A3A52` บน Cream → contrast > 4.5:1 (ผ่าน WCAG AA).
> ปุ่มหลักทอง `#FFCB6B` ต้องมี label สี navy ไม่ใช่ขาว. อย่าใช้สีระดับ rarity สื่อความหมายเดียวโดด ๆ — ต้องมีไอคอน/ป้ายข้อความกำกับด้วย (เผื่อตาบอดสี).

---

## 4. Typography

| บทบาท | ฟอนต์แนะนำ | เหตุผล |
|---|---|---|
| Display / หัวเรื่อง / โลโก้ | **Baloo 2** (หรือ Fredoka) | ตัวกลมหนา อบอุ่น เข้ากับรูปทรงกลมของเกม |
| Body / UI | **Nunito** (น้ำหนัก 600/700) | กลมอ่านง่าย รองรับหลายภาษา |
| ตัวเลข/สถิติ (balance, count) | **Nunito** tabular หรือ **M PLUS Rounded** | ตัวเลขเรียงตรง อ่านค่าเกมง่าย |
| ภาษาไทย | **Mali** / **Fahkwang** | คงโทนกลม-friendly เดียวกัน |

ขนาดอ้างอิง (web, base 16px): H1 32 / H2 24 / H3 20 / Body 16 / Caption 13. ปุ่มขั้นต่ำ 44×44px (touch target).

---

## 5. Creature Design — หัวใจของเกม

### หลักการ
- **1 silhouette = 1 species อ่านออกทันที** แม้เป็นเงาดำหรือย่อเหลือ 48px (test ด้วย squint/blur)
- ตา = จุดขายความน่ารัก: **ตากลมโต เป็นประกาย** มี catchlight 1–2 จุด
- สัดส่วน chibi: หัวใหญ่ ตัวอวบ ขาสั้น (ratio หัว:ตัว ≈ 1:1.2 ตอนโต)
- ขนฟู + rim light รอบตัว = ลายเซ็นของแบรนด์

### 4 Stage วิวัฒนาการ (ต้อง "เล่าเรื่อง" การเติบโต)
| Stage | ชื่อ | ลักษณะ | จังหวะอารมณ์ |
|---|---|---|---|
| 1 · **Egg** | ไข่ | ไข่ลายจุด pastel ในรังฟาง **เรืองแสงอ่อนๆ** (บอกว่า "มีชีวิตข้างใน") | ความหวัง/รอคอย |
| 2 · **Baby** | เด็ก | ตัวกลมจิ๋ว ตาโตเกินตัว ขาสั้นกุด ท่าทางงุ่มง่าม | น่าเอ็นดู/ปกป้อง |
| 3 · **Adult** | โต | ขนเต็ม ฟอร์มชัด ท่ามั่นใจ เริ่มมี feature เฉพาะสายพันธุ์ | ภูมิใจ/ผูกพัน |
| 4 · **Rare/Legendary** | หายาก | ขนเหลือบรุ้ง, **คริสตัล/เขาเรืองแสง, aura เวทมนตร์**, particle | ตื่นเต้น/อวดได้ |

> วิวัฒนาการต้องรู้สึกเป็น **"ช่วงเวลา"** (evolution moment) — มี flash + particle + เสียง, ไม่ใช่แค่สลับภาพ.
> รูปทรงหลัก/สีเอกลักษณ์ของสายพันธุ์ต้อง **คงเส้นทางเดียวกัน** ทั้ง 4 stage (ผู้เล่นต้องรู้ว่า "ตัวเดียวกันโตขึ้น").

### Expression sheet (ต่อ species ขั้นต่ำ)
idle · happy · eating · sleeping · evolving · rare-glow — เพื่อให้ฟาร์มมีชีวิต

---

## 6. Environment / Farm Scene

- **มุมมอง:** isometric 2:1 (true iso 26.57° หรือ 30° ก็ได้ — ล็อกค่าเดียวทั้งเกม)
- **Tile:** หญ้ามิ้นต์มี texture นุ่ม, path หินก้อนกลม, รั้วไม้ทาสี
- **Landmark hero:** กระท่อมฟักไข่ (incubator hut) เรืองแสงอุ่น = จุดสายตาหลักของฟาร์ม
- **องค์ประกอบ:** รังไข่เรืองแสง, แปลงดอกไม้, บ่อน้ำมีประกาย (caustics), creature เดินเล่น
- **เลเยอร์บรรยากาศ:** sparkle เวทมนตร์ลอยอ่อนๆ, แสง golden-hour, เงา contact ทุกวัตถุ
- **อ่านง่าย:** ของที่กดได้ต้อง pop ออกจากพื้น (rim light/เงา), ฉากไม่รกจนหา creature ไม่เจอ

> 💡 หมายเหตุเชื่อมกับออฟฟิศ (Well-being floor): โทนฟาร์มยึด "อบอุ่น/มีความหวัง" — ไม่ว่าสภาพตลาด NFT จะเป็นยังไง ฟาร์มต้องไม่กลายเป็นฉากมืดหดหู่; คงจุดอุ่น (แสงกระท่อม) ไว้เสมอ.

---

## 7. UI / UX Direction

- **สไตล์ panel:** การ์ดมุมโค้งใหญ่ (radius 20–28px), พื้น Cream, เงานุ่มฟุ้ง (soft drop shadow), ไม่มีเส้นขอบคม
- **ปุ่มหลัก:** ทอง `#FFCB6B`, ตัวอักษร navy, มี "juice" — กดแล้วยุบ + เด้ง (scale 0.96→1.04→1) + เสียง pop
- **การ์ด creature:** กรอบสีตาม rarity (ข้อ 3), มุมมีไอคอน stage, legendary มี aura เคลื่อนไหวเบาๆ
- **Micro-interaction:** ทุกการกระทำสำคัญ (ฟักไข่/วิวัฒนาการ/เก็บเกี่ยว) มี feedback ภาพ+particle — "ความ juicy" คือสิ่งที่แยกเกมสวยออกจากเกมธรรมดา
- **Scrollbar:** ใช้ slim blue-glass ตามมาตรฐานออฟฟิศ (ไม่ใช้ default หนา)
- **State ของ component (ส่งมอบ dev):** ทุกปุ่ม/การ์ดต้องนิยาม `default · hover · pressed · disabled · loading` พร้อม spacing เป็น 4px grid (4/8/12/16/24/32)

---

## 8. Reference Renders (เรนเดอร์จริงด้วยเครื่องมือออฟฟิศ)

ภาพต้นแบบที่ gen แล้ว — เก็บไว้ที่ `art/references/` ใช้เป็น quality bar และ mood ส่งต่อทีม:

- **ฟาร์ม isometric (HERO):** `art/references/farm-isometric-hero.png` — กระท่อมฟักไข่เรืองแสง + รังไข่ + บ่อน้ำประกาย, คม/มีมิติ → **ใช้เป็นตัวตั้งคุณภาพฉาก**
- **ฟาร์ม โทนนุ่ม (ALT):** `art/references/farm-isometric-soft-alt.png` — เวอร์ชัน painterly นุ่มกว่า สำหรับ mood เช้า/หน้า loading
- **Creature 4 stage วิวัฒนาการ:** `art/references/creature-evolution-4stage.png` — ไข่ → เด็ก → โต → ฟอร์มใหญ่ (สาย "จิ้งจอกเวทมนตร์")
- **Creature หายาก (HERO / QUALITY BAR):** `art/references/creature-rare-hero.png` — ขนฟูเหลือบมิ้นต์-ลาเวนเดอร์ + คริสตัลเรืองแสง → **ภาพนี้คือมาตรฐานความสวยที่ทุก asset ต้องไปให้ถึง**

> หมายเหตุ: ภาพเหล่านี้เป็น **direction reference** (กำหนดหน้าตา/แสง/สี) — ยังไม่ใช่ asset final สำหรับ production. ขั้นถัดไปคือล็อก species จริง + ทำ expression/stage ครบใน production pipeline.

---

## 9. Asset & Hand-off Spec (สำหรับ dev / web)

- **รูปแบบไฟล์:** creature/UI = PNG โปร่ง (หรือ WebP), ฉาก = WebP; พิจารณา sprite atlas เพื่อลด request
- **ความละเอียด:** ออกแบบที่ @2x แล้ว downscale; creature sprite ฐาน ~256–512px, การ์ด icon ~96px
- **เงา:** เก็บเป็นเลเยอร์/sprite แยก เพื่อปรับ opacity ได้ใน engine
- **Naming:** `creature_{species}_{stage}_{state}.png` เช่น `creature_foxling_baby_idle.png`
- **Tokens:** ส่งสี/spacing/radius เป็น CSS variables / JSON design tokens (ผูกกับข้อ 3–7)
- **Animation:** ใช้ spritesheet หรือ Lottie/Rive สำหรับ idle + evolution; กำหนด FPS และจำนวนเฟรมตอน hand-off

---

## 10. Next Steps (จาก Monanisa)

1. ล็อก **mascot species แรก 3–4 สาย** (silhouette ต่างกันชัด) + ตั้งชื่อ
2. ทำ **expression sheet** เต็มของ species นำร่อง 1 ตัว ครบ 4 stage
3. ออกแบบ **UI kit** (ปุ่ม/การ์ด/HUD/หน้าฟัก) เป็น Figma component + design tokens
4. ทำ **evolution moment** mockup (ภาพก่อน/หลัง + particle) ให้ dev เห็น juice ที่ต้องการ
5. ประสานกับ Sun (เศรษฐกิจ: rarity ส่งผลต่อ visual แค่ไหน) + Yamamoto (asset pipeline/web perf)
