#!/usr/bin/env node
/**
 * Fix phgamecreatr ABI — try different encodings
 */
const fs = require("fs");
const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;

async function wax(cmd, args = "") {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return await res.json();
}

async function push(from, contract, action, data) {
  const args = JSON.stringify({ network: "wax-testnet", from, contract, action, data });
  return wax("pushaction", args);
}

async function main() {
  const abiJson = JSON.parse(fs.readFileSync("../contract/pockethatch/build/pockethatch.abi", "utf8"));
  const abiRaw = JSON.stringify(abiJson);

  console.log(`ABI size: ${abiRaw.length} bytes`);

  // Try 1: hex-encoded (what deploy.mjs used — may have caused corruption)
  const abiHex = Buffer.from(abiRaw, "utf8").toString("hex");
  console.log(`Hex size: ${abiHex.length} chars`);

  console.log("\n🔧 Attempting setabi with hex encoding...");
  let r = await push("phgamecreatr", "eosio", "setabi", {
    account: "phgamecreatr",
    abi: abiHex,
  });
  console.log(r.ok ? "   ✅ OK" : `   ❌ ${r.msg}`);

  // Verify
  const verify = await fetch("https://testnet.waxsweden.org/v1/chain/get_abi", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account_name: "phgamecreatr" }),
  }).then(r => r.json());

  if (verify.abi) {
    console.log(`   Verified: ABI ${verify.abi.length} chars`);
  } else {
    console.log(`   Verify FAILED: ${JSON.stringify(verify).substring(0, 200)}`);
  }
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
