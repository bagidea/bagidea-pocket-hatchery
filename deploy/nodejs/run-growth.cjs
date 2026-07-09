// Live growth-loop prover for pockethatch1 on WAX testnet.
// Signs locally with eosjs (waxwingsuper key) — bypasses keosd/get_required_keys.
// Decrypts the waxwingsuper key straight from the waxwing keystore (no plaintext on disk).
const fs = require("fs");
const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const { TextEncoder, TextDecoder } = require("util");
// Node 24 ships a global fetch — eosjs just needs a fetch-shaped function.
const fetch = (...a) => globalThis.fetch(...a);

const RPC = "https://waxtestnet.greymass.com";
const CONTRACT = "pockethatch1";
const TOKEN = "hatchtokens1";
const PLAYER = "waxwingsuper";
const COLLECTION = "pockethatch1";

// ── decrypt waxwingsuper key from the waxwing keystore ──
const KS = require("E:/Projects/bagidea-ai-agents-office/plugins/waxwing/keystore.js");
const store = JSON.parse(fs.readFileSync(
  "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/data/keystore.json", "utf8"));
const acct = store.byNet["wax-testnet"].accounts.find(a => a.account === PLAYER);
const _pw = process.env.HATCH_KEYSTORE_PW; if (!_pw) throw new Error("HATCH_KEYSTORE_PW env var not set");
const PLAYER_KEY = KS.decrypt(acct, _pw);
if (!PLAYER_KEY) throw new Error("could not decrypt waxwingsuper key");

const sig = new JsSignatureProvider([PLAYER_KEY]);
const rpc = new JsonRpc(RPC, { fetch });
const api = new Api({ rpc, signatureProvider: sig, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

const out = { steps: [] };
function log(k, v) { out.steps.push({ step: k, ...v }); console.log(k, JSON.stringify(v)); }

async function push(name, data, label) {
  try {
    const r = await api.transact({
      actions: [{ account: CONTRACT, name, authorization: [{ actor: PLAYER, permission: "active" }], data }]
    }, { blocksBehind: 3, expireSeconds: 90 });
    const txid = r.transaction_id;
    const block = r.processed && r.processed.block_num;
    log(label, { ok: true, txid, block });
    return txid;
  } catch (e) {
    // eosjs often nests the chain error in e.json || e.message
    const detail = (e.json && (e.json.error && e.json.error.details)) || e.message;
    log(label, { ok: false, error: String(detail).slice(0, 400) });
    throw e;
  }
}

async function table(code, scope, tbl) {
  const r = await rpc.get_table_rows({ code, scope, table: tbl, json: true, limit: 50 });
  return r.rows;
}
async function hatchSupply() {
  const r = await rpc.get_currency_stats(TOKEN, "HATCH");
  return r.HATCH.supply;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log("=== HATCH supply BEFORE ===");
  const sup0 = await hatchSupply(); console.log("  " + sup0); out.supply_before = sup0;

  console.log("=== initplayer ===");
  await push("initplayer", { owner: PLAYER }, "initplayer");

  console.log("=== hatch (egg_type=0) ===");
  await push("hatch", { owner: PLAYER, egg_type: 0 }, "hatch");
  await sleep(1500);

  // resolve the newest creature owned by player
  let rows = await table(CONTRACT, CONTRACT, "creatures");
  const mine = rows.filter(r => r.owner === PLAYER);
  if (!mine.length) throw new Error("no creature row after hatch");
  const asset_id = mine[mine.length - 1].asset_id;
  console.log("  ASSET_ID=" + asset_id); out.asset_id = String(asset_id);

  console.log("=== feed ×1 (raise) ===");
  await push("feed", { owner: PLAYER, asset_id }, "feed-1");

  console.log("=== evolve → stage 1 ===");
  await push("evolve", { owner: PLAYER, asset_id }, "evolve-1");

  console.log("=== feed ×4 (raise toward Juvenile) ===");
  for (let i = 2; i <= 5; i++) await push("feed", { owner: PLAYER, asset_id }, "feed-" + i);

  console.log("=== evolve → stage 2 (Juvenile) ===");
  await push("evolve", { owner: PLAYER, asset_id }, "evolve-2");

  console.log("=== HATCH supply AFTER (burn proof) ===");
  const sup1 = await hatchSupply(); console.log("  " + sup1); out.supply_after = sup1;

  // ── verify on chain ──
  console.log("=== verify creature row ===");
  rows = await table(CONTRACT, CONTRACT, "creatures");
  const c = rows.find(r => String(r.asset_id) === String(asset_id));
  out.creature = c; console.log("  stage=" + c.stage + "  growth=" + (Number(c.growth_base)+Number(c.fed_growth)) + "  template=" + c.template_id);

  console.log("=== verify NFT mutable data (stage/growth mirrored) ===");
  const assets = await table("atomicassets", PLAYER, "assets");
  const nft = assets.find(a => String(a.asset_id) === String(asset_id));
  const mutable = {};
  if (nft) for (const f of (nft.mutable_data || [])) { try { mutable[f.key] = Array.isArray(f.value)?f.value[1]:f.value; } catch {} }
  out.nft = { asset_id, template_id: nft && nft.template_id, mutable };
  console.log("  NFT mutable=" + JSON.stringify(mutable));

  out.proven = (c.stage >= 2) && (mutable.stage !== undefined && Number(mutable.stage) >= 2);
  fs.writeFileSync(__dirname + "/growth-result.json", JSON.stringify(out, null, 2));
  console.log("\n=== PROVEN: " + out.proven + " ===");
})().catch(e => { console.error("FATAL:", e.message); fs.writeFileSync(__dirname + "/growth-result.json", JSON.stringify(out, null, 2)); process.exit(1); });
