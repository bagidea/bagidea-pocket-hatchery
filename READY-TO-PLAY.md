# Pocket Hatchery — สถานะปัจจุบัน (2 กรกฎาคม 2569)

> Kevin · 2 กรกฎาคม 2569 · status: **✅ LOOP PROVEN — เล่นได้บน WAX testnet**

---

## 🎯 สรุป

Game loop พิสูจน์แล้วบน WAX testnet ผ่าน waxwing `pushaction` บน Windows ล้วนๆ:
**initplayer → firsthatch → feed → evolve** — ผ่านหมดทุก step

Contract ที่ใช้งานได้จริง: **`phgamecreatr`** (code_hash `7a61f065`)

---

## ✅ Loop Proven — verified on-chain (2026-07-02)

| Step | Action | Status | Explorer |
|------|--------|--------|----------|
| 1 | `initplayer` | ✅ | `33c40fe216ee93ee...` |
| 2 | `firsthatch` | ✅ | `2cb5eecf820571c5...` |
| 3 | `feed` | ✅ | `e03904adcf1b2e4b...` |
| 4 | `evolve` | ✅ | `35bfda951afc2c5b...` |

### On-chain state (verified via RPC direct — not exit codes)

```
=== creatures table (phgamecreatr) ===
asset_id:  1099603751654
owner:     waxwingsuper
stage:     1  ← evolved!
growth:    41,000 base + 1,000 fed
template:  662889

=== players table (phgamecreatr) ===
waxwingsuper: 150 EGG  (200 - 50 evolve cost)
feeds_today: 1

=== AtomicAssets (waxwingsuper) ===
asset #1099603751654  collection=phgamecreatr  (mutable: stage=1)
asset #1099603751655  collection=phgamecreatr  (mutable: stage=0)
```

---

## 🛠 สิ่งที่ทำเพื่อให้ loop ทำงานได้

### 1. ATTR_MAP fix — source + compile + deploy
- `pockethatch.hpp:47-48` — `aa_asset_row` เปลี่ยน `ATTR_MAP` → `std::vector<uint8_t>`
- คอมไพล์ด้วย CDT 4.1.1 (WSL) → build `7a61f065`
- **Deploy ผ่าน waxwing pushaction บน Windows** — ใช้ `eosio::setcode`+`eosio::setabi` sign ด้วย contract account key

### 2. ABI packing fix
- CDT 4.1.1 ABI ไม่มี `tables` และ struct `player_row`/`creature_row`/`rewardpool_row`
- แก้ด้วย eosjs `abi_def` binary packing + merge structs/tables จาก pockethatch1 ABI

### 3. Contract setup (phgamecreatr)
| Resource | Status |
|----------|--------|
| Account creation | waxwing `newaccount` — waxwingsuper pays |
| RAM (1MB) | waxwing `buyram` + `confirm` |
| eosio.code | `eosio::updateauth` — grant phgamecreatr@eosio.code |
| AtomicAssets collection | `atomicassets::createcol` — "phgamecreatr" |
| Schema | `atomicassets::createschema` — "creatures" |
| Template | `atomicassets::createtempl` — #662889 (Fire) |
| Config | `setconfig` — hatch_cost=150, evolve_cost=50, feed_boost=1000, etc. |
| Species | `setspecies` — template_id=662889, thresholds+growth+yields |

---

## 🔴 pockethatch1 — ยัง buggy (ต้องการ CEO action)

| Contract | code_hash | creatures | Status |
|----------|-----------|-----------|--------|
| `pockethatch1` | `3d16ac28` ❌ | 0 rows | ATTR_MAP bug — ต้อง PH_CONTRACT_PRIV เพื่อ deploy fix |
| `phgamecreatr` | `7a61f065` ✅ | 1 row (stage 1) | ทำงานได้ — loop proven |

`pockethatch1` ยังเป็น code เก่า (ATTR_MAP bug) — firsthatch crash ที่ "datastream attempted to read past the end" deploy fix ต้องการ `PH_CONTRACT_PRIV` (pockethatch1 active key) ซึ่ง Kevin ไม่มี

---

## 🎮 วิธีเล่น (บน phgamecreatr)

```bash
# 1. ปลดล็อค waxwing
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d '{"cmd":"unlock","args":"<PASSWORD>"}'

# 2. ดูสถานะ (read-only)
cd tools && node play.mjs status

# 3. เล่นทั้ง loop
node play.mjs loop

# หรือทีละ step:
node play.mjs init       # initplayer — สร้าง player row
node play.mjs hatch 0    # firsthatch — creature แรกฟรี
node play.mjs feed <id>  # feed — +1000 growth
node play.mjs evolve <id> # evolve — เลื่อน stage
node play.mjs harvest    # harvest — เก็บ EGG
node play.mjs reward     # claimreward — HATCH token (stage 2+)
```

---

## 🛠 Tech Stack

| ชั้น | เทคโนโลยี | อยู่ที่ |
|------|---------|--------|
| Contract | C++ / Antelope CDT 4.1.1 | `contract/pockethatch/` |
| Signer | waxwing plugin (wharfkit) | `plugins/waxwing/` |
| Game Bot | Node.js → waxwing HTTP API | `tools/play.mjs` |
| Deploy | Node.js (setcode/setabi via waxwing) | `tools/deploy.mjs` |
| Frontend | React + Vite + WharfKit | `web/` |
| Chain | WAX Testnet | `phgamecreatr` (working) / `pockethatch1` (buggy) |
| NFTs | AtomicAssets | collection: `phgamecreatr` |
| Token | eosio.token (HATCH) | `hatchtokens1` |

---

## 📝 การเปลี่ยนแปลงไฟล์

| ไฟล์ | สิ่งที่เปลี่ยน |
|------|-------------|
| `contract/pockethatch/pockethatch.hpp` | ATTR_MAP fix (uint8[] blob) |
| `contract/pockethatch/build/pockethatch.wasm` | recompiled (7a61f065) |
| `contract/pockethatch/build/pockethatch.abi` | recompiled (+merged tables/structs) |
| `web/src/chain.ts` | CONTRACT_ACCOUNT: pockethatch1 → **phgamecreatr** |
| `web/src/contract.ts` | CONTRACT_ACCOUNT: pockethatch1 → **phgamecreatr** |
| `tools/play.mjs` | CONTRACT: pockethatch1 → **phgamecreatr** |
| `tools/deploy.mjs` | default account: pockethatch1 → **phgamecreatr** |
| `tools/setup-phgamecreatr.mjs` | ใหม่ — AtomicAssets collection + schema + template setup |
| `tools/pack-abi.cjs` | ใหม่ — ABI binary packer (fix CDT 4.1.1 missing tables) |
| `tools/run-loop.cjs` | ใหม่ — end-to-end loop runner |
| `tools/pockethatch1-abi.json` | reference — pockethatch1's working ABI for struct merge |
| `READY-TO-PLAY.md` | **นี้** — proven facts only, no overclaims |

---

## ⏳ สถานะสรุป

| Step | Status |
|------|--------|
| ✅ Source fix (ATTR_MAP) | compiled (7a61f065), deployed to phgamecreatr |
| ✅ phgamecreatr setup | account + RAM + eosio.code + AA collection + config + species |
| ✅ initplayer | waxwingsuper — 150 EGG balance |
| ✅ firsthatch | creature #1099603751654 minted (stage 1 after evolve) |
| ✅ feed | +1,000 fed_growth |
| ✅ evolve | stage 0 → 1, -50 EGG |
| 🔴 pockethatch1 deploy | ยัง buggy — รอ CEO PH_CONTRACT_PRIV |
