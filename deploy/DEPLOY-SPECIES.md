# Deploy 12 Species — Step-by-Step

> **Target:** `phgamecreatr` on WAX testnet · **Signer:** `phgamecreatr@active`
> **Current state:** 1 template (`662889` Emberling) + 1 speciescfg row
> **Goal:** 11 new templates + 11 new speciescfg rows = **12 species total across 6 families**
>
> ⚠️ **ทุกคำสั่งที่แตะ chain ต้องให้บอส unlock+sign เอง** — ห้าม Kevin รันเอง
> คำสั่ง verify/read-only รันได้เลยไม่ต้อง sign

---

## Prerequisites

- waxwing plugin ตั้ง network เป็น `wax-testnet` แล้ว
- `phgamecreatr` active key อยู่ใน wallet และ unlock แล้ว
- ไฟล์ payload อยู่ใน `deploy/setspecies/` (สร้างไว้แล้ว 11 ไฟล์)

---

## Step 1: Create 11 AtomicAssets Templates

ใช้ waxwing `pushaction` ยิง `atomicassets::createtempl` ทีละตัว

### 📋 คำสั่ง (copy-paste ทีละบรรทัด — 11 ครั้ง)

```
pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Blazetail"]},{"key":"family","value":["string","Fire"]},{"key":"rarity","value":["string","Uncommon"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Drakember"]},{"key":"family","value":["string","Fire"]},{"key":"rarity","value":["string","Rare"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Aquaring"]},{"key":"family","value":["string","Water"]},{"key":"rarity","value":["string","Common"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Tidalfin"]},{"key":"family","value":["string","Water"]},{"key":"rarity","value":["string","Uncommon"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Leviathorn"]},{"key":"family","value":["string","Water"]},{"key":"rarity","value":["string","Rare"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Terrabud"]},{"key":"family","value":["string","Earth"]},{"key":"rarity","value":["string","Common"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Mossback"]},{"key":"family","value":["string","Earth"]},{"key":"rarity","value":["string","Uncommon"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Zephyrling"]},{"key":"family","value":["string","Air"]},{"key":"rarity","value":["string","Common"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Stormwing"]},{"key":"family","value":["string","Air"]},{"key":"rarity","value":["string","Uncommon"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Wispember"]},{"key":"family","value":["string","Spirit"]},{"key":"rarity","value":["string","Rare"]}]}'

pushaction atomicassets createtempl '{"authorized_creator":"phgamecreatr","collection_name":"phgamecreatr","schema_name":"creatures","transferable":true,"burnable":true,"max_supply":0,"immutable_data":[{"key":"species","value":["string","Nyxling"]},{"key":"family","value":["string","Shadow"]},{"key":"rarity","value":["string","Legendary"]}]}'
```

### ✅ Verify: Check templates on chain

```
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" -d '{"json":true,"code":"atomicassets","scope":"phgamecreatr","table":"templates","limit":20}'
```

ควรเห็น 12 templates (662889 + 11 ใหม่) — **จด `template_id` ของแต่ละตัวไว้** (เทียบจาก `immutable_serialized_data` → species name)

---

## Step 2: Fill template_ids into species payloads

เอา `template_id` ที่ได้จาก Step 1 มาแทนที่ `"<ASSIGNED>"` ในไฟล์ `deploy/setspecies/*.json` แต่ละไฟล์

หรือใช้ไฟล์รวม `deploy/species-config.json` แทนที่ `<ASSIGNED>` ทุกจุด

**ตัวอย่าง:** ถ้า Blazetail ได้ template_id = 662890:
```json
{"template_id":662890,"growth_rate":900,...}
```

---

## Step 3: Register all 12 species via setspecies

ใช้ waxwing `pushaction` ยิง `phgamecreatr::setspecies` ทีละตัว

**⚠️ Emberling (662889) มีอยู่แล้ว — ข้ามหรือ push ซ้ำก็ได้ (upsert)**

### 📋 คำสั่ง (หลังจาก fill template_id แล้ว — copy-paste ทีละบรรทัด)

```
pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":900,"thresh_1":1500,"thresh_2":7000,"thresh_3":28000,"thresh_4":120000,"yield_0":110,"yield_1":330,"yield_2":660,"yield_3":1320,"yield_4":2600,"max_stage":5,"egg_weight":65,"egg_type":1,"family":"Fire"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":700,"thresh_1":2500,"thresh_2":12000,"thresh_3":45000,"thresh_4":160000,"yield_0":140,"yield_1":420,"yield_2":840,"yield_3":1680,"yield_4":3300,"max_stage":5,"egg_weight":22,"egg_type":2,"family":"Fire"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":800,"thresh_1":1200,"thresh_2":6000,"thresh_3":24000,"thresh_4":110000,"yield_0":120,"yield_1":350,"yield_2":700,"yield_3":1400,"yield_4":2800,"max_stage":5,"egg_weight":100,"egg_type":0,"family":"Water"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":700,"thresh_1":1800,"thresh_2":9000,"thresh_3":36000,"thresh_4":140000,"yield_0":130,"yield_1":380,"yield_2":760,"yield_3":1520,"yield_4":3000,"max_stage":5,"egg_weight":65,"egg_type":1,"family":"Water"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":500,"thresh_1":3500,"thresh_2":16000,"thresh_3":60000,"thresh_4":220000,"yield_0":160,"yield_1":480,"yield_2":960,"yield_3":1900,"yield_4":3800,"max_stage":5,"egg_weight":22,"egg_type":2,"family":"Water"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":500,"thresh_1":2000,"thresh_2":10000,"thresh_3":40000,"thresh_4":150000,"yield_0":80,"yield_1":250,"yield_2":500,"yield_3":1000,"yield_4":2000,"max_stage":5,"egg_weight":100,"egg_type":0,"family":"Earth"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":450,"thresh_1":2500,"thresh_2":12000,"thresh_3":48000,"thresh_4":170000,"yield_0":90,"yield_1":280,"yield_2":560,"yield_3":1120,"yield_4":2200,"max_stage":5,"egg_weight":65,"egg_type":1,"family":"Earth"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":1200,"thresh_1":800,"thresh_2":4000,"thresh_3":16000,"thresh_4":80000,"yield_0":90,"yield_1":270,"yield_2":540,"yield_3":1080,"yield_4":2200,"max_stage":5,"egg_weight":100,"egg_type":0,"family":"Air"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":1000,"thresh_1":1200,"thresh_2":6000,"thresh_3":24000,"thresh_4":100000,"yield_0":100,"yield_1":300,"yield_2":600,"yield_3":1200,"yield_4":2400,"max_stage":5,"egg_weight":65,"egg_type":1,"family":"Air"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":600,"thresh_1":3000,"thresh_2":15000,"thresh_3":60000,"thresh_4":200000,"yield_0":150,"yield_1":450,"yield_2":900,"yield_3":1800,"yield_4":3600,"max_stage":5,"egg_weight":30,"egg_type":2,"family":"Spirit"}}'

pushaction phgamecreatr setspecies '{"sp":{"template_id":<REAL_ID>,"growth_rate":400,"thresh_1":5000,"thresh_2":25000,"thresh_3":100000,"thresh_4":300000,"yield_0":200,"yield_1":600,"yield_2":1200,"yield_3":2400,"yield_4":5000,"max_stage":5,"egg_weight":8,"egg_type":3,"family":"Shadow"}}'
```

### ✅ Verify: Check speciescfg on chain

```
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"speciescfg","limit":20}'
```

ควรเห็น 12 rows — ทุก template_id + family ตรงตามที่ออกแบบ

---

## Step 4: Final verification checklist

```bash
# 1. Template count = 12
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" \
  -d '{"json":true,"code":"atomicassets","scope":"phgamecreatr","table":"templates","limit":20}' | python -c "import sys,json; d=json.load(sys.stdin); print(f'templates: {len(d[\"rows\"])}')"

# 2. Species count = 12
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" \
  -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"speciescfg","limit":20}' | python -c "import sys,json; d=json.load(sys.stdin); print(f'species: {len(d[\"rows\"])}')"

# 3. Verify each family group exists
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" \
  -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"speciescfg","limit":20}' | python -c "import sys,json; d=json.load(sys.stdin); families=set(r['family'] for r in d['rows']); print(f'families: {sorted(families)}')"
# Expected: ['Air', 'Earth', 'Fire', 'Shadow', 'Spirit', 'Water']

# 4. egg_type distribution
curl -s -X POST "https://testnet.wax.eosrio.io/v1/chain/get_table_rows" -H "content-type: application/json" \
  -d '{"json":true,"code":"phgamecreatr","scope":"phgamecreatr","table":"speciescfg","limit":20}' | python -c "
import sys,json
d=json.load(sys.stdin)
from collections import Counter
c=Counter(r['egg_type'] for r in d['rows'])
print(f'egg_type 0 (Common):    {c.get(0,0)} (expected 4)')
print(f'egg_type 1 (Uncommon):  {c.get(1,0)} (expected 4)')
print(f'egg_type 2 (Rare):      {c.get(2,0)} (expected 3)')
print(f'egg_type 3 (Legendary): {c.get(3,0)} (expected 1)')
"
```

---

## 📁 File Reference

| File | Purpose |
|------|---------|
| `deploy/SPECIES-DESIGN.md` | Full species design doc — all numbers, families, probability tables |
| `deploy/args-createtempls.json` | 11 createtempl payloads (JSON array) |
| `deploy/species-config.json` | All 12 species configs (master reference, placeholder IDs) |
| `deploy/setspecies/*.json` | Individual species payloads — 1 file per species |
| `deploy/DEPLOY-SPECIES.md` | This file — step-by-step deploy instructions |

---

## 🔒 Constraints

- ✅ `phgamecreatr` only — ไม่แตะ `pockethatch1`
- ✅ WAX testnet only — ไม่แตะ mainnet
- ✅ ไม่ setcode/setabi — wasm `060b7bff` คงเดิม
- ✅ บอส unlock+sign เองทุก action — Kevin ทำได้แค่ verify read-only

---

*Prepared by Kevin · 2026-07-03*
