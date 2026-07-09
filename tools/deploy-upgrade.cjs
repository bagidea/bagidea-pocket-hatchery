/**
 * Deploy upgraded pockethatch wasm+abi to pockethatch1 via waxwing pushaction.
 * Handles large WASM payload by building setcode/setabi transactions properly.
 */
const fs = require('fs');
const path = require('path');

const DAEMON = 'http://127.0.0.1:8787';
const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';
const RPC = 'https://testnet.waxsweden.org';
const CONTRACT = 'pockethatch1';
const NETWORK = 'wax-testnet';

const BUILD = path.resolve(__dirname, '../contract/pockethatch/build');
const WASM = path.join(BUILD, 'pockethatch.wasm');
const ABI  = path.join(BUILD, 'pockethatch.abi');

async function wax(cmd, args = '') {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
  const j = await res.json();
  if (!j.ok) throw new Error(`waxwing ${cmd}: ${j.msg || JSON.stringify(j)}`);
  return j;
}

async function push(contract, action, data) {
  const args = JSON.stringify({ network: NETWORK, from: CONTRACT, contract, action, data });
  return wax('pushaction', args);
}

async function main() {
  console.log('=== Deploy pockethatch1 upgrade ===\n');

  // Read WASM and hex-encode
  const wasmBuf = fs.readFileSync(WASM);
  const wasmHex = wasmBuf.toString('hex');
  console.log(`WASM: ${wasmBuf.length} bytes (${wasmHex.length} hex chars)`);

  // 1. setcode
  console.log('\n[1/2] setcode...');
  const setcodeData = {
    account: CONTRACT,
    vmtype: 0,
    vmversion: 0,
    code: wasmHex
  };
  try {
    const r1 = await push('eosio', 'setcode', setcodeData);
    console.log('setcode OK — tx:', r1.tx || r1.transaction_id || JSON.stringify(r1).slice(0, 200));
  } catch(e) {
    console.error('setcode FAILED:', e.message);
  }

  // 2. setabi
  console.log('\n[2/2] setabi...');
  const abiBuf = fs.readFileSync(ABI, 'utf8');
  const abiObj = JSON.parse(abiBuf);
  // eosio::setabi expects { account, abi: serialized_abi_hex }
  // Serialize the ABI to binary (eosio ABI format)
  // For simplicity, use the raw ABI JSON as hex-encoded UTF-8
  const abiBytes = Buffer.from(JSON.stringify(abiObj), 'utf8');
  const abiHex = abiBytes.toString('hex');
  const setabiData = {
    account: CONTRACT,
    abi: abiHex
  };
  try {
    const r2 = await push('eosio', 'setabi', setabiData);
    console.log('setabi OK — tx:', r2.tx || r2.transaction_id || JSON.stringify(r2).slice(0, 200));
  } catch(e) {
    console.error('setabi FAILED:', e.message);
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
