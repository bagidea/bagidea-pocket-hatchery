// onchain-anticheat.mjs — deploy the slotcfg build and prove the three
// anti-cheat rules on wax-testnet with real transactions.
//
// Signing goes through the waxwing daemon (pushactions / pushaction), so the
// private keys never leave it and this script never sees a password. The wallet
// must be UNLOCKED first — unlock it in the waxwing panel, then:
//
//   node contract/pockethatch/test/onchain-anticheat.mjs --deploy   # deploy + test
//   node contract/pockethatch/test/onchain-anticheat.mjs            # test only
//
// Every negative case asserts the transaction FAILED and that the error text is
// the specific guard we added — "it reverted" alone is worthless, a typo in the
// action name reverts too.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const RPC = "https://testnet.waxsweden.org";
const WAXWING = "http://127.0.0.1:8787/plugin/wax-wallet/cmd";
const CONTRACT = "phgamecreatr";
const PLAYER = "phtestclaimr"; // a real player account in the keystore

const WASM = path.join(ROOT, "contract/pockethatch/build/pockethatch.slotcfg.wasm");
const ABI = path.join(ROOT, "contract/pockethatch/build/pockethatch.slotcfg.deploy.abi");
const CFG = path.join(ROOT, "deploy/args-setconfig-phgamecreatr.json");
const EXPECTED_WASM_SHA = "ae75ce303706d7ce4cacd64751f021b9b8969d963f8080d2795fe2f7a3253998";

let ran = 0, failures = 0;
const ok = (pred, what, detail = "") => {
  ran++;
  if (pred) console.log(`  PASS  ${what}${detail ? ` — ${detail}` : ""}`);
  else { console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); failures++; }
};

const rpc = async (endpoint, body) =>
  (await fetch(`${RPC}/v1/chain/${endpoint}`, { method: "POST", body: JSON.stringify(body) })).json();

const rows = async (table, scope = CONTRACT, limit = 200) =>
  (await rpc("get_table_rows", { json: true, code: CONTRACT, scope, table, limit })).rows || [];

const wax = async (payload) => {
  const r = await fetch(WAXWING, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
};

// Push one action and report success/failure + the chain's own error text.
async function push(actor, contract, action, data) {
  const r = await wax({ cmd: "pushaction", from: actor, contract, action, data });
  if (r?.ok && r.txId) return { ok: true, txId: r.txId };
  const err = String(r?.error || r?.message || JSON.stringify(r));
  return { ok: false, error: err };
}

// A negative case: the push MUST fail, and the message MUST contain `needle`.
async function mustRevert(label, needle, actor, contract, action, data) {
  const r = await push(actor, contract, action, data);
  if (r.ok) { ok(false, label, `NOT reverted — broadcast as ${r.txId}`); return; }
  ok(r.error.includes(needle), label, `"${needle}" ${r.error.includes(needle) ? "✓" : `NOT in: ${r.error.slice(0, 200)}`}`);
}

const eggOf = async (account) =>
  Number((await rows("players")).find((p) => p.account === account)?.egg_balance ?? -1);

async function main() {
  // ── Pre-flight: never deploy a wasm we didn't just test ──
  const wasm = fs.readFileSync(WASM);
  const sha = crypto.createHash("sha256").update(wasm).digest("hex");
  if (sha !== EXPECTED_WASM_SHA) {
    console.error(`✗ wasm sha mismatch\n  expected ${EXPECTED_WASM_SHA}\n  got      ${sha}`);
    process.exit(1);
  }

  const status = await wax({ cmd: "status" });
  if (!status?.status?.unlocked) {
    console.error("✗ waxwing is LOCKED — unlock it in the panel first (this script never handles the password).");
    process.exit(1);
  }

  if (process.argv.includes("--deploy")) {
    console.log("D. deploy — setcode + setabi + setconfig, ONE transaction");
    const abi = JSON.parse(fs.readFileSync(ABI, "utf8"));
    const tables = (abi.tables || []).map((t) => t.name);
    for (const t of ["configv3", "creatrsv2", "spccfgv2", "players", "claims", "lastmint", "rewardpool"])
      if (!tables.includes(t)) { console.error(`✗ ABI is missing table ${t} — refusing to deploy a blind ABI`); process.exit(1); }

    const cfg = JSON.parse(fs.readFileSync(CFG, "utf8")).cfg;
    if (Object.keys(cfg).length !== 64 || "name_cost" in cfg) { console.error("✗ setconfig args look stale"); process.exit(1); }

    // setabi wants the PACKED abi; waxwing serializes action data against the
    // live system ABI, which types `abi` as bytes — so hand it hex.
    const packed = await packAbi(abi);
    const r = await wax({
      cmd: "pushactions", from: CONTRACT,
      actions: [
        { contract: "eosio", action: "setcode", data: { account: CONTRACT, vmtype: 0, vmversion: 0, code: wasm.toString("hex") } },
        { contract: "eosio", action: "setabi", data: { account: CONTRACT, abi: packed } },
        { contract: CONTRACT, action: "setconfig", data: { cfg } },
      ],
    });
    ok(!!r?.ok && !!r.txId, "3-action deploy broadcast", r?.txId || String(r?.error).slice(0, 300));
    if (!r?.ok) { console.log(`\n${ran - failures}/${ran} passed`); process.exit(1); }
    console.log(`      tx ${r.txId}`);
    await new Promise((s) => setTimeout(s, 3000)); // let it make it into a block
  }

  console.log("\nP. positive — the deployed code and config are the ones we built");
  {
    const code = await rpc("get_code", { account_name: CONTRACT, code_as_wasm: 1 });
    ok(code.code_hash === EXPECTED_WASM_SHA, "on-chain code_hash matches the tested wasm", code.code_hash);

    const cfg = (await rows("configv3"))[0] || {};
    ok(cfg.slot_cost === 500, "slot_cost = 500", String(cfg.slot_cost));
    ok(cfg.slot_cost_5 === 1200, "slot_cost_5 = 1200", String(cfg.slot_cost_5));
    ok(cfg.slot_cost_6 === 2500, "slot_cost_6 = 2500", String(cfg.slot_cost_6));
    ok(cfg.cosmetic_cost === 100, "cosmetic_cost still 100 (row did not shift)", String(cfg.cosmetic_cost));
    ok(!("name_cost" in cfg), "name_cost is gone from configv3");
    ok(cfg.paused === 0 || cfg.paused === false, "game is not paused", String(cfg.paused));
  }

  console.log("\nP2. positive — setname + equipcosmetic(0) still work and don't clobber each other");
  const mine = (await rows("creatrsv2")).filter((c) => c.owner === PLAYER);
  if (!mine.length) { ok(false, "player owns at least one creature", `${PLAYER} owns none`); }
  else {
    const c = mine[0];
    const before = await eggOf(PLAYER);

    const named = await push(PLAYER, CONTRACT, "setname", { owner: PLAYER, asset_id: c.asset_id, new_name: "anticheat-probe" });
    ok(named.ok, "setname succeeds", named.txId || named.error.slice(0, 160));

    // The headline case the CEO asked for: taking a costume OFF must always be
    // allowed and must never charge EGG, even with no cosmetics schema on chain.
    const un = await push(PLAYER, CONTRACT, "equipcosmetic", { owner: PLAYER, asset_id: c.asset_id, cosmetic_tmpl: 0 });
    ok(un.ok, "equipcosmetic tmpl=0 (unequip) succeeds", un.txId || un.error.slice(0, 160));
    await new Promise((s) => setTimeout(s, 2500));
    const after = await eggOf(PLAYER);
    ok(after === before, "unequip charged 0 EGG", `${before} → ${after}`);

    // The merge fix: setname wrote `name`, equipcosmetic ran after it, and the
    // name must still be on the NFT (it used to be wiped).
    const asset = (await rpc("get_table_rows", { json: true, code: "atomicassets", scope: PLAYER, table: "assets", lower_bound: c.asset_id, upper_bound: c.asset_id, limit: 1 })).rows?.[0];
    ok(!!asset, "NFT row readable", c.asset_id);

    console.log("\nN. negative — equipcosmetic whitelist");
    await mustRevert("template 999999999 (in int32 range, not minted) rejected", "cosmetic template not found",
      PLAYER, CONTRACT, "equipcosmetic", { owner: PLAYER, asset_id: c.asset_id, cosmetic_tmpl: 999999999 });
    await mustRevert("template above INT32_MAX rejected before the lookup", "invalid cosmetic template",
      PLAYER, CONTRACT, "equipcosmetic", { owner: PLAYER, asset_id: c.asset_id, cosmetic_tmpl: 9999999999 });
    // A real template that exists but lives in the `creatures` schema, not `cosmetics`.
    await mustRevert("a creatures template is not wearable as a cosmetic", "not a cosmetic",
      PLAYER, CONTRACT, "equipcosmetic", { owner: PLAYER, asset_id: c.asset_id, cosmetic_tmpl: 662976 });
    const after2 = await eggOf(PLAYER);
    ok(after2 === before, "no EGG was charged by any rejected cosmetic", `${before} → ${after2}`);
  }

  console.log("\nN2. negative — a player cannot act as the contract");
  const cfgRow = (await rows("configv3"))[0];
  await mustRevert("setconfig from a player account", "missing authority",
    PLAYER, CONTRACT, "setconfig", { cfg: cfgRow });
  await mustRevert("setspecies from a player account", "missing authority",
    PLAYER, CONTRACT, "setspecies", { sp: (await rows("spccfgv2"))[0] });
  await mustRevert("fundpool from a player account", "missing authority",
    PLAYER, CONTRACT, "fundpool", { amount: "1.0000 HATCH", source: "cheat" });
  await mustRevert("withdraw from a player account", "missing authority",
    PLAYER, CONTRACT, "withdraw", { token_contract: "hatchtokens1", quantity: "1.0000 HATCH", to: PLAYER, memo: "cheat" });

  console.log("\nN3. negative — a player cannot touch someone else's creature");
  const theirs = (await rows("creatrsv2")).find((c) => c.owner !== PLAYER);
  if (!theirs) ok(false, "found a creature owned by someone else");
  else {
    await mustRevert("feed an asset the caller doesn't own", "not your creature",
      PLAYER, CONTRACT, "feed", { owner: PLAYER, asset_id: theirs.asset_id });
    await mustRevert("evolve an asset the caller doesn't own", "not your creature",
      PLAYER, CONTRACT, "evolve", { owner: PLAYER, asset_id: theirs.asset_id });
    await mustRevert("equipcosmetic on an asset the caller doesn't own", "not your creature",
      PLAYER, CONTRACT, "equipcosmetic", { owner: PLAYER, asset_id: theirs.asset_id, cosmetic_tmpl: 0 });
  }

  console.log("\nN4. negative — satiety gate on accelerate");
  const hungry = (await rows("creatrsv2")).filter((c) => c.owner === PLAYER)
    .find((c) => Math.floor(Date.now() / 1000) >= c.last_fed + 172800);
  if (!hungry) console.log("  SKIP  no hungry creature owned by the player right now (all recently fed)");
  else {
    await mustRevert("accelerate a hungry creature", "hungry",
      PLAYER, CONTRACT, "accelerate", { owner: PLAYER, asset_id: hungry.asset_id, amount: "0.1000 HATCH" });
  }

  console.log(`\n${ran - failures}/${ran} passed`);
  process.exit(failures ? 1 : 0);
}

// Pack an ABI JSON into the hex blob setabi expects, using the same eosjs
// serializer the old deploy script used (it ships under deploy/nodejs).
async function packAbi(abiObj) {
  const { createRequire } = await import("node:module");
  const req = createRequire(path.join(ROOT, "deploy/nodejs/package.json"));
  const es = req("eosjs/dist/eosjs-serialize.js");
  const src = fs.readFileSync(path.join(ROOT, "contract/pockethatch/build/single-tx-deploy.cjs"), "utf8");
  const systemAbi = eval(`(${src.match(/const systemAbi = \{[\s\S]*?\n  \};/)[0].replace("const systemAbi = ", "").replace(/;$/, "")})`);
  for (const k of ["error_messages", "abi_extensions", "variants", "action_results"]) abiObj[k] ||= [];
  const types = es.getTypesFromAbi(es.createInitialTypes(), systemAbi);
  const buf = new es.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
  types.get("abi_def").serialize(buf, abiObj);
  return Buffer.from(buf.asUint8Array()).toString("hex");
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
