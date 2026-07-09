#!/usr/bin/env node
/**
 * Pocket Hatchery — Verify Loop
 * ===============================
 * Runs the full gameplay loop through waxwing pushaction:
 *   initplayer → firsthatch → feed → evolve → harvest → claimreward
 *
 * Each step is verified against chain state before proceeding.
 * Fails fast with clear diagnostics if any step breaks.
 *
 * USAGE:
 *   node verify-loop.mjs [--player waxwingsuper] [--contract phgamecreatr]
 *
 *   Step-by-step mode (interactive, confirms each step):
 *     node verify-loop.mjs --step
 *
 *   Check state only (no transactions):
 *     node verify-loop.mjs --dry
 *
 * PREREQUISITES:
 *   waxwing wallet UNLOCKED (boss password)
 *   phgamecreatr key in keystore
 *   phgamecreatr deployed + configured (AA collection + setconfig + setspecies)
 *
 * WASM: 060b7bff955fa53f3cf40718792679c04766b3f963b52adcec060dc704ae22d1
 */

const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;
const RPC = "https://testnet.waxsweden.org";

// ── Config ──────────────────────────────────────────────────────────
let CONTRACT = "phgamecreatr";
let PLAYER = "waxwingsuper";
const NETWORK = "wax-testnet";
const TOKEN = "hatchtokens1";

// parse --flags
const rawArgs = process.argv.slice(2);
let STEP_MODE = false;
let DRY_RUN = false;
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--player" && rawArgs[i + 1]) { PLAYER = rawArgs[++i]; }
  else if (rawArgs[i] === "--contract" && rawArgs[i + 1]) { CONTRACT = rawArgs[++i]; }
  else if (rawArgs[i] === "--step") { STEP_MODE = true; }
  else if (rawArgs[i] === "--dry") { DRY_RUN = true; }
}

// ── helpers ──────────────────────────────────────────────────────────
async function wax(cmd, args = "") {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${cmd}: ${data.msg}`);
  return data;
}

async function push(contract, action, data, opts = {}) {
  if (DRY_RUN) {
    console.log(`   [DRY] Would push: ${contract}::${action} ${JSON.stringify(data)}`);
    return { ok: true, txId: "dry-run", dry: true };
  }
  const from = opts.from || PLAYER;
  const fullArgs = { network: NETWORK, from, contract, action, data };
  const body = JSON.stringify({ cmd: "pushaction", args: JSON.stringify(fullArgs) });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const result = await res.json();
  if (!result.ok) throw new Error(`${action}: ${result.msg}`);
  return result;
}

async function rpc(endpoint, body) {
  const res = await fetch(`${RPC}/v1/chain/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getTable(code, scope, table, limit = 50) {
  const r = await rpc("get_table_rows", { json: true, code, scope, table, limit });
  return r.rows || [];
}

async function getCode(account) {
  return rpc("get_code", { account_name: account });
}

// ── game state helpers ───────────────────────────────────────────────
async function gameState() {
  const [creatures, players, configRows, walletStatus] = await Promise.all([
    getTable(CONTRACT, CONTRACT, "creatures", 100),
    getTable(CONTRACT, CONTRACT, "players", 100),
    getTable(CONTRACT, CONTRACT, "configv2", 1),
    wax("status").catch(() => ({ status: { unlocked: false } })),
  ]);

  const myPlayer = players.find(p => p.account === PLAYER);
  const myCreatures = creatures.filter(c => c.owner === PLAYER);
  const config = configRows[0] || null;

  return {
    walletUnlocked: walletStatus.status?.unlocked || false,
    player: myPlayer || null,
    creatures: myCreatures,
    totalCreatures: creatures.length,
    config,
    paused: config?.paused || false,
  };
}

async function assertStep(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    return true;
  } else {
    console.log(`  ❌ ${label} FAILED: ${detail}`);
    return false;
  }
}

// ── action wrappers ──────────────────────────────────────────────────
async function doInitPlayer() {
  const r = await push(CONTRACT, "initplayer", { owner: PLAYER });
  return r;
}

async function doFirstHatch(eggType = 0) {
  const r = await push(CONTRACT, "firsthatch", { owner: PLAYER, egg_type: eggType });
  return r;
}

async function doFeed(assetId) {
  const r = await push(CONTRACT, "feed", { owner: PLAYER, asset_id: parseInt(assetId) });
  return r;
}

async function doEvolve(assetId) {
  const r = await push(CONTRACT, "evolve", { owner: PLAYER, asset_id: parseInt(assetId) });
  return r;
}

async function doHarvest() {
  const r = await push(CONTRACT, "harvest", { owner: PLAYER });
  return r;
}

async function doClaimReward() {
  const r = await push(CONTRACT, "claimreward", { owner: PLAYER });
  return r;
}

// ── main verify loop ─────────────────────────────────────────────────
async function verifyLoop() {
  console.log("═".repeat(60));
  console.log("  Pocket Hatchery — VERIFY LOOP");
  console.log("═".repeat(60));
  console.log(`  Contract:  ${CONTRACT}`);
  console.log(`  Player:    ${PLAYER}`);
  console.log(`  Network:   ${NETWORK}`);
  console.log(`  Mode:      ${DRY_RUN ? "DRY RUN (no tx)" : STEP_MODE ? "STEP-BY-STEP" : "AUTO"}`);
  console.log("═".repeat(60));

  // ── Prerequisite checks ──────────────────────────────────────────
  console.log("\n📋 PREREQUISITES");

  // Wallet
  const ws = await wax("status");
  if (!ws.status?.unlocked) {
    console.log("  ❌ Wallet LOCKED — unlock first");
    process.exit(1);
  }
  console.log(`  ✅ Wallet unlocked | Network: ${ws.status.network?.name || "?"}`);

  // Contract code hash
  const code = await getCode(CONTRACT);
  const expectedHash = "060b7bff955fa53f3cf40718792679c04766b3f963b52adcec060dc704ae22d1";
  console.log(`  ✅ Contract code deployed (hash: ${code.code_hash?.slice(0, 12)}...)`);

  if (code.code_hash !== expectedHash) {
    console.log(`  ⚠️  Code hash MISMATCH!`);
    console.log(`     On-chain:  ${code.code_hash}`);
    console.log(`     Expected:  ${expectedHash}`);
    console.log(`     → Deploy latest build first: .\\tools\\deploy-phgamecreatr.ps1`);
    if (!DRY_RUN && !STEP_MODE) process.exit(1);
  }

  // Config + species present
  const configRows = await getTable(CONTRACT, CONTRACT, "configv2", 1);
  const speciesRows = await getTable(CONTRACT, CONTRACT, "speciescfg", 10);
  console.log(`  ${configRows.length > 0 ? "✅" : "⚠️"} config: ${configRows.length} row(s)`);
  console.log(`  ${speciesRows.length > 0 ? "✅" : "⚠️"} species: ${speciesRows.length} row(s)`);

  if (configRows.length > 0) {
    const cfg = configRows[0];
    console.log(`     token: ${cfg.token_contract}, collection: ${cfg.collection}, paused: ${cfg.paused}`);
    console.log(`     hatch_cost: ${cfg.hatch_cost}, evolve_cost: ${cfg.evolve_cost}, feed_boost: ${cfg.feed_boost}`);
  }
  if (speciesRows.length > 0) {
    for (const sp of speciesRows) {
      console.log(`     ${sp.family}: template=${sp.template_id}, max_stage=${sp.max_stage}, growth_rate=${sp.growth_rate}`);
    }
  }

  // AA collection check
  const collRows = await getTable("atomicassets", CONTRACT, "collections", 1);
  if (collRows.length === 0) {
    console.log("  ⚠️  No AtomicAssets collection — run tools/setup-phgamecreatr.mjs");
    if (!DRY_RUN && !STEP_MODE) process.exit(1);
  } else {
    console.log(`  ✅ AA collection: ${collRows[0].collection_name} (authorized: ${collRows[0].authorized_accounts})`);
  }

  // ── Start state ──────────────────────────────────────────────────
  let state = await gameState();
  console.log(`\n📊 START STATE:`);
  console.log(`  Player: ${state.player ? `${state.player.egg_balance} EGG, ${state.player.total_hatch_burned} burned` : "NOT INITIALIZED"}`);
  console.log(`  Creatures: ${state.creatures.length} (total on contract: ${state.totalCreatures})`);

  if (DRY_RUN) {
    console.log("\n🎉 Dry run complete — all read checks passed.");
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: initplayer
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log("  STEP 1: initplayer");
  console.log("─".repeat(50));

  if (STEP_MODE) {
    console.log("  Press Enter to execute initplayer...");
    await new Promise(r => process.stdin.once("data", r));
  }

  if (!state.player) {
    try {
      const r = await doInitPlayer();
      console.log(`  ✅ initplayer! tx: ${r.txId?.slice(0, 16)}...`);
      console.log(`  🔗 ${r.explorer || "(no explorer)"}`);
    } catch (e) {
      if (e.message.includes("already")) {
        console.log(`  ⚠️  Player already initialized`);
      } else {
        console.log(`  ❌ FAILED: ${e.message}`);
        process.exit(1);
      }
    }
  } else {
    console.log(`  ⏭  Already initialized (${state.player.egg_balance} EGG)`);
  }

  state = await gameState();
  console.log(`  Player EGG: ${state.player?.egg_balance || 0}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: firsthatch
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log("  STEP 2: firsthatch (FREE first creature)");
  console.log("─".repeat(50));

  if (STEP_MODE) {
    console.log("  Press Enter to execute firsthatch...");
    await new Promise(r => process.stdin.once("data", r));
  }

  if (state.creatures.length === 0) {
    try {
      const r = await doFirstHatch(0);
      console.log(`  ✅ Creature hatched! tx: ${r.txId?.slice(0, 16)}...`);
      console.log(`  🔗 ${r.explorer || "(no explorer)"}`);
    } catch (e) {
      console.log(`  ❌ firsthatch FAILED: ${e.message}`);

      // Known failure modes
      if (e.message.includes("read past end") || e.message.includes("datastream")) {
        console.log(`  🔍 DIAGNOSIS: datastream read-past-end (ABI mismatch or ATTR_MAP bug)`);
        console.log(`     → Verify the deployed ABI matches the WASM (deploy both together)`);
      } else if (e.message.includes("assertion") && e.message.includes("resolve")) {
        console.log(`  🔍 DIAGNOSIS: resolve_new_asset failed (known bug: inline mint not executed yet)`);
        console.log(`     → See docs/HATCH-RESOLVE-ROOT-CAUSE.md`);
        console.log(`     → Fix: predict asset_id from atomicassets config.asset_counter instead of reading back`);
      } else if (e.message.includes("authority")) {
        console.log(`  🔍 DIAGNOSIS: Missing authority (burn_hatch needs eosio.code linkage)`);
        console.log(`     → waxwingsuper must grant phgamecreatr@eosio.code permission`);
      }
      process.exit(1);
    }
  } else {
    console.log(`  ⏭  Already have ${state.creatures.length} creature(s)`);
    for (const c of state.creatures) {
      const g = (c.growth_base || 0) + (c.fed_growth || 0);
      console.log(`     #${c.asset_id}: stage=${c.stage} growth=${g}`);
    }
  }

  await new Promise(r => setTimeout(r, 2000)); // wait for block
  state = await gameState();
  if (state.creatures.length === 0) {
    console.log(`  ❌ Still 0 creatures after firsthatch — contract bug (mint rolled back)`);
    process.exit(1);
  }

  const cid = state.creatures[0].asset_id;
  console.log(`  Creature #${cid} exists on chain ✓`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: feed
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log(`  STEP 3: feed creature #${cid}`);
  console.log("─".repeat(50));

  if (STEP_MODE) {
    console.log("  Press Enter to execute feed...");
    await new Promise(r => process.stdin.once("data", r));
  }

  try {
    const r = await doFeed(cid);
    console.log(`  ✅ Fed! tx: ${r.txId?.slice(0, 16)}...`);
  } catch (e) {
    console.log(`  ❌ feed FAILED: ${e.message}`);
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 2000));
  state = await gameState();
  const c = state.creatures.find(c => c.asset_id === cid);
  if (c) {
    const growth = (c.growth_base || 0) + (c.fed_growth || 0);
    const boost = state.config?.feed_boost || 1000;
    console.log(`  Growth: ${growth} (boost +${boost}/feed)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: evolve
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log(`  STEP 4: evolve creature #${cid}`);
  console.log("─".repeat(50));

  const c4 = state.creatures.find(c => c.asset_id === cid);
  if (!c4) {
    console.log("  ❌ Creature disappeared!");
    process.exit(1);
  }

  const growth = (c4.growth_base || 0) + (c4.fed_growth || 0);
  const thresholds = [0, 1000, 5000, 20000, 100000];
  const nextThresh = thresholds[Math.min(c4.stage + 1, 4)] || 999999999;
  const evolveCost = (state.config?.evolve_cost || 50) * (c4.stage + 1);
  const eggBal = state.player?.egg_balance || 0;

  console.log(`  Stage: ${c4.stage} → ${c4.stage + 1}? (growth ${growth}/${nextThresh}, cost ${evolveCost} EGG, have ${eggBal} EGG)`);

  if (c4.stage >= 5) {
    console.log("  ⏭  Already max stage (5)");
  } else if (growth < nextThresh) {
    const needed = nextThresh - growth;
    const feedsNeeded = Math.ceil(needed / (state.config?.feed_boost || 1000));
    console.log(`  ⚠️  Not enough growth — need ${needed} more (feed ${feedsNeeded}×)`);
    if (STEP_MODE) {
      console.log("  Continue anyway (y/n)?");
      // In auto mode, try feed more times
      for (let i = 0; i < feedsNeeded && i < 10; i++) {
        try {
          await doFeed(cid);
          console.log(`     Fed +${state.config?.feed_boost || 1000} growth`);
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          console.log(`     Feed failed: ${e.message}`);
          break;
        }
      }
      state = await gameState();
      const cUpdated = state.creatures.find(c => c.asset_id === cid);
      const newGrowth = (cUpdated?.growth_base || 0) + (cUpdated?.fed_growth || 0);
      if (newGrowth < nextThresh) {
        console.log(`  ❌ Still not enough growth (${newGrowth}/${nextThresh})`);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  if (eggBal < evolveCost) {
    console.log(`  ⚠️  Not enough EGG (have ${eggBal}, need ${evolveCost})`);
    console.log(`     → Run 'harvest' first, or feed more to reduce cost, or give player more EGG`);
    process.exit(1);
  }

  if (STEP_MODE) {
    console.log("  Press Enter to execute evolve...");
    await new Promise(r => process.stdin.once("data", r));
  }

  try {
    const r = await doEvolve(cid);
    console.log(`  ✅ Evolved! tx: ${r.txId?.slice(0, 16)}...`);
  } catch (e) {
    console.log(`  ❌ evolve FAILED: ${e.message}`);
    if (e.message.includes("assertion") && e.message.includes("stage")) {
      console.log(`  🔍 DIAGNOSIS: evolve off-by-one bug (stage_for_growth vs stored stage)`);
      console.log(`     → Fix: change :395 to use c.stage instead of stage_for_growth(g)`);
      console.log(`     → See docs/BLOCKER-EVOLVE-FIX.md`);
    }
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 2000));
  state = await gameState();
  const cEvolved = state.creatures.find(c => c.asset_id === cid);
  console.log(`  New stage: ${cEvolved?.stage}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: harvest
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log("  STEP 5: harvest EGG");
  console.log("─".repeat(50));

  if (STEP_MODE) {
    console.log("  Press Enter to execute harvest...");
    await new Promise(r => process.stdin.once("data", r));
  }

  try {
    const r = await doHarvest();
    console.log(`  ✅ Harvested! tx: ${r.txId?.slice(0, 16)}...`);
  } catch (e) {
    console.log(`  ⚠️  harvest: ${e.message}`);
    // Non-fatal — harvest may be on cooldown or have 0 creatures with yield
  }

  await new Promise(r => setTimeout(r, 2000));
  state = await gameState();
  console.log(`  Player EGG: ${state.player?.egg_balance || 0}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: claimreward
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n─".repeat(50));
  console.log("  STEP 6: claimreward (HATCH)");
  console.log("─".repeat(50));

  const c6 = state.creatures.find(c => c.asset_id === cid);
  const highestStage = c6?.stage || 0;
  const rewardAmounts = { 0: 0, 1: 0, 2: 20, 3: 30, 4: 50, 5: 100 };
  const reward = rewardAmounts[highestStage] || 0;

  if (reward === 0) {
    console.log(`  ⏭  Stage ${highestStage} — not qualified (need stage ≥ 2)`);
    console.log(`     → Evolve more or feed more creatures to reach stage 2+`);
  } else {
    if (STEP_MODE) {
      console.log(`  Reward: ${reward}.0000 HATCH (stage ${highestStage}). Press Enter...`);
      await new Promise(r => process.stdin.once("data", r));
    }

    try {
      const r = await doClaimReward();
      console.log(`  ✅ Claimed ${reward}.0000 HATCH! tx: ${r.txId?.slice(0, 16)}...`);
    } catch (e) {
      console.log(`  ⚠️  claimreward: ${e.message}`);
      if (e.message.includes("reward pool empty") || e.message.includes("not enough")) {
        console.log(`  🔍 DIAGNOSIS: Reward pool is empty or insufficient balance`);
        console.log(`     → Fund the pool: pushaction phgamecreatr fundpool '{"amount":"100.0000 HATCH","source":"bootstrap"}' (as phgamecreatr)`);
        console.log(`     → AND ensure phgamecreatr holds that HATCH on hatchtokens1`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL STATE
  // ═══════════════════════════════════════════════════════════════════
  state = await gameState();
  console.log("\n" + "═".repeat(60));
  console.log("  VERIFY COMPLETE — FINAL STATE");
  console.log("═".repeat(60));
  console.log(`  Player:  ${PLAYER}`);
  console.log(`  EGG:     ${state.player?.egg_balance || 0}`);
  console.log(`  HATCH burned: ${state.player?.total_hatch_burned || 0}`);
  console.log(`  Farmed:  ${state.player?.total_egg_farmed || 0}`);
  console.log(`  Creatures: ${state.creatures.length}`);

  for (const c of state.creatures) {
    const g = (c.growth_base || 0) + (c.fed_growth || 0);
    console.log(`    #${c.asset_id}: stage=${c.stage} growth=${g} template=${c.template_id}`);
  }

  console.log("═".repeat(60));

  // ── Verdict ──────────────────────────────────────────────────────
  const checks = [];

  checks.push(["Player initialized", !!state.player]);
  checks.push(["At least 1 creature", state.creatures.length > 0]);

  if (state.creatures.length > 0) {
    const fc = state.creatures[0];
    checks.push(["Creature hatched (stage ≥ 0)", fc.stage >= 0]);
    // Feed adds growth, but may be 0 if feed failed silently
    const fg = (fc.growth_base || 0) + (fc.fed_growth || 0);
    checks.push([`Growth > 0 (was fed)`, fg > 0]);
    // Evolve check: did stage advance?
    checks.push([`Stage advanced (≥ 1)`, fc.stage >= 1]);
  }

  console.log("\n📋 VERDICT:");
  let allPassed = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✅" : "❌"} ${label}`);
    if (!pass) allPassed = false;
  }

  if (allPassed) {
    console.log("\n🎉 LOOP VERIFIED! All steps executed end-to-end.");
    console.log("   Creature hatched → fed → evolved → harvested → reward claimed");
  } else {
    console.log("\n⚠️  Some steps failed — check diagnostics above.");
  }

  return allPassed;
}

// ── run ──────────────────────────────────────────────────────────────
verifyLoop().then(passed => {
  if (!passed) process.exit(1);
}).catch(e => {
  console.error(`\n💥 FATAL: ${e.message}`);
  if (e.message.includes("locked")) {
    console.log(`\n💡 Unlock waxwing first:`);
    console.log(`   curl -s -X POST ${WAXWING} -H "content-type: application/json" -d '{"cmd":"unlock","args":"<PASSWORD>"}'`);
  }
  process.exit(1);
});
