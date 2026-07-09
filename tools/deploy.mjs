#!/usr/bin/env node
/**
 * Pocket Hatchery — Post-Deploy Setup Tool
 *
 * Setup AtomicAssets collection + config AFTER contract is deployed via cleos/WSL.
 * ⚠️ deploy.mjs does NOT deploy the WASM — use deploy/deploy-fix-2026-07-01.sh
 *    (WSL + cleos + PH_CONTRACT_PRIV) for setcode/setabi.
 *
 * Flow (after deploy-fix-2026-07-01.sh succeeds):
 *   1. unlock waxwing wallet
 *   2. createcol (if missing)
 *   3. createschema + createtmpl
 *   4. setconfig + setspecies
 *   5. fundpool (if needed)
 *
 * Usage:
 *   node deploy.mjs setup <account>       — setup collection + config (after cleos deploy)
 *   node deploy.mjs status <account>      — check deploy status
 *   node deploy.mjs new <account_name>    — create new contract account (cleos still needed for setcode)
 */

import { resolveTemplateId } from './lib/resolve-template.mjs';
import { packAbiFromPath } from './lib/pack-abi.mjs';

const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;
const NETWORK = "wax-testnet";
const RPC = "https://testnet.waxsweden.org";
const CREATOR = "waxwingsuper"; // pays for new accounts

// On-chain system accounts
const EOSIO = "eosio";
const ATOMICASSETS = "atomicassets";
const TOKEN_CONTRACT = "hatchtokens1";

// Contract artifacts
const WASM_PATH = "../contract/pockethatch/build/pockethatch.wasm";
const ABI_PATH = "../contract/pockethatch/build/pockethatch.abi";

const args = process.argv.slice(2);
const cmd = args[0] || "help";
const account = args[1] || "";

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

async function push(contract, action, data = {}, opts = {}) {
  const from = opts.from || account;
  const fullArgs = {
    network: NETWORK,
    from,
    contract,
    action,
    data,
  };
  const body = JSON.stringify({ cmd: "pushaction", args: JSON.stringify(fullArgs) });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data2 = await res.json();
  if (!data2.ok) throw new Error(`${action}: ${data2.msg}`);
  return data2;
}

// ── account management ───────────────────────────────────────────────
async function createAccount(name) {
  console.log(`🏦 Creating account ${name}...`);
  // waxwing newaccount needs: { creator, name, owner, active, ... }
  // First generate a key
  console.log("   Generate keypair (needs wallet unlocked)...");
  // The newaccount command handles key generation internally
  const r = await wax("newaccount", JSON.stringify({
    name,
    creator: CREATOR,
    buyrambytes: 200000,  // ~200KB for contract
    stakecpu: "1.00000000 WAX",
    stakenet: "0.50000000 WAX",
  }));
  console.log(`   ✅ Account created: ${name}`);
  console.log(`   Transaction: ${r.txId || "unknown"}`);
  return r;
}

// ── deploy ───────────────────────────────────────────────────────────
async function deployContract(contractAcct) {
  const fs = await import("fs");

  // Read wasm
  const wasmPath = new URL(WASM_PATH, import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "\\");
  const wasmBuf = fs.readFileSync(WASM_PATH.replace(/\//g, "\\"));
  const wasmHex = wasmBuf.toString("hex");
  console.log(`📦 WASM: ${(wasmBuf.length / 1024).toFixed(1)} KB → ${(wasmHex.length / 1024).toFixed(1)} KB hex`);

  // Read + PACK ABI as abi_def binary (NOT hex-encode JSON!)
  const abiPath = ABI_PATH.replace(/\//g, "\\");
  const { packedHex: abiHex, abiObj, packedBytes: abiPacked } = packAbiFromPath(abiPath);
  const abiJsonLen = JSON.stringify(abiObj).length;
  console.log(`📋 ABI: ${abiPath}`);
  console.log(`   JSON: ${abiJsonLen.toLocaleString()} bytes → packed: ${abiPacked.length.toLocaleString()} bytes (${((1 - abiPacked.length / abiJsonLen) * 100).toFixed(0)}% smaller)`);
  // DRY-TEST: verify first byte is varuint of version, not '{'
  if (abiPacked[0] === 0x7B) {
    console.error(`   ❌ FATAL: Packed ABI starts with 0x7B ('{') — WRONG! Aborting.`);
    process.exit(1);
  }
  console.log(`   ✅ First byte: 0x${abiPacked[0].toString(16)} (varuint of "eosio::abi/1.X") — correctly packed`);

  // Step 1: setcode
  console.log(`\n📤 Deploying WASM to ${contractAcct}...`);
  console.log("   Calling eosio::setcode...");

  try {
    const r = await push(EOSIO, "setcode", {
      account: contractAcct,
      vmtype: 0,
      vmversion: 0,
      code: wasmHex,
    });
    console.log(`   ✅ WASM deployed! tx: ${r.txId?.slice(0, 12)}...`);
    console.log(`   🔗 ${r.explorer || ""}`);
  } catch (e) {
    console.error(`   ❌ setcode failed: ${e.message}`);
    console.log("   ⚠️  May need more RAM or the payload is too large for pushaction");
    console.log("   → Try using cleos in WSL instead");
    throw e;
  }

  // Step 2: setabi (correctly packed as abi_def binary)
  console.log(`\n📤 Deploying ABI to ${contractAcct} (packed abi_def)...`);
  try {
    const r = await push(EOSIO, "setabi", {
      account: contractAcct,
      abi: abiHex,  // ← packed abi_def hex, NOT raw JSON hex!
    });
    console.log(`   ✅ ABI deployed! tx: ${r.txId?.slice(0, 12)}...`);
    console.log(`   🔗 ${r.explorer || ""}`);
  } catch (e) {
    console.error(`   ❌ setabi failed: ${e.message}`);
    throw e;
  }

  console.log(`\n🎉 Contract deployed to ${contractAcct}!`);
}

// ── setup: AtomicAssets collection + contract config ─────────────────
async function setupContract(contractAcct) {
  const collectionName = contractAcct; // use same name for collection

  // Step 1: Create AtomicAssets collection
  console.log(`\n🏗  Creating AtomicAssets collection "${collectionName}"...`);
  console.log("   Calling atomicassets::createcol...");

  try {
    // createcol params: author, collection_name, allow_notify, authorized_accounts, notify_accounts, market_fee, data
    const r = await push(ATOMICASSETS, "createcol", {
      author: contractAcct,
      collection_name: collectionName,
      allow_notify: true,
      authorized_accounts: [contractAcct],
      notify_accounts: [],
      market_fee: 0.05, // 5%
      data: [
        { key: "name", value: ["string", "Pocket Hatchery"] },
        { key: "description", value: ["string", "Creature farming game on WAX"] },
        { key: "url", value: ["string", "https://pockethatchery.com"] },
        { key: "image", value: ["string", "https://pockethatchery.com/logo.png"] },
      ],
    });
    console.log(`   ✅ Collection created! tx: ${r.txId?.slice(0, 12)}...`);
  } catch (e) {
    console.log(`   ⚠️  createcol: ${e.message}`);
    console.log("   → Collection might already exist, continuing...");
  }

  // Step 2: Create schema
  console.log(`\n📋 Creating schema "creatures"...`);
  try {
    const r = await push(ATOMICASSETS, "createschema", {
      authorized_creator: contractAcct,
      collection_name: collectionName,
      schema_name: "creatures",
      schema_format: [
        { name: "genetics", type: "string" },
        { name: "stage", type: "uint32" },
        { name: "growth", type: "uint64" },
        { name: "name", type: "string" },
      ],
    });
    console.log(`   ✅ Schema created! tx: ${r.txId?.slice(0, 12)}...`);
  } catch (e) {
    console.log(`   ⚠️  createschema: ${e.message}`);
  }

  // Step 3: Create species template (Fire creature)
  console.log(`\n🐉 Creating species template...`);
  try {
    const r = await push(ATOMICASSETS, "createtempl", {
      authorized_creator: contractAcct,
      collection_name: collectionName,
      schema_name: "creatures",
      transferable: true,
      burnable: true,
      max_supply: 0, // unlimited
      immutable_data: {
        family: "Fire",
        egg_type: 0,
      },
    });
    console.log(`   ✅ Template created! tx: ${r.txId?.slice(0, 12)}...`);
    console.log(`   (Note: template_id will be auto-assigned — update species config accordingly)`);
  } catch (e) {
    console.log(`   ⚠️  createtempl: ${e.message}`);
  }

  // Step 4: Configure contract
  console.log(`\n⚙️  Configuring contract...`);
  try {
    const r = await push(contractAcct, "setconfig", {
      cfg: {
        token_contract: TOKEN_CONTRACT,
        collection: collectionName,
        schema_name: "creatures",
        fee_account: contractAcct, // use self as fee account (won't be used in current EGG-based economy)
        paused: false,
        hatch_cost: 150,
        evolve_cost: 50,
        breed_cost: "5.0000 HATCH",
        feed_cost: 0,
        slot_cost: 500,
        cosmetic_cost: 100,
        name_cost: "1.0000 HATCH",
        install_cap_bonus: 72,
        feed_cd: 0,       // no cooldown for testing
        harvest_cd: 0,    // no cooldown for testing
        breed_cd: 86400,
        feed_daily_cap: 100,
        daily_egg_cap: 240,
        offline_cap_h: 8,
        tap_egg_cap: 60,
        feed_boost: 1000,
        season_index: 1,
        season_started: Math.floor(Date.now() / 1000),
        rng_oracle: "testoracle11",
      },
    });
    console.log(`   ✅ Contract configured! tx: ${r.txId?.slice(0, 12)}...`);
  } catch (e) {
    console.log(`   ⚠️  setconfig: ${e.message}`);
  }

  // Step 5: Resolve template_id from chain (AA auto-assigns it)
  console.log(`\n🔍 Resolving template_id from chain...`);
  let templateId;
  try {
    templateId = await resolveTemplateId(collectionName, RPC);
    console.log(`   Resolved: template_id = ${templateId}`);
  } catch (e) {
    console.log(`   ❌ Could not resolve template_id: ${e.message}`);
    console.log("   → Check if createtempl succeeded on chain");
    throw e;
  }

  // Step 6: Set species
  console.log(`\n🧬 Setting species config (template_id=${templateId})...`);
  try {
    const r = await push(contractAcct, "setspecies", {
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
    console.log(`   ✅ Species set! tx: ${r.txId?.slice(0, 12)}...`);
  } catch (e) {
    console.log(`   ⚠️  setspecies: ${e.message}`);
  }

  console.log("\n🎉 Setup complete!");
}

// ── full deploy flow ─────────────────────────────────────────────────
async function fullDeploy(contractAcct) {
  console.log("═".repeat(60));
  console.log(`  Pocket Hatchery — Full Deploy to ${contractAcct}`);
  console.log("═".repeat(60));

  // Check wallet
  const ws = await wax("status");
  if (!ws.status.unlocked) {
    console.log("\n❌ Wallet is LOCKED! Unlock first:");
    console.log(`   curl -X POST ${WAXWING} -H "content-type: application/json" -d '{"cmd":"unlock","args":"<PASSWORD>"}'`);
    return;
  }
  console.log(`   Wallet: 🔓 unlocked | Network: ${ws.status.network.name}`);

  // Step 1: Create account
  console.log(`\n📝 Step 1: Create account ${contractAcct}...`);
  try {
    await createAccount(contractAcct);
  } catch (e) {
    console.log(`   ⚠️  ${e.message} (might already exist, continuing...)`);
  }

  // Step 2: Deploy contract
  console.log(`\n📤 Step 2: Deploy contract...`);
  await deployContract(contractAcct);

  // Step 3: Setup
  console.log(`\n🔧 Step 3: Setup collection + config...`);
  await setupContract(contractAcct);

  // Step 4: Verify
  console.log(`\n✅ Step 4: Verify deploy...`);
  try {
    const info = await wax("account", contractAcct);
    console.log(`   Account:  ${info.account.account}`);
    console.log(`   RAM:      ${info.account.ram.usage}/${info.account.ram.quota}`);
    console.log(`   Created:  ${info.account.created}`);
  } catch (e) {
    console.log(`   ⚠️  ${e.message}`);
  }

  console.log("\n🎉 Deploy complete! Game is ready to play:");
  console.log(`   node play.mjs loop`);
}

// ── CLI ──────────────────────────────────────────────────────────────
async function main() {
  try {
    switch (cmd) {
      case "new":
        if (!account) { console.log("Usage: node deploy.mjs new <account_name>"); return; }
        await fullDeploy(account);
        break;

      case "deploy":
        if (!account) { console.log("Usage: node deploy.mjs deploy <account>"); return; }
        await deployContract(account);
        break;

      case "setup":
        if (!account) { console.log("Usage: node deploy.mjs setup <account>"); return; }
        await setupContract(account);
        break;

      case "status":
        {
          const acct = account || "phgamecreatr";
          console.log(`Checking ${acct}...`);
          try {
            const info = await wax("account", acct);
            console.log(JSON.stringify(info, null, 2));
          } catch (e) {
            console.log(`Error: ${e.message}`);
          }
        }
        break;

      case "help":
      default:
        console.log(`
🚀 Pocket Hatchery — Deploy Tool
   Deploy contract via waxwing pushaction (no cleos!)

Commands:
  node deploy.mjs new <account>      Full deploy: create account + deploy + setup
  node deploy.mjs deploy <account>   Deploy wasm+abi to existing account
  node deploy.mjs setup <account>    Setup collection + config (after deploy)
  node deploy.mjs status [account]   Check deploy status

Prerequisites:
  1. WSL with compiled contract (build/pockethatch.wasm + .abi)
  2. Unlocked waxwing wallet with waxwingsuper as creator
  3. waxwingsuper must have enough WAX for RAM/stake (~3 WAX)

Note:
  setcode via pushaction transfers 94KB of WASM as hex (~188KB JSON).
  If this fails (payload too large), use WSL cleos instead:
    wsl bash
    cleos -u https://testnet.waxsweden.org set contract <account> /mnt/e/.../build/
        `.trim());
        break;
    }
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main();
