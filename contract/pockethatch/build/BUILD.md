# pockethatch — build record

กฎ: **ห้ามลบ wasm ของรุ่นที่ deploy ไปแล้ว** — ต้อง re-hash ตรวจซ้ำได้เสมอก่อน/หลัง deploy
และ **ห้าม build ทับชื่อไฟล์ของรุ่นที่ deploy ไปแล้ว** — ถ้าซอร์สขยับหลัง deploy ให้ตั้งชื่อ
artifact ใหม่ ไม่งั้น artifact บนดิสก์จะไม่ตรงกับบนเชน แล้วคำสั่ง verify ในรันบุ๊กจะ fail
โดยไม่มีของเดิมเหลือให้เทียบ (เคยพลาดมาแล้ว 2026-07-20)

## Artifacts

| artifact | size | sha256 | สถานะ |
|---|---|---|---|
| `pockethatch.slotcfg.wasm` | 162,692 B | `ee7a150f91f0a1a463c836999d5cd889b71402d953910803a0f9b2203d5105f2` | ✅ **อยู่บนเชนตอนนี้** (`phgamecreatr`, wax-testnet) — build จาก commit `1eaad85` |
| `pockethatch.rules.wasm` | 162,761 B | `ae75ce303706d7ce4cacd64751f021b9b8969d963f8080d2795fe2f7a3253998` | ⚠️ **ยังไม่ deploy** — build จาก `17cebf8` (refactor เข้า `ph_rules.hpp`) |
| `pockethatch.mergefix.wasm` | 160,021 B | `559880bfb545a7052f044b6a663866c981d64aaf593b71f875a05b06d8859a73` | รุ่นก่อน (merge-fix) |

`pockethatch.slotcfg.abi` ตรงกันทุกรุ่นตั้งแต่ slotcfg — `diff` ระหว่าง `rules.abi` กับ
`slotcfg.abi` = ไม่ต่าง → ถ้า deploy `rules` ต้อง **setcode อย่างเดียว ห้าม setabi**

> `build/*.wasm` และ `build/*.abi` อยู่ใน `.gitignore` (ไม่ commit ลง repo) — ตารางนี้
> คือ record เดียวที่ track อยู่ ต้องอัปเดตทุกครั้งที่ build ของใหม่

### ซอร์สที่ HEAD ≠ ของที่อยู่บนเชน

`17cebf8` ย้าย satiety gate / burn payout / cosmetic range ไปเป็นฟังก์ชัน pure ใน
`ph_rules.hpp` เพื่อให้ `test_anticheat.cpp` เทสต์โค้ดตัวที่ ship จริง พฤติกรรมเหมือนเดิม
**ยกเว้น** `is_sated()` ขยายเป็น 64-bit ก่อนบวก (config ที่ `fed_dur` มหาศาลจะ wrap uint32
แล้วแจกใบผ่านฟรีไม่ได้อีก) — ของบนเชนยังเป็นเวอร์ชัน `1eaad85` ที่ยังไม่มีการกันwrap นี้
จะ deploy `rules` เมื่อไหร่เป็นการตัดสินใจของ CEO ไม่ได้ยิงเอง

### ยืนยันว่า re-build ได้ hash เดิม (2026-07-20)

build `1eaad85` ใหม่ใน worktree สะอาด → `ee7a150f…` / 162,692 B และ `cmp` กับ wasm ที่
ดึงจากเชน (`get_raw_code_and_abi`) = **byte-identical** — reproducible จริง

```sh
node build/verify-onchain-wasm.cjs                                  # slotcfg ↔ phgamecreatr
node build/verify-onchain-wasm.cjs build/pockethatch.rules.wasm     # → ✗ ตามคาด (ยังไม่ deploy)
```

## compile

```sh
cd contract/pockethatch
cdt-cpp \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core \
  -I . \
  -contract=pockethatch \
  -o build/<ชื่อรุ่นใหม่>.wasm pockethatch.cpp --abigen
sha256sum build/<ชื่อรุ่นใหม่>.wasm   # จดลงตารางข้างบนทันที
```

⚠️ **สองอย่างที่ห้ามพลาด ไม่งั้นได้ hash คนละตัว**

- **ห้ามใส่ `-O=z`** (เอกสารรุ่นก่อนเขียนผิด) — ของที่อยู่บนเชนคอมไพล์ด้วย
  optimize เริ่มต้นของ CDT 4.1.1 คือ **`-O=3`** ใส่ `-O=z` แล้ว re-hash ไม่ตรง
- **ต้องมี `-contract=pockethatch`** — CDT เดาชื่อ contract จาก basename ของ `-o`
  ถ้าปล่อยให้เป็น `pockethatch.mergefix` / `pockethatch.slotcfg` จะได้ warning
  `contract class not found` 15 อัน แล้ว **abigen error → cdt-cpp ไม่เขียนไฟล์ออกเลย**
  (ทดสอบแล้ว 2026-07-20) ตัวร้ายคือ exit code ไม่ฟ้องชัด และ **ไฟล์ .wasm รอบก่อน
  ยังนอนอยู่ที่เดิม** — ถ้าไม่เช็ค mtime/sha ทุกครั้ง จะนึกว่า build ใหม่แล้ว
  ทั้งที่กำลังจะ deploy ของเก่า

## เทสต์

```sh
# native unit test — ต้องผ่านทั้งคู่ก่อน deploy
g++ -std=c++17 -I . -o /tmp/tm test/test_mutdata.cpp   && /tmp/tm   # 21/21
g++ -std=c++17 -I . -o /tmp/ta test/test_anticheat.cpp && /tmp/ta   # 37/37

# บนเชนจริง (wax-testnet) — negative case เช็คข้อความ guard ไม่ใช่แค่ "revert"
node test/onchain-anticheat.mjs
```

## แก้อะไรในแต่ละรุ่น

**mergefix** — `atomicassets::setassetdata` เขียนทับ mutable map **ทั้งก้อน** ไม่ใช่ patch
`evolve` เลยลบ `name` ของผู้เล่นทิ้ง และ `setname` ลบ `cosmetic` ที่ซื้อมาทิ้ง ทุก write ต้อง
decode ของเดิม → merge → เขียนกลับ (helper header-only `aa_mutdata.hpp` จงใจไม่ include
eosio เพื่อให้เทสต์ native ได้)

⚠️ `aa_mutdata.hpp` เป็นคู่แฝดของ `web/src/chain.ts → decodeAssetName()` — แก้ฝั่งไหนต้องแก้อีกฝั่ง

**slotcfg** — slot_cost staircase (`slot_cost_5` / `slot_cost_6`), ถอด `name_cost`,
`equipcosmetic` เช็ค template จริงใน `atomicassets::templates`, `burncreature` เช็ค
`pool.balance >= payout` **ก่อน** burn (fail-closed), `accelerate` มี satiety gate เท่ากับ `evolve`

**rules** — ยกกฎสามข้อข้างบนไปเป็นฟังก์ชัน pure ใน `ph_rules.hpp` + เทสต์จริง (ดูหัวข้อด้านบน)

## deploy

```sh
node build/single-tx-deploy.cjs      # setpaused → setcode → setabi → setconfig
```

### ข้อกำหนด RAM

setcode ต้องมี RAM ว่างพอสำหรับ **โค้ดเก่า + โค้ดใหม่พร้อมกัน**
ครั้งล่าสุด (2026-07-20) เชนตอบ: `needs 1632235 bytes has 1505567 bytes` → ขาด **126,668 bytes**
ต้อง `buyrambytes` ให้ `phgamecreatr` ก่อน ไม่งั้น tx เด้งและ **ไม่มีอะไรถูกเขียนลงเชน**
