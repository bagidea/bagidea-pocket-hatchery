// verify-game-loop.cjs — Kevin's write-path verification (Session-based)
// Fires hatch→feed→evolve→breed on phgamecreatr (wax-testnet)
// Diffs before/after state for every step. No redeploy — read + fire + assert only.
// Usage: node verify-game-loop.cjs

const path = require("path");
const NM = "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/node_modules";
const { APIClient } = require(path.join(NM, "@wharfkit/antelope"));
const { Session } = require(path.join(NM, "@wharfkit/session"));
const { WalletPluginPrivateKey } = require(path.join(NM, "@wharfkit/wallet-plugin-privatekey"));

// ── Config ────────────────────────────────────────────────────────────
const RPC     = "https://waxtestnet.greymass.com";
const CHAIN   = "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12";
const CONTRACT = "phgamecreatr";
const PLAYER   = "waxwingsuper";
const WIF = process.env.PH_TESTPLAYER_PRIV;
if (!WIF) throw new Error("FATAL: export PH_TESTPLAYER_PRIV=<waxwingsuper active key> in-process before running (never on disk)");

// ── Setup ─────────────────────────────────────────────────────────────
const api = new APIClient({ url: RPC });
const session = new Session({
  actor: PLAYER,
  permission: "active",
  chain: { id: CHAIN, url: RPC },
  walletPlugin: new WalletPluginPrivateKey(WIF),
});
const AUTH = [session.permissionLevel];

async function getTable(table, scope, lower, upper) {
  const body = { code: CONTRACT, scope: scope || CONTRACT, table, json: true, limit: 50 };
  if (lower) body.lower_bound = lower;
  if (upper) body.upper_bound = upper;
  const res = await api.v1.chain.get_table_rows(body);
  return res.rows;
}

function sumPlayer(p) {
  if (!p) return "null";
  return `EGG=${p.egg_balance} feeds=${p.feeds_today}/${p.feed_day} farmed=${p.total_egg_farmed} burned=${p.total_hatch_burned}`;
}
function sumCreature(c) {
  if (!c) return "null";
  return `id=${c.asset_id} tpl=${c.template_id} stage=${c.stage} gp=${c.growth_base} fg=${c.fed_growth} last_fed=${c.last_fed} last_bred=${c.last_bred}`;
}

// ── Main step function ─────────────────────────────────────────────────
const results = [];

async function step(label, actionName, actionData) {
  console.log(`\n=== STEP: ${label} ===`);

  // BEFORE snapshot
  const [playersBefore, creaturesBefore, poolBefore] = await Promise.all([
    getTable("players", CONTRACT, PLAYER, PLAYER),
    getTable("creatrsv2", CONTRACT), // scope=phgamecreatr, NOT player
    getTable("rewardpool"),
  ]);
  const pB = playersBefore.find(r => r.account === PLAYER) || null;
  const myCreaturesB = creaturesBefore.filter(r => r.owner === PLAYER);
  console.log(`   BEFORE player:  ${sumPlayer(pB)}`);
  console.log(`   BEFORE creatures: ${myCreaturesB.length} rows (total in table: ${creaturesBefore.length})`);
  myCreaturesB.forEach(c => console.log(`      ${sumCreature(c)}`));
  if (poolBefore.length) console.log(`   BEFORE pool: ${poolBefore[0].balance} (funded ${poolBefore[0].lifetime_funded}, paid ${poolBefore[0].lifetime_paid})`);

  // FIRE action
  let txResult;
  try {
    const result = await session.transact({
      action: { account: CONTRACT, name: actionName, authorization: AUTH, data: actionData },
    });
    txResult = { txid: result.response.transaction_id, block: result.response.processed?.block_num || "?" };
    console.log(`   TX:  ${txResult.txid}  (block ${txResult.block})`);
  } catch (e) {
    const msg = (e.message || String(e)).slice(0, 500);
    console.log(`   REVERT: ${msg}`);
    results.push({ label, action: actionName, tx: "REVERT", before: sumPlayer(pB), diff: "N/A", status: "FAIL", error: msg });
    return { status: "FAIL", error: msg, newCreatureIds: [], changedCreatureIds: [] };
  }

  // Wait for chain propagation
  await new Promise(r => setTimeout(r, 2000));

  // AFTER snapshot
  const [playersAfter, creaturesAfter] = await Promise.all([
    getTable("players", CONTRACT, PLAYER, PLAYER),
    getTable("creatrsv2", CONTRACT), // scope=phgamecreatr
  ]);
  const pA = playersAfter.find(r => r.account === PLAYER) || null;
  const myCreaturesA = creaturesAfter.filter(r => r.owner === PLAYER);
  console.log(`   AFTER  player:  ${sumPlayer(pA)}`);
  console.log(`   AFTER  creatures: ${myCreaturesA.length} rows (total: ${creaturesAfter.length})`);
  myCreaturesA.forEach(c => console.log(`      ${sumCreature(c)}`));

  // DIFF
  const eggDiff = (pA && pB) ? (pA.egg_balance - pB.egg_balance) : "?";
  const newCreatures = myCreaturesA.filter(ca => !myCreaturesB.find(cb => String(cb.asset_id) === String(ca.asset_id)));
  const changedCreatures = myCreaturesA.filter(ca => {
    const cb = myCreaturesB.find(cb => String(cb.asset_id) === String(ca.asset_id));
    return cb && JSON.stringify(ca) !== JSON.stringify(cb);
  });

  console.log(`   DIFF: dEGG=${eggDiff} new=${newCreatures.length} chg=${changedCreatures.length}`);
  newCreatures.forEach(c => console.log(`      NEW -> ${sumCreature(c)}`));
  changedCreatures.forEach(c => console.log(`      CHG -> ${sumCreature(c)}`));

  const pass = txResult.txid.length === 64; // SHA256 hash
  results.push({
    label, action: actionName, tx: txResult.txid,
    before: sumPlayer(pB), after: sumPlayer(pA),
    diff: `dEGG=${eggDiff} new=${newCreatures.length} chg=${changedCreatures.length}`,
    status: pass ? "PASS" : "FAIL",
  });
  return { status: pass ? "PASS" : "FAIL", newCreatureIds: newCreatures.map(c => c.asset_id), changedCreatureIds: changedCreatures.map(c => c.asset_id) };
}

// ── Execute game loop ──────────────────────────────────────────────────
(async () => {
console.log("=============================================");
console.log(" POCKET HATCHERY - Game Loop Verification");
console.log(" Contract: phgamecreatr | Player: waxwingsuper");
console.log(" RPC: waxtestnet.greymass.com");
console.log(` Time: ${new Date().toISOString()}`);
console.log("=============================================");

try {
  // Step 1: HATCH — egg_type=0 (common rarity, highest egg_weight=100)
  const h1 = await step("1.HATCH", "hatch", { owner: PLAYER, egg_type: 0 });
  let a1 = null, a2 = null;

  if (h1.status === "PASS" && h1.newCreatureIds.length > 0) {
    a1 = h1.newCreatureIds[0];
    console.log(`\n   >>> Got creature: asset_id=${a1}`);

    // Step 2: FEED the creature
    const f1 = await step("2.FEED", "feed", { owner: PLAYER, asset_id: a1 });

    // Step 3: EVOLVE (may fail if not enough growth — that's expected, document it)
    const e1 = await step("3.EVOLVE", "evolve", { owner: PLAYER, asset_id: a1 });

    // Need 2 creatures for breed. Hatch second if needed.
    if (h1.newCreatureIds.length >= 2) {
      a2 = h1.newCreatureIds[1];
    } else {
      console.log(`\n   >>> Hatching second creature for breed...`);
      const h2 = await step("4a.HATCH2", "hatch", { owner: PLAYER, egg_type: 0 });
      if (h2.status === "PASS" && h2.newCreatureIds.length > 0) {
        a2 = h2.newCreatureIds[0];
      }
    }

    // Step 5: BREED (needs 2 creatures)
    if (a1 && a2) {
      await step("5.BREED", "breed", { owner: PLAYER, parent_a: a1, parent_b: a2 });
    } else {
      console.log(`\n   >>> SKIP breed: need 2 creatures (have ${a1 ? 1 : 0})`);
      results.push({ label: "BREED", action: "breed", tx: "SKIPPED", before: "-", after: "-", diff: "need 2 creatures", status: "SKIP" });
    }
  } else {
    console.log(`\n   >>> Hatch FAILED: ${h1.error || "no creature created"}`);
  }
} catch (e) {
  console.log(`\nFATAL: ${e.message}`);
  console.log(e.stack);
}

// ── Summary table ──────────────────────────────────────────────────────
console.log(`\n\n=============================================`);
console.log(`  GAME LOOP VERIFICATION — SUMMARY TABLE`);
console.log(`=============================================`);
console.log(`  ${"Step".padEnd(14)} ${"TX ID".padEnd(24)} ${"Before -> After (diff)".padEnd(64)} Status`);
console.log(`  ${"-".repeat(14)} ${"-".repeat(24)} ${"-".repeat(64)} ${"-".repeat(8)}`);
for (const r of results) {
  const tx = r.tx === "REVERT" ? "REVERT" : r.tx === "SKIPPED" ? "SKIPPED" : (r.tx?.slice(0, 22) || "?");
  const detail = (r.diff || r.error || "").slice(0, 64);
  console.log(`  ${r.label.padEnd(14)} ${tx.padEnd(24)} ${detail.padEnd(64)} ${r.status}`);
  if (r.error && r.error !== detail) console.log(`    └─ ${r.error.slice(0, 100)}`);
}
console.log(`=============================================`);
const p = results.filter(r => r.status === "PASS").length;
const f = results.filter(r => r.status === "FAIL").length;
const s = results.filter(r => r.status === "SKIP").length;
console.log(`  PASS: ${p}  FAIL: ${f}  SKIP: ${s}`);
console.log(`=============================================`);
})();
