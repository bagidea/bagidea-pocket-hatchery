// poll-deploy.mjs — live deploy watcher for phgamecreatr v2
// Polls two independent nodes every ~20s until code_hash changes,
// then runs full baseline diff and writes report.

import https from 'https';

const OLD_HASH = '37447ddede1f003e7b097467dc73bb84244a74dabd0c4a9547e13dba46bb98ac';
const CONTRACT = 'phgamecreatr';
const TOKEN_CONTRACT = 'hatchtokens1';
const SYMBOL = 'HATCH';
const POLL_MS = 20000;
const MAX_POLLS = 90; // 90 × 20s = 30 min max

const NODES = {
  waxsweden: 'https://testnet.waxsweden.org',
  eosphere:  'https://wax-testnet.eosphere.io',
};

const BASELINE = {
  creatrsv2: [
    { asset_id: '1099603751833', owner: 'waxwingsuper', template_id: '662889', stage: 0 },
    { asset_id: '1099603751834', owner: 'officewax123',  template_id: '662889', stage: 0 },
    { asset_id: '1099603751835', owner: 'officewax123',  template_id: '662976', stage: 0 },
    { asset_id: '1099603751836', owner: 'waxwingsuper', template_id: '662977', stage: 1 },
    { asset_id: '1099603751838', owner: 'waxwingsuper', template_id: '662976', stage: 0 },
    { asset_id: '1099603751839', owner: 'waxwingsuper', template_id: '662889', stage: 2 },
    { asset_id: '1099603751840', owner: 'waxwingsuper', template_id: '662977', stage: 0 },
    { asset_id: '1099603751841', owner: 'waxwingsuper', template_id: '663046', stage: 0 },
    { asset_id: '1099603751842', owner: 'waxwingsuper', template_id: '662977', stage: 2 },
    { asset_id: '1099603751843', owner: 'waxwingsuper', template_id: '663046', stage: 0 },
    { asset_id: '1099603751844', owner: 'waxwingsuper', template_id: '662889', stage: 1 },
    { asset_id: '1099603751845', owner: 'waxwingsuper', template_id: '662978', stage: 0 },
    { asset_id: '1099603751846', owner: 'waxwingsuper', template_id: '662889', stage: 0 },
    { asset_id: '1099603751847', owner: 'waxwingsuper', template_id: '662889', stage: 0 },
  ],
  spccfgv2_ids: [662889, 662976, 662977, 662978, 663046, 663047, 663048],
};

function post(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 10000,
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch(e) { reject(new Error('JSON parse fail: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function getHash(node) {
  const r = await post(`${node}/v1/chain/get_code_hash`, { account_name: CONTRACT });
  return r.code_hash;
}

async function getTableRows(node, table, { limit = 100, lower_bound = '', upper_bound = '' } = {}) {
  return post(`${node}/v1/chain/get_table_rows`, {
    code: CONTRACT, scope: CONTRACT, table,
    json: true, limit, lower_bound, upper_bound,
  });
}

async function getBalance(node) {
  const r = await post(`${node}/v1/chain/get_currency_balance`, {
    code: TOKEN_CONTRACT, account: CONTRACT, symbol: SYMBOL,
  });
  return r; // array like ["150000.0000 HATCH"]
}

// paginate until more:false
async function paginate(node, table) {
  const rows = [];
  let lower = '';
  for (let i = 0; i < 20; i++) {
    const r = await getTableRows(node, table, { limit: 100, lower_bound: lower });
    rows.push(...(r.rows || []));
    if (!r.more) return { rows, more: false };
    lower = r.next_key || '';
  }
  return { rows, more: true }; // didn't finish
}

async function runFullVerify(newHash, primaryNode) {
  const results = {};

  // (a) creatrsv2 paginated
  try {
    const { rows, more } = await paginate(primaryNode, 'creatrsv2');
    const issues = [];
    if (rows.length !== 14) issues.push(`row count ${rows.length} != 14`);
    if (more) issues.push('more=true (pagination not complete)');
    for (const b of BASELINE.creatrsv2) {
      const found = rows.find(r => String(r.asset_id) === b.asset_id);
      if (!found) { issues.push(`MISSING asset_id ${b.asset_id}`); continue; }
      if (found.owner !== b.owner) issues.push(`${b.asset_id} owner mismatch: ${found.owner} != ${b.owner}`);
      if (Number(found.stage) !== b.stage) issues.push(`${b.asset_id} stage mismatch: ${found.stage} != ${b.stage}`);
    }
    results.creatrsv2 = { pass: issues.length === 0, count: rows.length, more, issues };
  } catch(e) {
    results.creatrsv2 = { pass: false, issues: [e.message] };
  }

  // (b) spccfgv2
  try {
    const { rows, more } = await paginate(primaryNode, 'spccfgv2');
    const issues = [];
    if (rows.length !== 7) issues.push(`row count ${rows.length} != 7`);
    if (more) issues.push('more=true');
    for (const tid of BASELINE.spccfgv2_ids) {
      if (!rows.find(r => Number(r.template_id) === tid)) {
        issues.push(`MISSING template_id ${tid}`);
      }
    }
    results.spccfgv2 = { pass: issues.length === 0, count: rows.length, more, issues };
  } catch(e) {
    results.spccfgv2 = { pass: false, issues: [e.message] };
  }

  // (c) configv3 decode (must not return error 3060003)
  try {
    const r = await getTableRows(primaryNode, 'configv3');
    if (r.code && r.code === 3060003) {
      results.configv3 = { pass: false, issues: [`ABI decode error 3060003 (old ABI still active)`] };
    } else if (!r.rows || r.rows.length === 0) {
      results.configv3 = { pass: false, issues: ['configv3 empty — setconfig not yet run'] };
    } else {
      const fieldCount = Object.keys(r.rows[0]).length;
      results.configv3 = { pass: true, fieldCount, rows: r.rows.length, issues: [] };
    }
  } catch(e) {
    results.configv3 = { pass: false, issues: [e.message] };
  }

  // (d) HATCH balance >= 150000
  try {
    const bal = await getBalance(primaryNode);
    const raw = (bal[0] || '0 HATCH').split(' ')[0].replace(/,/g, '');
    const amount = parseFloat(raw);
    const pass = amount >= 150000;
    results.hatch = { pass, balance: bal[0] || '(none)', amount, issues: pass ? [] : [`${amount} < 150000`] };
  } catch(e) {
    results.hatch = { pass: false, issues: [e.message] };
  }

  return results;
}

// ── main ────────────────────────────────────────────────────────────
console.log(`[poll-deploy] watching phgamecreatr on WAX testnet`);
console.log(`[poll-deploy] old hash: ${OLD_HASH}`);
console.log(`[poll-deploy] polling every ${POLL_MS/1000}s — max ${MAX_POLLS} polls`);

let poll = 0;
async function tick() {
  poll++;
  const ts = new Date().toISOString().replace('T',' ').slice(0,19);

  let hashA, hashB, errA, errB;
  try { hashA = await getHash(NODES.waxsweden); } catch(e) { errA = e.message; }
  try { hashB = await getHash(NODES.eosphere);  } catch(e) { errB = e.message; }

  const hashLine = [
    `waxsweden=${errA ? 'ERR:'+errA : hashA.slice(0,12)+'...'}`,
    `eosphere=${errB   ? 'ERR:'+errB : hashB.slice(0,12)+'...'}`,
  ].join('  ');

  const changed = (hashA && hashA !== OLD_HASH) || (hashB && hashB !== OLD_HASH);

  if (!changed) {
    console.log(`[${ts}] poll#${poll} — still old hash  ${hashLine}`);
    if (poll < MAX_POLLS) {
      setTimeout(tick, POLL_MS);
    } else {
      console.log('[poll-deploy] TIMEOUT — hash never changed after max polls');
      process.exit(1);
    }
    return;
  }

  // hash changed!
  const newHash = (hashA && hashA !== OLD_HASH) ? hashA : hashB;
  const fromBoth = hashA === hashB;

  console.log(`\n[${ts}] === HASH CHANGED ===`);
  console.log(`  waxsweden: ${errA ? 'ERR' : hashA}`);
  console.log(`  eosphere:  ${errB ? 'ERR' : hashB}`);
  console.log(`  both agree: ${fromBoth}`);
  console.log(`  new hash:   ${newHash}`);
  console.log('');

  // use waxsweden as primary for verification
  const primaryNode = NODES.waxsweden;
  console.log('[verify] running full baseline diff...');
  const v = await runFullVerify(newHash, primaryNode);

  // ── report ──────────────────────────────────────────────────────
  const PASS = 'PASS';
  const FAIL = 'FAIL';
  const flag = (ok) => ok ? '✅' : '🔴';

  const creaturesMissing = (v.creatrsv2.issues || []).some(i => i.includes('MISSING'));

  console.log('\n════════════════════════════════════════');
  console.log(' DEPLOY VERIFY REPORT — phgamecreatr v2');
  console.log('════════════════════════════════════════');
  console.log(`code_hash (new):  ${newHash}`);
  console.log(`both nodes agree: ${fromBoth ? 'YES' : 'NO — discrepancy!'}`);
  console.log('');
  console.log(`Check                    │ Result │ Detail`);
  console.log(`─────────────────────────┼────────┼────────────────────────────────────────`);
  console.log(`(a) creatrsv2 rows+data  │ ${v.creatrsv2.pass ? PASS : FAIL}   ${flag(v.creatrsv2.pass)} │ ${v.creatrsv2.count} rows, more=${v.creatrsv2.more} ${v.creatrsv2.issues.length ? '| ISSUES: '+v.creatrsv2.issues.join('; ') : ''}`);
  console.log(`(b) spccfgv2 rows+ids    │ ${v.spccfgv2.pass ? PASS : FAIL}   ${flag(v.spccfgv2.pass)} │ ${v.spccfgv2.count} rows, more=${v.spccfgv2.more} ${v.spccfgv2.issues.length ? '| ISSUES: '+v.spccfgv2.issues.join('; ') : ''}`);
  console.log(`(c) configv3 decode      │ ${v.configv3.pass ? PASS : FAIL}   ${flag(v.configv3.pass)} │ ${v.configv3.pass ? v.configv3.fieldCount+' fields, '+v.configv3.rows+' row' : v.configv3.issues.join('; ')}`);
  console.log(`(d) HATCH balance≥150k   │ ${v.hatch.pass ? PASS : FAIL}   ${flag(v.hatch.pass)} │ ${v.hatch.balance}`);
  console.log('────────────────────────────────────────');

  const allPass = v.creatrsv2.pass && v.spccfgv2.pass && v.configv3.pass && v.hatch.pass;
  console.log('');
  if (creaturesMissing) {
    console.log('🔴 CRITICAL: creature data loss detected — DO NOT UNPAUSE, contact team immediately');
  } else if (!allPass) {
    console.log('⚠️  Some checks failed — review above before unpausing');
  } else {
    console.log('✅ All checks PASS — safe to proceed per checklist');
  }

  // write report to file
  const report = {
    timestamp: ts,
    new_code_hash: newHash,
    both_nodes_agree: fromBoth,
    node_hashes: { waxsweden: hashA || errA, eosphere: hashB || errB },
    checks: v,
    all_pass: allPass,
    critical_data_loss: creaturesMissing,
  };
  process.stdout.write('\nREPORT_JSON:' + JSON.stringify(report) + '\n');
  process.exit(0);
}

tick();
