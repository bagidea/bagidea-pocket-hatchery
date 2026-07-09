# WALLET-INTEGRATION.md — WAX Cloud Wallet → Web App (เส้น ก)

> เป้าหมาย: ผู้ใช้ทั่วไปที่ **มี WAX Cloud Wallet (WCW) อยู่แล้ว** ล็อกอินและเซ็น+broadcast
> transaction ของ smart contract ของเราได้ผ่านหน้าเว็บ — ครอบคลุม dev บน **wax-testnet** และ prod บน mainnet.
>
> Research by **Sahara** · 2026-06-26 · ทุกข้ออ้างมีแหล่งใน Research Board (แท็ก `pocket-hatchery`) ตรวจย้อนได้.
> chainId ของ testnet ยืนยันสดกับ RPC จริง 3 โหนด — ใช้ได้ทันที.

---

## ✅ 0. ข้อสรุปหลัก — WCW ล็อกอิน/เซ็นบน wax-testnet ได้ (ตอบคำถามบอสตรงๆ)

**WAX Cloud Wallet (ตอนนี้คือ "MyCloudWallet" ตัว passkey ใหม่) — connector ทางการรองรับ wax-testnet จริง. ใช้เส้น ก ได้ตามเป้า.**

หลักฐานชี้ขาด (อ่านซอร์สโค้ดจริงของปลั๊กอิน `@wharfkit/wallet-plugin-cloudwallet` 1.6.5 — primary, สูงกว่าหน้า docs):
- `supportedChains` ดีฟอลต์ **ใส่ chainId ของ wax-testnet ไว้ชัดเจน** พร้อมคอมเมนต์ในซอร์ส:
  ```
  '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4', // WAX (Mainnet)
  'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12', // WAX (Testnet) - new wallet
  ```
  (ยืนยันตรงกัน 2 ทาง: GitHub raw `src/index.ts` + bundle ที่ publish บน jsdelivr)
- `login()` **ไม่ผูกกับ chain ใด chain หนึ่งในตัว URL** — มันยิงไป `https://www.mycloudwallet.com/cloud-wallet/login` ตัวเดียว (ส่งแค่ `v`+`nonce`), แล้ว chain ที่อยู่ใน `context.chain` ถูก **validate กับ supportedChains** (testnet ผ่านเพราะอยู่ในลิสต์) และผูกกลับใน session ที่คืนมา. ⇒ โยน testnet chain เข้า SessionKit แล้ว WCW จะคืน session บน testnet ให้.
- คอมเมนต์ `// ... - new wallet` คืนคำตอบให้ความขัดแย้งกับข้อมูลเก่า: **WCW ตัวเก่า = mainnet-only จริง แต่ MyCloudWallet ตัว passkey ใหม่เพิ่ม testnet เข้ามาแล้ว** ซึ่งคือเวอร์ชันที่ connector 1.6.5 เล็งไปหา. หน้า docs ที่ยังเขียน "mainnet only" เป็นข้อมูล**ค้าง/อธิบาย wallet ตัวเก่า** — ถูก outrank ด้วยซอร์สโค้ดปัจจุบัน.

> ⚠️ **เหลือยืนยันด้วยมือ 1 ครั้ง (พิสูจน์ headless ไม่ได้):** login เป็น passkey + popup ต้องมีคนกดจริง — จึงเหลือทดสอบ end-to-end ว่าบัญชี MyCloudWallet ที่ผู้ใช้มี ล็อกอิน+เซ็น testnet ผ่านจริง 1 รอบ. **อย่าฟันธงว่าทำไม่ได้** (จุดที่ดราฟต์แรกพลาด) — connector รองรับชัดเจน ทำได้แน่ระดับโค้ด เหลือแค่ยืนยัน UX จริง. ขั้นทดสอบอยู่ในข้อ 6.

**สรุปเชิงสถาปัตยกรรม:**

| สภาพแวดล้อม | วิธีล็อกอิน/เซ็น |
|---|---|
| **wax-testnet (dev/ทดสอบ)** | **WCW (MyCloudWallet)** — รองรับโดย connector; + **Anchor** เป็น fallback ที่เชื่อถือได้สำหรับ dev (private key จาก faucet เซ็นได้แน่ๆ) |
| **wax-mainnet (prod, ผู้ใช้จริง)** | **WCW (MyCloudWallet)** = ทางหลัก + Anchor fallback |

โค้ดชุดเดียว (WharfKit SessionKit), ใส่ **ทั้ง WCW + Anchor ทั้งสอง chain** — **ไม่ถอด WCW ออกจาก testnet**. ผู้ใช้เลือก wallet เองตอน login. ขึ้น mainnet แค่สลับ env.

---

## 1. SDK / ไลบรารีที่ใช้จริง (เลือกแล้ว: WharfKit)

**ตัดสินใจ: ใช้ WharfKit Session Kit** — เป็นเส้นที่ WAX แนะนำเองในปี 2026, maintained ต่อเนื่อง, รองรับหลาย wallet ในโค้ดชุดเดียว.

### แพ็กเกจที่ต้องติดตั้ง (เวอร์ชันยืนยันกับ npm registry 2026-06-26)

| Package | เวอร์ชันล่าสุด | publish ล่าสุด | สถานะ | License |
|---|---|---|---|---|
| `@wharfkit/session` | **1.6.1** | 2025-09-05 | ✅ maintained | BSD-3 |
| `@wharfkit/web-renderer` | **1.4.3** | 2025-09-06 | ✅ maintained | BSD-3 |
| `@wharfkit/wallet-plugin-cloudwallet` | **1.6.5** | **2026-05-24** | ✅ maintained (active) | BSD-3 |
| `@wharfkit/wallet-plugin-anchor` | **1.6.1** | 2025-12-14 | ✅ maintained | BSD-3 |
| `@wharfkit/antelope` (ชนิดข้อมูล Name/Asset, ถ้าต้อง) | 1.2.0 | 2026-04-12 | ✅ maintained | BSD-3-No-Military |
| `@wharfkit/contract` (ABI helper, ออปชัน) | 1.2.1 | 2025-02-02 | ✅ maintained | BSD-3 |

> ⚠️ ชื่อแพ็กเกจ WCW connector คือ `@wharfkit/wallet-plugin-cloudwallet` (มี scope `@wharfkit/`) — **อย่าสับสน** กับ `wax-cloud-wallet` (ของเก่ายุค waxjs). ผลค้นเก่าๆ ที่บอก "1.3.2 ก.พ. 2024" เป็นข้อมูลค้าง ของจริงคือ 1.6.5.

```bash
npm i @wharfkit/session @wharfkit/web-renderer \
      @wharfkit/wallet-plugin-cloudwallet @wharfkit/wallet-plugin-anchor
```

### ทางเลือกที่ "ไม่" ใช้ (และเหตุผล)

- **`@waxio/waxjs`** (SDK ทางการเดิม): latest 1.7.1 (ก.พ. 2024), repo ยังแตะปี 2025 แต่ค้างเวอร์ชัน — *ใช้ได้* สำหรับ WCW-only แบบ minimal แต่ WAX ไม่แนะนำแล้ว. เก็บไว้เป็น note เฉยๆ.
- **UAL stack** (`universal-authenticator-library` + `@eosdacio/ual-wax` + `ual-anchor` + renderers): **legacy dead-end**. core ค้างที่ 0.3.0 ตั้งแต่ **2020** (อยู่ใต้ EOSIO org ที่ Block.one ยุบ), WCW authenticator ของ eosDAC ค้างที่ **2023**. **ห้ามเริ่มโปรเจกต์ใหม่ปี 2026 บน UAL.** บทบาท multi-wallet ของ UAL ตอนนี้ WharfKit รับช่วงไปแล้ว.

> บทเรียน (จากความจำออฟฟิศ): ทุก repo ข้างบนเช็คแล้วว่า GitHub ไม่ขึ้น `archived:true` — แต่ "ไม่ archived + มี npm + มี license" **ไม่ได้แปลว่ายังมีชีวิต**. สัญญาณจริงคือ **วันที่** — UAL หยุดปี 2020/2023, waxjs ค้างปี 2024. WharfKit เท่านั้นที่ยัง publish ปลายปี 2025–2026.

---

## 2. ค่า network ของ wax-testnet (ยืนยันสดแล้ว)

### Chain ID (คัดลอกตรงจาก `get_info` ของ 3 โหนดอิสระ — ตรงกันหมด)
```
f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12
```
mainnet (อ้างอิง, อย่าสับสน): `1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4`

### RPC / Chain API endpoints (HTTPS — ต้อง https เท่านั้นสำหรับเว็บ)

| Endpoint | สถานะ 2026-06-26 | หมายเหตุ |
|---|---|---|
| `https://testnet.waxsweden.org` | ✅ LIVE | **แนะนำ** — มี Hyperion v3 history ในตัว |
| `https://api.waxtest.alohaeos.com` | ✅ LIVE | สำรองที่ดี |
| `https://waxtestnet.greymass.com` | ⚠️ 403 ต่อ crawler | อาจบล็อกบอท — เทสต์จาก browser จริงก่อนใช้ |
| `https://testnet.wax.pink.gg` | ❌ refused | อย่าใช้ |
| `https://wax-test.eosdac.io` | ❌ DNS ตาย | อย่าใช้ |

> registry endpoint ทางการ (`eosswedenorg/waxtestnet → endpoints.json`) มีรายการ **ค้าง/ตายปนอยู่** → ต้อง health-check runtime เสมอ. โหนดที่เชื่อถือสุดตัวเดียว = `testnet.waxsweden.org`.
>
> **CORS:** ไม่มีเอกสารยืนยันชัด แต่ `testnet.waxsweden.org` คือโหนดที่ dApp ใช้จาก browser โดยพฤตินัย. แนะนำ probe header `Access-Control-Allow-Origin` ก่อนพึ่งพา (ทำใน verify-before-use layer).

### History API (อ่านประวัติบัญชี)
`https://testnet.waxsweden.org` รัน **Hyperion v3.5.0** → ใช้ `https://testnet.waxsweden.org/v2/history/...`

---

## 3. โค้ด — ตั้งค่า → ล็อกอิน → เซ็น custom contract action

### 3.1 ตั้งค่า SessionKit (ชุดเดียว รองรับทั้ง testnet+mainnet)

```ts
// wallet.ts
import { SessionKit, Chain } from '@wharfkit/session'
import { WebRenderer } from '@wharfkit/web-renderer'
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'

// --- chain definitions (ยืนยันสดแล้ว) ---
const waxTestnet = new Chain({
  id: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
  url: 'https://testnet.waxsweden.org', // https + CORS-ok โดยพฤตินัย
})
const waxMainnet = new Chain({
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.greymass.com',
})

// เลือก env: dev = testnet, prod = mainnet
const IS_TESTNET = import.meta.env.VITE_CHAIN !== 'mainnet'
const activeChain = IS_TESTNET ? waxTestnet : waxMainnet

// ใส่ทั้งสอง wallet ทั้งสอง chain — connector cloudwallet รองรับ testnet
// (testnet chainId อยู่ใน default supportedChains แล้ว) จึง "ไม่ถอด WCW ออกจาก testnet".
// ผู้ใช้เลือก wallet เองตอน login; Anchor คือ fallback (และตัวเซ็น dev ที่ชัวร์ด้วย private key)
const walletPlugins = [
  new WalletPluginCloudWallet(),
  new WalletPluginAnchor(),
]

export const sessionKit = new SessionKit({
  appName: 'pocket-hatchery',
  chains: [activeChain],
  ui: new WebRenderer(),
  walletPlugins,
})
```

### 3.2 ล็อกอิน / กู้ session / ออกจากระบบ

> SessionKit เก็บ session ลง localStorage อัตโนมัติ และ `restore()` คืนค่าให้เอง.
> **สำคัญ:** `login()` ต้องเรียกจาก **user gesture ตรงๆ** (onClick) เพราะ WCW เปิด popup/แท็บใหม่ → ถ้าเรียกหลัง await/บน page-load จะโดน popup blocker.

```ts
import { sessionKit } from './wallet'

// ปุ่มล็อกอิน (ใน click handler)
export async function login() {
  const { session } = await sessionKit.login() // WCW เปิดแท็บ / Anchor เด้ง popup
  return session
}

// ตอนเปิดแอป
export async function bootstrap() {
  const session = await sessionKit.restore()    // Session | undefined
  return session
}

export async function logout() {
  await sessionKit.logout()
}
```

### 3.3 เซ็น + broadcast action ของ custom contract เรา

```ts
const session = await sessionKit.restore()
if (!session) throw new Error('ยังไม่ได้ล็อกอิน')

const action = {
  account: 'mycontract11',                       // บัญชี contract ของเรา (≤12 ตัว a-z1-5.)
  name: 'mintegg',                               // ชื่อ action
  authorization: [{
    actor: String(session.actor),                // บัญชีที่ล็อกอิน
    permission: String(session.permission),      // ปกติ 'active'
  }],
  data: {                                         // ต้องตรง struct ใน ABI ของ contract
    owner: String(session.actor),
    species: 'phoenix',
    rarity: 3,
  },
}

const result = await session.transact(
  { actions: [action] },
  { expireSeconds: 120, broadcast: true }         // true = push ขึ้น chain จริง
)
console.log('tx id:', String(result.resolved?.transaction.id))
```

**จุดที่พลาดบ่อย:**
- ถ้า `data` ไม่ตรง ABI → `transact` throw ตอน serialize. ถ้าต้องการ type-safe ดึง ABI ผ่าน `@wharfkit/contract`.
- WCW/Anchor ใช้ interface `session.transact()` **เหมือนกันทุกประการ** → โค้ดเซ็นไม่ต้องแยกตาม wallet.
- `broadcast: false` = dry-run (เซ็นแต่ไม่ push) มีไว้เทสต์.

---

## 4. Anchor เป็น fallback (สำรองที่ดี + ตัวเซ็น dev ที่ชัวร์บน testnet)

**สรุป: ใช้ได้ดีในฐานะตัวเลือกที่ 2** — ไม่ใช่ "ทางเดียว" บน testnet (WCW ก็ทำ testnet ได้) แต่ Anchor เป็นตัวเซ็น dev ที่เชื่อถือได้ที่สุดเพราะ import private key จาก faucet มาเซ็นได้ตรงๆ ไม่ต้องพึ่ง popup/passkey.

- **plugin (`@wharfkit/wallet-plugin-anchor` v1.6.1, ธ.ค. 2025): maintained, ปลอดภัยที่จะใช้.** เสียบเข้า SessionKit คู่กับ WCW แล้วได้ wallet picker ทันที (ไม่ต้องแก้โค้ดเซ็น).
- **ตัวแอป Anchor desktop: แช่แข็ง** — release ล่าสุด v1.3.12 (มิ.ย. 2023), ไม่มี release ~3 ปี. ไม่ประกาศ deprecate อย่างเป็นทางการ แต่ Greymass ย้ายโฟกัสไป **Unicove** (web wallet, วางเป็น "ใช้คู่กับ Anchor"). Anchor mobile (Android v0.66, พ.ค. 2025) ยังได้ patch บ้าง.
- **Anchor รองรับ wax-testnet เต็มตัว** (desktop: Manage Blockchains → add → "WAX Testnet", chainId `f16b1833...`, แล้ว import private key จาก faucet). *ข้อจำกัด: Anchor mobile เพิ่ม custom chain ไม่ได้* → testnet ต้องใช้ desktop.
- **UAL Anchor (`ual-anchor` 1.3.0, 2022): abandoned** — อย่าใช้.

**คำแนะนำ:** ทั้ง testnet และ mainnet = **WCW หลัก + Anchor สำรอง** (combo มาตรฐานปี 2026, เพิ่ม plugin ตัวเดียวแทบไม่มีต้นทุน). บน testnet ใช้ Anchor+faucet key เป็นตัวเซ็นหลักของ dev ก่อนยืนยัน UX ของ WCW. ไม่ต้องลงทุน wallet ที่ 3 (Wombat ฯลฯ) จนกว่าจะมี demand จริง.

---

## 5. ผู้ใช้เริ่มต้นบน testnet ยังไง (ให้ engineer/QA ทดสอบ)

แหล่งเดียวจบ: **WAX sw/eden** → `https://waxsweden.org/create-testnet-account/`

1. **สร้างบัญชี testnet** — ฟอร์มบนหน้า หรือ API: `https://faucet.waxsweden.org/create_account?<ชื่อ>`
   - ชื่อ = **12 ตัวอักษรพอดี**, ใช้ได้แค่ `a–z` และ `1–5`. จำกัด 1 บัญชี/24 ชม.
   - ได้ public/private keypair → import private key เข้า Anchor.
2. **ขอ test WAX ฟรี (faucet)** — `https://faucet.waxsweden.org/get_token?<ชื่อ>` → 100 WAX/ครั้ง, เพดาน 1000 WAX/24 ชม.
3. **ตรวจ/ดู** — explorer: `https://testnet.waxblock.io` หรือ `https://wax-test.bloks.io`. ชุมชน: Telegram `t.me/waxtestnet`.

---

## 6. แผนลงมือ (สำหรับ engineer)

1. `npm i` แพ็กเกจในข้อ 1 → วาง `wallet.ts` (ข้อ 3.1) — ใส่ **ทั้ง WCW + Anchor** (อย่าถอด WCW ออกจาก testnet).
2. ตั้ง env `VITE_CHAIN` (`testnet` default / `mainnet`).
3. ทำปุ่ม Login เรียก `sessionKit.login()` **ใน onClick** + เรียก `restore()` ตอน mount.
4. ฟังก์ชันส่ง action ของ contract เรา (ข้อ 3.3) — เปลี่ยน `account/name/data` ให้ตรง ABI.
5. **ทดสอบ 2 เส้นบน testnet:**
   - **(ก) WCW/MyCloudWallet** — กด Login → เลือก Cloud Wallet → ดูว่าล็อกอิน+เซ็น testnet ผ่านจริง (นี่คือ end-to-end check ที่เหลือ; connector รองรับแล้ว แต่ต้องเห็น UX จริง 1 รอบ). ถ้าบัญชี MyCloudWallet ไม่มีตัวตนบน testnet ให้สร้าง/ผูกผ่านพอร์ทัล MyCloudWallet แล้วลองใหม่.
   - **(ข) Anchor** — สร้างบัญชี testnet + faucet (ข้อ 5), import เข้า Anchor desktop (เพิ่ม WAX Testnet), login+sign — ใช้เป็นเส้นเซ็น dev ที่ชัวร์.
6. เพิ่ม runtime health-check + CORS probe ของ RPC endpoint (verify-before-use); มี fallback endpoint.
7. ขึ้น mainnet: แค่สลับ `VITE_CHAIN=mainnet` → WCW ทำงานเหมือนเดิม ไม่ต้องแก้โค้ดเซ็น.

---

## 7. แหล่งอ้างอิง (เก็บใน Research Board แท็ก `pocket-hatchery` ทั้งหมด)

ทุกข้อตรวจย้อนได้ด้วย `research-board list pocket-hatchery` / `trace`. หลัก ๆ:

- **[ชี้ขาด] ซอร์สโค้ดปลั๊กอิน cloudwallet 1.6.5 — `supportedChains` รวม wax-testnet (`f16b1833...`, คอมเมนต์ "new wallet")** — primary — raw.githubusercontent.com/wharfkit/wallet-plugin-cloudwallet/master/src/index.ts (ยืนยันคู่กับ bundle บน cdn.jsdelivr.net) · Sahara re-checked (รอ staff sign-off)
- WharfKit Cloud Wallet plugin (repo + docs) — primary — github.com/wharfkit/wallet-plugin-cloudwallet · wharfkit.com/plugins/wallet-plugin-cloudwallet *(หน้า docs ยังเขียน mainnet-only — ค้าง/อธิบาย wallet เก่า, ถูก outrank ด้วยซอร์ส)*
- WAX official WharfKit React tutorial — primary — docs.wax.io/build/tutorials/wharfkit/howto_react.html
- npm registry: @wharfkit/session 1.6.1, web-renderer 1.4.3, wallet-plugin-anchor 1.6.1, wallet-plugin-cloudwallet 1.6.5
- wax-testnet chainId ยืนยันสด (RPC จริง 2-3 โหนดตรงกัน) — testnet.waxsweden.org & api.waxtest.alohaeos.com `/v1/chain/get_info` · Sahara re-checked (รอ staff sign-off)

> หมายเหตุ Research Board: ทุกแหล่งบันทึก + trace ย้อนได้แล้ว (แท็ก `pocket-hatchery`, 16 รายการ). การ promote เป็น tier "verified" เป็น staff sign-off ที่ทำได้เฉพาะ role ระดับ oversight (Researcher อย่าง Sahara สั่งไม่ได้ตามดีไซน์) — ฝาก reviewer/lead รัน `research-board verify` บน `rb_f0b361cb` (ซอร์สชี้ขาด), `rb_a5301c5e`, `rb_83366d05`, `rb_8cf40380` ได้เลย.
- testnet endpoints registry — github.com/eosswedenorg/waxtestnet
- WAX sw/eden create-testnet-account + faucet — waxsweden.org/create-testnet-account
- MyCloudWallet (passkey wallet, รองรับ testnet ผ่าน connector) — mycloudwallet.com
- Greymass Progress Update May 2025 (Anchor status) — greymass.medium.com/progress-update-may-2025
- Legacy: @waxio/waxjs 1.7.1 (npm), @eosdacio/ual-wax 1.9.0 (npm) — เพื่อบันทึกว่าเป็น legacy

---

### TL;DR สำหรับบอส
ใช้ **WharfKit SessionKit** (`@wharfkit/session` + `web-renderer` + `wallet-plugin-cloudwallet` + `wallet-plugin-anchor`). **WCW (MyCloudWallet passkey ใหม่) ล็อกอิน+เซ็น wax-testnet ได้จริง** — ยืนยันจากซอร์สปลั๊กอิน 1.6.5: testnet chainId อยู่ใน `supportedChains` (คอมเมนต์ "new wallet") และ `login()` ผูก session ตาม chain ที่ส่งเข้า SessionKit. ใส่ทั้ง WCW+Anchor ทั้งสอง chain (Anchor = fallback + ตัวเซ็น dev ที่ชัวร์). โค้ดชุดเดียว ขึ้น mainnet แค่สลับ env. chainId testnet = `f16b1833...8a12` (ยืนยันสด), endpoint = `https://testnet.waxsweden.org`. **เหลือ:** ทดสอบ WCW testnet login end-to-end ด้วยมือ 1 รอบ (passkey ทำ headless ไม่ได้).
