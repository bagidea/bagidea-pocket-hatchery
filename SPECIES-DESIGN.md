# 🐾 Pocket Hatchery — Species Roster & Trait System

> **12 สายพันธุ์ · 6 ธาตุ · infinite genetic combinations**
> Monanisa (Designer) · v1.0 · 2026-07-03
> อ้างอิง: [`ART.md §5`](./ART.md) · [`NFT-CARD-DESIGN.md`](./NFT-CARD-DESIGN.md) · [`PLAYGUIDE.md`](./PLAYGUIDE.md)

---

## 0. Design Principles

จาก ART.md §5 — หลักการออกแบบ creature ทุกตัว:

1. **1 silhouette = 1 species** — อ่านออกทันทีแม้เป็นเงาดำหรือย่อเหลือ 48px (test ด้วย squint/blur)
2. **ตา = จุดขายความน่ารัก** — ตากลมโต เป็นประกาย มี catchlight 1–2 จุด
3. **สัดส่วน chibi** — หัวใหญ่ ตัวอวบ ขาสั้น (หัว:ตัว ≈ 1:1.2)
4. **ขนฟู + rim light** = ลายเซ็นของแบรนด์
5. **4-stage evolution** — Egg → Baby → Adult → Rare Form, รูปทรง/สีคงเส้นทาง

### Species Diversity Matrix

| # | Species | Element | Silhouette Key | Habitat |
|---|---|---|---|---|
| 1 | **Foxling** 🦊 | 🔥 Fire | จิ้งจอกหางพุ่มใหญ่ หูแหลมตั้ง | Forest Edge |
| 2 | **Owlet** 🦉 | 🌬️ Air | นกฮูกกลม หัวโตไม่มีคอ ตาเบ้อเริ่ม | Ancient Tree |
| 3 | **Droplet** 💧 | 💧 Water | หยดน้ำกลับหัว ครีบใส | Crystal Pond |
| 4 | **Pebblit** 🪨 | 🏔️ Earth | ก้อนหินกลมมน มีขาสั้น 4 ข้าง | Rocky Hill |
| 5 | **Sproutling** 🌱 | 🌿 Nature | ต้นอ่อน ใบไม้บนหัว ลำต้นเป็นตัว | Meadow |
| 6 | **Flicker** 🔥 | 🔥 Fire | เปลวไฟหัวกลับ มีแขนไฟ | Hearth |
| 7 | **Glimmer** 💎 | ✨ Crystal | คริสตัลเหลี่ยม โปร่งแสง | Crystal Cave |
| 8 | **Wisp** 👻 | 🌙 Shadow | วิญญาณกลมลอยได้ หางควัน | Twilight Grove |
| 9 | **Fluffle** ☁️ | 🌬️ Air | ก้อนปุยกลม มีหูยาวย้อย | Cloud Meadow |
| 10 | **Shellby** 🐚 | 💧 Water | หอยทากมีเปลือกมุก ตาหยดน้ำ | Coral Shore |
| 11 | **Dracling** 🐉 | 🔥 Fire | มังกรน้อย มีปีกเล็ก เขาเล็ก | Volcano Nest |
| 12 | **Buzzle** 🐝 | 🌿 Nature | ผึ้งอวบอ้วน ปีกใส มีหนวด | Flower Field |

---

## 1. Species #1 — Foxling 🦊 *(มีอยู่แล้ว — mascot ตัวแรก)*

| Property | Value |
|---|---|
| **Scientific name** | *Vulpes magica* |
| **Element** | 🔥 Fire / Forest |
| **Base color (default gene)** | Mint `#8FD694` → Meadow `#5BB572` |
| **Accent color** | Coral `#FF9EB5` (ear tips, cheeks) |
| **Silhouette** | จิ้งจอกหางใหญ่พุ่ม หูแหลมตั้งตรง ปากแหลม |
| **Egg pattern** | จุดกลม mint บนพื้น cream + golden crack line |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่สี mint มีจุด cream เรืองแสง golden อ่อน |
| **Baby** | ตัวกลม ขนฟู หางสั้น ตาโตมาก หูตก |
| **Adult** | หูตั้ง หางพุ่มยาว ขน mint เต็มตัว ปลายหู lavender |
| **Rare** | หางเหลือบรุ้ง + คริสตัลที่หน้าผาก + golden aura |

### Special Traits (gene-coded)
- **Ear style (2 bits):** pointed / floppy / tufted / folded
- **Tail plume (2 bits):** standard / extra-fluffy / forked / crystal-tipped
- **Forehead mark (2 bits):** none / diamond / star / crescent

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 5 | 7 |
| Uncommon | 9 | 13 |
| Rare | 16 | 20 |
| Epic | 24 | 28 |
| Legendary | 38 | 44 |

---

## 2. Species #2 — Owlet 🦉

| Property | Value |
|---|---|
| **Scientific name** | *Strigis rotundus* |
| **Element** | 🌬️ Air / Wisdom |
| **Base color** | Sky `#A8DCF0` → `#7EC8E0` |
| **Accent color** | Golden `#FFCB6B` (eye rings, beak) |
| **Silhouette** | วงกลมใหญ่ (หัว+ตัวรวมกัน) + สามเหลี่ยมเล็ก (เท้า) + วงรีข้าง (ปีกสั้น) |
| **Key differentiator** | **ไม่มีคอ** — หัวกับตัวเป็นทรงกลมเดียวกัน ตาโตมากแบบนกฮูก มองแล้วนึกถึง "ลูกกอล์ฟมีตา" |
| **Egg pattern** | ลายวงกลม concentric sky blue |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ขาวลายวงกลมฟ้า มีจุด golden |
| **Baby** | ลูกกอล์ฟฟูฟ่อง ตาเบ้อเริ่ม ปีกจิ๋ว |
| **Adult** | ตัวใหญ่ขึ้น ปีกกางได้ ตาสื่อปัญญา มีคิ้วขนนก |
| **Rare** | ขนเหลือบม่วง-ทอง + ดาวบนหน้าผาก + constellation aura |

### Special Traits
- **Eye rings (2 bits):** simple / double-ring / star-shaped / crescent
- **Wing style (2 bits):** small / broad / pointed / ethereal
- **Crown (2 bits):** none / feather tuft / crystal / star

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 4 | 8 |
| Uncommon | 8 | 15 |
| Rare | 14 | 24 |
| Epic | 22 | 34 |
| Legendary | 36 | 52 |

---

## 3. Species #3 — Droplet 💧

| Property | Value |
|---|---|
| **Scientific name** | *Aqua vivens* |
| **Element** | 💧 Water / Flow |
| **Base color** | Teal `#5BC0BE` → `#3DA5A3` |
| **Accent color** | White-pearl `#F0F8FF` (highlights, fin edges) |
| **Silhouette** | หยดน้ำกลับหัว (胖上尖下) + ครีบข้างโปร่งแสง 2 ข้าง |
| **Key differentiator** | **โปร่งแสงบางส่วน** — มองเห็นแกนใน (core) เรืองแสงอยู่ข้างในตัว เป็น species เดียวที่ใช้ translucency |
| **Egg pattern** | ไข่ฟองน้ำ มีระลอกคลื่น teal |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ทรงหยดน้ำใส มี ripple pattern |
| **Baby** | หยดน้ำน้อย ครีบสั้น ใสจนเห็นหัวใจเต้น (core) |
| **Adult** | ตัวใหญ่ขึ้น ครีบยาวพลิ้ว มีประกายน้ำ surround |
| **Rare** | แกนในเป็นคริสตัล + ครีบสีรุ้ง + bubble particles |

### Special Traits
- **Core shape (2 bits):** circle / heart / star / diamond
- **Fin style (2 bits):** simple / flowing / wing-like / crystal
- **Transparency (2 bits):** clear / misty / shimmer / prismatic

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 3 | 10 |
| Uncommon | 7 | 18 |
| Rare | 12 | 28 |
| Epic | 20 | 38 |
| Legendary | 32 | 56 |

---

## 4. Species #4 — Pebblit 🪨

| Property | Value |
|---|---|
| **Scientific name** | *Lithos vivens* |
| **Element** | 🏔️ Earth / Stability |
| **Base color** | Earth `#C49A6C` → `#A07848` |
| **Accent color** | Moss green `#8FD694` (moss patches) |
| **Silhouette** | ก้อนหินกลมมน (irregular oval) + ขาสั้น stubby 4 ข้าง + moss บนหัว |
| **Key differentiator** | **ขา 4 ข้างสั้นจิ๋ว** — เป็น species เดียวที่ไม่มีหาง/หูแบบดั้งเดิม มีแต่ moss + คริสตัลเล็กๆ บนตัว |
| **Egg pattern** | ไข่ลายหิน texture + moss spots |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ทรงกรวดมน มีรอยแตกแบบหิน |
| **Baby** | ก้อนกรวดน้อย ขาเล็ก 4 ข้าง ตาจิ๋ว มี moss นิดเดียว |
| **Adult** | ก้อนหินใหญ่ มี moss ปกคลุม คริสตัลเล็ก ๆ โผล่ |
| **Rare** | หินอัญมณี (gemstone) + moss เรืองแสง + crystal crown |

### Special Traits
- **Stone type (2 bits):** granite / obsidian / marble / geode
- **Moss coverage (2 bits):** minimal / patchy / full-coat / flowering
- **Crystal growth (2 bits):** none / small / cluster / crown

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 10 | 3 |
| Uncommon | 18 | 5 |
| Rare | 28 | 10 |
| Epic | 40 | 16 |
| Legendary | 60 | 24 |

---

## 5. Species #5 — Sproutling 🌱

| Property | Value |
|---|---|
| **Scientific name** | *Herba ambulans* |
| **Element** | 🌿 Nature / Growth |
| **Base color** | Meadow `#5BB572` → `#4A9E5E` |
| **Accent color** | Coral `#FF9EB5` (flower, berry) |
| **Silhouette** | ต้นอ่อน — หัวเป็นดอก/ใบ ตัวเป็นลำต้นอวบ รากเป็นขา 2 ข้าง |
| **Key differentiator** | **เดินได้ด้วยราก** — เป็น species พืชที่มีชีวิต มีใบไม้/ดอกไม้บนหัวที่เปลี่ยนตาม season |
| **Egg pattern** | ไข่ลายใบไม้ + vine swirl |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ลายใบไม้ในเปลือกไม้ |
| **Baby** | ต้นอ่อนเล็ก ใบไม้บนหัว 1 ใบ ราก 2 เส้น |
| **Adult** | ลำต้นใหญ่ ใบไม้หลายใบ ดอกไม้เล็ก ๆ บนหัว |
| **Rare** | ต้นไม้บานเต็มที่ + ดอกไม้เรืองแสง + butterfly aura |

### Special Traits
- **Head plant (2 bits):** single leaf / flower / fruit / vine crown
- **Root style (2 bits):** simple / spread / curly / glowing
- **Season color (2 bits):** spring green / summer gold / autumn red / winter white

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 3 | 9 |
| Uncommon | 6 | 17 |
| Rare | 11 | 26 |
| Epic | 18 | 36 |
| Legendary | 28 | 54 |

---

## 6. Species #6 — Flicker 🔥

| Property | Value |
|---|---|
| **Scientific name** | *Ignis animatus* |
| **Element** | 🔥 Fire / Energy |
| **Base color** | Golden `#FFCB6B` → Coral `#FF9EB5` (gradient) |
| **Accent color** | White-hot `#FFF6E9` (core, eye shine) |
| **Silhouette** | เปลวไฟหัวกลับ (胖底尖顶) + ไฟเล็ก 2 ข้างเป็นแขน |
| **Key differentiator** | **ตัวเป็นไฟ** — รูปร่างไม่ตายตัว เปลี่ยนแปลงได้ตามอารมณ์ (happy=สว่าง, sad=หรี่) แขนเป็นเปลวไฟเล็ก |
| **Egg pattern** | ไข่สีดำมีลายเปลวไฟ golden |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่สี obsidian มี flame crack เรืองแสง |
| **Baby** | เปลวไฟน้อย สีส้มอ่อน แขนสั้น ตากลม |
| **Adult** | เปลวไฟแรง สีทอง-ส้ม มี spark particle |
| **Rare** | ไฟสีฟ้า-ม่วง (blue flame) + phoenix wing |

### Special Traits
- **Flame color (2 bits):** orange / golden / blue / purple
- **Flame shape (2 bits):** teardrop / candle / torch / spiral
- **Spark level (2 bits):** minimal / moderate / intense / constellation

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 7 | 5 |
| Uncommon | 14 | 9 |
| Rare | 22 | 15 |
| Epic | 32 | 22 |
| Legendary | 50 | 34 |

---

## 7. Species #7 — Glimmer 💎

| Property | Value |
|---|---|
| **Scientific name** | *Crystallus vivens* |
| **Element** | ✨ Crystal / Light |
| **Base color** | Lavender `#C9A8FF` → `#B07BE8` |
| **Accent color** | White `#FFFFFF` (reflections, edges) |
| **Silhouette** | คริสตัล 6 เหลี่ยมตั้ง ปลายแหลมบน-ล่าง มีตา 2 ข้างในเหลี่ยมกลาง |
| **Key differentiator** | **เหลี่ยม geometry ชัดเจน** — เป็น species เดียวที่ใช้รูปทรงเรขาคณิตแทนความนุ่มฟู สะท้อนแสงแบบ gemstone |
| **Egg pattern** | ไข่รูปอัญมณี มี facet lines |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่คริสตัลใส มี facet เรืองแสงอ่อน |
| **Baby** | คริสตัลก้อนเล็ก 2-3 เหลี่ยม มีประกายในตัว |
| **Adult** | คริสตัลใหญ่ 6 เหลี่ยม มีแกนในเรืองแสง |
| **Rare** | คริสตัลสีรุ้ง + prismatic refraction + rainbow aura |

### Special Traits
- **Crystal shape (2 bits):** hexagon / diamond / obelisk / cluster
- **Inner core (2 bits):** solid / hollow / swirling / constellation
- **Refraction (2 bits):** clear / rainbow / aurora / prismatic burst

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 6 | 6 |
| Uncommon | 11 | 11 |
| Rare | 18 | 18 |
| Epic | 28 | 28 |
| Legendary | 42 | 42 |

> Glimmer เป็น species ที่ POW = CHARM เสมอ — สมดุลที่สุดในทุกสายพันธุ์

---

## 8. Species #8 — Wisp 👻

| Property | Value |
|---|---|
| **Scientific name** | *Umbra ludens* |
| **Element** | 🌙 Shadow / Playfulness |
| **Base color** | Soft Navy `#3A3A52` → `#5C5C7A` |
| **Accent color** | Lavender glow `#C9A8FF` (aura, eyes) |
| **Silhouette** | ผีกลมมีหางควัน + ตาโตเรืองแสง |
| **Key differentiator** | **ลอยได้** — ไม่มีขา หางเป็นควันที่ทิ้ง trail จาง ๆ เวลาเคลื่อนที่ ตาเรืองแสงในที่มืด |
| **Egg pattern** | ไข่สีม่วงเข้ม มี swirl ควัน + star dots |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่สี dark มี swirl ม่วงเรืองแสง |
| **Baby** | ก้อนควันน้อย ตาโต หางสั้น |
| **Adult** | ผีใหญ่ หางควันยาว มีแขน phantom |
| **Rare** | Wisp ใสเป็นประกาย + หางเป็นกลุ่มดาว + multi-shadow |

### Special Traits
- **Tail style (2 bits):** short / long / split / constellation
- **Glow color (2 bits):** lavender / cyan / gold / rainbow
- **Transparency (2 bits):** opaque / semi / ghostly / prismatic

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 2 | 12 |
| Uncommon | 5 | 22 |
| Rare | 9 | 34 |
| Epic | 15 | 46 |
| Legendary | 24 | 64 |

> Wisp มี CHARM สูงที่สุดในทุกสายพันธุ์ — แต่ POW ต่ำสุดเช่นกัน

---

## 9. Species #9 — Fluffle ☁️

| Property | Value |
|---|---|
| **Scientific name** | *Nubes mollis* |
| **Element** | 🌬️ Air / Softness |
| **Base color** | Cream `#FFF6E9` → `#F5E6CC` |
| **Accent color** | Mint `#8FD694` (ear tips, paws) |
| **Silhouette** | ก้อนเมฆกลมฟู + หูยาวย้อยลง + หางปุยกลม |
| **Key differentiator** | **ฟูที่สุดในบรรดาสายพันธุ์** — ขนยาวเป็น fluff ball ทำให้ silhouette เบลอเล็กน้อย นุ่มจนอยากกอด |
| **Egg pattern** | ไข่ขาวนวล มี swirl ขนนุ่ม |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ขาวฟู มี swirl cream |
| **Baby** | ก้อนปุยกลม ตาโต หูสั้นย้อย |
| **Adult** | ขนฟูใหญ่ หูยาว มี curl ที่ปลายหู |
| **Rare** | ขนสีรุ้งอ่อน + cotton-candy fluff + sparkle |

### Special Traits
- **Fluff level (2 bits):** smooth / fluffy / extra-fluffy / cloud-like
- **Ear length (2 bits):** short / medium / long / curled
- **Ear style (2 bits):** straight / floppy / curled / ribbon

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 3 | 11 |
| Uncommon | 6 | 20 |
| Rare | 10 | 30 |
| Epic | 17 | 42 |
| Legendary | 26 | 60 |

> Fluffle = template species สำหรับ NFT card design system

---

## 10. Species #10 — Shellby 🐚

| Property | Value |
|---|---|
| **Scientific name** | *Cochlea margarita* |
| **Element** | 💧 Water / Pearl |
| **Base color** | Pearl `#F5F0E8` → `#E8D5F0` (shell gradient) |
| **Accent color** | Coral `#FF9EB5` (body, antennae) |
| **Silhouette** | เปลือกหอยเกลียวบนหลัง + ตัวทากนุ่ม 2 หนวด |
| **Key differentiator** | **มีบ้านบนหลัง** — เปลือกหอยมุกเกลียวที่โตตาม stage ตัวนิ่มสี coral มีตากลมบนหนวด |
| **Egg pattern** | ไข่ทรงหอย มี spiral shell pattern |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ทรงกลม มี spiral pearlescent |
| **Baby** | ตัวทากน้อย เปลือกเล็ก หนวดสั้น |
| **Adult** | เปลือกมุกใหญ่ เกลียวสวย หนวดยาว |
| **Rare** | เปลือกมุกดำ (black pearl) + golden spiral + ocean aura |

### Special Traits
- **Shell type (2 bits):** spiral / conch / nautilus / crown
- **Shell color (2 bits):** pearl / coral / abalone / black-pearl
- **Antennae (2 bits):** short / feathered / star-tipped / glowing

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 8 | 4 |
| Uncommon | 15 | 7 |
| Rare | 24 | 12 |
| Epic | 34 | 19 |
| Legendary | 52 | 28 |

---

## 11. Species #11 — Dracling 🐉

| Property | Value |
|---|---|
| **Scientific name** | *Draco parvus* |
| **Element** | 🔥 Fire / Dragon |
| **Base color** | Lavender `#B07BE8` → `#8A4FD4` |
| **Accent color** | Golden `#FFD86B` (belly, horns, wing edges) |
| **Silhouette** | มังกรน้อยอวบ — ปีกเล็กบนหลัง เขาเล็กบนหัว หางยาวปลายสามเหลี่ยม |
| **Key differentiator** | **มังกรที่น่ารักไม่น่ากลัว** — อวบอ้วน ปีกเล็กเกินจะบินได้จริง (วิ่งกระพือปีก代替) เอกลักษณ์คือเขา+ปีก+หางแหลม |
| **Egg pattern** | ไข่ลายเกล็ด dragonscale + golden rim |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่เกล็ดมังกรสีม่วง มี golden rim |
| **Baby** | มังกรน้อย ปีกจิ๋ว เขาตุ่ม หางสั้น |
| **Adult** | ปีกใหญ่ขึ้น เขาโค้ง มี flame breath เล็ก ๆ |
| **Rare** | ปีกใหญ่เต็มตัว + เขาคริสตัล + fire aura + scale iridescence |

### Special Traits
- **Horn style (2 bits):** nub / straight / curved / crystal
- **Wing size (2 bits):** tiny / small / medium / majestic
- **Breath (2 bits):** none / spark / flame / star-fire

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 8 | 6 |
| Uncommon | 16 | 10 |
| Rare | 26 | 17 |
| Epic | 38 | 26 |
| Legendary | 58 | 38 |

---

## 12. Species #12 — Buzzle 🐝

| Property | Value |
|---|---|
| **Scientific name** | *Bombus rotundus* |
| **Element** | 🌿 Nature / Industry |
| **Base color** | Golden `#FFCB6B` + Warm Earth `#C49A6C` (stripes) |
| **Accent color** | White `#FFF6E9` (wings, fluff) |
| **Silhouette** | ผึ้งอวบกลม — ลายทางเหลือง-น้ำตาล ปีกใสบนหลัง หนวด 2 เส้น |
| **Key differentiator** | **อวบอ้วน บินไม่เก่ง** — ตัวกลมเกินปีก (น่ารักแบบ bumblebee) มีขนฟูรอบคอ ปีกใสมีประกาย |
| **Egg pattern** | ไข่ลายรังผึ้ง hexagon |

### 4-Stage Evolution
| Stage | Description |
|---|---|
| **Egg** | ไข่ hexagon ลายรังผึ้งสีทอง |
| **Baby** | ผึ้งน้อยกลม ไม่มีปีก หนวดสั้น |
| **Adult** | ปีกใสบนหลัง ลายทางชัด ขนฟูรอบคอ |
| **Rare** | ปีกสีรุ้ง + honey drip aura + flower crown |

### Special Traits
- **Stripe pattern (2 bits):** 2-stripe / 3-stripe / wavy / diamond
- **Wing style (2 bits):** round / pointed / butterfly / iridescent
- **Fluff collar (2 bits):** none / small / fluffy / regal

### Base Stats
| Rarity | POW | CHARM |
|---|---|---|
| Common | 5 | 7 |
| Uncommon | 10 | 14 |
| Rare | 17 | 22 |
| Epic | 26 | 32 |
| Legendary | 40 | 48 |

---

## 13. Complete Trait System & Gene Encoding

### Extended Gene Layout (64 bits)

```
bits  0-3:   species_id     (0-15 — 12 species + 4 reserved)
bits  4-11:  body_hue       (0-255 → HSL hue 0°-360°)
bits 12-19:  accent_hue     (0-255 → HSL hue 0°-360°)
bits 20-23:  pattern_type   (0-15 → 16 pattern types: stripes/spots/hearts/stars × variants)
bits 24-31:  pattern_hue    (0-255 → HSL hue 0°-360°)
bits 32-35:  sat_lvl        (0-15 → 40%-85% saturation)
bits 36-39:  bright_mod     (0-15 → -15% to +15% brightness)
bits 40-43:  eye_var        (0-15 → eye color palette)
bits 44-47:  pat_opacity    (0-15 → 20%-80% pattern opacity)
bits 48-51:  trait_1        (0-15 → species-specific trait A)
bits 52-55:  trait_2        (0-15 → species-specific trait B)
bits 56-59:  trait_3        (0-15 → species-specific trait C)
bits 60-63:  mutation_flags (0-15 → rare mutations)
```

### Species-Specific Trait Mapping

| Species | trait_1 (bits 48-51) | trait_2 (bits 52-55) | trait_3 (bits 56-59) |
|---|---|---|---|
| Foxling | Ear style | Tail plume | Forehead mark |
| Owlet | Eye rings | Wing style | Crown |
| Droplet | Core shape | Fin style | Transparency |
| Pebblit | Stone type | Moss coverage | Crystal growth |
| Sproutling | Head plant | Root style | Season color |
| Flicker | Flame color | Flame shape | Spark level |
| Glimmer | Crystal shape | Inner core | Refraction |
| Wisp | Tail style | Glow color | Transparency |
| Fluffle | Fluff level | Ear length | Ear style |
| Shellby | Shell type | Shell color | Antennae |
| Dracling | Horn style | Wing size | Breath |
| Buzzle | Stripe pattern | Wing style | Fluff collar |

### Mutation Flags (bits 60-63)

| Bit | Mutation | Effect | Rarity |
|---|---|---|---|
| 60 | **Shiny** | Colors shift +30° hue (alternate palette) | 1/64 |
| 61 | **Giant** | Sprite scale ×1.3 | 1/128 |
| 62 | **Prismatic** | Rainbow iridescence on body | 1/256 |
| 63 | **Ethereal** | Transparency + glow aura | 1/512 |

---

## 14. Rarity Distribution by Species

อัตราการปรากฏของแต่ละ rarity ต่อ species — ใช้ตอน mint/summon:

| Species | Common | Uncommon | Rare | Epic | Legendary | Mythic |
|---|---|---|---|---|---|---|
| Foxling | 45% | 25% | 15% | 9% | 5% | 1% |
| Owlet | 48% | 26% | 14% | 8% | 3.5% | 0.5% |
| Droplet | 50% | 27% | 13% | 7% | 2.5% | 0.5% |
| Pebblit | 52% | 25% | 13% | 7% | 2.5% | 0.5% |
| Sproutling | 50% | 25% | 14% | 7% | 3.5% | 0.5% |
| Flicker | 48% | 24% | 15% | 9% | 3.5% | 0.5% |
| Glimmer | 40% | 26% | 17% | 10% | 6% | 1% |
| Wisp | 54% | 25% | 12% | 6% | 2.5% | 0.5% |
| Fluffle | 46% | 28% | 15% | 7% | 3.5% | 0.5% |
| Shellby | 50% | 26% | 14% | 7% | 2.5% | 0.5% |
| Dracling | 42% | 24% | 16% | 10% | 7% | 1% |
| Buzzle | 48% | 27% | 14% | 7% | 3.5% | 0.5% |

---

## 15. Breeding Compatibility Matrix

| | Fox | Owl | Drop | Peb | Sprout | Flick | Glim | Wisp | Fluff | Shell | Drac | Buzz |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Fox** | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| **Owl** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| **Drop** | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **Peb** | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Sprout** | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Flick** | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
| **Glim** | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **Wisp** | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Fluff** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| **Shell** | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| **Drac** | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **Buzz** | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |

**Rules:**
- ✓ = compatible — offspring is randomly one of the two parents' species
- ✗ = incompatible — same element required or adjacent elements
- Cross-element breeding (e.g. Fire × Water) = ✗ (except Glimmer which bridges all)

---

## 16. Element Wheel

```
         🔥 FIRE
      (Foxling, Flicker, Dracling)
           /        \
    💧 WATER        🌬️ AIR
  (Droplet,       (Owlet, Fluffle)
   Shellby)          |
         \        /
      🏔️ EARTH —— 🌿 NATURE
     (Pebblit)    (Sproutling, Buzzle)
           \      /
        ✨ CRYSTAL  🌙 SHADOW
       (Glimmer)   (Wisp)
```

- Fire beats Nature, feeds Air
- Water beats Fire, feeds Earth
- Earth beats Air, feeds Nature
- Air beats Earth, feeds Water
- Nature beats Water, feeds Fire
- Crystal/Shadow = neutral — breed with any element

---

## 17. Egg Design Guide

ทุก species มี egg pattern เฉพาะตัวที่ identify ได้ตั้งแต่ stage 0:

| Species | Base color | Pattern | Crack style |
|---|---|---|---|
| Foxling | Mint `#8FD694` | จุด cream | Golden zigzag |
| Owlet | Sky `#A8DCF0` | วงกลม concentric | Blue star |
| Droplet | Teal `#5BC0BE` | ระลอกคลื่น | White ripple |
| Pebblit | Earth `#C49A6C` | หิน texture + moss | Moss crack |
| Sproutling | Meadow `#5BB572` | ใบไม้ + vine | Green sprout |
| Flicker | Obsidian `#1a1a2e` | เปลวไฟ golden | Flame crack |
| Glimmer | White `#FFF6E9` | Facet lines | Prism crack |
| Wisp | Dark purple `#2D1B4E` | Swirl ควัน + stars | Purple mist |
| Fluffle | Cream `#FFF6E9` | Swirl ขนนุ่ม | Soft puff |
| Shellby | Pearl `#F5F0E8` | Spiral shell | Spiral crack |
| Dracling | Lavender `#B07BE8` | เกล็ดมังกร | Golden claw |
| Buzzle | Golden `#FFCB6B` | Hexagon รังผึ้ง | Honey drip |

---

## 18. Next Steps

- [x] **SVG silhouette sheet** — `art/species/silhouettes.svg` (12 ตัว, squint/blur verified ✓)
- [x] **Species hero art** — concept art ครบ 12 ตัว: `concept-*.png` ใน `art/species/`
- [x] **Egg icon set** — `art/species/eggs.svg` (12 egg designs พร้อมลายเฉพาะ species)
- [ ] **Trait visual reference** — render trait variants ของ 1 species (เช่น Foxling ear styles ทั้ง 4 แบบ)
- [ ] **Breed offspring preview** — mockup ลูกผสม 2-3 คู่ (เช่น Foxling × Dracling)
- [ ] **Contract gene encoding** — sync กับ Kevin เรื่อง gene bit layout ใน contract
- [x] **Species showcase** — `art/species/showcase.html` (12 species cards พร้อม traits, stats, egg designs)
- [ ] **Figma component** — สร้าง species card component สำหรับ dev หยิบใช้

---

> **Design files:** `art/species/silhouettes.svg` ✅ · `art/species/eggs.svg` ✅ · `art/species/concept-*.png` (12 files) ✅ · `art/species/showcase.html` ✅
> **Gene system:** `NFT-CARD-DESIGN.md §5` + `art/nft-cards/showcase.html` (interactive lab)
> **Questions?** → Monanisa ในออฟฟิศ
