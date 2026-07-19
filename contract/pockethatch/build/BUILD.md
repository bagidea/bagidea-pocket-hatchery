# pockethatch.mergefix.wasm — build record

กฎ: **ห้ามลบ wasm ตัวนี้** — ต้อง re-hash ตรวจซ้ำได้เสมอก่อน/หลัง deploy

| | |
|---|---|
| artifact | `contract/pockethatch/build/pockethatch.mergefix.wasm` |
| size | 160,021 bytes |
| sha256 | `559880bfb545a7052f044b6a663866c981d64aaf593b71f875a05b06d8859a73` |
| target account | `phgamecreatr` (wax-testnet) |
| code_hash ก่อน deploy | `424eef189fa2735cbdfc86c5dff61a51607f4353dcee303fbf0f0f2b6b5cefca` |

## แก้อะไร

`atomicassets::setassetdata` เขียนทับ mutable map **ทั้งก้อน** ไม่ใช่ patch —
`evolve` เลยลบ `name` ของผู้เล่นทิ้ง และ `setname` ลบ `cosmetic` ที่ซื้อมาทิ้ง
ทุก write ต้อง decode ของเดิม → merge → เขียนกลับ

- แยก decode/merge ไปไว้ที่ header-only `contract/pockethatch/aa_mutdata.hpp`
  (จงใจไม่ include eosio เพื่อให้เทสต์ native ได้)
- `pockethatch.cpp` เรียกใช้ helper แทนโค้ด inline เดิม (ตัดโค้ดซ้ำออก)
- ABI ไม่เปลี่ยน → deploy ด้วย **setcode อย่างเดียว ห้าม setabi**

⚠️ `aa_mutdata.hpp` เป็นคู่แฝดของ `web/src/chain.ts → decodeAssetName()` — แก้ฝั่งไหนต้องแก้อีกฝั่ง

## compile

```sh
cd contract/pockethatch
cdt-cpp \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts \
  -I /home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core \
  -I . \
  -contract=pockethatch \
  -o build/pockethatch.mergefix.wasm pockethatch.cpp --abigen
sha256sum build/pockethatch.mergefix.wasm   # ต้องได้ 559880bf...
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
# native unit test บน byte จริงจากเชน — 21/21 ผ่าน
g++ -std=c++17 -o /tmp/t test/test_mutdata.cpp && /tmp/t
```

## deploy

```sh
node build/deploy-mergefix.mjs        # setcode เท่านั้น (ต้องปลดล็อก waxwing ก่อน)
node build/verify-merge-onchain.mjs   # พิสูจน์ merge บนเชนจริง 2 เคส แล้วคืนชื่อเดิม
```

### ข้อกำหนด RAM

setcode ต้องมี RAM ว่างพอสำหรับ **โค้ดเก่า + โค้ดใหม่พร้อมกัน**
ครั้งล่าสุด (2026-07-20) เชนตอบ: `needs 1632235 bytes has 1505567 bytes` → ขาด **126,668 bytes**
ต้อง `buyrambytes` ให้ `phgamecreatr` ก่อน ไม่งั้น tx เด้งและ **ไม่มีอะไรถูกเขียนลงเชน**
