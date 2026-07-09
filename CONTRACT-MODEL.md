# Pocket Hatchery — CONTRACT-MODEL.md

> เจ้าของเอกสาร: **Yamamoto** (สถาปนิกหลัก / contract & data model)
> สถานะ: **design v1 (paper)** — ยังไม่ deploy. เป็น **companion reference** ของ `CONTRACT.md` (รายละเอียด action flow แบบเต็มอยู่ที่นั่น) + เอกสารที่ **ปลดล็อก SYNC #1–6** ที่ Sun รอใน `TOKENOMICS.md §9`
> เป้าหมายของไฟล์นี้: (1) รวบตาราง+action ทุกตัวไว้ที่เดียว (2) **map กฎเหล็ก 3 ข้อของ Sun → โครงสร้างตรงไหนบังคับ** (3) ตอบ SYNC #1–6 ชัด (4) assumptions ท้ายไฟล์
>
> เงื่อนไขสำคัญที่ carry over จาก `CONTRACT.md`: lazy-growth `sync()` (ไม่เชื่อ client), ผู้เล่นเป็น RAM-payer ของ row ตัวเอง, wallet-parity (WCW + Anchor + waxwing ยิง action เหมือนกัน byte-tile-byte). **อย่าอ่านไฟล์นี้โดยไม่อ่าน CONTRACT.md §1–§2** — ไฟล์นี้คือสรุป+ส่วนที่เพิ่ม ไม่ใช่แหล่งเดียว

---

## 0. Accounts & contracts

| Account | บทบาท |
|---|---|
| `pockethatch` | **game contract**; collection author; HATCH issuer; rewardpool/buybackpool escrow host |
| `hatchtokens1` | `eosio.token` ของ 🐣 **HATCH** (precision 4) — issuer = `pockethatch`, fixed **100M** supply |
| `atomicassets` | standard WAX NFT — เรียก `mintasset`/`setassetdata`/`burnasset`/`transfer` + อ่าน `accounts` table (สำหรับ install-gate, §3.6) |
| `hatchfees1` | house fee sink (treasury) |

🥚 **EGG ไม่ใช่ `eosio.token`** — เป็น `uint64` internal balance ใน `players.egg_balance` กลายใจโดย contract ตรงๆ (ไม่มี transfer/retire/issue) → **ไม่มี contract ให้ list บน DEX** = กฎ #2 บังคับที่รากโครงสร้าง.

---

## 1. Tables (reference ครบ)

สัญลักษณ์ RAM-payer: 💾🏠 = house · 💾👤 = player. ⏱ = field ที่ขับจาก `current_time_point()`.

### 1.1 `config` — singleton · 💾🏠 · scope = contract
| field | type | หมายเหตุ |
|---|---|---|
| `token_contract` | `name` | `hatchtokens1` |
| `token_symbol` | `symbol` | `HATCH,4` |
| `collection` / `schema_name` | `name` | atomicassets |
| `fee_account` | `name` | `hatchfees1` |
| `paused` | `bool` | kill-switch |
| `feed_cost` / `hatch_cost` / `evolve_cost` / `slot_cost` / `cosmetic_cost` | `uint64` | 🥚 **EGG** — mutate `egg_balance` ลง (soft, off-token; **Sun §2 row: feed/hatch/evolve/slot/cosmetic = EGG**) — tunable |
| `breed_cost` / `premium_egg_cost` / `listing_boost` / `name_cost` | `asset` | 🐣 **HATCH** — 🔥 burn/part-pool (Sun §3.4: breeding 40% burn · 60% pool) — tunable |
| `feed_cd` / `harvest_cd` / `breed_cd` | `uint32` | cooldown วินาที ⏱ |
| `daily_egg_cap` | `uint64` | **240** (web default) — กฎ §3.2 |
| `install_cap_bonus` | `uint64` | **+72** (= 312−240; SYNC #5) — ปลดเมื่อ `players.installed=true` |
| `tap_egg_cap` | `uint64` | 60 (web) — fold เข้า harvest, §2.5a |
| `offline_cap_h` | `uint32` | 8 ชม. (web) |
| `bootstrap_daily_release` | `asset` | HATCH ปล่อย/วัน จาก escrow (decaying, มี sunset) |
| `royalty_bps` | `uint16` | **400** (=4%) — AtomicMarket collection royalty |
| `buyback_share_bps` | `uint16` | **200** (=2% ของ royalty → buyback; อีก 2% → treasury) |
| `season_index` / `season_started` | `uint16` / `uint32` | ⏱ |
| `rng_oracle` | `name` | `orng.wax` (mainnet) / empty → block entropy (testnet) |

> **เพิ่มใหม่ vs CONTRACT.md §1.1:** `install_cap_bonus`, `bootstrap_daily_release`, `royalty_bps`, `buyback_share_bps` — เป็น knob ที่ตอบ SYNC #3/#5 และทำให้กฎเหล็ก #1/#3 tunable-on-chain โดยไม่ redeploy.

### 1.2 `speciescfg` · 💾🏠 · pk = `template_id`
| field | type |
|---|---|
| `template_id` (pk) | `uint64` |
| `growth_rate` | `uint64` (lazy Δt multiplier) |
| `thresholds[5]` | `uint64` (G เกณฑ์ stage 1..5) |
| `stage_yield[5]` | `uint64` (🥚 EGG/ชม. ×10⁴ — ตาม TOKENOMICS §3.1: 1.0/3.0/6.0/10.0) |
| `max_stage` | `uint8` |
| `egg_weight` | `uint16` (น้ำหนักใน hatch pool) |
| `family` | `string` |

### 1.3 `players` · 💾👤 · pk = `account`
| field | type | หมายเหตุ |
|---|---|---|
| `account` (pk) | `name` | |
| `created_at` | `uint32` | ⏱ |
| `egg_balance` | `uint64` | 🥚 spendable — **EGG sink = `feed`/`hatch`/`evolve`/`unlockslot`/`equipcosmetic`** (mutate balance ลง, §2; Sun §2 row 38). non-tradeable. (feed/hatch/evolve ใช้ EGG **ไม่ใช่ HATCH** — §1.1) |
| `last_harvest` | `uint32` | ⏱ checkpoint idle accrual |
| `harvest_day` | `uint32` | ⏱ day-index ของ `egg_harvested_today` |
| `egg_harvested_today` | `uint64` | vs `effectiveDailyCap()` (§3.5) |
| `tap_accrued` | `uint64` | 🥚 tap bonus **client-reported** ที่สะสม → `settlebp` credit เข้า balance; hard-capped `tap_egg_cap`/วัน (SYNC #4 — **honest model: contract ไม่พิสูจน์จำนวน tap จริง**, ดู §4 ทำไมจึงปลอดภัย) |
| `tap_day` | `uint32` | ⏱ day-index ของ `tap_accrued`/`tap_paid_today` |
| `tap_paid_today` | `uint64` | vs `tap_egg_cap` |
| `installed` | `bool` | **false default** — set โดย `claiminstallbonus` เท่านั้น (SYNC #5) |
| `feeds_today` / `feed_day` | `uint32` | helper |
| `total_egg_farmed` / `total_hatch_burned` | `uint64` | lifetime stat (display) |

> **เพิ่มใหม่ vs CONTRACT.md §1.3:** `installed`, `tap_accrued`, `tap_day`, `tap_paid_today`.

### 1.4 `creatures` · 💾👤 · pk = `asset_id` · sec idx `by_owner(owner)`
| field | type |
|---|---|
| `asset_id` (pk) | `uint64` (= atomicassets asset_id, 1:1) |
| `owner` (sec) | `name` |
| `template_id` | `uint64` (→ speciescfg) |
| `stage` | `uint8` (mirror cache — recompute ก่อน trust) |
| `growth_base` | `uint64` (lazy checkpoint) |
| `fed_growth` | `uint64` (monotonic) |
| `born_at` / `last_sync` / `last_fed` / `last_bred` | `uint32` ⏱ |
| `genetics` | `checksum256` (immutable, set ตอน hatch) |

`currentGrowth = growth_base + fed_growth` (คำนวณ, ไม่เก็บ) — ต้อง `sync()` ก่อนเสมอ.

### 1.5 `rewardpool` — singleton escrow · 💾🏠 · scope = contract
| field | type | หมายเหตุ |
|---|---|---|
| `balance` | `asset` | HATCH ที่จ่าย reward ได้ |
| `bootstrap_total` | `asset` | fixed allocation (decaying, sunset) |
| `bootstrap_released` | `uint64` | ที่ปล่อยไปแล้ว |
| `last_release` | `uint32` | ⏱ checkpoint |
| `lifetime_funded` | `asset` | ที่ไหลเข้า (fee + sponsor + buyback) |
| `lifetime_paid` | `asset` | ที่จ่ายออก (display) |

**กฎ #1 อยู่ที่นี่:** `claimreward` ทำ `check(payout ≤ pool.balance)` → pool ว่าง = จ่ายไม่ได้. ไม่มี `eosio.token::issue` path ใดๆ ใน gameplay.

### 1.6 `buybackpool` — singleton escrow · 💾🏠 · scope = contract — **ใหม่ (SYNC #3)**
| field | type | หมายเหตุ |
|---|---|---|
| `balance` | `asset` | HATCH ที่ซื้อคืนจากตลาด รอ route เข้า rewardpool |
| `pending_wax` | `asset` | WAX fee-share ที่รอ convert → HATCH (ฝั่งก่อน swap) |
| `lifetime_buyback` | `asset` | รวม HATCH ที่เคย route เข้า rewardpool (display — ตรวจ A4/A5 ได้) |
| `last_buyback` | `uint32` | ⏱ |

**ทำไมต้องมี:** ทำให้ buyback **transparent + auditable แต่ไม่ auto-MEV** — fee share ไหลเข้า `buybackpool.pending_wax` (on-chain visible) → house-auth `doprebuyback` (§2.10) สั่ง swap WAX→HATCH บน Alcor แล้ว deposit เข้า `rewardpool.balance`. ไม่ฝัง swap อัตโนมัติใน gameplay action (risk slippage/MEV/complexity) แต่ก็ไม่ manual ปิดม่าน (ทุก step ติด on-chain). ดู resolution เต็มที่ §4 SYNC #3.

### 1.7 `installers` (optional registry) · 💾🏠 · pk = `account` — **ใหม่ (SYNC #5)**
| field | type |
|---|---|
| `account` (pk) | `name` |
| `installed_at` | `uint32` ⏱ |
| `proof_template_id` | `uint64` (exclusive template ที่ใช้ gate) |

> **ออปชัน:** ถ้าไม่อยากมี registry แยก ใช้ `players.installed` flag อย่างเดียวก็พอ (§3.6). ผมเสนอ flag-only เป็น default เพราะสะอาดกว่า — table นี้เก็บไว้ถ้าบอสอยากมี public registry ของผู้ติดตั้ง.

---

## 2. Action signatures (สรุป — flow เต็มอยู่ใน CONTRACT.md §2)

### Gameplay (player-auth: `require_auth(owner)` + `check(!cfg.paused)`)

> **สองสกุลเงิน สองทิศทาง** (ยึด TOKENOMICS §2 row 38 — ไม่ใช่สกุลเดียว): 🥚 **EGG** = soft off-token, mutate `egg_balance` ลง (feed/hatch/evolve/slot/cosmetic). 🐣 **HATCH** = hard `eosio.token`, 🔥 `retire()` หรือจ่ายจาก `rewardpool` (breed/premium/listing/naming/reward). คอลัมน์ spend บอกทั้งสอง.

| action | signature | spend | ⏱ guard |
|---|---|---|---|
| `initplayer` | `(name owner)` | — | — |
| `hatch` | `(name owner, uint64 egg_type)` | 🥚 EGG `−= hatch_cost` | — |
| `feed` | `(name owner, uint64 asset_id)` | 🥚 EGG `−= feed_cost` (0 v1) | `last_fed+feed_cd` · daily cap |
| `evolve` | `(name owner, uint64 asset_id)` | 🥚 EGG `−= evolve_cost×(stage+1)` | threshold + `stage<max_stage` |
| **`unlockslot`** | `(name owner, uint8 slot_index)` | 🥚 EGG `−= slot_cost(slot_index)` | `slot_index < max_slots(owner)` · `egg_balance ≥ slot_cost` — **เพิ่ม (ปิด EGG-sink mapping, Sun §2)** |
| **`equipcosmetic`** | `(name owner, uint64 asset_id, uint64 cosmetic_tmpl)` | 🥚 EGG `−= cosmetic_cost` | owns `cosmetic_tmpl` (atomicassets read) · `egg_balance ≥ cosmetic_cost` — **เพิ่ม (ปิด EGG-sink mapping)** |
| `harvest` | `(name owner)` | — (🥚 accrue idle EGG **เข้า** `egg_balance`) | `last_harvest+harvest_cd` · daily cap · offline cap |
| `claimreward` | `(name owner)` | 🐣 จ่าย HATCH **จาก `rewardpool`** (`check(payout ≤ pool.balance)`) | season/milestone tier |
| `breed` | `(name owner, uint64 a, uint64 b)` | 🐣 HATCH `breed_cost` · 40% 🔥retire + 60% → `rewardpool` | `breed_cd` ทั้งคู่ |
| `accelerate` | `(name owner, uint64 asset_id, asset amount)` | 🐣 HATCH 🔥retire `amount` | — (pay-to-skip-time) |
| `setname` | `(name owner, uint64 asset_id, string name)` | 🐣 HATCH 🔥retire `name_cost` | — |
| `burncreature` | `(name owner, uint64 asset_id)` | — | — |
| **`settlebp`** | `(name owner)` | — (🥚 credit tap bonus **เข้า** `egg_balance`, capped) | ⏱ cap `tap_egg_cap`/วัน — **ใหม่ (SYNC #4 — client-reported §4)** |
| **`claiminstallbonus`** | `(name owner, uint64 template_id)` | — | ต้องถือ exclusive template — **ใหม่ (SYNC #5)** |

### Admin (contract-auth: `require_auth(get_self())`)
| action | signature | หน้าที่ |
|---|---|---|
| `setconfig` | `(config_row …)` | tune ทุก knob |
| `setspecies` | `(species_row …)` | upsert species |
| `setpaused` | `(bool paused)` | kill-switch |
| `newseason` | `(uint16 index, asset bootstrap_release)` | เลื่อน season + ปล่อย bootstrap escrow (ไม่ใช่ mint) |
| `withdraw` | `(name token_contract, asset qty, name to, string memo)` | sweep **surplus** HATCH → `fee_account`. ⚠ `check(qty ≤ sweepableHatch())` (§3.8) — **ห้าม drain escrow** (`rewardpool`/`buybackpool`) |
| **`doprebuyback`** | `(asset wax_in, asset min_hatch_out)` | swap WAX→HATCH บน Alcor → `rewardpool` — **ใหม่ (SYNC #3)** |
| **`routebuyback`** | `()` | ย้าย `buybackpool.balance` → `rewardpool.balance` (หลัง swap) |
| **`settlefeeshare`** | `(asset hatch_or_wax, bool to_treasury)` | route fee share ที่ค้างจาก AtomicMarket/Alcor — **wire point** |

### Notification
| handler | trigger | ทำอะไร |
|---|---|---|
| `on_nt_transfer` | `atomicassets::transfer` | sync `creatures.owner = to` (ไม่ register `eosio.token::transfer` — HATCH ที่มาทาง inline transfer ถูก burn in-action, §0) |

---

## 3. Helpers (internal, ไม่อยู่ใน ABI)

### 3.1 `sync(creature, now)` ⏱
```
check(now ≥ c.last_sync, "time went backwards")
c.growth_base += (now − c.last_sync) × rate(speciescfg[c.template_id])   // overflow-checked
c.last_sync = now
```

### 3.2 `currentGrowth(c)` = `c.growth_base + c.fed_growth` (call only after sync)

### 3.3 `reset_daily_if_new_day(player, now)` ⏱
```
if day_index(now) != player.harvest_day:
   player.egg_harvested_today = 0 ; player.harvest_day = day_index(now)
if day_index(now) != player.tap_day:
   player.tap_paid_today = 0 ; player.tap_day = day_index(now)
```

### 3.4 `effectiveDailyCap(player)` — **SYNC #5**
```
return cfg.daily_egg_cap + (player.installed ? cfg.install_cap_bonus : 0)
// web = 240 ; installed = 312 (+30%) — ผูกกับ flag ที่ gate ด้วย template ownership ไม่ใช่ client
```

### 3.5 `seasonRewardTier(player, season_index)` → `asset` — house-authored, capped per tier (อยู่ใน `claimreward`)

### 3.6 Install-gate logic (`claiminstallbonus`)
```
require_auth(owner) ; check(!cfg.paused)
// อ่าน atomicassets accounts[owner][collection] — inter-contract read
ownsExclusive = exists template_id ใน owner's assets ที่ ∈ cfg.exclusive_template_set
check(ownsExclusive, "no exclusive template — not an installer")
player.installed = true
// optional: installers.emplace(owner, now, template_id)
```
> **ทำไมแบบนี้ sybil-resistant:** bonus 30% ผูกกับการ **ถือ exclusive template** — sybil ต้องซื้อ template จากตลาด (มีราคา/liquidity) ก่อนจึงจะได้ flag. บวก fact ว่า bonus = soft-cap (ไม่ใช่ HATCH power, กฎ §5.3) → สร้างกองทัพ account ไม่คุ้ม. ที่สำคัญ: install **ไม่ปลด HATCH ฟรีเพิ่ม** (ผ่านได้แค่ EGG cap) → กฎ #1 ยังครอบ funnel.

### 3.7 `settleTapBonus(player, now)` ⏱ — **SYNC #4 (honest model)**
```
reset_daily_if_new_day(player, now)            // §3.3 — reset tap_paid_today ตอนเปลี่ยนวัน
uint64 credit = min(player.tap_accrued,
                    cfg.tap_egg_cap − player.tap_paid_today)
player.egg_balance  += credit                  // EGG เข้า balance (soft, off-token)
player.tap_paid_today += credit                // cap ต่อวัน
player.tap_accrued   = 0                       // fold — client สะสมใหม่วันถัดไป
```
> **`tap_accrued` = client-reported** (client เขียนค่านี้ก่อนเรียก settlebp). contract เชื่อค่านั้นแต่ hard-cap ที่ `tap_egg_cap`/วัน ผ่าน `tap_paid_today`. **contract ไม่มีทางรู้จำนวน tap จริง** — anti-cheat จริงอยู่ที่ invariant เศรษฐกิจ ไม่ใช่ที่นี่ (ดู §4 SYNC#4 + assumption §6 #9).

### 3.8 `sweepableHatch()` → `asset` — **withdraw bound (กฎ #1, กัน admin drain escrow)**
```
// inline read: eosio.token get_balance(token_contract, get_self(), symbol)
asset contract_balance = token.get_balance(cfg.token_contract, get_self(), cfg.token_symbol)
asset escrow = rewardpool.balance + buybackpool.balance   // ที่ house รับประกันไว้
return contract_balance − escrow                           // = surplus ที่ admin กวาดออกได้
```
> admin `withdraw` ทำ `check(qty ≤ sweepableHatch(), "would drain escrow")` → กวาดได้แค่ **surplus นอก escrow**. **invariant:** `rewardpool.balance + buybackpool.balance ≤ contract.eosio.balance` เสมอ (escrow ที่ `claimreward`/`routebuyback` รับประกัน ไม่มีทางถูก `withdraw` drain). ตรวจได้ตาม A4/A5.

---

## 4. 🔌 SYNC #1–6 resolution (ปลดล็อกให้ Sun)

| # | คำถาม Sun | คำตอบ (structure ที่บังคับ) |
|---|---|---|
| **#1** | EGG on-chain token หรือ off-chain? กันใครเปิด DEX pair | **off-token entirely** — EGG = `players.egg_balance` (`uint64`) ไม่ใช่ `eosio.token`. ไม่มี contract ให้ list → เปิด pair ไม่ได้ทางโครงสร้าง. ตรวจ A10 = audit ว่าไม่มี action แปลง EGG→token (จริง — `harvest` mutate balance ล้วนๆ, §2.5a) |
| **#2** | reward pool = escrow จ่าย ≤ balance? | ✅ `rewardpool.balance` + `claimreward` check `payout ≤ pool.balance` (§1.5/§2). reuse Streak Pact escrow pattern. funded จาก fee+buyback+decaying bootstrap sunset — **ไม่มี `issue`** |
| **#3** | buyback on-chain auto หรือ manual? | **hybrid — `buybackpool` escrow (transparent) + house-auth `doprebuyback`/`routebuyback` (auditable, non-auto)** (§1.6/§2). เหตุผล: auto-swap ใน gameplay = MEV/slippage/complexity risk; manual ปิดม่าน = ไม่ transparent. แยก pool ให้ on-chain visible ทุก step แต่ swap ทำเป็น admin action ที่รายงานได้ |
| **#4** | feed/harvest batch หรือ per-tap? | **harvest = single periodic settlement; feed = per-creature throttled; tap = client-reported + fold เข้า harvest (ไม่ใช่ per-tap tx)** — `settlebp(owner)` (player-auth) credit `min(tap_accrued, tap_egg_cap − tap_paid_today)` เข้า `egg_balance` แล้วรีเซ็ต `tap_accrued=0`. ลด tx count/CPU §6. **⚠ ตรงไปตรงมา: `tap_accrued` เป็น client-reported** — contract **ไม่สามารถพิสูจน์จำนวน tap จริง** (tap = discrete event ไม่ใช่ time-derivable; เฉพาะ **idle** growth ที่ deterministic ผ่าน `sync()`). client ร้ายอาจ claim ถึง 60 EGG/วันโดยไม่ tap เลย. **anti-cheat จริงไม่ได้อยู่ที่การพิสูจน์จำนวน tap แต่ที่ invariant เศรษฐกิจ**: ① EGG off-token non-tradeable (กฎ#2) ② **ไม่มี action แปลง EGG→HATCH** — HATCH ออกจาก `rewardpool` season tier ที่ capped + `check(payout ≤ pool.balance)` (กฎ#1), ไม่ใช่ linear กับ EGG stockpile ③ tap เป็นสัดส่วนเล็ก (~60 vs idle 240/วัน) — idle deterministic เป็น source หลัก. ดังนั้นแม้ฟาร์ม tap EGG เต็มแคป ก็แค่เร่ง in-game progression เล็กน้อย ส่วน HATCH ที่ออกจริงถูก pool cap จำกัดอยู่แล้ว. ถ้าบอสอยาก tap trustless เต็ม = per-tap on-chain action (แพง CPU/RAM สำหรับ idle game) หรือ oracle/house-signed proof (off-chain trust point) — assumption §6 #9 |
| **#5** | install funnel ผูกอย่างไร (sybil-proof)? | **ผูก `players.installed` flag ที่ gate ด้วย exclusive-template ownership** (`claiminstallbonus` §3.6) — ไม่ใช่ client flag. bonus = `install_cap_bonus` (+72 EGG cap) ผ่าน `effectiveDailyCap`. sybil ต้องซื้อ template ก่อน → ไม่คุ้ม. **install ไม่ปลด HATCH ฟรี** → กฎ #1 ยังครอบ |
| **#6** | burn ใช้ `retire` จริง? | ✅ ทุก 🔥 path ของ **HATCH** = **inline `hatchtokens1::transfer(owner→contract)` + `hatchtokens1::retire()`** (เฉพาะ HATCH sinks: breed/accelerate/setname/premium_egg/listing_boost — §1.1/§2). retire คือ action มาตรฐาน eosio.token — ตรวจบนเชนได้ตาม A4. ⚠ **EGG sinks (feed/hatch/evolve/unlockslot/equipcosmetic) ไม่ใช้ retire** — EGG เป็น off-token `uint64` จึง mutate `egg_balance` ลงตรงๆ (ไม่มี token ให้ retire, กฎ#2). เรา **ไม่ register `eosio.token::transfer` on_notify** เลย → HATCH ที่มาทาง inline burn ทันที ไม่มี deposit-hook รั่ว |

---

## 5. 🔒 กฎเหล็ก 3 ข้อ → enforcement map

| กฎ (TOKENOMICS §0) | บังคับที่ structure ตรงไหน (แน่นอน ตรวจได้) |
|---|---|
| **#1 — HATCH ไม่ถูกพิมพ์เป็นรางวัล; payout ≤ revenue** | ① HATCH fixed 100M, issuer `pockethatch`, **ไม่มี `eosio.token::issue` ใน gameplay path** (ABI ไม่มี action นั้น) ② `claimreward` ทำ `check(payout ≤ rewardpool.balance)` โครงสร้าง = จ่ายไม่ได้ถ้า pool ว่าง ③ `rewardpool` รับเข้าจาก: `doprebuyback`+`routebuyback` (fee), to-pool half ของ breed/premium sink, decaying bootstrap sunset — ไม่มี faucet เปิด ④ ไม่ register `eosio.token::transfer` → ไม่มี deposit-then-mint path ⑤ admin `withdraw` bound `qty ≤ sweepableHatch()` (= contract eosio.balance − rewardpool.balance − buybackpool.balance, §3.8) → **escrow ที่ house guarantee ไว้ drain ไม่ได้ทาง admin** |
| **#2 — EGG ขายไม่ได้ (off-market)** | ① EGG = `players.egg_balance` (`uint64`) ไม่ใช่ `eosio.token` → **ไม่มี token contract ให้ list บน DEX** ② ไม่มี action EGG transfer/retire/issue ใดๆ — `harvest`/`settlebp` mutate balance ขึ้น, sinks mutate ลง ล้วนๆ ③ EGG ออกได้แค่ทาง in-game sink (`feed`/`hatch`/`evolve`/`unlockslot`/`equipcosmetic` — **มี action signature row ครบทุกตัว §2**, mutate balance ลง) — **ไม่มี action แปลง EGG→HATCH/token**. (feed/hatch/evolve ใช้ EGG ไม่ใช่ HATCH — §1.1; Sun §2 row 38) ④ ⇒ ตลาดเทขายถล่มเป็นไปไม่ได้ทางกายภาพ |
| **#3 — รายได้จากกิจกรรมจริง (fee), ไม่ใช่ขายความหวัง** | ① fee source = AtomicMarket `royalty_bps`=4% + Alcor swap share 0.3% — โตตาม volume จริง ② `royalty_bps`/`buyback_share_bps` tunable-on-chain ผ่าน `setconfig` (ต่ำโดยตั้งใจ) ③ buyback route `buybackpool`→`rewardpool` = on-chain auditable (`lifetime_buyback`) ④ ไม่มี token pre-sale/promise action ใน ABI — รายได้เกิดตอนคนเทรดจริง (`on_nt_transfer` + `settlefeeshare`) |

> **ตรวจสอบได้ทุกข้อ:** แต่ละกฎ = ไม่ใช่นโยบายที่ "หวังว่าจะทำตาม" แต่เป็น **constraint ทางโครงสร้าง** — ถ้าจะทำผิดกฎต้อง redeploy contract (ซึ่งผู้เล่นเห็น + เป็น governance event). นี่คือสิ่งที่ทำให้ "falsify ได้" ตาม bar ของ Sun.

---

## 6. Assumptions ที่ต้องให้ CEO เคาะ (blocker)

รายการที่ผม **decide ไว้แล้วใน design** แต่เป็น policy call ที่บอสเป็นเจ้าของเกมต้องยืนยัน ไม่ใช่ engineering call:

1. **EGG อยู่ off-token ทั้งหมด (SYNC #1) — ยืนยัน?** ผมเลือกแบบนี้เพราะมันบังคับกฎ #2 ที่ราก. trade-off: EGG ไม่ composable (ไม่เอาไปใช้ใน dApp อื่นได้) แต่นั่นคือ feature ไม่ใช่ bug. ถ้าบอสอยากให้ EGG on-chain (เพื่อ cross-game) ต้องคิด anti-market mechanism ใหม่ — ผมไม่แนะนำ.

2. **Buyback = hybrid (escrow visible + house-auth swap), ไม่ใช่ auto (SYNC #3) — ยืนยัน?** auto-swap ใน gameplay = ซับซ้อน + MEV risk. แต่ hybrid ทำให้ house เป็น trust point สำหรับ timing/size ของ swap. ทางลด: ตั้ง `max_slippage_bps` cap + รายงาน `doprebuyback` ทุกครั้ง. ถ้าบอสอยาก trustless เต็ม → ต้องฝัง Alcor router ใน contract (phase ถัดไป, เพิ่ม scope).

3. **Install bonus = +30% EGG cap (soft) ผูก exclusive-template ownership, ไม่ใช่ HATCH (SYNC #5) — ยืนยัน?** ผมเลือก soft-cap-only เพราะกฎ #1 ต้องครอบ funnel (install ห้ามปลด HATCH ฟรี). ถ้าบอสอยากให้ install ได้ HATCH บางส่วน → ต้อง route จาก rewardpool (ยังไม่พิมพ์) — ทำได้แต่ทำให้ funnel "รวม" เข้า pool budget.

4. **`exclusive_template_set` มาจากไหน?** `claiminstallbonus` gate ด้วยการถือ template หายาก — แต่ใครเป็นคน mint template หายากให้ installer? ผม assume **house mint ผ่าน plugin path ที่ verify install จริง (off-chain gate ที่ house คุม) แล้ว mint on-chain**. ต้อง confirm: (a) install-verification mechanism ฝั่ง plugin คืออะไร (license key? signed challenge?), (b) template หายาก limited supply เท่าไหร่. **นี่คือ off-chain trust point เดียวในระบบ — ต้องเคาะให้แน่น.**

5. **`bootstrap_daily_release` + sunset schedule — ตัวเลข?** TOKENOMICS §4.3 วางตารางลดทอน (S1: 1.5M → tapering) แต่ daily release concretely ต้อง calibrate. ผม assume = bootstrap_total / estimated_season_days × decay. ต้อง confirm season ยาวกี่วัน + decay rate `d`.

6. **Royalty/split 2%/2% — AtomicMarket collection royalty set ที่ collection creation ครั้งเดียว?** ใช่ — แต่ `royalty_bps` ใน config ของเราเป็น mirror (display + buyback calc). ถ้าอนาคตอยากเปลี่ยน rate ต้อง re-create collection หรือใช้ AtomicMarket `announcesale` per-listing. confirm rate 4% ล็อคที่ collection-level หรือต้องการ flexibility?

7. **HATCH genesis distribution (TOKENOMICS §1: 30/20/15/15/10/10) — ใคร custody + vesting mechanism?** ฝั่ง treasury/team/ecosystem อยู่นอก contract นี้ (token balance ที่ issuer account). confirm ว่า vesting ทำที่ contract แยกหรือ multisig timelock — ไม่ใช่ scope ของ `pockethatch`.

8. **`claimreward` season tier logic — v1 minimal แน่นอนหรือ?** ผม leave `seasonRewardTier` เป็น house-authored placeholder (payout table per season). ถ้าบอสอยาก on-chain leaderboard/tier-calc → phase ถัดไป (CONTRACT.md §9 out-of-v1).

9. **tap = client-reported (ไม่ trustless) — ยอมรับหรือบังคับ on-chain proof? (SYNC #4)** `tap_accrued` ที่ client สะสมแล้ว `settlebp` credit (capped `tap_egg_cap`=60/วัน) — contract ไม่พิสูจน์จำนวน tap จริง (§3.7/§4). ผม assume **ยอมรับ** เพราะ **EGG economically inert**: ขายไม่ได้ + ไม่มี action แปลง EGG→HATCH (กฎ#2), ส่วน HATCH ออกจาก `rewardpool` ที่ capped per tier + `check(payout ≤ pool.balance)` (กฎ#1) → ฟาร์ม tap EGG ไม่ได้เปรียบเชิงเศรษฐกิจจริง. ถ้าบอสอยาก tap trustless เต็ม = ทุก tap เป็น on-chain action (แพง CPU/RAM สำหรับ idle game) หรือ oracle/house-signed proof (off-chain trust point อีกจุด). **ไม่ block implementation** — lock default ได้ แต่เป็น policy call ว่ายอม client-reported หรือไม่.

> ทุกข้อข้างบนถ้าบอสไม่เคาะ = ผม lock default ที่ผม decide ไว้ (เพราะไม่ block implementation) แต่ **ข้อ 4 (install verification) กับข้อ 5 (bootstrap numbers) กระทบหลักการกันเงินเฟ้อโดยตรง** — เคาะก่อน deploy จะได้ไม่ต้อง calibrate บน mainnet. **ข้อ 9 (tap trustless ไหม)** ไม่ block และไม่กระทบ anti-ponzi (EGG inert) แต่เป็น policy call ที่บอสควรตัดสินใจ — ยอม client-reported หรือยอมจ่าย on-chain cost.

---

*ตารางเป็นกระดูก; กฎเหล็กเป็นเส้นเอ็นที่ขึงกระดูกไว้ไม่ให้คุด. — Yamamoto*
