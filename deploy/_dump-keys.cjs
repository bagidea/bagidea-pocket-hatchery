// Decrypt every private key in the waxwing keystore (wax-testnet bucket) and
// write each to the WSL home ~/.ph/<account>@<perm>.key — NOT to the repo.
// Run with node (Windows). Used only to import into a local keosd wallet for deploy.
const fs = require("fs");
const path = require("path");

const KEYSTORE = "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/data/keystore.json";
const KSMOD = "E:/Projects/bagidea-ai-agents-office/plugins/waxwing/keystore.js";
const PASSWORD = process.env.HATCH_KEYSTORE_PW;
if (!PASSWORD) { console.error("ERROR: HATCH_KEYSTORE_PW env var not set"); process.exit(1); }
const OUTDIR = "//wsl.localhost/Ubuntu/home/bagidea/.ph";

const { decrypt } = require(KSMOD);
const store = JSON.parse(fs.readFileSync(KEYSTORE, "utf8"));
const bucket = store.byNet["wax-testnet"];
if (!bucket) { console.error("no wax-testnet bucket"); process.exit(1); }

let n = 0;
for (const acct of bucket.accounts) {
  let key;
  try { key = decrypt(acct, PASSWORD); }
  catch (e) { console.log(`SKIP ${acct.account}@${acct.permission}: ${e.message}`); continue; }
  if (!key) { console.log(`SKIP ${acct.account}@${acct.permission}: null`); continue; }
  const fn = `${acct.account}@${acct.permission}.key`;
  fs.writeFileSync(path.join(OUTDIR, fn), key + "\n");
  // print only a fingerprint, never the full key
  console.log(`wrote ${fn}  (${acct.account}  fingerprint=${key.slice(0, 7)}…${key.slice(-4)})`);
  n++;
}
console.log(`done: ${n} keys → ${OUTDIR}`);
