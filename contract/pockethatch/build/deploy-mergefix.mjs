// deploy-mergefix.mjs — setcode only (ABI is byte-identical to the deployed one,
// verified by diffing the regenerated pockethatch.abi, so setabi is a no-op).
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const BUILD = dirname(fileURLToPath(import.meta.url));
const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';

const wasmBytes = readFileSync(resolve(BUILD, 'pockethatch.mergefix.wasm'));
const wasmHex = wasmBytes.toString('hex');
console.log(`WASM: ${wasmBytes.length} bytes`);

const body = JSON.stringify({
  cmd: 'pushaction',
  args: {
    contract: 'eosio',
    action: 'setcode',
    data: { account: 'phgamecreatr', vmtype: 0, vmversion: 0, code: wasmHex },
    actor: 'phgamecreatr',
  },
});
const resp = await fetch(WAXWING, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body,
});
const out = await resp.json();
console.log(JSON.stringify(out).slice(0, 600));
process.exit(out.ok ? 0 : 1);
