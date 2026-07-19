#!/usr/bin/env node
// ดึง wasm ที่อยู่บนเชนจริงมาเทียบไบต์ต่อไบต์กับ artifact บนดิสก์
//
//   node build/verify-onchain-wasm.cjs [artifact] [account]
//
// default: build/pockethatch.slotcfg.wasm ↔ phgamecreatr (wax-testnet)
// exit 0 = ตรง, exit 1 = ไม่ตรง (พิมพ์ sha256 ทั้งสองฝั่งให้เห็น)
//
// มีไว้เพราะเคยพลาด: build ทับชื่อไฟล์ของรุ่นที่ deploy ไปแล้ว → artifact บนดิสก์
// ไม่ตรงกับบนเชน แล้วไม่เหลือของเดิมไว้เทียบ

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RPC = process.env.PH_RPC || 'https://wax-testnet.eosphere.io';
const artifact = process.argv[2] || path.join(__dirname, 'pockethatch.slotcfg.wasm');
const account = process.argv[3] || 'phgamecreatr';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  if (!fs.existsSync(artifact)) {
    console.error(`✗ ไม่มีไฟล์ ${artifact}`);
    process.exit(1);
  }
  const local = fs.readFileSync(artifact);

  const res = await fetch(`${RPC}/v1/chain/get_raw_code_and_abi`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  const json = await res.json();
  if (!json.wasm) {
    console.error(`✗ RPC ไม่คืน wasm: ${JSON.stringify(json).slice(0, 300)}`);
    process.exit(1);
  }
  const chain = Buffer.from(json.wasm, 'base64');

  console.log(`local  ${path.basename(artifact)}  ${local.length} B  ${sha(local)}`);
  console.log(`chain  ${account}@${RPC}  ${chain.length} B  ${sha(chain)}`);

  if (local.equals(chain)) {
    console.log('✅ byte-identical — artifact ตรงกับที่อยู่บนเชน');
    process.exit(0);
  }
  console.error('✗ ไม่ตรง — artifact บนดิสก์ไม่ใช่ของที่ deploy ไป (ดูตารางใน build/BUILD.md)');
  process.exit(1);
})();
