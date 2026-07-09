/**
 * Pocket Hatchery — Full game loop on phgamecreatr via waxwing pushaction
 */
const { resolveTemplateId } = require('./lib/resolve-template.cjs');

const DAEMON = 'http://127.0.0.1:8787';
const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';
const RPC = 'https://testnet.waxsweden.org';
const CONTRACT = 'phgamecreatr';
const PLAYER = 'waxwingsuper';
const NETWORK = 'wax-testnet';

async function wax(cmd, args = '') {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
  return await res.json();
}

async function push(from, contract, action, data) {
  const r = await wax('pushaction', JSON.stringify({ network: NETWORK, from, contract, action, data }));
  return r;
}

async function rpcTable(code, scope, table, limit = 50) {
  const res = await fetch(RPC + '/v1/chain/get_table_rows', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({ json: true, code, scope, table, limit })
  });
  return await res.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Ensure wallet unlocked
  await wax('unlock', process.env.HATCH_KEYSTORE_PW);
  console.log('✅ Wallet unlocked\n');

  // ─── STEP 1: Set contract config (as phgamecreatr) ───
  console.log('─'.repeat(50));
  console.log('STEP 1: Configure contract');
  console.log('─'.repeat(50));

  const now = Math.floor(Date.now() / 1000);
  const cfg = {
    cfg: {
      token_contract: 'hatchtokens1',
      collection: CONTRACT,
      schema_name: 'creatures',
      fee_account: CONTRACT,
      paused: false,
      hatch_cost: 150,
      evolve_cost: 50,
      breed_cost: '5.0000 HATCH',
      feed_cost: 0,
      slot_cost: 500,
      cosmetic_cost: 100,
      name_cost: '1.0000 HATCH',
      install_cap_bonus: 72,
      feed_cd: 0,
      harvest_cd: 0,
      breed_cd: 86400,
      feed_daily_cap: 100,
      daily_egg_cap: 240,
      offline_cap_h: 8,
      tap_egg_cap: 60,
      feed_boost: 1000,
      season_index: 1,
      season_started: now,
      rng_oracle: CONTRACT,
    }
  };

  let r = await push(CONTRACT, CONTRACT, 'setconfig', cfg);
  console.log(r.ok ? '✅ setconfig' : `⚠️  ${r.msg?.substring(0,200)}`);

  // Step 1.5: Resolve template_id from chain (NEVER hardcode)
  console.log('\n🔍 Resolving template_id from chain...');
  let templateId;
  try {
    templateId = await resolveTemplateId(CONTRACT, RPC);
    console.log(`   Resolved: template_id = ${templateId}`);
  } catch (e) {
    console.log(`   ❌ Cannot resolve template_id: ${e.message}`);
    console.log('   → Run setup-phgamecreatr.mjs first to create templates');
    process.exit(1);
  }

  // ─── STEP 2: Set species ───
  console.log('\nSTEP 2: Set species');
  r = await push(CONTRACT, CONTRACT, 'setspecies', {
    sp: {
      template_id: templateId,   // ← RESOLVED from chain
      growth_rate: 1000,
      thresh_1: 1000, thresh_2: 5000, thresh_3: 20000, thresh_4: 100000,
      yield_0: 100, yield_1: 300, yield_2: 600, yield_3: 1200, yield_4: 2400,
      max_stage: 5, egg_weight: 100, egg_type: 0, family: 'Fire',
    }
  });
  console.log(r.ok ? '✅ setspecies (Fire)' : `⚠️  ${r.msg?.substring(0,200)}`);

  // ─── STEP 3: Select player ───
  await wax('select', JSON.stringify({ network: NETWORK, account: PLAYER }));

  // ─── STEP 4: initplayer ───
  console.log('\n─'.repeat(50));
  console.log('STEP 3: initplayer');
  console.log('─'.repeat(50));
  r = await push(PLAYER, CONTRACT, 'initplayer', { owner: PLAYER });
  if (r.ok) {
    console.log('✅ initplayer! tx:', (r.txId||'').substring(0,16));
  } else if (r.msg?.includes('already')) {
    console.log('⚠️  Already initialized');
  } else {
    console.log(`❌ initplayer FAILED: ${r.msg?.substring(0,200)}`);
    // Check if initplayer needs the PLAYER to sign or the contract
    console.log('\nTrying initplayer as phgamecreatr...');
    await wax('select', JSON.stringify({ network: NETWORK, account: CONTRACT }));
    r = await push(CONTRACT, CONTRACT, 'initplayer', { owner: PLAYER });
    if (r.ok) {
      console.log('✅ initplayer (as contract)!');
    } else {
      console.log(`❌ Still failed: ${r.msg?.substring(0,200)}`);
    }
    await wax('select', JSON.stringify({ network: NETWORK, account: PLAYER }));
  }

  await sleep(2000);

  // Check player state
  const players = await rpcTable(CONTRACT, CONTRACT, 'players');
  const myPlayer = (players.rows||[]).find(p => p.account === PLAYER);
  if (myPlayer) {
    console.log(`   Player: ${PLAYER}, EGG: ${myPlayer.egg_balance}`);
  } else {
    console.log('   ⚠️  Player not found — initplayer may have failed');
  }

  // ─── STEP 5: firsthatch ───
  console.log('\n─'.repeat(50));
  console.log('STEP 4: firsthatch (FREE)');
  console.log('─'.repeat(50));

  r = await push(PLAYER, CONTRACT, 'firsthatch', { owner: PLAYER, egg_type: 0 });
  if (r.ok) {
    console.log('✅ firsthatch! tx:', (r.txId||'').substring(0,16));
    console.log('   explorer:', r.explorer);
  } else {
    console.log(`❌ firsthatch FAILED: ${r.msg?.substring(0,300)}`);
    if (r.msg?.includes('authority')) {
      console.log('   Trying as phgamecreatr...');
      await wax('select', JSON.stringify({ network: NETWORK, account: CONTRACT }));
      r = await push(CONTRACT, CONTRACT, 'firsthatch', { owner: PLAYER, egg_type: 0 });
      if (r.ok) {
        console.log('✅ firsthatch (as contract)!');
      } else {
        console.log(`❌ ${r.msg?.substring(0,200)}`);
      }
      await wax('select', JSON.stringify({ network: NETWORK, account: PLAYER }));
    }
  }

  await sleep(2000);

  // Check creatures
  const creatures = await rpcTable(CONTRACT, CONTRACT, 'creatures', 10);
  console.log('\n   📊 creatures table:', (creatures.rows||[]).length, 'rows');
  for (const c of (creatures.rows||[])) {
    console.log(`      asset_id=${c.asset_id} owner=${c.owner} stage=${c.stage} template=${c.template_id}`);
  }

  if ((creatures.rows||[]).length === 0) {
    console.log('\n❌ No creatures yet! Something went wrong with firsthatch.');

    // Check config
    const cfgCheck = await rpcTable(CONTRACT, CONTRACT, 'configv2');
    console.log('   configv2:', cfgCheck.rows?.length || 0, 'rows');
    if (cfgCheck.rows?.length > 0) {
      console.log('   config:', JSON.stringify(cfgCheck.rows[0]).substring(0,300));
    }

    // Check collection
    const collCheck = await rpcTable('atomicassets', CONTRACT, 'collections');
    console.log('   AA collections (scope='+CONTRACT+'):', collCheck.rows?.length || 0, 'rows');

    return;
  }

  // ─── STEP 6: feed ───
  const cid = creatures.rows[0].asset_id;
  console.log('\n─'.repeat(50));
  console.log(`STEP 5: feed creature #${cid}`);
  console.log('─'.repeat(50));

  r = await push(PLAYER, CONTRACT, 'feed', { owner: PLAYER, asset_id: cid });
  if (r.ok) {
    console.log('✅ feed! tx:', (r.txId||'').substring(0,16));
  } else {
    console.log(`❌ feed FAILED: ${r.msg?.substring(0,200)}`);
  }

  await sleep(2000);

  // ─── STEP 7: Check growth + evolve ───
  const creatures2 = await rpcTable(CONTRACT, CONTRACT, 'creatures', 10);
  const c2 = (creatures2.rows||[]).find(c => c.asset_id === cid);
  if (c2) {
    const growth = (c2.growth_base || 0) + (c2.fed_growth || 0);
    console.log(`\n   Creature #${cid}: stage=${c2.stage} growth=${growth}/1000`);

    if (c2.stage < 5 && growth >= 1000) {
      console.log('\n─'.repeat(50));
      console.log(`STEP 6: evolve creature #${cid} (stage ${c2.stage} → ${c2.stage + 1})`);
      console.log('─'.repeat(50));

      r = await push(PLAYER, CONTRACT, 'evolve', { owner: PLAYER, asset_id: cid });
      if (r.ok) {
        console.log('✅ evolve! tx:', (r.txId||'').substring(0,16));
      } else {
        console.log(`❌ evolve FAILED: ${r.msg?.substring(0,200)}`);
      }

      await sleep(2000);
    }
  }

  // ─── FINAL STATE ───
  console.log('\n' + '═'.repeat(50));
  console.log('  FINAL CHAIN STATE');
  console.log('═'.repeat(50));

  const finalCreatures = await rpcTable(CONTRACT, CONTRACT, 'creatures', 10);
  const finalPlayers = await rpcTable(CONTRACT, CONTRACT, 'players', 10);

  console.log(`  Contract: ${CONTRACT}`);
  console.log(`  Players: ${(finalPlayers.rows||[]).length} rows`);
  for (const p of (finalPlayers.rows||[])) {
    console.log(`    ${p.account}: ${p.egg_balance} EGG`);
  }
  console.log(`  Creatures: ${(finalCreatures.rows||[]).length} rows`);
  for (const c of (finalCreatures.rows||[])) {
    const g = (c.growth_base || 0) + (c.fed_growth || 0);
    console.log(`    #${c.asset_id}: owner=${c.owner} stage=${c.stage} growth=${g} template=${c.template_id}`);
  }
  console.log('═'.repeat(50));

  if ((finalCreatures.rows||[]).length > 0) {
    console.log('\n🎉 LOOP PROVEN! Creature exists on chain!');
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
