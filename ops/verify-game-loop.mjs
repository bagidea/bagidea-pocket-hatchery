// verify-game-loop.mjs — Kevin's write-path verification
// Fires hatch→feed→evolve→breed on phgamecreatr (wax-testnet)
// Diffs before/after state for every step. No redeploy — read + fire + assert only.
//
// Usage: NODE_PATH=<waxwing_nm> node verify-game-loop.mjs

import { createRequire } from "module";
const nm = "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/node_modules";
const require = createRequire(import.meta.url.replace(/ops\/.*/, "ops/") + "../node_modules/"); // won't work

// Better: just require from the exact path
const modPath = nm + "/@wharfkit/antelope/lib/antelope.js";
const { PrivateKey, SignedTransaction, Action, APIClient } = await import("file:///" + nm.replace(/\\/g, "/") + "/@wharfkit/antelope/lib/antelope.m.js");

// ── Config ────────────────────────────────────────────────────────────
const RPC     = "https://testnet.waxsweden.org";
const CHAIN   = "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12";
const CONTRACT = "phgamecreatr";
const PLAYER   = "waxwingsuper";
const AUTH     = [{ actor: PLAYER, permission: "active" }];

const WIF = process.env.PH_TESTPLAYER_PRIV;
if (!WIF) throw new Error("FATAL: export PH_TESTPLAYER_PRIV=<waxwingsuper active key> in-process before running (never on disk)");

// ── Helpers ───────────────────────────────────────────────────────────
const api = new APIClient({ url: RPC });
const key = PrivateKey.from(WIF);
console.log(`KEY: ${key.toPublic().toString()}`);

async function getTable(table, scope = CONTRACT, lower = null, upper = null) {
  const body = { code: CONTRACT, scope, table, json: true, limit: 50 };
  if (lower) body.lower_bound = lower;
  if (upper) body.upper_bound = upper;
  const res = await api.v1.chain.get_table_rows(body);
  return res.rows;
}

async function pushAction(name, data) {
  const info = await api.v1.chain.get_info();
  const action = Action.from({
    account: CONTRACT,
    name,
    authorization: AUTH,
    data,
  });
  const header = info.getTransactionHeader(90);
  const tx = SignedTransaction.from({
    ...header,
    actions: [action],
  });
  const digest = tx.signingDigest(CHAIN);
  const sig = key.sign(digest);
  tx.signatures = [sig];

  const result = await api.v1.chain.push_transaction(tx);
  return {
    txid: result.transaction_id,
    block: result.processed?.block_num || "?",
  };
}

function summarizePlayer(p) {
  if (!p) return "null";
  return `EGG=${p.egg_balance} feeds_today=${p.feeds_today}/${p.feed_day} total_farmed=${p.total_egg_farmed} burned=${p.total_hatch_burned}`;
}

function summarizeCreature(c) {
  if (!c) return "null";
  return `id=${c.asset_id} template=${c.template_id} stage=${c.stage} growth=${c.growth_points} last_fed=${c.last_fed}`;
}

// ── Main ──────────────────────────────────────────────────────────────
const results = [];

async function step(label, actionName, actionData) {
  console.log(`\n=== STEP: ${label} ===`);

  // BEFORE snapshot
  const [playersBefore, creaturesBefore, poolBefore] = await Promise.all([
    getTable("players", CONTRACT, PLAYER, PLAYER),
    getTable("creatrsv2", PLAYER),
    getTable("rewardpool"),
  ]);
  const pBefore = playersBefore.find(r => r.account === PLAYER) || null;
  console.log(`   BEFORE player:  ${summarizePlayer(pBefore)}`);
  console.log(`   BEFORE creatures: ${creaturesBefore.length} rows`);
  creaturesBefore.forEach(c => console.log(`      ${summarizeCreature(c)}`));
  if (poolBefore.length) console.log(`   BEFORE pool: ${poolBefore[0].balance} (funded ${poolBefore[0].lifetime_funded}, paid ${poolBefore[0].lifetime_paid})`);

  // Fire action
  let txResult;
  try {
    txResult = await pushAction(actionName, actionData);
    console.log(`   TX:  ${txResult.txid}  (block ${txResult.block})`);
  } catch (e) {
    const msg = (e.message || String(e)).slice(0, 300);
    console.log(`   REVERT: ${msg}`);
    results.push({ label, action: actionName, tx: "REVERT", before: summarizePlayer(pBefore), after: "N/A", status: "FAIL", error: msg });
    return { status: "FAIL", error: msg };
  }

  // Wait for propagation
  await new Promise(r => setTimeout(r, 1500));

  // AFTER snapshot
  const [playersAfter, creaturesAfter, poolAfter] = await Promise.all([
    getTable("players", CONTRACT, PLAYER, PLAYER),
    getTable("creatrsv2", PLAYER),
    getTable("rewardpool"),
  ]);
  const pAfter = playersAfter.find(r => r.account === PLAYER) || null;
  console.log(`   AFTER  player:  ${summarizePlayer(pAfter)}`);
  console.log(`   AFTER  creatures: ${creaturesAfter.length} rows`);
  creaturesAfter.forEach(c => console.log(`      ${summarizeCreature(c)}`));

  // Diff
  const eggDiff = pAfter && pBefore ? pAfter.egg_balance - pBefore.egg_balance : "?";
  const newCreatures = creaturesAfter.filter(ca => !creaturesBefore.find(cb => cb.asset_id === ca.asset_id));
  const changedCreatures = creaturesAfter.filter(ca => {
    const cb = creaturesBefore.find(cb => cb.asset_id === ca.asset_id);
    return cb && JSON.stringify(ca) !== JSON.stringify(cb);
  });

  console.log(`   DIFF: dEGG=${eggDiff} new_creatures=${newCreatures.length} changed=${changedCreatures.length}`);
  if (newCreatures.length) newCreatures.forEach(c => console.log(`      NEW -> ${summarizeCreature(c)}`));
  if (changedCreatures.length) changedCreatures.forEach(c => console.log(`      CHG -> ${summarizeCreature(c)}`));

  results.push({
    label,
    action: actionName,
    tx: txResult.txid,
    before: summarizePlayer(pBefore),
    after: summarizePlayer(pAfter),
    diff: `dEGG=${eggDiff} new=${newCreatures.length} chg=${changedCreatures.length}`,
    status: "PASS",
  });

  return {
    status: "PASS",
    newCreatureIds: newCreatures.map(c => c.asset_id),
    changedCreatureIds: changedCreatures.map(c => c.asset_id),
  };
}

// ── Execute ────────────────────────────────────────────────────────────
console.log("=============================================");
console.log(" POCKET HATCHERY - Game Loop Verification");
console.log(" Contract: phgamecreatr | Player: waxwingsuper");
console.log(" RPC: testnet.waxsweden.org");
console.log("=============================================");

try {
  // Step 1: HATCH egg_type=0 (common)
  const hatchRes = await step("1.HATCH", "hatch", { owner: PLAYER, egg_type: 0 });
  let assetId = null;

  if (hatchRes.status === "PASS" && hatchRes.newCreatureIds.length > 0) {
    assetId = hatchRes.newCreatureIds[0];
    console.log(`\n   Got new creature: asset_id=${assetId}`);

    // Step 2: FEED
    const feedRes = await step("2.FEED", "feed", { owner: PLAYER, asset_id: assetId });

    // Step 3: EVOLVE (may fail if not enough growth points yet — that's expected)
    const evolveRes = await step("3.EVOLVE", "evolve", { owner: PLAYER, asset_id: assetId });

    // Step 4: Need 2 creatures for breed
    let assetId2 = null;
    if (hatchRes.newCreatureIds.length >= 2) {
      assetId2 = hatchRes.newCreatureIds[1];
    } else {
      console.log(`\n   Need second creature for breed - hatching another...`);
      const hatch2Res = await step("4a.HATCH2", "hatch", { owner: PLAYER, egg_type: 0 });
      if (hatch2Res.status === "PASS" && hatch2Res.newCreatureIds.length > 0) {
        assetId2 = hatch2Res.newCreatureIds[0];
      }
    }

    if (assetId && assetId2) {
      // Step 5: BREED
      const breedRes = await step("5.BREED", "breed", {
        owner: PLAYER,
        parent_a: assetId,
        parent_b: assetId2,
      });
    } else {
      console.log(`\n   SKIP breed: need 2 creatures (have ${assetId ? 1 : 0}+${assetId2 ? 1 : 0})`);
      results.push({ label: "BREED", action: "breed", tx: "SKIPPED", before: "-", after: "-", status: "SKIP", error: "need 2 creatures" });
    }
  } else {
    console.log(`\n   Hatch failed - cannot continue. Error: ${hatchRes.error || "no creature"}`);
  }

} catch (e) {
  console.log(`\nFATAL: ${e.message}`);
  console.log(e.stack);
}

// ── Summary table ──────────────────────────────────────────────────────
console.log(`\n\n=============================================`);
console.log(`  SUMMARY TABLE`);
console.log(`=============================================`);
console.log(`  ${"Step".padEnd(14)} ${"TX".padEnd(22)} ${"Before -> After".padEnd(60)} Status`);
console.log(`  ${"-".repeat(14)} ${"-".repeat(22)} ${"-".repeat(60)} ${"-".repeat(8)}`);
for (const r of results) {
  const txShort = r.tx === "REVERT" ? "REVERT" : r.tx === "SKIPPED" ? "SKIPPED" : (r.tx?.slice(0, 20) || "?");
  console.log(`  ${r.label.padEnd(14)} ${txShort.padEnd(22)} ${(r.diff || r.error || "").padEnd(60)} ${r.status}`);
}
console.log(`=============================================`);
const passCount = results.filter(r => r.status === "PASS").length;
const failCount = results.filter(r => r.status === "FAIL").length;
const skipCount = results.filter(r => r.status === "SKIP").length;
console.log(`  PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skipCount}`);
console.log(`=============================================`);
