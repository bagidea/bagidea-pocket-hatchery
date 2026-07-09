// deploy.mjs — Deploy WASM + ABI to phgamecreatr via waxwing pushaction
// pushaction expects structured args: {contract, action, data, actor}
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..', '..', '..');
const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';
const CONTRACT = 'phgamecreatr';
const BUILD = __dirname;

// Read + hex-encode WASM
const wasmPath = resolve(BUILD, 'pockethatch.wasm');
const wasmBytes = readFileSync(wasmPath);
const wasmHex = [...wasmBytes].map(b => b.toString(16).padStart(2, '0')).join('');
console.log(`WASM: ${wasmBytes.length} bytes`);

// Pack ABI
const packCli = resolve(PROJECT, 'tools', 'pack-abi-cli.mjs');
const abiPath = resolve(BUILD, 'pockethatch.abi');
const packResult = JSON.parse(execSync(`node "${packCli}" --json "${abiPath}"`, { encoding: 'utf8' }).trim());
const abiHex = packResult.packedHex;
console.log(`ABI packed: ${packResult.packedBytes} bytes`);

// Helper — pushaction expects args as OBJECT with {contract, action, data, actor}
async function pushaction(contract, action, data, actor) {
  const body = JSON.stringify({
    cmd: 'pushaction',
    args: { contract, action, data, actor }
  });
  console.log(`  Body size: ${body.length} chars`);
  const resp = await fetch(WAXWING, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  });
  return await resp.json();
}

// Step 1: setcode
console.log('\n=== [1/2] SETCODE ===');
const scResult = await pushaction('eosio', 'setcode',
  { account: CONTRACT, vmtype: 0, vmversion: 0, code: wasmHex },
  CONTRACT);
if (!scResult.ok) { console.error('SETCODE FAILED:', scResult.msg); process.exit(1); }
console.log(`  TX: ${scResult.txId}`);

// Step 2: setabi
console.log('\n=== [2/2] SETABI ===');
const saResult = await pushaction('eosio', 'setabi',
  { account: CONTRACT, abi: abiHex },
  CONTRACT);
if (!saResult.ok) { console.error('SETABI FAILED:', saResult.msg); process.exit(1); }
console.log(`  TX: ${saResult.txId}`);

console.log('\n=== DEPLOY COMPLETE ===');
console.log(JSON.stringify({ setcode_tx: scResult.txId, setabi_tx: saResult.txId }));
