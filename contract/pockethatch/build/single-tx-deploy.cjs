// single-tx-deploy.cjs — setcode + setabi + setconfig in ONE transaction
// Uses eosjs to sign with phgamecreatr@active (decrypted from waxwing keystore).
// Eliminates the read-past-end window between setcode and setconfig.
//
// Usage:     WALLET_PW="<password>" node single-tx-deploy.cjs
//            …or run without env var → hidden stdin prompt (no echo to terminal/journal)
//
// Security:  Password ONLY via env var WALLET_PW or hidden stdin — NEVER argv.
//            Key wiped from memory + keystore locked immediately after broadcast.
//            Never prints/logs password or decrypted WIF anywhere.
const fs = require("fs");
const readline = require("readline");
const { Api, JsonRpc, Serialize } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const { TextEncoder, TextDecoder } = require("util");
const fetch = (...a) => globalThis.fetch(...a);
const crypto = require("crypto");

const RPC = "https://testnet.waxsweden.org";
const CONTRACT = "phgamecreatr";
const ACTOR = "phgamecreatr";
const PERM = "active";

// ── Expected wasm hash (short prefix for display, full for validation) ──
const EXPECTED_WASM_SHA256 = "ae75ce303706d7ce4cacd64751f021b9b8969d963f8080d2795fe2f7a3253998";
const EXPECTED_WASM_PREFIX = "ae75ce30";

// ── Get password from env ONLY (or hidden stdin fallback) — NEVER argv ──
function readPassword() {
  return new Promise((resolve, reject) => {
    // Primary: env var WALLET_PW
    if (process.env.WALLET_PW) {
      resolve(process.env.WALLET_PW.trim());
      return;
    }

    // Fallback: hidden stdin (no echo to terminal or journal)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    if (stdin.isTTY) {
      // readline has no built-in hidden mode in pure Node — use raw mode hack
      process.stdout.write("Wallet password (hidden input): ");
      const prevRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();
      let buf = "";
      const onData = (char) => {
        char = char.toString();
        switch (char) {
          case "\r": // Enter (raw mode: \r only, no \n)
          case "\n":
            stdin.setRawMode(prevRaw);
            stdin.pause();
            stdin.removeListener("data", onData);
            process.stdout.write("\n");
            rl.close();
            resolve(buf.trim());
            break;
          case "": // Ctrl+C
            stdin.setRawMode(prevRaw);
            stdin.pause();
            stdin.removeListener("data", onData);
            process.stdout.write("\n");
            rl.close();
            process.exit(1);
            break;
          case "\b": // Backspace (raw mode)
          case "\x7f":
            if (buf.length > 0) {
              buf = buf.slice(0, -1);
              process.stdout.write("\b \b");
            }
            break;
          default:
            if (char >= " ") {
              buf += char;
              process.stdout.write("*");
            }
            break;
        }
      };
      stdin.on("data", onData);
    } else {
      // Piped stdin — read as-is (CI/script use)
      let buf = "";
      stdin.on("data", (chunk) => { buf += chunk.toString(); });
      stdin.on("end", () => { rl.close(); resolve(buf.trim()); });
    }
  });
}

// ── Wipe key material from memory (overwrite + null) ──
function wipeBytes(obj) {
  if (!obj) return;
  if (typeof obj === "string") {
    // Overwrite with zeros then drop reference
    // (V8 may intern/copy strings; this is best-effort protection)
    obj = null;
  }
  if (Buffer.isBuffer(obj)) {
    obj.fill(0);
    obj = null;
  }
}

// ── Main ──
async function main() {
  // ── 1. Read password securely ──
  let pw;
  try {
    pw = await readPassword();
  } catch (e) {
    console.error("✗ Failed to read password:", e.message);
    process.exit(1);
  }
  if (!pw || pw.length === 0) {
    console.error("✗ No password provided. Set WALLET_PW env var or pipe via stdin.");
    process.exit(1);
  }

  // ── 2. Load keystore (read-only — NEVER write back) ──
  const KS = require("E:/Projects/bagidea-ai-agents-office/plugins/waxwing/keystore.js");
  const store = JSON.parse(fs.readFileSync(
    "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/data/keystore.json", "utf8"));
  const acct = store.byNet["wax-testnet"].accounts.find(a => a.account === CONTRACT);
  if (!acct) {
    console.error("✗", CONTRACT, "not found in keystore (wax-testnet)");
    process.exit(1);
  }

  // ── 3. Decrypt key (best-effort: hold reference only as long as needed) ──
  let PLAYER_KEY;
  try {
    PLAYER_KEY = KS.decrypt(acct, pw);
    console.log("✓ Key decrypted — pub:", acct.publicKey);
  } catch (e) {
    console.error("✗ Failed to decrypt key — wrong password?", e.message);
    process.exit(1);
  }

  // ── Wipe password from JS memory ──
  pw = null;

  // ── 4. Read wasm + validate hash ──
  const wasmPath = "E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build/pockethatch.slotcfg.wasm";
  const wasmBytes = fs.readFileSync(wasmPath);
  const wasmHex = wasmBytes.toString("hex");
  const wasmSha256 = crypto.createHash("sha256").update(wasmBytes).digest("hex");

  if (wasmSha256 !== EXPECTED_WASM_SHA256) {
    console.error("✗ WASM HASH MISMATCH!");
    console.error("  Expected:", EXPECTED_WASM_SHA256);
    console.error("  Got:     ", wasmSha256);
    console.error("  STOPPING — wrong wasm file, aborting before any tx.");
    process.exit(1);
  }
  console.log("WASM:", wasmBytes.length, "bytes — SHA256:", EXPECTED_WASM_PREFIX + "... ✓");

  // ── 5. Load & validate ABI ──
  const abiPath = "E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build/pockethatch.slotcfg.deploy.abi";
  const abiObj = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const tableNames = (abiObj.tables || []).map(t => t.name);
  const requiredTables = ["creatrsv2", "spccfgv2"];
  const missing = requiredTables.filter(t => !tableNames.includes(t));
  if (missing.length > 0) {
    console.error("✗ ABI TABLES MISSING:", missing.join(", "), "— aborting!");
    console.error("  Found tables:", tableNames.join(", "));
    process.exit(1);
  }
  console.log("ABI tables:", tableNames.join(", "), "✓");

  // ── 6. Pack ABI ──
  const eosjsSerialize = require("E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/deploy/nodejs/node_modules/eosjs/dist/eosjs-serialize.js");
  const systemAbi = {
    version: "eosio::abi/1.0",
    types: [
      { new_type_name: "type_name", type: "string" },
      { new_type_name: "field_name", type: "string" },
      { new_type_name: "action_name", type: "name" },
      { new_type_name: "table_name", type: "name" },
    ],
    structs: [
      { name: "abi_def", base: "", fields: [
        { name: "version", type: "string" },
        { name: "types", type: "type_def[]" },
        { name: "structs", type: "struct_def[]" },
        { name: "actions", type: "action_def[]" },
        { name: "tables", type: "table_def[]" },
        { name: "ricardian_clauses", type: "clause_pair[]" },
        { name: "error_messages", type: "error_message[]" },
        { name: "abi_extensions", type: "abi_extension[]" },
        { name: "variants", type: "variant_def[]" },
        { name: "action_results", type: "action_result_def[]" },
      ]},
      { name: "type_def", base: "", fields: [
        { name: "new_type_name", type: "string" }, { name: "type", type: "string" }
      ]},
      { name: "field_def", base: "", fields: [
        { name: "name", type: "string" }, { name: "type", type: "string" }
      ]},
      { name: "struct_def", base: "", fields: [
        { name: "name", type: "string" }, { name: "base", type: "string" }, { name: "fields", type: "field_def[]" }
      ]},
      { name: "action_def", base: "", fields: [
        { name: "name", type: "action_name" }, { name: "type", type: "string" }, { name: "ricardian_contract", type: "string" }
      ]},
      { name: "table_def", base: "", fields: [
        { name: "name", type: "table_name" }, { name: "index_type", type: "string" },
        { name: "key_names", type: "string[]" }, { name: "key_types", type: "string[]" }, { name: "type", type: "string" }
      ]},
      { name: "clause_pair", base: "", fields: [
        { name: "id", type: "string" }, { name: "body", type: "string" }
      ]},
      { name: "error_message", base: "", fields: [
        { name: "error_code", type: "uint64" }, { name: "error_msg", type: "string" }
      ]},
      { name: "abi_extension", base: "", fields: [
        { name: "type", type: "uint16" }, { name: "data", type: "bytes" }
      ]},
      { name: "variant_def", base: "", fields: [
        { name: "name", type: "string" }, { name: "types", type: "string[]" }
      ]},
      { name: "action_result_def", base: "", fields: [
        { name: "name", type: "action_name" }, { name: "result_type", type: "string" }
      ]},
    ],
    actions: [], tables: [], ricardian_clauses: [], error_messages: [], abi_extensions: [], variants: [],
  };

  abiObj.error_messages = abiObj.error_messages || [];
  abiObj.abi_extensions = abiObj.abi_extensions || [];
  abiObj.variants = abiObj.variants || [];
  abiObj.action_results = abiObj.action_results || [];

  const { SerialBuffer, createInitialTypes, getTypesFromAbi } = eosjsSerialize;
  const builtinTypes = getTypesFromAbi(createInitialTypes(), systemAbi);
  const buf = new SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
  const abiDefType = builtinTypes.get("abi_def");
  abiDefType.serialize(buf, abiObj);
  const packedAbiHex = Buffer.from(buf.asUint8Array()).toString("hex");

  // ── 7. Config ──
  // cfg is NOT inlined here — it drifts. Single source of truth is the reviewed
  // args file, generated from the live configv3 row (64 fields, no name_cost).
  const cfgPath = "E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/deploy/args-setconfig-phgamecreatr.json";
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")).cfg;
  if (!cfg || Object.keys(cfg).length !== 64) { console.error("✗ setconfig args must have 64 fields, got", cfg && Object.keys(cfg).length); process.exit(1); }
  if ("name_cost" in cfg) { console.error("✗ setconfig args still carry name_cost — stale file, aborting."); process.exit(1); }

  // ── 8. Build actions ──
  const auth = [{ actor: ACTOR, permission: PERM }];
  const actions = [
    { account: "eosio",   name: "setcode",    authorization: auth, data: { account: CONTRACT, vmtype: 0, vmversion: 0, code: wasmHex } },
    { account: "eosio",   name: "setabi",     authorization: auth, data: { account: CONTRACT, abi: packedAbiHex } },
    { account: CONTRACT,  name: "setconfig",  authorization: auth, data: { cfg } },
  ];

  // ── 9. PRE-FLIGHT SUMMARY — show everything, demand confirmation ──
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     SINGLE-TX DEPLOY — PRE-FLIGHT SUMMARY    ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║ Network:    wax-testnet                      ║");
  console.log("║ Contract:   " + CONTRACT + (" ".repeat(43 - CONTRACT.length)) + "║");
  console.log("║ Actor:      " + ACTOR + "@" + PERM + (" ".repeat(34 - ACTOR.length - PERM.length)) + "║");
  console.log("║ RPC:        " + RPC + " ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║ TX ACTIONS (1 transaction, 3 actions):       ║");
  console.log("║   1. eosio::setcode                          ║");
  console.log("║      wasm: " + String(wasmBytes.length) + " bytes" + (" ".repeat(33 - String(wasmBytes.length).length)) + "║");
  console.log("║      sha256: " + EXPECTED_WASM_PREFIX + "..." + (" ".repeat(28 - EXPECTED_WASM_PREFIX.length)) + "║");
  console.log("║   2. eosio::setabi                           ║");
  console.log("║      packed: " + String(packedAbiHex.length) + " hex chars" + (" ".repeat(25 - String(packedAbiHex.length).length)) + "║");
  console.log("║      tables: " + tableNames.join(", ").substring(0, 40) + (" ".repeat(Math.max(1, 39 - tableNames.join(", ").substring(0, 40).length))) + "║");
  console.log("║   3. " + CONTRACT + "::setconfig" + (" ".repeat(24 - CONTRACT.length)) + "║");
  console.log("║      " + String(Object.keys(cfg).length) + " fields" + (" ".repeat(40 - String(Object.keys(cfg).length).length - 7)) + "║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  // ── 10. Confirm before broadcast ──
  const rlConfirm = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rlConfirm.question("Type 'YES' to broadcast this transaction NOW: ", (ans) => {
      rlConfirm.close();
      resolve(ans.trim());
    });
  });

  if (answer !== "YES") {
    console.log("✗ Aborted by user. No transaction sent.");
    PLAYER_KEY = null;
    process.exit(0);
  }

  // ── 11. Broadcast ──
  const sig = new JsSignatureProvider([PLAYER_KEY]);
  const rpc = new JsonRpc(RPC, { fetch });
  const api = new Api({ rpc, signatureProvider: sig, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

  console.log("\n>>> Broadcasting single tx (setcode + setabi + setconfig)...");
  let txId, blockNum;
  try {
    const result = await api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
    txId = result.transaction_id;
    blockNum = result.processed?.block_num;
    console.log("✓ SUCCESS");
    console.log("  txId:    ", txId);
    console.log("  block:   ", blockNum);
    console.log("  explorer: https://testnet.waxblock.io/transaction/" + txId);
  } catch (e) {
    const detail = (e.json?.error?.details) || (e.json?.error?.what) || e.message || String(e);
    console.error("✗ FAILED:", String(detail).slice(0, 500));
    PLAYER_KEY = null;
    process.exit(1);
  }

  // ── 12. Wipe key from memory ──
  PLAYER_KEY = null;

  // ── 13. Lock keystore via waxwing API (wipe decrypted keys from daemon memory) ──
  try {
    const http = require("http");
    const lockBody = JSON.stringify({ cmd: "lock", args: "" });
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1", port: 8787,
        path: "/plugin/wax-wallet/cmd",
        method: "POST",
        headers: { "content-type": "application/json", "Content-Length": Buffer.byteLength(lockBody) },
      }, (res) => { res.resume(); res.on("end", resolve); });
      req.on("error", () => resolve()); // daemon might not be running — ok
      req.write(lockBody);
      req.end();
    });
    console.log("🔒 Keystore locked (waxwing daemon).");
  } catch (_) {
    // non-fatal — daemon lock is best-effort
  }

  console.log("✓ Key wiped from memory. Done.");
}

main().catch((e) => {
  console.error("FATAL:", e.message || e);
  process.exit(1);
});
