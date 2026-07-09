#!/usr/bin/env node
/**
 * Config phgamecreatr — setconfig + setspecies with exact ABI types
 */
import { resolveTemplateId } from './lib/resolve-template.mjs';

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

const ACCT = "phgamecreatr";
const COL = "phgamecreatr";

async function main() {
  const now = Math.floor(Date.now() / 1000);

  // setconfig — exact match to config_row ABI
  console.log("⚙️  setconfig...");
  const cfgData = {
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
    rng_oracle: ACCT,
  };

  let r = await push(ACCT, ACCT, "setconfig", { cfg: cfgData });
  if (r.ok) {
    console.log("   ✅ Config set");
  } else {
    console.log(`   ❌ setconfig failed: ${r.msg}`);
    // Try without cfg wrapper
    r = await push(ACCT, ACCT, "setconfig", cfgData);
    console.log(r.ok ? "   ✅ Config set (unwrapped)" : `   ❌ ${r.msg}`);
  }

  // Step 1: Resolve template_ids from chain — NEVER hardcode
  console.log("🔍 Resolving template_ids from chain...");
  let fireId, waterId;
  try {
    const res = await fetch(`${RPC}/v1/chain/get_table_rows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        json: true,
        code: "atomicassets",
        scope: COL,
        table: "templates",
        limit: 10,
        reverse: true,
      }),
    });
    const data = await res.json();
    const rows = data.rows || [];
    if (rows.length === 0) throw new Error("No templates found");
    // First template = Fire (egg_type 0), second = Water (egg_type 1) if exists
    fireId = rows[0].template_id;
    waterId = rows.length > 1 ? rows[1].template_id : null;
    console.log(`   Resolved: Fire=${fireId}${waterId ? ` Water=${waterId}` : ' (single template)'}`);
  } catch (e) {
    console.log(`   ❌ Cannot resolve template_id: ${e.message}`);
    process.exit(1);
  }

  // setspecies — exact match to species_row ABI
  console.log("🧬 setspecies...");
  const spData = {
    template_id: fireId,   // ← RESOLVED from chain
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
  };

  r = await push(ACCT, ACCT, "setspecies", { sp: spData });
  if (r.ok) {
    console.log("   ✅ Species set");
  } else {
    console.log(`   ❌ setspecies failed: ${r.msg}`);
    // Try without sp wrapper
    r = await push(ACCT, ACCT, "setspecies", spData);
    console.log(r.ok ? "   ✅ Species set (unwrapped)" : `   ❌ ${r.msg}`);
  }

  // Also set species for second template (egg_type 1) — if it exists
  if (waterId) {
    console.log("🧬 setspecies (egg_type 1)...");
    r = await push(ACCT, ACCT, "setspecies", { sp: { ...spData, template_id: waterId, egg_type: 1, family: "Water" } });
    if (r.ok) {
      console.log("   ✅ Species 2 set");
    } else {
      console.log(`   ⚠️  ${r.msg}`);
    }
  } else {
    console.log("   ⚠️  Only 1 template — skipping second species (create another template first)");
  }
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
