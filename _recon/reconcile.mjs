// Live owner reconcile: phgamecreatr.creatures vs AtomicAssets real owner (WAX testnet)
// Usage: node _recon/reconcile.mjs   (writes JSON + summary to stdout; caller redirects to log)
const RPCS = ['https://waxtestnet.greymass.com', 'https://testnet.waxsweden.org'];
const AA = 'https://test.wax.api.atomicassets.io';
const CONTRACT = 'phgamecreatr';

async function post(url, path, body) {
  const r = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url}${path} -> HTTP ${r.status}`);
  return r.json();
}

async function getCreatures() {
  let last_err;
  for (const rpc of RPCS) {
    try {
      const rows = [];
      let more = true, next = '';
      while (more) {
        const res = await post(rpc, '/v1/chain/get_table_rows', {
          json: true, code: CONTRACT, scope: CONTRACT, table: 'creatures',
          limit: 100, lower_bound: next || undefined,
        });
        for (const r of res.rows) rows.push(r);
        more = res.more;
        next = res.next_key;
        if (!next) break;
      }
      return { rpc, rows };
    } catch (e) { last_err = e; }
  }
  throw last_err;
}

async function aaOwners(ids) {
  // bulk query in chunks of 50
  const map = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const r = await fetch(`${AA}/atomicassets/v1/assets?ids=${chunk.join(',')}&limit=100`);
    if (!r.ok) throw new Error(`AA HTTP ${r.status}`);
    const j = await r.json();
    for (const a of j.data) map.set(a.asset_id, { owner: a.owner, burned: !!a.burned_at_block });
  }
  return map;
}

const { rpc, rows } = await getCreatures();
const ids = rows.map(r => String(r.asset_id));
const owners = await aaOwners(ids);

const mismatches = [];
let missing = 0;
for (const r of rows) {
  const id = String(r.asset_id);
  const aa = owners.get(id);
  if (!aa) { missing++; continue; }
  if (aa.owner !== r.owner) {
    mismatches.push({ asset_id: id, table_owner: r.owner, aa_owner: aa.owner, stage: r.stage, burned: aa.burned });
  }
}

console.log(JSON.stringify({
  rpc, aa: AA, contract: CONTRACT,
  total_rows: rows.length, aa_missing: missing, desynced: mismatches.length,
  mismatches,
}, null, 2));
