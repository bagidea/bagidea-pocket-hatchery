#!/usr/bin/env node
/**
 * Deploy fixed pockethatch contract to phgamecreatr
 * Step 1: setcode (WASM as hex)
 * Step 2: setabi  (ABI as hex)
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;
const ACCT = "phgamecreatr";
const NET = "wax-testnet";
const BUILD = "contract/pockethatch/build";

async function wax(cmd, args) {
  const body = JSON.stringify({ cmd, args: JSON.stringify(args) });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return res.json();
}

async function main() {
  // Read build artifacts
  const wasm = readFileSync(`${BUILD}/pockethatch.wasm`);
  const wasmHex = wasm.toString('hex');
  const wasmHash = createHash('sha256').update(wasm).digest('hex');
  const abiRaw = readFileSync(`${BUILD}/pockethatch.abi`, 'utf8');
  const abiHex = Buffer.from(abiRaw, 'utf8').toString('hex');

  console.log(`WASM: ${wasm.length} bytes (hex: ${wasmHex.length} chars)`);
  console.log(`SHA256: ${wasmHash}`);
  console.log(`ABI: ${abiRaw.length} chars (hex: ${abiHex.length} chars)`);

  // Step 1: setcode
  console.log("\n📤 [1/2] Deploying WASM (setcode)...");
  const r1 = await wax("pushaction", {
    network: NET,
    from: ACCT,
    contract: "eosio",
    action: "setcode",
    data: {
      account: ACCT,
      vmtype: 0,
      vmversion: 0,
      code: wasmHex,
    },
  });

  if (r1.ok) {
    console.log(`✅ setcode OK! tx: ${r1.txId}`);
    console.log(`🔗 ${r1.explorer}`);
  } else {
    console.log(`❌ setcode failed: ${r1.msg}`);
    process.exit(1);
  }

  // Step 2: setabi
  console.log("\n📋 [2/2] Deploying ABI (setabi)...");
  const r2 = await wax("pushaction", {
    network: NET,
    from: ACCT,
    contract: "eosio",
    action: "setabi",
    data: {
      account: ACCT,
      abi: abiHex,
    },
  });

  if (r2.ok) {
    console.log(`✅ setabi OK! tx: ${r2.txId}`);
    console.log(`🔗 ${r2.explorer}`);
  } else {
    console.log(`❌ setabi failed: ${r2.msg}`);
    process.exit(1);
  }

  // Verify
  console.log("\n🔍 Verifying...");
  const rpcBody = JSON.stringify({ account_name: ACCT });
  const verifyRes = await fetch("https://testnet.waxsweden.org/v1/chain/get_code_hash", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rpcBody,
  });
  const v = await verifyRes.json();
  console.log(`On-chain hash: ${v.code_hash}`);
  console.log(`Local hash:    ${wasmHash}`);
  console.log(v.code_hash === wasmHash ? "✅ HASH MATCH!" : "⚠️ MISMATCH");

  console.log("\n🎉 Deploy complete! Now run config + species setup.");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
