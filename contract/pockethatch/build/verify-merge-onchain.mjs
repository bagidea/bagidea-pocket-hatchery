// verify-merge-onchain.mjs — proves on WAX testnet that a write to an NFT's
// mutable data no longer deletes the attributes it doesn't own.
//
// Both directions of the reported bug, against the live contract:
//   ① equipcosmetic on a NAMED asset  → the name must survive (evolve shares
//      this exact merge path; it is only gated behind a bigger EGG cost)
//   ② setname on that now-COSMETIC asset → the cosmetic must survive
//
// Requires the waxwing wallet unlocked. Run AFTER deploy-mergefix.mjs.
//   node verify-merge-onchain.mjs
import { setTimeout as sleep } from 'node:timers/promises';

const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';
const RPC = 'https://wax-testnet.eosphere.io';
const OWNER = 'officewax123';
const COLLECTION = 'phgamecreatr';
const ASSET = '1099603751834';   // "Ember Queen"
const COSMETIC = 424242;         // arbitrary marker template id

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

async function rpc(path, body) {
  const r = await fetch(RPC + path, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

async function push(contract, action, data, actor = OWNER) {
  const r = await fetch(WAXWING, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd: 'pushaction', args: { contract, action, data, actor } }),
  });
  const out = await r.json();
  if (!out.ok) throw new Error(`${action} failed: ${JSON.stringify(out).slice(0, 300)}`);
  console.log(`  → ${action} ${out.txId || out.transaction_id || ''}`);
  return out;
}

// Same decode as the contract and chain.ts: [varuint id][value], id = format index + 4.
const readVaruint = (b, at) => {
  let v = 0, s = 1;
  for (;;) { const x = b[at.i++]; v += (x & 0x7f) * s; if (!(x & 0x80)) return v; s *= 128; }
};

async function readMutable() {
  const [asset] = (await rpc('/v1/chain/get_table_rows', {
    code: 'atomicassets', scope: OWNER, table: 'assets', json: true,
    lower_bound: ASSET, upper_bound: ASSET, limit: 1,
  })).rows;
  const [schema] = (await rpc('/v1/chain/get_table_rows', {
    code: 'atomicassets', scope: COLLECTION, table: 'schemas', json: true,
    lower_bound: asset.schema_name, upper_bound: asset.schema_name, limit: 1,
  })).rows;
  const bytes = asset.mutable_serialized_data ?? [];
  const at = { i: 0 };
  const out = {};
  while (at.i < bytes.length) {
    const f = schema.format[readVaruint(bytes, at) - 4];
    if (f.type === 'string' || f.type === 'image') {
      const len = readVaruint(bytes, at);
      out[f.name] = new TextDecoder().decode(new Uint8Array(bytes.slice(at.i, at.i + len)));
      at.i += len;
    } else out[f.name] = readVaruint(bytes, at);
  }
  return out;
}

console.log(`\n═══ mutable-data merge on chain — asset ${ASSET} ═══`);
const before = await readMutable();
console.log('  before:', JSON.stringify(before));
check('starts with a player-set name', typeof before.name === 'string' && before.name.length > 0, JSON.stringify(before));

console.log('\n① equipcosmetic — must NOT delete the name');
await push(COLLECTION, 'equipcosmetic', { owner: OWNER, asset_id: ASSET, cosmetic_tmpl: COSMETIC });
await sleep(3000);
const afterCosmetic = await readMutable();
console.log('  after :', JSON.stringify(afterCosmetic));
check('name survived equipcosmetic', afterCosmetic.name === before.name, JSON.stringify(afterCosmetic));
check('cosmetic was written', Number(afterCosmetic.cosmetic) === COSMETIC);
check('growth still present', afterCosmetic.growth !== undefined);

console.log('\n② setname — must NOT delete the cosmetic');
const renamed = before.name === 'Ember Queen' ? 'Ember Queen II' : 'Ember Queen';
await push(COLLECTION, 'setname', { owner: OWNER, asset_id: ASSET, new_name: renamed });
await sleep(3000);
const afterRename = await readMutable();
console.log('  after :', JSON.stringify(afterRename));
check('new name written', afterRename.name === renamed);
check('cosmetic survived setname', Number(afterRename.cosmetic) === COSMETIC, JSON.stringify(afterRename));

console.log('\n③ restore the original name (leaves the asset as it was found)');
await push(COLLECTION, 'setname', { owner: OWNER, asset_id: ASSET, new_name: before.name });
await sleep(3000);
const restored = await readMutable();
check('name restored', restored.name === before.name, JSON.stringify(restored));

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
