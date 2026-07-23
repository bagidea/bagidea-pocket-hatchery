// claimreward proof — polling loop for phtestclaimr on phgamecreatr
const WALLET = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd';
const RPC = 'https://testnet.waxsweden.org';
const PLAYER = 'phtestclaimr';
const CONTRACT = 'phgamecreatr';
const ASSET1 = '1099603752038';
const ASSET2 = '1099603752039';

async function rpc(body) {
  const res = await fetch(`${RPC}/v1/chain/get_table_rows`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: true, code: CONTRACT, scope: CONTRACT, limit: 1, ...body }),
  });
  return res.json();
}

async function wallet(cmd, args) {
  const body = typeof args === 'string' ? { cmd, args } : { cmd, ...args };
  const res = await fetch(WALLET, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

async function pushAction(action, data) {
  const args = JSON.stringify({ from: PLAYER, contract: CONTRACT, action, data });
  return wallet('pushaction', args);
}

async function getPlayer() {
  const r = await rpc({ table: 'players', lower_bound: PLAYER, upper_bound: PLAYER });
  return r.rows[0] || null;
}

async function getEgg() {
  const p = await getPlayer();
  return p ? p.egg_balance : 0;
}

async function getNow() {
  const res = await fetch(`${RPC}/v1/chain/get_info`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const info = await res.json();
  return Math.floor(new Date(info.head_block_time + 'Z').getTime() / 1000);
}

async function getHatchBalance() {
  const res = await fetch(`${RPC}/v1/chain/get_currency_balance`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'hatchtokens1', account: PLAYER }),
  });
  const balances = await res.json();
  return Array.isArray(balances) ? balances.join(', ') : '0';
}

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, msg);

async function tryHarvest() {
  const res = await pushAction('harvest', { owner: PLAYER });
  if (res.ok) {
    log(`✅ HARVEST OK  tx=${res.txId}`);
    return { ok: true, txId: res.txId };
  }
  return { ok: false, msg: res.msg || 'unknown' };
}

async function tryEvolve(assetId) {
  const res = await pushAction('evolve', { owner: PLAYER, asset_id: assetId });
  if (res.ok) {
    log(`✅ EVOLVE OK  tx=${res.txId}`);
    return { ok: true, txId: res.txId };
  }
  return { ok: false, msg: res.msg || 'unknown' };
}

async function tryClaim() {
  // capture before
  const hatchBefore = await getHatchBalance();
  const playerBefore = await getPlayer();
  log(`===== BEFORE CLAIM =====`);
  log(`HATCH: ${hatchBefore}`);
  log(`Player: ${JSON.stringify(playerBefore)}`);

  const res = await pushAction('claimreward', { owner: PLAYER });
  if (res.ok) {
    log(`✅✅✅ CLAIMREWARD SUCCESS  tx=${res.txId}`);
    await new Promise(r => setTimeout(r, 3000));
    const hatchAfter = await getHatchBalance();
    const claims = await rpc({ table: 'claims', lower_bound: PLAYER, upper_bound: PLAYER });
    log(`===== AFTER CLAIM =====`);
    log(`HATCH after: ${hatchAfter}`);
    log(`Claims: ${JSON.stringify(claims.rows[0])}`);

    console.log('\n========================================');
    console.log('FINAL RESULT');
    console.log('========================================');
    console.log(`claimreward TX: ${res.txId}`);
    console.log(`HATCH BEFORE:   ${hatchBefore}`);
    console.log(`HATCH AFTER:    ${hatchAfter}`);
    console.log(`claimed_season: ${claims.rows[0]?.claimed_season || 'N/A'}`);
    console.log('========================================\n');
    return { ok: true, txId: res.txId, hatchBefore, hatchAfter, claims: claims.rows[0] };
  }
  log(`❌ CLAIM FAILED: ${res.msg}`);
  return { ok: false, msg: res.msg || 'unknown' };
}

async function main() {
  log('=== CLAIMREWARD PROOF LOOP ===');
  log(`Creatures: ${ASSET1}, ${ASSET2}`);

  let egg = await getEgg();
  log(`Starting EGG: ${egg}`);

  let evolved1 = false;
  let evolved2 = false;
  let harvestCount = 0;
  const MAX_HARVESTS = 50;

  // Select player
  await wallet('select', 'phtestclaimr');

  while (harvestCount < MAX_HARVESTS) {
    // Wait for harvest cooldown — poll every 30s
    let waited = 0;
    let harvested = false;
    while (waited < 240) { // max 2 hours per attempt
      await new Promise(r => setTimeout(r, 30000));
      waited++;

      const r = await tryHarvest();
      if (r.ok) {
        harvestCount++;
        harvested = true;
        await new Promise(r => setTimeout(r, 3000));
        egg = await getEgg();
        log(`EGG now: ${egg} (harvest #${harvestCount})`);
        break;
      }
      if (waited % 6 === 0) {
        log(`⏳ waiting for cooldown... (${r.msg})`);
      }
    }

    if (!harvested) {
      log('⚠️ Could not harvest within timeout window');
      continue;
    }

    // Check evolve 0→1
    if (!evolved1 && egg >= 300) {
      const r = await tryEvolve(ASSET1);
      if (r.ok) {
        evolved1 = true;
        await new Promise(r => setTimeout(r, 3000));
        egg = await getEgg();
        log(`EGG after evolve 0→1: ${egg}`);
      }
    }

    // Check evolve 1→2
    if (evolved1 && !evolved2 && egg >= 600) {
      const r = await tryEvolve(ASSET1);
      if (r.ok) {
        evolved2 = true;
        await new Promise(r => setTimeout(r, 3000));
        egg = await getEgg();
        log(`EGG after evolve 1→2: ${egg}`);
      }
    }

    // Claim!
    if (evolved2) {
      await tryClaim();
      process.exit(0);
    }
  }

  log(`Max harvests (${MAX_HARVESTS}) reached. egg=${egg} evolved1=${evolved1} evolved2=${evolved2}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
