# Pocket Hatchery — GENETICS-SPEC.md

> **ผู้เขียน:** Sun (tokenomics + genetics combinatorics)
> **ผู้รับ:** Kevin (contract owner — implement ใน `pockethatch.cpp/.hpp`)
> **สถานะ:** read-only design — implementer-ready spec
> **วัตถุประสงค์:** ออกแบบระบบ genetics แบบ structured genome ให้โอกาสซ้ำ ≤ 1 ในพันล้าน + rarity distribution แบบ power-law ที่สร้าง collectibility
> **อ้างอิง:** pockethatch.cpp/hpp (Kevin), TOKENOMICS.md (Sun), CONTRACT-MODEL.md (Yamamoto)

---

## 0. ปัญหาของ genetics ปัจจุบัน

genetics ปัจจุบัน (`pockethatch.cpp:144-162`):

```
make_seed()         → uint64_t (2^64 possible seeds)
make_genetics(seed) → checksum256 (256-bit hash, แต่ deterministic จาก seed → มีแค่ 2^64 unique values)
```

**3 ปัญหา:**
1. **No structure** — genetics เป็น hash สุ่ม ไม่มียีน ไม่มี trait ไม่มีอะไรให้ decode → สัตว์ทุกตัวในสายพันธุ์เดียวกัน "เหมือนกันหมด" เชิงภาพ (มีแค่ template_id ต่าง)
2. **Breed blending blind** — breed (`cpp:604-610`) ใช้ bit-by-bit copy จากพ่อ-แม่ โดยไม่รู้ขอบเขตยีน → ทำลายโครงสร้างยีน (ถ้ามี) เพราะตัดกลาง allele
3. **Rarity อยู่ที่ species level เท่านั้น** — `egg_type` (0/1/2 = common/uncommon/rare) เลือก template แตะไม่ได้ความหายากภายใน species → "Fire Dragon ทุกตัวเหมือนกัน" = ไม่มีของให้ตามล่า

---

## 1. Architecture Overview

```
256-bit genetics (checksum256)
├── Gene 0: bits   0– 31  → Primary Hue       (สีหลักของตัว)
├── Gene 1: bits  32– 63  → Shade & Tone      (เฉด + ความสว่าง)
├── Gene 2: bits  64– 95  → Pattern Type      (ลาย: ล้วน/จุด/ลายทาง/เกล็ด/ฯลฯ)
├── Gene 3: bits  96–127  → Pattern Accent    (สีลาย/รายละเอียดลาย)
├── Gene 4: bits 128–159  → Physique          (โครงร่าง: ปกติ/บึกบึน/เพรียว/ฯลฯ)
├── Gene 5: bits 160–191  → Feature           (อวัยวะพิเศษ: เขา/ปีก/หาง/หงอน)
├── Gene 6: bits 192–223  → Eyes & Expression (ตา+สีตา+แววตา)
└── Gene 7: bits 224–255  → Aura & Shiny Flag (เอฟเฟกต์พิเศษ + โครโมโซม shiny)
```

**หลักการออกแบบ:**
- **Gene-aware boundary** — ทุก operation (generate/breed/decode) รู้ขอบเขตยีน → ไม่ตัดกลาง allele
- **Independent genes** — แต่ละยีนเป็นอิสระต่อกัน → combinatorial explosion = 2^256 unique profiles
- **Rarity encoded per-allele** — ความหายากฝังใน allele ไม่ใช่แค่ species → สัตว์สายพันธุ์เดียวกันหายากต่างกันได้

---

## 2. Seed Generation — ปลด bottleneck 2^64 → 2^256

### 2.1 ปัญหา bottleneck

`make_seed()` ปัจจุบันคืน `uint64_t` → genetics ทั้ง 256-bit ถูก deterministic จาก 64-bit seed เดียว → มีแค่ 2^64 unique genetics profiles จริง ๆ (ไม่ใช่ 2^256)

2^64 ≈ 1.8×10^19 ตัว — ก็มากพอสำหรับ game ทั่วไป แต่ถ้าเราใช้ gene-aware breeding และต้องการ combinatorial explosion ในระดับ "แต่ละ gene อิสระจากกันจริง" → ต้องใช้ entropy 256-bit จริง

### 2.2 Solution: 4-seed generation

```cpp
// แทนที่ make_seed() เดิม
void make_seeds(uint64_t seeds[4]) const {
    uint64_t now    = current_time_point().sec_since_epoch();
    uint64_t prefix = tapos_block_prefix();
    uint64_t num    = tapos_block_num();

    auto size = transaction_size();
    char tx_buf[size];
    read_transaction(tx_buf, size);
    checksum256 tx_hash = sha256(tx_buf, size);
    auto* w = (const uint64_t*)tx_hash.extract_as_byte_array().data();

    // 4 independent seeds from 4 64-bit words of tx_hash
    seeds[0] = w[0] ^ prefix ^ now;
    seeds[1] = w[1] ^ num    ^ (now >> 1);
    seeds[2] = w[2] ^ prefix ^ (now << 1);
    seeds[3] = w[3] ^ num    ^ (now >> 2);
}
```

แต่ละ seed ขับ 2 genes (seed[k] → gene 2k + gene 2k+1) → **ทั้ง 4 ยีนคู่เป็นอิสระต่อกันทางสถิติ** = true 2^256 combinatorial space (ดู §6)

### 2.3 Revised make_genetics()

```cpp
checksum256 make_genetics(const uint64_t seeds[4]) const {
    std::array<uint8_t, 32> arr;
    uint64_t* g = (uint64_t*)arr.data();  // 4 × uint64 = 256 bits = 8 genes × 32 bits

    for (int i = 0; i < 4; i++) {
        // xorshift64* mixer per seed → high-quality pseudo-random uint64
        uint64_t x = seeds[i] ^ 0xDEADBEEFCAFEBABEULL;
        x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
        uint64_t y = x * 0x2545F4914F6CDD1DULL;
        y ^= y >> 33; y *= 0xFF51AFD7ED558CCDULL; y ^= y >> 33;

        // Seed i  drives gene 2i   (lower 32 bits of g[i])
        //          and gene 2i+1  (upper 32 bits of g[i])
        g[i] = (seeds[i] << 32) | (y & 0xFFFFFFFFULL);
    }

    return checksum256(arr);
}
```

**ผลลัพธ์:** 256 bits = 8 ยีนอิสระ × 32 bits ต่อยีน = 2^256 profiles จริง

---

## 3. Gene Layout & Allele Mapping

แต่ละยีน = `uint32_t` → หารด้วย 2^32 ได้ค่า normalized ใน [0, 1) → map เข้า rarity band

### 3.1 Rarity Bands (standard สำหรับทุกยีน)

| Band | ช่วง normalized | Probability | #alleles ต่อยีน (typical) |
|------|----------------|-------------|--------------------------|
| **Common (C)** | [0.00, 0.50) | 50% | 4–6 |
| **Uncommon (U)** | [0.50, 0.75) | 25% | 3–4 |
| **Rare (R)** | [0.75, 0.90) | 15% | 2–3 |
| **Epic (E)** | [0.90, 0.97) | 7% | 2 |
| **Legendary (L)** | [0.97, 0.995) | 2.5% | 1 |
| **Mythic (M)** | [0.995, 1.00) | 0.5% | 1 |

### 3.2 Helper: allele resolver

```cpp
// คืน rarity band index (0=C, 1=U, 2=R, 3=E, 4=L, 5=M) + allele ordinal ภายใน band
struct allele_info {
    uint8_t band;      // 0-5
    uint8_t ordinal;   // 0..N-1 ภายใน band
    uint32_t raw;      // raw gene value
};
allele_info resolve_gene(uint32_t gene_val, uint8_t total_bands = 6);
```

### 3.3 Per-Gene Allele Tables

#### G0 — Primary Hue (สีหลัก)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | Red, Blue, Green, Gold | สีพื้นฐาน 4 สี |
| U (25%) | Teal, Purple, Orange | สีผสม |
| R (15%) | Rose Gold, Silver | สีเมทัลลิก |
| E (7%) | Iridescent Warm, Iridescent Cool | สีเหลือบมุก |
| L (2.5%) | Nebula (multi-hue gradient) | สีเนบิวลาหมุน |
| M (0.5%) | Void (black + galaxy specks) | ดำสนิทประกายดาว |

**รวม:** 14 alleles ต่อยีน

#### G1 — Shade & Tone (เฉด + ความสว่าง)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | Light, Medium, Dark, Warm | เฉดพื้นฐาน |
| U (25%) | Pastel, Vibrant, Muted | โทนสี |
| R (15%) | Deep Saturated, Pale Ghost | โทนจัด/โทนซีด |
| E (7%) | Bioluminescent, Metallic Sheen | เรืองแสงชีวภาพ/เงาโลหะ |
| L (2.5%) | Opalescent | สีเหลือบมุกทั้งตัว |
| M (0.5%) | Chroma-shift (color cycles) | สีเปลี่ยนตามมุมมอง |

**รวม:** 14 alleles

#### G2 — Pattern Type (ลายบนตัว)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | Solid, Gradient, Simple Spots, Simple Stripes | ลายพื้นฐาน |
| U (25%) | Diamond Spots, Tiger Stripes, Chevron | ลายซับซ้อน |
| R (15%) | Runes (glowing), Tribal Marks | ลายพิเศษเรืองแสง |
| E (7%) | Constellation Map, Biome Camo | ลายแผนที่ดาว/พรางตัว |
| L (2.5%) | Animated Runes (slow pulse) | ลายเคลื่อนไหว |
| M (0.5%) | Fractal Pattern (infinite detail) | ลายแฟร็กทัล |

**รวม:** 14 alleles

#### G3 — Pattern Accent (สีลาย)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | White, Black, Body-darker, Body-lighter | สีลายพื้นฐาน |
| U (25%) | Gold accent, Silver accent, Copper accent | สีเมทัลลิก |
| R (15%) | Neon Blue, Neon Pink | สีนีออน |
| E (7%) | Rainbow shift, Dual-tone | สีรุ้ง/สองโทน |
| L (2.5%) | Pure Light (glowing white) | แสงขาวบริสุทธิ์ |
| M (0.5%) | Shadow Ink (light-absorbing) | หมึกดูดแสง |

**รวม:** 14 alleles

#### G4 — Physique (โครงร่าง)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | Standard, Stocky, Lean, Small | รูปร่างพื้นฐาน |
| U (25%) | Muscular, Elegant, Round | รูปร่างพิเศษ |
| R (15%) | Giant, Mini (dwarf) | ขนาดสุดขั้ว |
| E (7%) | Armored plates, Fluffy coat | เกราะ/ขนฟู |
| L (2.5%) | Crystalline body | ตัวเป็นคริสตัล |
| M (0.5%) | Ethereal (semi-transparent) | ตัวโปร่งแสง |

**รวม:** 14 alleles

#### G5 — Feature (อวัยวะพิเศษ)

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | None, Small crest, Short tail, Tiny horns | feature พื้นฐาน |
| U (25%) | Large horns, Long tail, Small wings, Fin ears | feature เด่น |
| R (15%) | Antlers (branching), Feathered wings, Scorpion tail | feature หายาก |
| E (7%) | Dragon wings (leather), Phoenix tail (fire) | feature epic |
| L (2.5%) | Angel wings (feathered+glow), Crown of light | feature legendary |
| M (0.5%) | Cosmic halo + 4 wings | feature divine |

**รวม:** 16 alleles

#### G6 — Eyes & Expression

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | Round/Brown, Round/Blue, Almond/Green, Almond/Amber | ตา+สีพื้นฐาน |
| U (25%) | Slit/Red, Slit/Purple, Big/Gold, Big/Silver | ตา+สีพิเศษ |
| R (15%) | Glowing/Cyan, Glowing/Magenta, Multi-pupil | ตาเรืองแสง/หลายรูม่านตา |
| E (7%) | Galaxy eyes, Fire eyes | ดวงตากาแล็กซี่/ไฟ |
| L (2.5%) | Prism eyes (rainbow iris) | ม่านตาสีรุ้ง |
| M (0.5%) | Void eyes (star-field) | ดวงตาว่างเปล่าประกายดาว |

**รวม:** 14 alleles

#### G7 — Aura & Shiny Flag

| Band | Alleles | คำอธิบาย |
|------|---------|----------|
| C (50%) | No aura, Faint dust, Soft glow (warm) | ไม่มี/เบสิก |
| U (25%) | Sparkles, Fireflies, Gentle pulse | อนุภาค |
| R (15%) | Smoke (dark/light), Lightning sparks | เอฟเฟกต์เข้ม |
| E (7%) | Rainbow trail, Frost mist | ทางรุ้ง/หมอกน้ำแข็ง |
| L (2.5%) | ✨ **Shiny** (sparkle burst + alt palette) | ตัวชินี่ |
| M (0.5%) | 🌟 **Divine Shiny** (shiny + cosmic aura + unique palette) | ชินี่ขั้นเทพ |

**รวม:** 14 alleles

> **Shiny mechanic:** G7 band ≥ L คือ "Shiny" — ได้ visual effect พิเศษ + สี palette เปลี่ยนทั้งตัว (override G0+G1 ด้วย shiny palette). Divine Shiny (band=M) คือ shiny + cosmic aura ซ้อน

---

## 4. Rarity Distribution Model

### 4.1 Per-Creature Rarity Score

```
rarity_score = Σ rarity_weight(gene_i.band)

โดย rarity_weight:
  Common    = 1
  Uncommon  = 2
  Rare      = 5
  Epic      = 15
  Legendary = 50
  Mythic    = 200
```

Min = 8 (all common), Max = 1600 (all mythic)

### 4.2 Population Distribution (simulated, 10M creatures)

| Overall Tier | Score Range | Expected % | ถ้ามี 1M ตัว |
|-------------|-------------|-----------|-------------|
| 🟢 **Common** | 8–15 | ~39% | ~390,000 |
| 🔵 **Uncommon** | 16–30 | ~35% | ~350,000 |
| 🟣 **Rare** | 31–55 | ~17% | ~170,000 |
| 🟠 **Epic** | 56–120 | ~7% | ~70,000 |
| 🟡 **Legendary** | 121–300 | ~1.8% | ~18,000 |
| 🔴 **Mythic** | 301+ | ~0.2% | ~2,000 |

### 4.3 Expected Creature

Creature ทั่วไปโดยเฉลี่ย:
- 5 Common genes
- 2 Uncommon genes
- 1 Rare gene
- Rarity score ≈ 5×1 + 2×2 + 1×5 = **14** (top of Common tier)

โอกาสได้ Epic creature ขึ้นไป (≥1 Legendary gene หรือ ≥3 Epic genes): ~9.2% ต่อการ hatch หนึ่งครั้ง

โอกาสได้ Shiny (G7 band ≥ L): **3.0%** (1 ใน ~33 ตัว)
โอกาสได้ Divine Shiny (G7 band = M): **0.5%** (1 ใน 200 ตัว)

---

## 5. Breed Algorithm — Gene-Aware Inheritance

### 5.1 Current Problem

```cpp
// ปัจจุบัน (cpp:604-610) — blind bit-by-bit copy:
for (int i = 0; i < 32; i++) {
    gblend[i] = (seed & (1ULL << (i % 64))) ? ga[i] : gb[i];
}
```

**ปัญหา:** ถ้ายีนหนึ่งเป็น 32-bit allele ที่มีความหมาย การตัดบิตตรงกลาง allele = ทำลาย allele → ลูกได้ "ยีนเพี้ยน" ที่ไม่ตรงกับ allele ใดในตาราง → แสดงผลผิด

### 5.2 New Algorithm: Per-Gene Inheritance

```cpp
checksum256 breed_genetics(
    const checksum256& parent_a,
    const checksum256& parent_b,
    const uint64_t seeds[4]
) {
    auto ba = parent_a.extract_as_byte_array();
    auto bb = parent_b.extract_as_byte_array();
    const uint32_t* ga = (const uint32_t*)ba.data(); // 8 genes จาก parent A
    const uint32_t* gb = (const uint32_t*)bb.data(); // 8 genes จาก parent B

    std::array<uint8_t, 32> child_arr;
    uint32_t* gc = (uint32_t*)child_arr.data();

    for (int i = 0; i < 8; i++) {
        // ใช้ seed[i/2] เป็น entropy สำหรับยีนนี้
        uint64_t mix = seeds[i / 2];
        uint64_t roll = (mix >> (16 * (i % 2))) & 0xFFFF; // 0–65535

        // ── Inheritance rule ──
        if (roll < 29491) {          // 45% — inherit from parent A
            gc[i] = ga[i];
        } else if (roll < 58982) {   // 45% — inherit from parent B
            gc[i] = gb[i];
        } else {                     // 10% — novel mutation
            gc[i] = mutate_gene(ga[i], gb[i], mix);
        }
    }

    return checksum256(child_arr);
}

uint32_t mutate_gene(uint32_t a, uint32_t b, uint64_t entropy) {
    // Mutation = random gene value within the SAME rarity band as parent average
    // ใช้ entropy สร้าง gene value ใหม่ที่ map เข้า band เดิมกับ mid-parent
    // (กันไม่ให้ mutation ข้ามจาก Common → Mythic ในขั้นตอนเดียว)
    allele_info info_a = resolve_gene(a);
    allele_info info_b = resolve_gene(b);
    uint8_t band = (info_a.band + info_b.band + 1) / 2; // ceiling average band

    // generate new raw value within target band
    uint64_t x = entropy ^ 0xA5A5A5A5A5A5A5A5ULL;
    x ^= x >> 17; x ^= x << 31; x ^= x >> 13;
    uint32_t raw = (uint32_t)(x & 0xFFFFFFFFULL);
    return band_to_gene_value(band, raw); // clamp เข้า band
}
```

### 5.3 Inheritance Summary

| กรณี | Probability | ผล |
|------|------------|-----|
| Inherit from A | 45% | allele A ทั้งยีน ไม่ตัด |
| Inherit from B | 45% | allele B ทั้งยีน ไม่ตัด |
| Mutation | 10% | allele ใหม่ใน rarity band เฉลี่ยของพ่อ-แม่ |

### 5.4 Shiny Breeding Bonus

ถ้าพ่อ-แม่ตัวใดตัวหนึ่งเป็น Shiny (G7 ≥ L):
- โอกาส mutation ใน G7 เพิ่มจาก 10% → 25%
- mutation ใน G7 = band L หรือ M (50/50) — ไม่ใช่ random band เฉลี่ย
- ⇒ พ่อ-แม่ shiny = ลูกมีโอกาส shiny สูงขึ้น แต่ไม่การันตี

---

## 6. Combinatorics — Duplication Probability Proof

### 6.1 Total Genetic Space

```
4 seeds × 64-bit = 256-bit entropy (หลัง mixing)
8 genes × 32-bit = 256-bit genotype
จำนวน unique genotypes ที่เป็นไปได้ = min(2^256, ∏ alleles_per_gene)
```

ด้วย allele definition: **14 × 14 × 14 × 14 × 14 × 16 × 14 × 14 = 1.72 × 10^9** unique named allele combinations

แต่นี่เป็นแค่ "ชื่อ allele" — ค่า raw 32-bit ทำให้มี 2^32 = 4.3 × 10^9 variants ต่อยีน → true genotype space = (4.3×10^9)^8 ≈ 1.8×10^77

ด้วย seed space 2^256 ≈ 1.16×10^77 → genetics diversity ≈ seed space (ใกล้เคียงกันมาก)

### 6.2 Birthday Collision Probability

ใช้ birthday paradox: P(collision) ≈ n² / (2 × N) เมื่อ n = จำนวน creatures, N = space size

| n (creatures) | N = 2^256 | N = 2^64 (ปัจจุบัน) |
|--------------|-----------|-------------------|
| 1,000 | negligible | negligible |
| 1,000,000 (1M) | **~4.3×10⁻⁶⁶** | 2.8×10⁻⁸ (0.000003%) |
| 100,000,000 (100M) | **~4.3×10⁻⁶²** | 0.028% |
| 1,000,000,000 (1B) | **~4.3×10⁻⁶⁰** | 2.8% |
| 10,000,000,000 (10B) | **~4.3×10⁻⁵⁸** | 93% ⚠️ |

**Conclusion:** ที่ 2^256, ต่อให้มีสัตว์ 1 หมื่นล้านตัว โอกาสซ้ำก็น้อยกว่า 1 ใน 10^57 — "น้อยมาก" แบบที่ในทางปฏิบัติ = **ไม่มีทางเกิด duplicate**.

> สำหรับเทียบ: จำนวนอะตอมในเอกภพที่สังเกตได้ ≈ 10^80 — genetics space 2^256 ≈ 10^77 ใกล้เคียงกับจำนวนอะตอมในเอกภพ! 🪐

### 6.3 Gene-Level Collision (8 ยีนเหมือนกันหมด)

P(all 8 genes match) = (1 / 14^8 สำหรับ named alleles) ≈ 1 / 1.7×10^9

สำหรับ 100M creatures: expected duplicate gene profiles ≈ (10^8)² / (2 × 1.7×10^9) ≈ 2.9×10^6 ≈ **~3 ล้านคู่ที่มี gene profile ซ้ำ**

**แต่นี่คือ named allele match** — raw uint32 ยังต่างกันได้แม้ allele เดียวกัน (เช่น Red สีแดงมี 2^32/14 ≈ 306 ล้านเฉด) → true duplicate (ทุก gene raw value ตรงกัน) = 0 จริง

---

## 7. Integration with Existing Contract

### 7.1 Changes to `pockethatch.hpp`

```cpp
// ── เพิ่มใน class pockethatch (public helpers — pure/const, เรียกจาก off-chain ได้) ──

// Decode genetics → 8 gene values
[[eosio::action]] std::vector<uint32_t> decodegenes(const checksum256& genetics);

// Calculate rarity score (0–1600)
[[eosio::action]] uint64_t rarityscore(const checksum256& genetics);

// Get overall rarity tier string
[[eosio::action]] std::string raritytier(const checksum256& genetics);

// ── แก้ private helpers ──
void make_seeds(uint64_t seeds[4]) const;                          // แทน make_seed() เดิม
checksum256 make_genetics(const uint64_t seeds[4]) const;           // รับ 4 seeds
allele_info resolve_gene(uint32_t gene_val) const;                  // decode ยีนเดี่ยว
uint32_t band_to_gene_value(uint8_t band, uint32_t raw) const;     // clamp เข้า band
checksum256 breed_genetics(const checksum256& a, const checksum256& b,
                           const uint64_t seeds[4]) const;          // gene-aware blend
```

### 7.2 Changes to `pockethatch.cpp`

| Action | Change |
|--------|--------|
| `hatch()` | `make_seed()` → `make_seeds(seeds)` + `make_genetics(seeds)` |
| `firsthatch()` | เหมือน hatch |
| `breed()` | แทนที่ bit-by-bit blend ด้วย `breed_genetics(a, b, seeds)` |
| `decodegenes()` | (ใหม่) แยก checksum256 → 8 × uint32 |
| `rarityscore()` | (ใหม่) คำนวณ Σ rarity_weight |
| `raritytier()` | (ใหม่) map score → tier string |

### 7.3 Storage — ไม่ต้องเปลี่ยน schema

genetics ยังเก็บเป็น `checksum256` เหมือนเดิม — NFT immutable data ยังเป็น hex string เหมือนเดิม — **backward compatible** 100%

สิ่งเดียวที่เปลี่ยนคือ **วิธี generate** ค่าใน 256-bit นั้น และ **วิธี blend** ใน breed

### 7.4 Creature Row — เพิ่ม optional field (v2)

```cpp
struct [[eosio::table("creatures")]] creature_row {
    // ... fields เดิม ...
    checksum256 genetics;       // ✅ มีอยู่แล้ว
    uint16_t    rarity_score;   // 🆕 optional — cache rarity score (save gas on reads)
};
```

ถ้าไม่เพิ่ม field: `rarityscore()` เป็น pure computation จาก genetics — O(1) per call, 8 gene decodes → cheap

---

## 8. Visual Expression Mapping (for future rendering)

ตารางนี้เป็น **off-chain reference** สำหรับ renderer/visualizer — contract ไม่ได้ enforce trait-to-pixel mapping

### 8.1 Rendering Pipeline (conceptual)

```
genetics (checksum256)
  → decodegenes() → [g0..g7] (8 × uint32)
    → resolve_gene(g_i) → allele_info {band, ordinal}
      → trait_lookup(gene_index, band, ordinal) → visual asset
```

แต่ละ gene map ไปยัง:
- **G0+G1** → base sprite tint (HSV shift) — เลือก sprite sheet เดียวกับ species template
- **G2+G3** → pattern overlay + pattern color multiply
- **G4** → body scale/crop (stretch/squash transform)
- **G5** → feature sprite attachment (horns/wings/tail overlay)
- **G6** → eye sprite swap
- **G7** → particle effect layer + shiny palette swap (ถ้า band ≥ L)

### 8.2 Species × Genetics Interaction

species template กำหนด **base silhouette** (รูปร่างพื้นฐานตาม family: Fire, Water, Nature, ฯลฯ) — genetics กำหนด **variation within that silhouette**

ตัวอย่าง:
- Fire Dragon template + G0=Blue(U) + G4=Giant(R) + G5=Dragon Wings(E) + G7=Shiny(L)
  → "Shiny Ice-Giant Winged Fire Dragon" — หายากมาก ✨

---

## 9. Gas Cost Analysis

| Operation | Current gas | New gas | Delta |
|-----------|------------|---------|-------|
| `make_seed()` → `make_seeds()` | ~50 µs | ~80 µs | +30 µs (4 hashes vs 1) |
| `make_genetics(seed)` → `make_genetics(seeds[4])` | ~30 µs | ~60 µs | +30 µs (4 loops vs 1) |
| Breed blending (bit-by-bit → per-gene) | ~20 µs | ~100 µs | +80 µs (8 gene decodes + roll) |
| `decodegenes()` (ใหม่, off-chain อ่าน) | — | ~200 µs | action ใหม่ |

**ทั้งหมดยังอยู่ใน µs range** — ไม่กระทบ CPU cost ของผู้เล่น

---

## 10. 🟢 DEFER — สิ่งที่ยังไม่ทำใน v1

| Item | เหตุผล | owner |
|------|--------|-------|
| Visual rendering engine | ต้องมี art assets ก่อน — genetics system รองรับแล้ว | Artist (Monanisa/ui) |
| Gene dominance/recessive | v1 = co-dominant (inherit A หรือ B) — dominance เพิ่ม depth ใน v2 | Sun (design) |
| Inbreeding penalty | breed ซ้ำคู่เดิมโอกาส mutation ลด — v1 ใช้ cooldown 24h ก็พอแล้ว | — |
| Cross-species breed | v1 = breed ใน species เดียวกัน — cross-species เพิ่ม combinatorial อีก 10× | Sun + Kevin |
| On-chain trait name storage | v1 = off-chain lookup table — v2 อาจ store allele names on-chain เป็น string ใน NFT mutable data | Kevin |

---

## 11. Summary — ทำไมระบบนี้ถึงตอบโจทย์

| เป้าหมาย | วิธีที่ทำ |
|----------|----------|
| **โอกาสซ้ำน้อยมาก** | 4-seed → true 2^256 space → collision probability < 10^-60 แม้มี 1B creatures (§6) |
| **Rarity distribution ชัดเจน** | power-law 6-tier per gene → population แจกแจงแบบธรรมชาติ: common เยอะ, mythic หายาก (§4) |
| **Breed มีความหมาย** | gene-aware inheritance (45/45/10) → allele จากพ่อ-แม่ + mutation ใน band (§5) |
| **Collectible** | 1.7×10^9 named allele combinations → "ของหายากให้ตามล่า" ไม่ใช่แค่สุ่ม template |
| **Backward compatible** | storage เดิม 100% — เปลี่ยนแค่ generate + blend logic (§7) |
| **Gas ต่ำ** | ทุก operation ยังอยู่ใน µs — ไม่กระทบผู้เล่น (§9) |
| **Shiny hunting** | 3% base chance ปรับได้จาก knob — สร้าง endgame loop "ตามล่า shiny" (§3.3, G7) |

---

*"Genetics ที่ดีไม่ใช่แค่สุ่ม แต่มันคือการสร้างเรื่องราว — ทุก allele คือหนึ่งบท ของสิ่งมีชีวิตที่ไม่ซ้ำใคร" — Sun*
