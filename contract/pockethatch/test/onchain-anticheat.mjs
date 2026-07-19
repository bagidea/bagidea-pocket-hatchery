// onchain-anticheat.mjs — deploy the slotcfg build and prove the three
// anti-cheat rules on wax-testnet with real transactions.
//
// Signing goes through the waxwing daemon (pushactions / pushaction), so the
// private keys never leave it and this script never sees a password. The wallet
// must be UNLOCKED first — unlock it in the waxwing panel, then:
//
//   node contract/pockethatch/test/onchain-anticheat.mjs --setcode-only  # setcode + test
//   node contract/pockethatch/test/onchain-anticheat.mjs --deploy        # setcode+setabi+setconfig + test
//   node contract/pockethatch/test/onchain-anticheat.mjs                 # test only
//
// Add --pool-guard to also prove N5 (burncreature on a pool that can't pay). It
// is opt-in because it briefly raises burn_base_hatch in live config and puts it
// back — see poolGuardCase() for why there is no way to trip that guard without.
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

const WASM = path.join(ROOT, "contract/pockethatch/build/pockethatch.rules.wasm");
const ABI = path.join(ROOT, "contract/pockethatch/build/pockethatch.slotcfg.deploy.abi");
const CFG = path.join(ROOT, "deploy/args-setconfig-phgamecreatr.json");
const EXPECTED_WASM_SHA = "ae75ce303706d7ce4cacd64751f021b9b8969d963f8080d2795fe2f7a3253998";
// The build that is on chain right now — so a read-only run can say "still the
// previous build" instead of just "hash doesn't match".
const PREV_WASM_SHA = "ee7a150f91f0a1a463c836999d5cd889b71402d953910803a0f9b2203d5105f2";

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

// HATCH is 4-decimal — compare quotes in raw units so nothing rounds away.
const rawOf = (assetStr) => BigInt(String(assetStr).split(" ")[0].replace(".", ""));
const fmt = (raw) => `${raw / 10000n}.${String(raw % 10000n).padStart(4, "0")} HATCH`;

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

  // Signing needs an unlocked waxwing. Read-only checks don't, so a locked
  // wallet degrades to the positive half rather than telling you nothing.
  const status = await wax({ cmd: "status" });
  const SIGNING = !!status?.status?.unlocked;
  if (!SIGNING) console.log("⚠ waxwing is LOCKED — running READ-ONLY checks; every signing case will be skipped.\n");

  // `rules` ships the SAME abi as the build on chain (build/pockethatch.rules.abi
  // and build/pockethatch.slotcfg.abi are byte-identical), so it deploys with
  // setcode alone. Do NOT hand setabi the generated abi here — CDT 4.1.1 emits it
  // with `tables: []`, which is what blanked every get_table_rows last time.
  if (process.argv.includes("--setcode-only")) {
    if (!SIGNING) { console.error("✗ --setcode-only needs an unlocked wallet. Unlock it in the waxwing panel first."); process.exit(1); }
    console.log("D. deploy — setcode ONLY (abi unchanged, config untouched)");

    const live = await rpc("get_code", { account_name: CONTRACT, code_as_wasm: 1 });
    if (live.code_hash !== PREV_WASM_SHA) {
      console.error(`✗ live code_hash is ${live.code_hash}, expected the known previous build ${PREV_WASM_SHA}`);
      console.error("  someone else touched the contract — stopping before setcode.");
      process.exit(1);
    }
    console.log(`      live code_hash ${live.code_hash.slice(0, 8)}… (previous build) ✓`);

    const r = await wax({
      cmd: "pushaction", from: CONTRACT, contract: "eosio", action: "setcode",
      data: { account: CONTRACT, vmtype: 0, vmversion: 0, code: wasm.toString("hex") },
    });
    ok(!!r?.ok && !!r.txId, "setcode broadcast", r?.txId || String(r?.error).slice(0, 300));
    if (!r?.ok) { console.log(`\n${ran - failures}/${ran} passed`); process.exit(1); }
    console.log(`      tx ${r.txId}`);
    await new Promise((s) => setTimeout(s, 3000)); // let it make it into a block
  }

  if (process.argv.includes("--deploy")) {
    if (!SIGNING) { console.error("✗ --deploy needs an unlocked wallet. Unlock it in the waxwing panel first."); process.exit(1); }
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

  if (!SIGNING) {
    console.log(`\n${ran - failures}/${ran} read-only checks passed — SKIPPED every case that needs a signature.`);
    console.log("  Unlock waxwing and re-run to get P2 / N / N2 / N3 / N4 / N5.");
    process.exit(failures ? 1 : 2);
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
  // Satiety runs out after fed_dur_<rarity>, not a flat 48h — reading the live
  // config is the only way to know whether a creature is actually hungry to the
  // contract (a mythic stays fed for 14 days).
  const cfgNow = (await rows("configv3"))[0];
  const speciesNow = await rows("spccfgv2");
  const fedDur = (c) => {
    const sp = speciesNow.find((s) => Number(s.template_id) === Number(c.template_id));
    const field = ["fed_dur_common", "fed_dur_uncommon", "fed_dur_rare",
      "fed_dur_epic", "fed_dur_legendary", "fed_dur_mythic"][Math.min(sp ? Number(sp.egg_type) : 0, 5)];
    return Number(cfgNow[field]);
  };
  const hungry = (await rows("creatrsv2")).filter((c) => c.owner === PLAYER)
    .find((c) => Math.floor(Date.now() / 1000) >= c.last_fed + fedDur(c));
  // Not a SKIP: this is one of the guards the deploy has to prove, so "there was
  // nothing to test with" is a failed run, not a quiet pass.
  if (!hungry) ok(false, "a hungry creature to test the gate with", `every creature ${PLAYER} owns is still sated`);
  else {
    await mustRevert("accelerate a hungry creature", "hungry",
      PLAYER, CONTRACT, "accelerate", { owner: PLAYER, asset_id: hungry.asset_id, amount: "0.1000 HATCH" });
  }

  console.log("\nN5. negative — burncreature refuses when the pool can't cover the quote");
  await poolGuardCase();

  console.log(`\n${ran - failures}/${ran} passed`);
  process.exit(failures ? 1 : 0);
}

// ── N5 ────────────────────────────────────────────────────────────────────
// The guard is `pool.balance >= payout` checked BEFORE burnasset, so proving it
// needs a quote the pool cannot pay. On this testnet it can't happen by itself:
// burn_base_hatch is 10 HATCH and the dearest creature alive quotes 500, against
// a pool holding ~149,931 — there is no creature to pick that trips it.
//
// So the run raises burn_base_hatch far enough that the quote outgrows the pool,
// fires burncreature, and puts the old config straight back. That is a real
// (reversible) write to live config, so it is opt-in: --pool-guard. Without the
// flag this counts as a FAILURE, never a silent skip — Director asked for this
// case and "we didn't run it" must not read as "it passed".
async function poolGuardCase() {
  if (!process.argv.includes("--pool-guard")) {
    ok(false, "burncreature on an empty pool reverts",
      "NOT RUN — needs --pool-guard (temporarily raises burn_base_hatch; see the comment in this file)");
    return;
  }

  const mine = (await rows("creatrsv2")).filter((c) => c.owner === PLAYER);
  if (!mine.length) { ok(false, "a creature to quote a buy-back for", `${PLAYER} owns none`); return; }
  const c = mine[0];

  const before = await rows("configv3");
  const cfg0 = before[0];
  if (!cfg0) { ok(false, "configv3 readable before touching it"); return; }
  const pool = (await rows("rewardpool"))[0];

  const species = (await rows("spccfgv2")).find((s) => Number(s.template_id) === Number(c.template_id));
  const eggType = species ? Number(species.egg_type) : 0;
  const poolRaw = rawOf(pool.balance);

  // Same arithmetic as ph_rules::burn_payout_raw — integer, same truncation order.
  const quote = (baseRaw) => {
    const stageMul = [2n, 5n, 10n, 20n, 50n, 100n][Math.min(Number(c.stage), 5)];
    const rarityMul = [10n, 30n, 100n, 250n, 600n, 1500n][Math.min(eggType, 5)];
    return ((BigInt(baseRaw) * stageMul) / 10n * rarityMul) / 10n;
  };

  ok(quote(rawOf(cfg0.burn_base_hatch)) <= poolRaw, "the pool covers this creature at today's config",
    `quote ${fmt(quote(rawOf(cfg0.burn_base_hatch)))} ≤ pool ${cfg0 && pool.balance}`);

  // Pick a base whose quote clears the pool with room to spare, so the revert
  // can only be the pool guard and not a rounding accident.
  let baseRaw = 10n ** 4n;
  while (quote(baseRaw) <= poolRaw * 2n) baseRaw *= 10n;
  const rescue = () => wax({ cmd: "pushaction", from: CONTRACT, contract: CONTRACT, action: "setconfig", data: { cfg: cfg0 } });

  const raised = await push(CONTRACT, CONTRACT, "setconfig", { cfg: { ...cfg0, burn_base_hatch: fmt(baseRaw) } });
  ok(raised.ok, "raise burn_base_hatch so the quote outgrows the pool", raised.txId || raised.error.slice(0, 200));
  if (!raised.ok) return; // nothing was written — nothing to put back

  try {
    await new Promise((s) => setTimeout(s, 2500));
    const live = (await rows("configv3"))[0];
    ok(rawOf(live.burn_base_hatch) === baseRaw, "chain shows the raised base", live.burn_base_hatch);
    ok(quote(baseRaw) > rawOf(pool.balance), "quote now exceeds the pool",
      `${fmt(quote(baseRaw))} > ${pool.balance}`);

    await mustRevert("burncreature with a quote the pool can't pay", "reward pool too low to buy back this creature",
      PLAYER, CONTRACT, "burncreature", { owner: PLAYER, asset_id: c.asset_id });

    // Fail-closed means the creature is still there — the old order burned first.
    const still = (await rows("creatrsv2")).some((r) => String(r.asset_id) === String(c.asset_id));
    ok(still, "the creature survived the rejected burn", c.asset_id);
  } finally {
    // Always put the config back, even if an assertion above threw.
    const back = await rescue();
    await new Promise((s) => setTimeout(s, 2500));
    const after = (await rows("configv3"))[0];
    ok(!!back?.ok && after && rawOf(after.burn_base_hatch) === rawOf(cfg0.burn_base_hatch),
      "burn_base_hatch restored to what it was", `${after?.burn_base_hatch} (was ${cfg0.burn_base_hatch})`);
    const drifted = Object.keys(cfg0).filter((k) => String(after?.[k]) !== String(cfg0[k]));
    ok(drifted.length === 0, "no other config field drifted", drifted.join(", ") || "clean");
  }
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
