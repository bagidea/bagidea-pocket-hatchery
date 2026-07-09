/**
 * setabi for phgamecreatr — bypass waxwing pushaction for the ABI storage issue.
 * Uses waxwing's decrypted key to sign the eosio::setabi transaction directly.
 */
const fs = require('fs');
const path = require('path');

// Load eosjs from deploy/nodejs/node_modules
const eosjsPath = path.resolve(__dirname, '../deploy/nodejs/node_modules/eosjs/dist');
const { Api, JsonRpc, Serialize } = require(eosjsPath + '/eosjs-api.js');
const { JsSignatureProvider } = require(eosjsPath + '/eosjs-jssig.js');
const { TextEncoder, TextDecoder } = require('util');

// Load key from waxwing keystore
const KEYSTORE_PATH = 'E:/Projects/bagidea-ai-agents-office/plugins/waxwing/data/keystore.json';
const KEYSTORE_PW = process.env.HATCH_KEYSTORE_PW;
if (!KEYSTORE_PW) { console.error("ERROR: HATCH_KEYSTORE_PW env var not set"); process.exit(1); }

// Load decrypt function
const keystore = require('E:/Projects/bagidea-ai-agents-office/plugins/waxwing/keystore.js');

const RPC_URL = 'https://testnet.waxsweden.org';
const CONTRACT = 'phgamecreatr';
const ABI_PATH = path.resolve(__dirname, '../contract/pockethatch/build/pockethatch.abi');

async function main() {
  // Get the private key for phgamecreatr
  const store = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf8'));
  const netBucket = store.byNet['wax-testnet'];
  if (!netBucket) throw new Error('No wax-testnet bucket');

  let privKey = null;
  for (const acct of netBucket.accounts) {
    if (acct.account === CONTRACT) {
      privKey = keystore.decrypt(acct, KEYSTORE_PW);
      console.log(`Found key for ${CONTRACT}: ${privKey.substring(0, 7)}...`);
      break;
    }
  }
  if (!privKey) throw new Error(`No key found for ${CONTRACT}`);

  // Setup eosjs
  const rpc = new JsonRpc(RPC_URL, { fetch });
  const sigProvider = new JsSignatureProvider([privKey]);
  const api = new Api({ rpc, signatureProvider: sigProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

  // Read ABI file
  const abiObj = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
  const abiText = JSON.stringify(abiObj);
  console.log(`ABI: ${abiText.length} bytes`);

  // Get chain info for TAPoS
  const info = await rpc.get_info();
  const block = await rpc.get_block(info.last_irreversible_block_num);
  console.log(`Chain head: ${info.head_block_num}, lib: ${info.last_irreversible_block_num}`);

  // Build transaction
  const tx = {
    expiration: new Date(info.head_block_time + 'Z').getTime() / 1000 + 120,
    ref_block_num: info.last_irreversible_block_num & 0xFFFF,
    ref_block_prefix: block.ref_block_prefix,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [{
      account: 'eosio',
      name: 'setabi',
      authorization: [{ actor: CONTRACT, permission: 'active' }],
      data: {
        account: CONTRACT,
        abi: Buffer.from(abiText, 'utf8').toString('hex'),
      },
    }],
    transaction_extensions: [],
  };

  console.log('Building and signing transaction...');
  const signed = await api.transact({ actions: tx.actions }, {
    broadcast: false,
    sign: true,
    blocksBehind: 3,
    expireSeconds: 120,
  });

  // Push to chain
  console.log('Pushing transaction...');
  const result = await api.pushSignedTransaction(signed);
  console.log('✅ setabi tx:', result.transaction_id);
  console.log('explorer: https://testnet.waxblock.io/transaction/' + result.transaction_id);

  // Wait
  await new Promise(r => setTimeout(r, 4000));

  // Verify
  console.log('\nVerifying ABI...');
  try {
    const abiCheck = await rpc.get_abi(CONTRACT);
    console.log('✅ ABI works!', JSON.stringify(abiCheck.abi).length, 'bytes');

    // Test a simple action
    console.log('\nTesting initplayer...');
    // Now waxwing should work since ABI is fixed
    const DAEMON = 'http://127.0.0.1:8787';
    const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';
    const body = JSON.stringify({
      cmd: 'pushaction',
      args: JSON.stringify({
        network: 'wax-testnet',
        from: CONTRACT,
        contract: CONTRACT,
        action: 'initplayer',
        data: { owner: 'waxwingsuper' }
      })
    });
    const fres = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
    const fr = await fres.json();
    console.log(fr.ok ? '✅ initplayer works!' : '❌ ' + (fr.msg||'').substring(0,200));
  } catch (e) {
    console.log('❌ ABI check failed:', e.message?.substring(0, 200));
  }
}

main().catch(e => console.error('FATAL:', e.message));
