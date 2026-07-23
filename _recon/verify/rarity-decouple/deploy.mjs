// deploy.mjs — Deploy rarity-decouple to phgamecreatr via waxwing pushaction
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';
const CONTRACT = 'phgamecreatr';
const RPC = 'https://testnet.waxsweden.org';

async function pushaction(contract, action, data, actor) {
  const body = JSON.stringify({ cmd: 'pushaction', args: { contract, action, data, actor } });
  const resp = await fetch(WAXWING, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  return await resp.json();
}

async function getCodeHash() {
  const resp = await fetch(`${RPC}/v1/chain/get_raw_abi`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: CONTRACT })
  });
  const j = await resp.json();
  return j.code_hash || '?';
}

async function main() {
  // 0. Verify live code_hash
  console.log('[0/5] Live code_hash...');
  const oldHash = await getCodeHash();
  console.log(`  Live: ${oldHash}`);

  // 1. Pause
  console.log('[1/5] Pause...');
  const r1 = await pushaction(CONTRACT, 'setpaused', { paused: true }, CONTRACT);
  console.log(`  ${JSON.stringify(r1)}`);

  // 2. Setcode
  console.log('[2/5] Setcode...');
  const wasmBytes = readFileSync(resolve(__dirname, 'pockethatch.wasm'));
  const wasmHex = [...wasmBytes].map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`  WASM: ${wasmBytes.length} bytes`);
  const r2 = await pushaction('eosio', 'setcode', { account: CONTRACT, vmtype: 0, vmversion: 0, code: wasmHex }, CONTRACT);
  console.log(`  ${JSON.stringify(r2)}`);

  // 3. Setabi
  console.log('[3/5] Setabi...');
  const packCli = resolve(__dirname, '..', '..', '..', 'tools', 'pack-abi-cli.mjs');
  const abiPath = resolve(__dirname, 'pockethatch.deploy.abi');
  const packResult = JSON.parse(execSync(`node "${packCli}" --json "${abiPath}"`, { encoding: 'utf8' }).trim());
  console.log(`  ABI packed: ${packResult.packedBytes} bytes`);
  const r3 = await pushaction('eosio', 'setabi', { account: CONTRACT, abi: packResult.packedHex }, CONTRACT);
  console.log(`  ${JSON.stringify(r3)}`);

  // 4. Clear old creatures (layout migration)
  console.log('[4/5] Clear creatures...');
  const r4 = await pushaction(CONTRACT, 'clearcreatrs', {}, CONTRACT);
  console.log(`  ${JSON.stringify(r4)}`);

  // 5. Verify
  console.log('[5/5] Verify...');
  const newHash = await getCodeHash();
  console.log(`  New code_hash: ${newHash}`);
  const expected = '5a321f53e8f8f1a7109fa9e25d0ecc7a85130f0bd71ba4e58bc362decde6655e';
  console.log(`  Expected:      ${expected}`);
  console.log(`  MATCH: ${newHash === expected}`);

  console.log('\n=== Deploy complete ===');
  console.log('Next: setconfig to reopen game, then test hatches');
}

main().catch(e => { console.error(e); process.exit(1); });
