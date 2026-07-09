#!/usr/bin/env node
/**
 * Setup phgamecreatr — AtomicAssets collection + contract config
 *
 * ⚠️  RUN ORDER:
 *   1. deploy-phgamecreatr.ps1    (setcode + setabi)
 *   2. THIS script                (AA collection + config)
 *   3. verify-loop.mjs            (gameplay smoke test)
 *
 * CRITICAL: template_id is RESOLVED from chain after createtempl —
 *           NOT hardcoded (each AA collection gets its own auto-incremented ID).
 *           pockethatch1's template 662644 is a DIFFERENT collection.
 */
const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;
const RPC = "https://testnet.waxsweden.org";

async function wax(cmd, args = "") {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data = await res.json();
  return data;
}

async function push(from, contract, action, data) {
  const args = JSON.stringify({ network: "wax-testnet", from, contract, action, data });
  return wax("pushaction", args);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Query AA templates for a collection via RPC — returns the template_id we just created */
async function resolveTemplateId(collectionName) {
  const res = await fetch(`${RPC}/v1/chain/get_table_rows`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      json: true,
      code: "atomicassets",
      scope: collectionName,
      table: "templates",
      limit: 10,
      reverse: true, // newest first
    }),
  });
  const data = await res.json();
  const rows = data.rows || [];
  if (rows.length === 0) throw new Error("No templates found — createtempl may have failed");
  // The newest template is what we just created
  return rows[0].template_id;
}

const ACCT = "phgamecreatr";
const COL = "phgamecreatr";

async function main() {
  console.log("=".repeat(55));
  console.log(`  Setup ${ACCT} — AtomicAssets + Config`);
  console.log("=".repeat(55));

  // Step 1: createcol
  console.log("\n📦 Step 1: createcol...");
  let r = await push(ACCT, "atomicassets", "createcol", {
    author: ACCT,
    collection_name: COL,
    allow_notify: true,
    authorized_accounts: [ACCT],
    notify_accounts: [],
    market_fee: 0.05,
    data: [
      { key: "name", value: ["string", "Pocket Hatchery"] },
    ],
  });
  console.log(r.ok ? "   ✅ Collection created" : `   ⚠️  ${r.msg}`);

  // Step 2: createschema
  console.log("\n📋 Step 2: createschema...");
  r = await push(ACCT, "atomicassets", "createschema", {
    authorized_creator: ACCT,
    collection_name: COL,
    schema_name: "creatures",
    schema_format: [
      { name: "genetics", type: "string" },
      { name: "stage", type: "uint32" },
      { name: "growth", type: "uint64" },
      { name: "name", type: "string" },
    ],
  });
  console.log(r.ok ? "   ✅ Schema created" : `   ⚠️  ${r.msg}`);

  // Step 3: createtempl → RESOLVE real template_id from chain
  console.log("\n🐉 Step 3: createtempl...");
  r = await push(ACCT, "atomicassets", "createtempl", {
    authorized_creator: ACCT,
    collection_name: COL,
    schema_name: "creatures",
    transferable: true,
    burnable: true,
    max_supply: 0,
    immutable_data: [],
  });
  console.log(r.ok ? "   ✅ Template created" : `   ❌ ${r.msg}`);
  if (!r.ok) throw new Error("createtempl failed — cannot continue without template_id");

  // ⚠️ MUST resolve template_id from chain — AtomicAssets auto-assigns it.
  //    662644 is pockethatch1's template, NOT ours. Each collection has its own counter.
  console.log("\n🔍 Resolving template_id from chain...");
  await sleep(2000); // wait for block
  let templateId;
  try {
    templateId = await resolveTemplateId(COL);
    console.log(`   ✅ Resolved: template_id = ${templateId}`);
  } catch (e) {
    console.log(`   ❌ Could not resolve template_id: ${e.message}`);
    console.log("   → Check if createtempl succeeded on chain");
    console.log(`   → Query manually: curl ${RPC}/v1/chain/get_table_rows -d '{"json":true,"code":"atomicassets","scope":"${COL}","table":"templates","limit":5}'`);
    process.exit(1);
  }

  // Step 4: setconfig
  console.log("\n⚙️  Step 4: setconfig...");
  const now = Math.floor(Date.now() / 1000);
  r = await push(ACCT, ACCT, "setconfig", {
    cfg: {
      token_contract: "hatchtokens1",
      collection: COL,
      schema_name: "creatures",
      fee_account: ACCT,
      paused: false,
      hatch_cost: 150,
      evolve_cost: 50,
      breed_cost: "5.0000 HATCH",
      feed_cost: 0,
      slot_cost: 500,
      cosmetic_cost: 100,
      name_cost: "1.0000 HATCH",
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
      rng_oracle: "phgamecreatr",
    },
  });
  console.log(r.ok ? "   ✅ Config set" : `   ❌ ${r.msg}`);
  if (!r.ok) throw new Error("setconfig failed");

  // Step 5: setspecies — use the REAL resolved template_id
  console.log(`\n🧬 Step 5: setspecies (template_id=${templateId})...`);
  r = await push(ACCT, ACCT, "setspecies", {
    sp: {
      template_id: templateId,   // ← RESOLVED from chain, NOT hardcoded
      growth_rate: 1000,
      thresh_1: 1000,
      thresh_2: 5000,
      thresh_3: 20000,
      thresh_4: 100000,
      yield_0: 100,
      yield_1: 300,
      yield_2: 600,
      yield_3: 1200,
      yield_4: 2400,
      max_stage: 5,
      egg_weight: 100,
      egg_type: 0,
      family: "Fire",
    },
  });
  console.log(r.ok ? "   ✅ Species set" : `   ❌ ${r.msg}`);

  console.log(`\n🎉 Setup complete! template_id=${templateId}`);
  console.log(`   Next: node verify-loop.mjs`);
}

main().catch(e => { console.error(`\n💥 FATAL: ${e.message}`); process.exit(1); });
