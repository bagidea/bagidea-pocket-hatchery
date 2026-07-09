# Pocket Hatchery — TOKENOMICS.md

> เจ้าของเอกสาร: **Sun** (เศรษฐกิจ/กันเงินเฟ้อ)
> สถานะ: ร่างออกแบบ v1 — ตัวเลขทั้งหมดเป็น **สมมติฐานที่ตรวจสอบได้** (ดู §7) รอ calibrate กับ data จริงบน testnet
> เชนเป้าหมาย: WAX · NFT = AtomicAssets (mutable template) · ตลาด = AtomicMarket · DEX = Alcor
>
> **เหตุผลที่ฉันเขียนเอกสารนี้:** ตอนโหวต concept ฉันเลือก A (Streak Pact) เพราะมัน "ไม่มี faucet เงินเฟ้อ" — เงินรางวัลมาจาก escrow ที่ sponsor เติม ไม่ใช่พิมพ์ใหม่. บอสเลือก B แล้ว หน้าที่ฉันคือ **ยกหลักการกันเงินเฟ้ออันเดียวกันนั้นมาฝังลงใน B** เพื่อให้เกมฟาร์ม idle ตัวนี้ **ไม่ตายแบบ Axie/StepN** (faucet เกิน sink → ผู้เล่นใหม่ต้องเติมเงินค้ำราคา → พังเป็นโดมิโน).

---

## 0. North Star — กฎเหล็กกัน" ponzi" (อ่านก่อนทุกข้อ)

เกม play-to-earn ตายเพราะ **เหรียญที่ขายได้ถูก "พิมพ์แจก" เป็นรางวัล** เร็วกว่าที่ระบบจะดูดกลับ (sink). พอผู้เล่นใหม่หยุดเข้า ไม่มีใครซื้อเหรียญที่ทุกคนแห่ขาย → ราคาดิ่ง → คนเก่าหนี → ตาย. นี่คือนิยาม ponzi ทางเศรษฐศาสตร์: payout ของคนเก่า = เงินของคนใหม่.

Pocket Hatchery แก้ที่ **ราก** ด้วยกฎ 3 ข้อนี้ ซึ่งบังคับใช้ได้บนเชนจริง:

> **กฎ #1 — เหรียญที่เทรดได้ ไม่เคยถูกพิมพ์เป็นรางวัล gameplay.**
> ทุก `$HATCH` ที่ผู้เล่นได้ "ฟรีจากการเล่น" ออกมาจาก **reward pool ที่ถูกเติมด้วยรายได้ค่าธรรมเนียมจริง + เงิน sponsor** เท่านั้น ไม่ใช่ `issue()` ใหม่. payout ออก ≤ revenue เข้า — **บังคับด้วยยอดคงเหลือใน escrow contract** (จ่ายไม่ได้ถ้า pool ว่าง). ⇒ ไม่มี faucet ให้วิ่งแซง sink ได้ตั้งแต่แรก = death-spiral เกิดไม่ได้เชิงโครงสร้าง.

> **กฎ #2 — เหรียญที่เล่นได้แบบไม่จำกัด (`EGG`) ขายไม่ได้.**
> `EGG` คือ "ทรัพยากรในเกม" ไม่ใช่สินทรัพย์ cash-out. ไม่มีคู่เทรดบน DEX. ต่อให้ผู้เล่นกอง EGG เป็นภูเขา ก็ไม่มีตลาดให้เทขายถล่มราคา. EGG เฟ้อได้แค่ "ในเชิงเกมเพลย์" ซึ่งเราคุมด้วย daily cap + sink (§2–4) ไม่ใช่เฟ้อเชิงการเงิน.

> **กฎ #3 — รายได้ของเรามาจาก "กิจกรรมจริง" (ค่าเทรด) ไม่ใช่ "ขายความหวัง".**
> เราไม่ขาย token pre-sale แล้วสัญญาผลตอบแทน. เรากินค่าธรรมเนียมตอนคนเทรด HATCH + ค่า royalty ตอนเทรด NFT — สองอย่างนี้โตตามจำนวนคนเล่นจริง ไม่ใช่ตามการระดมทุนรอบใหม่. และเราตั้งเพดานค่าธรรมเนียม **ต่ำ** (royalty 4%, swap 0.3%) เพื่อ "ไม่ขูดผู้เล่น" — เพราะถ้าขูด คนหนีไปตลาดอื่น รายได้เราเองที่หาย.

ทุกอย่างใต้บรรทัดนี้คือการขยายกฎ 3 ข้อนี้ให้เป็นตัวเลขจับต้องได้.

---

## 1. สองสกุลเงิน — แยกบทบาทชัด (รากของกฎ #1 และ #2)

| | 🥚 **EGG** (soft / ทรัพยากรในเกม) | 🐣 **$HATCH** (hard / เหรียญเทรดได้) |
|---|---|---|
| ที่มา | เก็บเกี่ยวจากสัตว์ (idle/tap) | **ซื้อบน DEX** หรือ **ชนะส่วนแบ่งจาก reward pool** เท่านั้น |
| เทรดบน DEX ได้ไหม | ❌ ไม่ได้ (off-market โดยตั้งใจ) | ✅ ได้ (Alcor) — นี่คือที่มาของรายได้ค่าเทรด |
| supply | ไม่จำกัด แต่ "ดูดกลับเร็ว" (cap + sink) | **จำกัดตายตัว 100,000,000 ตลอดกาล** ไม่มี inflation |
| พิมพ์เป็นรางวัลได้ไหม | — (เป็น resource) | ❌ **ห้ามเด็ดขาด** (กฎ #1) — แจกได้แค่จาก pool ที่ fee เติม |
| หน้าที่หลัก | feed, hatch, evolve, slot, cosmetic | breeding, premium egg, season pass, governance, prize |
| ถ้าราคา/ปริมาณพัง | ไม่กระทบการเงิน (ไม่มีตลาด) | มี buyback flywheel + sink เป็นเบรก (§4) |

**ทำไมต้องสองสกุล:** ระบบ play-to-earn ส่วนใหญ่ใช้ two-token เพื่อ "ซ่อน" เงินเฟ้อ (เหรียญ soft เฟ้อแต่อ้างว่าเหรียญ hard มั่นคง). เราใช้ตรงข้าม — **โปร่งใส**: EGG เฟ้อได้แต่ขายไม่ได้จึงไม่เป็นพิษ; HATCH ขายได้แต่พิมพ์แจกไม่ได้จึงไม่เฟ้อ. แต่ละสกุลถูกออกแบบให้ "จุดอ่อนของมันไม่เชื่อมกับตลาด".

### การกระจาย $HATCH (genesis, ไม่มีพิมพ์เพิ่มหลังจากนี้)

| ส่วน | % | จำนวน | เงื่อนไขปลดล็อก |
|---|---|---|---|
| Reward Pool (seed bootstrap) | 30% | 30,000,000 | ปล่อยตาม **ตารางลดทอน** + sunset (§4.3) — ไม่ใช่ faucet เปิด |
| Liquidity (DEX LP) | 20% | 20,000,000 | ล็อก LP ≥ 24 เดือน (พิสูจน์ความตั้งใจ) |
| Treasury / Ops | 15% | 15,000,000 | ใช้พัฒนา/ค่าเชน, รายงานการใช้สาธารณะ |
| Team | 15% | 15,000,000 | vest 4 ปี, cliff 1 ปี (กันทีมเทขายทิ้งผู้เล่น) |
| Ecosystem / Sponsor | 10% | 10,000,000 | สำหรับ prize pool ร่วมกับ partner |
| Community Sale / Airdrop | 10% | 10,000,000 | สัดส่วนเล็กโดยตั้งใจ — เราไม่พึ่งการระดมทุน |

> ⚠️ จุดที่ honest ที่สุด: **ช่วง bootstrap มีการปล่อย HATCH จาก Reward Pool จริง** (เพราะวันแรกยังไม่มี fee ให้เก็บ). แต่มันคือ **งบก้อนตายตัว + มีตารางลดทอน + มีวันจบ (sunset)** ไม่ใช่ faucet ที่เปิดตามจำนวนผู้เล่น. รายละเอียด crossover fee→reward ใน §4.3 — นี่คือคำสัญญาที่ falsify ได้.

---

## 2. Loop เศรษฐกิจหลัก — ได้อะไร / เสียอะไร

```
         ┌──────────────────────────────────────────────────────┐
         │                    วงจรหลัก (EGG)                      │
         │                                                       │
   HATCH EGG จาก   ──hatch──▶  🥚 Egg ──โต(เวลา)──▶ 🐣 Hatchling │
   pool/ซื้อ          (sink)                          │           │
         ▲                                       harvest EGG     │
         │                                            │          │
    ชนะ season /                                      ▼          │
    buyback        ◀── fee ──  ตลาด NFT + DEX  ◀── feed (sink)   │
         │                          ▲                 │          │
         │                          │            evolve (sink)   │
         └────── reward pool ◀──────┘                 │          │
                                                       ▼          │
                                              🦅 Adult/Evolved    │
                                              (collectible, เทรด) │
         └──────────────────────────────────────────────────────┘
```

**ผู้เล่นได้ (faucet):**
- **Idle harvest** — สัตว์ผลิต EGG ต่อชั่วโมงตาม stage (เวลาเดินจริง ยืนยันด้วย `current_time_point()` บนเชน กัน time-cheat)
- **Tap bonus** — แตะดูแลสัตว์ได้ EGG เพิ่มเล็กน้อย (มี cap ต่อวัน — กันบอท spam)
- **Daily login / care streak** — โบนัสเล็กๆ สร้างนิสัยกลับมา (ไม่ใช่เงินก้อน)
- **Season reward (HATCH)** — ส่วนแบ่งจาก pool ตามอันดับ/ความสำเร็จ (มาจาก fee เท่านั้น — กฎ #1)

**ผู้เล่นเสีย (sink — หัวใจกันเงินเฟ้อ):**
- **Feed** — ต้องให้อาหาร (EGG) เพื่อให้สัตว์ผลิตต่อ; **ค่า feed กินสัดส่วน production ที่สูงขึ้นเมื่อสัตว์โต** (ดู §3) → สัตว์ใหญ่ = prestige/สะสม ไม่ใช่เครื่องพิมพ์เงินไม่จำกัด
- **Hatch** ไข่ใหม่ (EGG ก้อน)
- **Evolve** ขึ้น stage (EGG ก้อนใหญ่ + time-gate)
- **เปิด slot สัตว์เพิ่ม** (EGG ขั้นบันได)
- **Breeding** — รวม genes ลูกใหม่ (EGG + **HATCH** + cooldown พ่อแม่) ← sink ของ HATCH ที่สำคัญ
- **Cosmetic / reroll / naming** — sink ความสวยงาม (บางส่วนกิน HATCH)
- **RAM ตอน hatch** — ผู้เล่นจ่าย RAM ของตัวเอง หรือเรา subsidize (ดู §6 ต้นทุนเรา)

**หลักสมดุล:** ที่ "บัญชี mid-game ทั่วไป" → **EGG ที่ดูดออก (feed + lump sink) ≥ EGG ที่ผลิต** เสมอ (เป้า sink/faucet ratio ≥ 1.0 ที่ระดับ adult, ดู §7). ผู้เล่นจึง "สะสมได้ช้าและมีเพดาน" — สนุกเพราะความก้าวหน้า ไม่ใช่เพราะกองเงินบวม.

---

## 3. Token sink + Daily cap — เครื่องยนต์กันเงินเฟ้อ (ตัวเลขตั้งต้น)

### 3.1 อัตราผลิต vs ค่า feed ต่อ stage (EGG/ชม.)

| Stage | ผลิต (gross) | feed (sink) | **net** | feed คิดเป็น % ของผลิต |
|---|---|---|---|---|
| 🥚 Egg | 0 | 0 | 0 | — (ฟักอยู่) |
| 🐣 Hatchling | 1.0 | 0.3 | **0.7** | 30% |
| 🦎 Juvenile | 3.0 | 1.5 | **1.5** | 50% |
| 🦅 Adult | 6.0 | 4.0 | **2.0** | 67% |
| ✨ Evolved (rare) | 10.0 | 8.0 | **2.0** | 80% |

> **กลไกกันเฟ้อในตาราง:** ยิ่งสัตว์โต feed กินสัดส่วนยิ่งสูง (30%→80%) → **net ไม่โตเชิงเส้น** (ตันที่ ~2/ชม.). สัตว์ evolved คือ "ของสะสม/หน้าตา/prestige + เทรดได้" ไม่ใช่ทางลัดปั๊มเงิน. ถ้าผู้เล่นไม่ feed → สัตว์หยุดผลิต (ไม่ตาย — well-being: ไม่ลงโทษโหด แค่หยุด accrue).

### 3.2 Daily cap (ต่อบัญชี) — กันบอท/วาฬกดเฟ้อ

| | Web ฟรี | ติดตั้ง Office + plugins |
|---|---|---|
| เพดาน harvest net | **240 EGG/วัน** | **312 EGG/วัน** (+30%) |
| Offline accrual cap | 8 ชม. | 12 ชม. |
| Tap bonus cap | +60 EGG/วัน | +90 EGG/วัน |

> เพดานนี้คือ "เพดานแข็ง" — ต่อให้มีสัตว์ 50 ตัว ก็ harvest ได้ไม่เกินเพดาน/วัน. ⇒ การถือสัตว์เยอะให้ผลตอบแทน **ลดน้อยถอยลง (diminishing)** = กันวาฬกวาดซื้อสัตว์มาปั๊ม EGG ถล่มระบบ. offline cap 8–12 ชม. = ต้องกลับมาเล่น แต่ไม่โหด (กลับมาวันละครั้งก็เก็บเต็ม).

### 3.3 Lump sink (EGG ก้อน — ดูดเร็ว)

| รายการ | ราคา (EGG) | หมายเหตุ |
|---|---|---|
| Hatch ไข่ใหม่ | 150 | หรือซื้อ Egg NFT จากตลาด |
| Evolve → Juvenile | 300 | + time-gate |
| Evolve → Adult | 800 | + time-gate |
| Evolve → Evolved | 2,000 | + time-gate + ต้องสำเร็จเงื่อนไข |
| Slot สัตว์ที่ 4,5,6… | 500 → 1,200 → 2,500 (ขั้นบันได) | |
| Cosmetic reroll | 100 | |

### 3.4 HATCH sink (ดูด token เทรดได้ — สร้าง demand + deflation)

| รายการ | ราคา (HATCH) | ปลายทาง |
|---|---|---|
| Breeding (ต่อครั้ง) | 5 HATCH | **40% เผาทิ้ง (burn) · 60% เข้า reward pool** |
| Premium Egg pack (rare gene สูง) | 10 HATCH | 50% burn · 50% pool |
| Season Pass | 15 HATCH | เข้า treasury + pool |
| Listing boost บนตลาด | 1 HATCH | burn |
| Naming / ของแต่งพิเศษ | 1–3 HATCH | burn |
| **Accelerate (ข้ามเวลาโต)** | ผันแปร (จ่ายเท่าไรก็ได้) | **100% burn** — sink ใหม่จาก Yamamoto (CONTRACT-MODEL §2). ข้าม **time-gate** ของ evolve ไม่ใช่ข้าม **daily EGG cap** → ไม่ทำให้ EGG เฟ้อ (harvest ยังโดน cap §3.2). **ไม่นับเป็นคะแนน season โดยตรง** (กัน pay-to-win — §10.3) |

> **Deflation เบรก:** ทุกการใช้ HATCH เผาบางส่วนทิ้ง → supply หมุนเวียนลดลงเรื่อยๆ สวนทางกับ unlock ใดๆ. ส่วนที่ไม่เผาเข้า pool = วนกลับเป็นรางวัลโดยไม่ต้องพิมพ์ใหม่ (กฎ #1).

---

## 4. รายได้สองฝั่งของเรา — ยั่งยืน ไม่ขูด (กฎ #3)

### 4.1 ฝั่งที่ 1 — ค่าธรรมเนียมเทรด $HATCH (DEX)
- เรา seed liquidity HATCH/WAX บน **Alcor** แล้วเป็น LP → กิน **swap fee 0.3%** ตามปริมาณเทรดจริง
- (ทางเลือก) protocol fee เล็กน้อย **0.1%** บนปริมาณ swap เข้า treasury — รวมไม่เกิน ~0.4% ซึ่งต่ำกว่าตลาดทั่วไป
- **ทำไมไม่ขูด:** ถ้าตั้ง fee สูง คนไปเทรดที่ pool อื่น/OTC รายได้เราหายเอง. fee ต่ำ + ปริมาณสูง = ยั่งยืนกว่า

### 4.2 ฝั่งที่ 2 — ค่า royalty ตลาด NFT (AtomicMarket)
- ตั้ง collection royalty **4%** บนการเทรด creature/egg ในตลาดรอง
- แบ่ง: **2% เข้า treasury · 2% เข้า buyback** (ซื้อ HATCH คืนจากตลาด → เติม reward pool)
- Primary sale (ไข่รุ่นแรก/season) ขายเป็น HATCH หรือ WAX → เข้า treasury + pool
- **ทำไมไม่ขูด:** 4% เทียบ NFT market มาตรฐาน (5–10%) ถือว่าต่ำ; ผู้เล่นที่เทรดรู้สึก "แฟร์" → เทรดบ่อยขึ้น → เราได้มากขึ้นจาก volume ไม่ใช่จาก rate

### 4.3 Flywheel + Crossover (หัวใจของ "ไม่ใช่ ponzi" — falsify ได้)

```
ผู้เล่นเทรด HATCH/NFT มากขึ้น
        │
        ▼
  fee revenue เพิ่ม ──▶ buyback ซื้อ HATCH คืนจากตลาด ──▶ เติม reward pool
        │                    (สร้าง buy pressure)              │
        │                                                      ▼
        └──────────────── จ่าย season reward (จาก pool) ◀──────┘
                          payout ≤ fee revenue เสมอ
```

**ตารางลดทอน Bootstrap → Fee-funded (คำสัญญาที่ตรวจได้):**

| Season | Reward จาก Bootstrap Pool (HATCH) | Reward คาดว่าจาก Fee/Buyback | สถานะ |
|---|---|---|---|
| 1 | 1,500,000 | ~0 (ยังไม่มี volume) | พึ่ง bootstrap 100% |
| 2 | 1,275,000 (×0.85) | ↑ | hybrid |
| 4 | ~920,000 | ↑↑ | hybrid |
| ~8–10 | → tapering 0 | **≥ emission** | **Crossover: fee เลี้ยงตัวเองได้** |
| หลัง sunset | 0 | 100% | **ไม่พิมพ์/ไม่ปล่อย bootstrap อีก** |

> **เงื่อนไข sunset (บังคับ):** เมื่อ buyback-funded reward ≥ bootstrap emission ติดกัน 2 season → ปิดท่อ bootstrap. หลังจากนั้นรางวัลทั้งหมด = fee จริง. **ถ้า fee revenue ไม่โตถึงจุด crossover** = สัญญาณว่าเกมไม่มี demand จริง → เรา **ลดขนาด reward pool ลงตามจริง** (ไม่ฝืนปล่อยจนพอง) — เกมหดตัวอย่างนุ่มนวล ไม่ระเบิด. นี่คือข้อแตกต่างจาก ponzi: ของเรา **ยอมเล็กลงได้ ไม่ต้องหาคนใหม่มาค้ำ**.

---

## 5. Funnel รางวัล — Web ฟรี vs ติดตั้ง Office (ตามที่บอสวาง)

**โจทย์บอส:** เล่นบน web ฟรี = รางวัลพื้นฐาน · ติดตั้ง BagIdea Office + plugins = ปลดของหายาก/พิเศษ. ออกแบบให้ **จูงใจให้อยากติดตั้งจริง** แต่คน web ล้วน **ยังสนุก ไม่รู้สึกถูกบังคับ**.

### 5.1 หลักการออกแบบ funnel (กันไม่ให้กลายเป็น pay/install-to-win)

> **เส้นแบ่งทอง:** สิ่งที่ปลดล็อกจากการติดตั้งต้องเป็น **"ความหายาก + ความสะดวก + ความสวย (collectible/flavor/convenience)"** เป็นหลัก — **ไม่ใช่ "พลังเศรษฐกิจดิบ" ที่ทำให้คน web แข่งไม่ได้**. และอะไรที่เป็น power จริง (เช่น harvest rate) ก็ถูก **daily cap คุมเพดานอยู่แล้ว** → ช่องว่างจึง "บรรจบ" ไม่ถ่างเป็นทวีคูณ.

คน web ต้องรู้สึกว่า **"เกมนี้เล่นจบได้ สนุกครบ ชนะได้"** — ไม่ใช่ demo ที่ถูกตัดแขนขา. คนติดตั้งรู้สึกว่า **"ได้เวอร์ชัน deluxe + ของสะสม exclusive + สะดวกขึ้น"** — แรงจูงใจคือ *ความอยาก* ไม่ใช่ *ความกลัวตกขบวน*.

### 5.2 ตารางเทียบสิทธิ์

| ฟีเจอร์ | 🌐 Web ฟรี | 🏢 ติดตั้ง Office + plugins |
|---|---|---|
| Core loop (hatch/feed/harvest/evolve/trade) | ✅ ครบ | ✅ ครบ |
| สายพันธุ์พื้นฐาน (common/uncommon) | ✅ ทั้งหมด | ✅ ทั้งหมด |
| **สายพันธุ์ rare/shiny exclusive** | ปลดได้บางส่วนผ่าน event/ตลาด | ✅ ปลด template หายาก + variant ชินี่ |
| Daily harvest cap | 240 EGG | **312 EGG (+30%)** |
| Offline accrual | 8 ชม. | **12 ชม.** |
| **Caretaker (auto-feed reminder / offline helper)** | — | ✅ plugin ดูแลฟาร์มให้ตอนไม่อยู่ |
| Cosmetic / seal / โครงสร้างฟาร์มสวยพิเศษ | พื้นฐาน | ✅ ชุด exclusive ตามฤดู |
| Plugin mini-game (drop วัตถุดิบ rare gene) | — | ✅ |
| Season reward tier | ได้ (tier มาตรฐาน) | ได้ (tier + slot exclusive cosmetic) |
| สิทธิ์เทรด / เป็นเจ้าของ NFT จริง | ✅ เท่ากันทุกประการ | ✅ เท่ากันทุกประการ |

### 5.3 ทำไม funnel นี้ "จูงใจจริง แต่ไม่บังคับ"
- **ตัวดึงหลัก = ของสะสม exclusive + ความสะดวก (Caretaker)** ไม่ใช่ "เงินมากกว่า 5 เท่า". คนชอบสะสม/อยากได้ shiny จะติดตั้งด้วยความอยาก
- **+30% cap ถูกครอบด้วยเพดานอยู่ดี** — คน web ก็ถึงเป้าได้ แค่ช้ากว่านิดเดียว ไม่ใช่ "เป็นไปไม่ได้". ช่องว่างจึง *meaningful แต่ไม่ punishing*
- **ทุกอย่างยังเคารพ global emission cap (§4)** — install bonus ห้ามทำให้ HATCH ที่จ่ายออกเกิน fee revenue (กฎ #1 ครอบ funnel ด้วย). install ปลด "ของหายาก/หน้าตา/cap soft-currency" ได้ แต่ **ปลด HATCH ฟรีเพิ่มไม่ได้** — ไม่งั้นเราทำลายกฎ #1 ด้วยมือตัวเอง
- **ไม่มีอะไรที่คน web "ทำไม่ได้เลย"** — ทุก rare ยังหาได้ผ่านตลาด/event (แค่ไม่ได้แจกให้). คน web ที่เก่ง/ขยันยัง outperform คนติดตั้งที่ขี้เกียจได้ = เกมยัง fair

---

## 6. ต้นทุนฝั่งเรา (อย่าลืม — กันขาดทุนเงียบ)

- **RAM** ต่อ creature (mutable data): จำกัด attribute ให้น้อย (stage, genes, fed_at, level) + **ผู้เล่นจ่าย RAM ตอน hatch** หรือเรา subsidize เฉพาะ onboarding ไข่แรก แล้ว recoup จาก primary sale
- **CPU/NET**: action บ่อย (feed/harvest) → พิจารณา batching / claim เป็นช่วง (ไม่ใช่ทุก tap = 1 tx) เพื่อลด resource churn
- **Buyback/LP**: ใช้ส่วน fee — ไม่ใช้เงินทุนเราเอง (ยั่งยืน)

---

## 7. สมมติฐานตัวเลข — ตรวจสอบ/falsify ได้ (เปิดให้ท้าทาย)

ทุกแถวคือสิ่งที่ฉัน **ยินดีให้พิสูจน์ว่าผิด** ด้วย data จริง. ถ้าผิด เราปรับ knob ไม่ใช่หลักการ.

| # | สมมติฐาน | ค่าตั้งต้น | วิธีตรวจ (on-chain / analytics) |
|---|---|---|---|
| A1 | **Sink/Faucet ratio** ที่บัญชี mid-game ≥ 1.0 | เป้า 1.0–1.2 | sum(feed+lump EGG sink) ÷ sum(harvest EGG) ต่อ cohort ราย week |
| A2 | Daily harvest cap พอเหมาะ (ไม่กดจนเบื่อ / ไม่หลวมจนเฟ้อ) | 240 / 312 | % ผู้เล่นที่ชน cap; median EGG balance trend (ควรนิ่ง ไม่พุ่ง) |
| A3 | net EGG/ชม. ตันที่ ~2 ที่ stage สูง | 2.0 | จำลอง + วัด balance สะสมจริงต่อสัตว์ |
| A4 | HATCH burn ≥ HATCH ที่เข้า circulation/season | burn ≥ release | track `retire`/burn action vs pool payout บนเชน |
| A5 | **Crossover fee→reward** ภายใน season 8–10 | ≤ S10 | fee revenue (USD) vs bootstrap emission (USD) ต่อ season |
| A6 | DAU จุดคุ้ม fee เลี้ยง reward | ~2,000 DAU @ avg trade | unique signer/วัน × avg fee/หัว — ตรวจ AtomicMarket + Alcor |
| A7 | Install conversion (web → ติดตั้ง Office) | เป้า 8–15% | เทียบ wallet ที่ถือ exclusive template vs ทั้งหมด |
| A8 | ช่องว่าง web vs install "meaningful ไม่ punishing" | progress gap ≤ ~30% | เวลาถึง milestone เดียวกันของ 2 กลุ่ม |
| A9 | royalty 4% ไม่กด volume | volume คงโต | A/B sensitivity ถ้าเคยปรับ rate |
| A10 | EGG ไม่มีทางรั่วออกเป็น cash | =0 | audit: ไม่มี action แปลง EGG→token/WAX โดยตรง — **รวมถึง season score ไม่อ้าง EGG** (§10.1 SCORE-1) |
| A11 | **Season reward ไม่เป็น money-pump** — ผลตอบแทนชายขอบ < ต้นทุน HATCH ที่เผาไต่ tier | return/burn < 1.0 | ต่อ season: Σ tier payout (HATCH) ÷ Σ HATCH burned เพื่อแข่ง; ถ้า ≥1 ติดกัน = ลด `tier_amount` (กัน wash-burn, §10.3 SCORE-2) |

**ตัวอย่าง worked (sanity check A6):** สมมติ 2,000 DAU, เทรดเฉลี่ย $5/หัว/วันบน NFT+DEX, fee รวม ~4% ⇒ ~$400/วัน ⇒ ~$12,000/เดือน ⇒ ~$36,000/season (3 เดือน). ถ้าราคา HATCH สมมติ $0.05 ⇒ buyback ได้ ~720,000 HATCH/season — เทียบ bootstrap S4 ~920k ⇒ ใกล้ crossover พอดี ✅ (สมมติฐานเชิงภาพ — ต้อง calibrate กับราคา/volume จริง).

---

## 8. Failure modes + เบรกฉุกเฉิน (well-being ของเศรษฐกิจ)

| ความเสี่ยง | เบรกที่ฝังไว้ |
|---|---|
| Faucet โตเกิน sink | daily cap + feed-ratio เพิ่มตาม stage + lump sink (§3) |
| HATCH ถูกพิมพ์แจกจนเฟ้อ | **กฎ #1 บังคับด้วย escrow balance** — pool ว่าง = จ่ายไม่ได้ |
| EGG เทขายถล่มราคา | **เป็นไปไม่ได้** — EGG ไม่มีตลาด (กฎ #2) |
| ผู้เล่นใหม่หยุดเข้า | reward หดตามจริง (§4.3 sunset) — เกมเล็กลงได้ ไม่พัง |
| บอท/วาฬ farm | daily cap + diminishing return + tap cap + RAM cost ต่อ hatch |
| Time-cheat | `current_time_point()` guard ทุก action ที่ใช้เวลา (Yamamoto ยืนยันแล้วเป็น pattern มาตรฐาน) |
| Install funnel กลายเป็น pay-to-win | install ปลด HATCH ฟรีเพิ่ม **ไม่ได้** (§5.3) — ปลดได้แค่ rarity/convenience/soft-cap |

---

## 9. SYNC — รอเจ้าของ contract/data model (Yamamoto)

data model ของ creatures/token ยังไม่วาง ฉันมาร์กจุดที่ต้องจับคู่ไว้:

- 🔌 **SYNC #1** — `EGG` เป็น on-chain token (eosio.token clone, ห้ามมี DEX pair) หรือ off-chain ledger? (กระทบกฎ #2 — ถ้า on-chain ต้องมั่นใจไม่มีใครเปิด pair ได้)
- 🔌 **SYNC #2** — Reward pool = escrow contract ที่ "จ่ายไม่เกิน balance" (ยืนยันกฎ #1 บังคับได้จริงบนเชน) — reuse pattern escrow จาก Streak Pact concept ได้
- 🔌 **SYNC #3** — buyback กลไก: on-chain auto หรือ treasury ops manual? (กระทบ trust/โปร่งใส)
- 🔌 **SYNC #4** — feed/harvest action: batch หรือ per-tap? (กระทบต้นทุน CPU §6)
- 🔌 **SYNC #5** — install funnel ผูกกับ wallet/account อย่างไร (proof-of-install ที่ปลอม/sybil ไม่ได้) — ออกแบบ unlock ให้ผูกกับ template ownership ไม่ใช่ flag client-side
- 🔌 **SYNC #6** — burn ใช้ `retire` action จริง (ตรวจบนเชนได้ตาม A4)

> ✅ **SYNC #1–6 ได้รับคำตอบจาก Yamamoto แล้ว** (`CONTRACT-MODEL.md §4`). ทุกข้อ map ลงโครงสร้างบังคับได้: EGG = `players.egg_balance` off-token (#1), `rewardpool` escrow + `check(payout ≤ balance)` (#2), `buybackpool` hybrid (#3), tap client-reported + cap (#4), `players.installed` gate ด้วย template ownership (#5), `retire` เฉพาะ HATCH sink (#6). ฉันยืนยันว่า **ไม่มีข้อใดขัดกับ TOKENOMICS** — รายละเอียด + จุดที่ต้องเติม ดู §11.

---

## 10. สูตรคะแนน Season (Season Score) — ผูกกับ data model ของ Yamamoto

> เติมเต็ม `seasonRewardTier()` ที่ Yamamoto leave เป็น house-authored placeholder (`CONTRACT-MODEL §3.5`, assumption #8). นี่คือ logic เศรษฐกิจที่ฉันเป็นเจ้าของ (§2: "season reward = ส่วนแบ่ง pool ตามอันดับ/ความสำเร็จ"). เขียนให้ผูกกับ field จริงในตาราง `players`/`creatures` และ **ไม่ทำลายกฎเหล็ก 3 ข้อ**.

### 10.1 กฎทองของสูตรนี้ — **EGG ห้ามแตะคะแนน** (ปิดช่องรั่วของ SYNC #4)

Yamamoto ยอมรับว่า `tap_accrued` เป็น **client-reported** — contract พิสูจน์จำนวน tap จริงไม่ได้ (CONTRACT-MODEL §3.7/§4/assumption #9). เขาบอกว่ามันปลอดภัยเพราะ "EGG economically inert (ขายไม่ได้ + ไม่มี action แปลง EGG→HATCH)". **สูตรคะแนนคือ channel สุดท้ายที่ EGG จะรั่วเข้า HATCH ได้** — ถ้าคะแนน season เป็นฟังก์ชันของ EGG (balance หรือ `total_egg_farmed`) เมื่อไหร่ คนโกง tap จะปั๊ม EGG → ดันคะแนน → คว้า HATCH จาก pool = **ทำลายกฎ #1 ทางอ้อม**.

> **🔒 Invariant SCORE-1:** `seasonScore` **ต้องไม่อ้างอิง** `egg_balance`, `total_egg_farmed`, `tap_accrued` หรือ field EGG ใดๆ เลย. ⇒ คำกล่าวอ้าง "EGG inert" ของ Yamamoto จึง **จริงแบบปิดวง** — ไม่มีเส้นทางใดให้ EGG กลายเป็น HATCH แม้ผ่าน season reward. นี่คือจุดที่ความเข้มงวด tokenomics ของฉัน "ขัน" SYNC #4 ให้แน่น: client-reported tap ปลอดภัย **เพราะ** คะแนนไม่แตะมัน.

### 10.2 คะแนนมาจาก "ความสำเร็จที่มี throttle คุม" เท่านั้น (ตรวจได้บนเชน)

คะแนนสะสมจาก action ที่ **ผ่านด่านกันโกงอยู่แล้ว** — ทุก term พิสูจน์ได้บนเชน และเงินซื้อลัดไม่ได้เต็มที่ (มี cooldown/time-gate/EGG cap ครอบ):

| Term | มาจาก action | +คะแนน (ค่าตั้งต้น) | ทำไมโกง/ซื้อลัดไม่ได้ |
|---|---|---|---|
| **Evolve** | `evolve` ขึ้น stage `k` | `+ k² × 10` (Hatchling=10, Juvenile=40, Adult=90, Elder=160) | ต้อง `G ≥ threshold` ที่มาจาก `sync()` (เวลาจริง, time-cheat ไม่ได้) + จ่าย EGG sink. superlinear ให้รางวัล "โตจริงถึง stage สูง" |
| **Breed** | `breed` สำเร็จ | `+ 50` ต่อครั้ง | เผา HATCH จริง (ต้นทุนจริง) + `breed_cd` ทั้งพ่อแม่ + ต้องมี genes 2 ตัว → breadth/skill ไม่ใช่สแปม |
| **Active days** | นับวันที่มี gameplay action ≥ 1 | `+ 5` ต่อวัน (เพดาน = จำนวนวันใน season) | สม่ำเสมอ ไม่ใช่เงิน; เพดานกันฟาร์ม |

**สิ่งที่ไม่นับคะแนน (เจตนา):**
- ❌ EGG balance/farmed/tap — กฎ §10.1
- ❌ `accelerate` (ข้ามเวลา) — แม้เผา HATCH จริง ก็ **ไม่ให้คะแนนตรง** มิฉะนั้นรวยซื้ออันดับได้ → pay-to-win. accelerate ได้คะแนน **ทางอ้อม** ผ่าน evolve ที่มันปลดล็อก (ยังต้องจ่าย EGG sink + ผ่าน threshold) — เงินช่วย "เร็วขึ้น" แต่ไม่ "ซื้อแต้มตรงๆ"
- ❌ จำนวนสัตว์ที่ถือ (whale กวาดซื้อ) — diminishing อยู่แล้วจาก daily harvest cap; ถือเยอะไม่ดันคะแนน

### 10.3 จากคะแนน → payout (bounded by กฎ #1)

```
ปลาย season (admin newseason เลื่อน index):
  tier(player) = ระดับจาก seasonScore เทียบ threshold คงที่ (S / A / B / —)
  payout(player) = tier_amount[tier]                    // ตารางจ่ายต่อ tier (house-authored, ต่อ season)
  claimreward():  check(payout ≤ rewardpool.balance)    // 🔒 กฎ #1 — จ่ายไม่เกิน escrow
```

- **จ่ายเป็น tier คงที่ (ไม่ pro-rata)** ใน v1 — ไม่ต้อง aggregate ผลรวมทั้งระบบในทรานแซกชันเดียว (ถูก/ตรวจง่าย). pro-rata-by-share = v2.
- **เพดานรวม:** house ตั้ง `Σ(tier_count × tier_amount) ≤ season pool budget ≤ rewardpool.balance`. ผลรวมจ่ายทั้ง season **ไม่เกิน pool** เสมอ → ไม่เกิน revenue จริง (กฎ #1/#3).
- **🔒 Invariant SCORE-2 (กัน money-pump):** ที่ผู้เล่นชายขอบ **expected payout < ต้นทุน HATCH ที่เผาเพื่อไต่ tier**. เพราะ pool คงที่ถูกแบ่ง — ยิ่งคนแข่งเผามาก share ต่อหัวยิ่งหด → return ลงต่ำกว่า 1 เองตามดุลยภาพ. season reward จึงเป็น **โบนัสฉลองการเล่น ไม่ใช่เครื่องปั๊มกำไรจากการเผา** (ไม่งั้นเกิด wash-burn). house ต้อง calibrate `tar_amount` ให้สอดคล้อง — ดู A11.

### 10.4 🔧 สิ่งที่ data model ต้องเติมเพื่อรันสูตรนี้ (SYNC กลับหา Yamamoto)

ตาราง `players` ปัจจุบันเก็บแต่ **lifetime** (`total_egg_farmed`/`total_hatch_burned`) — คำนวณคะแนน **ต่อ season** ตรงๆ ไม่ได้. และคำนวณตอนปิด season โดยไล่ creatures ทุกตัว = แพง. ทางออกที่ถูก + reuse pattern ที่ Yamamoto มีอยู่แล้ว (lazy daily-reset §3.3):

- 🔌 **SYNC #7** — เพิ่ม `players.season_score_raw` (`uint64`) + `players.season_score_idx` (`uint16`). reset แบบ **lazy ต่อผู้เล่น**: ถ้า `season_score_idx != cfg.season_index` ตอนแตะ action ใดๆ → `season_score_raw = 0 ; season_score_idx = cfg.season_index` (เหมือน `reset_daily_if_new_day`). action `evolve`/`breed` (+ active-day tick) **บวกแต้มตอนทำ action** ไม่ใช่ไล่นับตอนปิด → O(1) ต่อ action, ไม่ต้อง mass-iterate.
- 🔌 **SYNC #8** — `claimreward` อ่าน `season_score_raw` → map tier → จ่าย โดย `check(payout ≤ rewardpool.balance)` + กันเคลม season เดิมซ้ำ (`players.last_reward_season`).
- 🔌 **SYNC #9** — active-day tick: เพิ่ม `players.active_day` (`uint32`); action แรกของวัน +5 แต้มแล้ว stamp. (reuse จังหวะ `reset_daily_if_new_day`).

---

## 11. รายงาน reconcile: data model ของ Yamamoto vs TOKENOMICS

หลังเดิน SYNC #1–6 + ผูกสูตรคะแนน — **กระดูกสันหลังตรงกันหมด ไม่มีข้อขัดหลักการ.** จุดที่ต้องเติม/ตกลง:

**✅ ตรงกันสนิท (กฎเหล็กบังคับได้จริง):** dual-currency, EGG off-token (`uint64`, เปิด DEX pair ไม่ได้), `rewardpool` escrow + `check(payout ≤ balance)`, **ไม่มี `eosio.token::issue` ใน gameplay**, `retire` เฉพาะ HATCH sink, `withdraw` bound ด้วย `sweepableHatch()` (admin drain escrow ไม่ได้ — จุดนี้ Yamamoto **เกินความคาดหวัง**, ปิดช่อง insider ที่ฉันยังไม่ได้เขียน), install gate ด้วย template ownership ไม่ใช่ client flag.

**🔧 จุดที่ขัด/ขาด (ต้องเติม — ไม่ใช่ blocker หลักการ):**

| # | เรื่อง | สถานะ | ทางแก้ |
|---|---|---|---|
| Δ1 | **per-season accumulator ไม่มี** — มีแต่ lifetime → รันสูตรคะแนนไม่ได้ | ขาด | SYNC #7–9 (§10.4) — เพิ่ม `season_score_raw` + lazy reset |
| Δ2 | **`premium_egg_cost` + `listing_boost` มี knob ใน config แต่ไม่มี action** ใน §2 ที่เรียกใช้ | ขาด action | เพิ่ม action `buypremiumegg`/`boostlisting` หรือถอด knob; ทั้งคู่เป็น HATCH sink ที่ฉันนับใน §3.4 (กระทบ deflation เล็กน้อย) |
| Δ3 | **install funnel เติมไม่ครบ** — `install_cap_bonus` ครอบแค่ daily EGG cap (+72 ✅) แต่ §3.2/§5.2 ของฉันสัญญา installer ได้ **offline 12h (vs 8)** + **tap cap 90 (vs 60)** ด้วย; data model ไม่มี field สองตัวนี้ | ไม่ตรง | เลือก: (ก) เพิ่ม install bonus ให้ `offline_cap_h`/`tap_egg_cap`, หรือ (ข) ตัด TOKENOMICS เหลือ "install = +30% daily cap อย่างเดียว". ฉันเอน (ก) เพื่อให้ funnel น่าติดตั้งตามเดิม — แต่เป็น policy call |
| Δ4 | **`accelerate` (pay-to-skip-time) เป็น sink ใหม่** ไม่อยู่ใน TOKENOMICS เดิม | เพิ่มแล้ว | รับเข้า §3.4 (100% burn, ไม่เฟ้อ EGG, ไม่ให้คะแนน season ตรง §10.2) — **ไม่ขัด**, เป็นส่วนเสริม sink ที่ดี |
| Δ5 | **Season Pass** (§3.4 ของฉัน) ไม่มีใน config/action เลย | ขาด | ยอมรับได้ว่าเป็น Office-plugin layer / out-of-v1 (ARCHITECTURE §10) — mark deferred, ไม่นับใน sink v1 |

**สรุปจุดยืน tokenomics:** assumption #9 ของ Yamamoto (tap client-reported, ไม่ trustless) — **ฉันรับรองว่าปลอดภัยเชิงเศรษฐกิจ** เพราะ Invariant SCORE-1 ปิดวง EGG→HATCH สนิทแล้ว (คะแนน season ไม่แตะ EGG). ไม่ต้องจ่าย cost ของ on-chain tap proof. เคลียร์.

---

*"กันเงินเฟ้อ" ไม่ใช่การทำให้เกมจน — มันคือการทำให้ความสนุกของผู้เล่นวันนี้ ไม่ถูกสร้างบนเงินของผู้เล่นวันพรุ่งนี้. เกมที่ยุติธรรมกับคนรุ่นหลัง คือเกมที่อยู่ได้นาน. — Sun*
