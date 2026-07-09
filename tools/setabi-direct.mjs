#!/usr/bin/env node
/**
 * setabi for phgamecreatr — use raw serialized transaction via waxwing
 *
 * Strategy: Instead of passing structured data to pushaction,
 * serialize the setabi action using eosjs, then send the raw transaction
 * to waxwing for signing and broadcasting.
 */
const fs = require("fs");

const RPC = "https://testnet.waxsweden.org";
const CONTRACT = "phgamecreatr";
const ABI_PATH = "../contract/pockethatch/build/pockethatch.abi";

async function main() {
  // Read ABI
  const abiJson = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
  const abiText = JSON.stringify(abiJson);
  console.log(`ABI text: ${abiText.length} bytes`);

  // Use waxwing pushaction with _raw hex data instead of structured data
  const DAEMON = "http://127.0.0.1:8787";
  const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;

  // Try passing ABI as base64 instead of hex
  const abiBase64 = Buffer.from(abiText, "utf8").toString("base64");
  console.log(`ABI base64: ${abiBase64.length} chars`);

  // Method: use cleos get_abi format and redeploy correctly
  // Actually let's try: pass the ABI text as the abi field directly (not hex-encoded)
  // waxwing with wharfkit should treat a string as the correct type for bytes

  async function wax(cmd, args = "") {
    const body = JSON.stringify({ cmd, args });
    const res = await fetch(WAXWING, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    return await res.json();
  }

  // Try approach: setabi with the raw ABI text (not hex-encoded)
  // In wharfkit, bytes can be provided as hex string, Uint8Array, or base64
  // Let's try multiple approaches

  // Approach 1: direct text (waxwing might handle it)
  console.log("\n🔧 Attempt 1: raw text as abi field...");
  let r = await wax("pushaction", JSON.stringify({
    network: "wax-testnet",
    from: CONTRACT,
    contract: "eosio",
    action: "setabi",
    data: {
      account: CONTRACT,
      abi: abiText,
    },
  }));
  console.log(r.ok ? "✅ OK" : `❌ ${r.msg?.substring(0, 150)}`);

  // Approach 2: hex string
  console.log("\n🔧 Attempt 2: hex string...");
  const abiHex = Buffer.from(abiText, "utf8").toString("hex");
  r = await wax("pushaction", JSON.stringify({
    network: "wax-testnet",
    from: CONTRACT,
    contract: "eosio",
    action: "setabi",
    data: {
      account: CONTRACT,
      abi: abiHex,
    },
  }));
  console.log(r.ok ? "✅ OK" : `❌ ${r.msg?.substring(0, 150)}`);

  // Verify
  console.log("\n🔍 Verifying ABI...");
  const verify = await fetch(`${RPC}/v1/chain/get_abi`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account_name: CONTRACT }),
  }).then(r => r.json());

  if (verify.abi) {
    console.log(`✅ ABI OK: ${verify.abi.length} chars`);
  } else if (verify.error) {
    console.log(`❌ ABI error: ${verify.error.what?.substring(0, 150)}`);
  } else {
    console.log(`❌ Unknown: ${JSON.stringify(verify).substring(0, 200)}`);
  }
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
