/**
 * compose-multi-action-tx.js
 *
 * Compose a single transaction with 3 actions for phgamecreatr deploy:
 *   1. eosio::setcode   — deploy wasm
 *   2. eosio::setabi    — deploy ABI (creatrsv2/spccfgv2)
 *   3. phgamecreatr::setconfig — config entry (same tx = atomic, prevents read-past-end)
 *
 * Usage (DRY RUN — no sign, no broadcast):
 *   node compose-multi-action-tx.js --dry-run
 *   node compose-multi-action-tx.js --output payload.json
 *
 * Usage (SERIALIZE — verify tx can be built, no sign):
 *   node compose-multi-action-tx.js --serialize
 *
 * Usage (SIGN + BROADCAST — requires private key):
 *   node compose-multi-action-tx.js --sign <PRIVATE_KEY> [--broadcast]
 *
 * Env vars:
 *   PH_WASM    — path to wasm (default: ../../contract/pockethatch/build/pockethatch.wasm)
 *   PH_ABI     — path to ABI (default: ../../contract/pockethatch/build/pockethatch.merged.abi)
 *   PH_CONFIG  — path to config JSON (default: ../args-setconfig.json)
 *   PH_RPC     — RPC endpoint (default: https://waxtestnet.greymass.com)
 */

const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

// Resolve paths relative to this script
const ROOT = __dirname;
const WASM_PATH = process.env.PH_WASM || path.join(ROOT, '..', '..', 'contract', 'pockethatch', 'build', 'pockethatch.wasm');
const ABI_PATH  = process.env.PH_ABI  || path.join(ROOT, '..', '..', 'contract', 'pockethatch', 'build', 'pockethatch.abi');
const CONFIG_PATH = process.env.PH_CONFIG || path.join(ROOT, '..', 'args-setconfig-phgamecreatr.json');
const RPC = process.env.PH_RPC || 'https://waxtestnet.greymass.com';

const ACCOUNT = 'phgamecreatr';       // contract account
const PERMISSION = `${ACCOUNT}@active`;

function readWasmHex(filePath) {
  const buf = readFileSync(filePath);
  return buf.toString('hex');
}

function readAbiHex(filePath) {
  // setabi on eosio expects the ABI as hex-encoded JSON string
  const json = readFileSync(filePath, 'utf8');
  // Parse to validate, then re-stringify compact, then hex-encode
  const parsed = JSON.parse(json);
  const compact = JSON.stringify(parsed);
  return Buffer.from(compact, 'utf8').toString('hex');
}

function readConfig(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  // Extract just the config row, dropping _note / _boss_locked metadata
  if (raw.cfg) return raw.cfg;
  return raw;
}

function buildActions(wasmHex, abiHex, configObj) {
  const actions = [];

  // Action 1: eosio::setcode
  actions.push({
    account: 'eosio',
    name: 'setcode',
    authorization: [{ actor: ACCOUNT, permission: 'active' }],
    data: {
      account: ACCOUNT,
      vmtype: 0,
      vmversion: 0,
      code: wasmHex,
    },
  });

  // Action 2: eosio::setabi
  actions.push({
    account: 'eosio',
    name: 'setabi',
    authorization: [{ actor: ACCOUNT, permission: 'active' }],
    data: {
      account: ACCOUNT,
      abi: abiHex,
    },
  });

  // Action 3: phgamecreatr::setconfig
  actions.push({
    account: ACCOUNT,
    name: 'setconfig',
    authorization: [{ actor: ACCOUNT, permission: 'active' }],
    data: {
      cfg: configObj,
    },
  });

  return actions;
}

async function dryRun(actions) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MULTI-ACTION DEPLOY TX — DRY RUN (no sign, no broadcast)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Account   : ${ACCOUNT}`);
  console.log(`  RPC       : ${RPC}`);
  console.log(`  Actions   : ${actions.length}`);
  console.log('');

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    console.log(`── Action ${i + 1}/${actions.length}: ${a.account}::${a.name} ──`);
    console.log(`   Authorization: ${JSON.stringify(a.authorization)}`);

    if (a.name === 'setcode') {
      const codeLen = a.data.code.length;
      console.log(`   data.account: ${a.data.account}`);
      console.log(`   data.code   : <hex, ${(codeLen / 2).toLocaleString()} bytes>`);
      // Show first + last 32 hex chars
      console.log(`   data.code   : ${a.data.code.slice(0, 32)}...${a.data.code.slice(-32)}`);
    } else if (a.name === 'setabi') {
      const abiLen = a.data.abi.length;
      console.log(`   data.account: ${a.data.account}`);
      console.log(`   data.abi    : <hex, ${(abiLen / 2).toLocaleString()} bytes>`);
      // Decode a bit of the hex to show it's valid JSON
      try {
        const decoded = Buffer.from(a.data.abi, 'hex').toString('utf8');
        const abiObj = JSON.parse(decoded);
        console.log(`   ABI version : ${abiObj.version}`);
        console.log(`   ABI tables  : ${abiObj.tables.map(t => t.name).join(', ')}`);
        console.log(`   ABI actions : ${abiObj.actions.length} actions`);
      } catch (e) {
        console.log(`   ⚠️ ABI decode failed: ${e.message}`);
      }
    } else if (a.name === 'setconfig') {
      console.log(`   data.cfg: ${JSON.stringify(a.data.cfg, null, 2).slice(0, 500)}...`);
    }
    console.log('');
  }

  // Also output the full JSON for machine consumption
  const payload = {
    account: ACCOUNT,
    permission: PERMISSION,
    rpc: RPC,
    actions: actions.map(a => ({
      ...a,
      data: a.name === 'setcode'
        ? { ...a.data, code: `<${(a.data.code.length / 2).toLocaleString()} bytes hex>` }
        : a.name === 'setabi'
        ? { ...a.data, abi: `<${(a.data.abi.length / 2).toLocaleString()} bytes hex>` }
        : a.data,
    })),
  };

  console.log('── Full review payload (JSON) ──');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  return payload;
}

async function composeSerialized(actions) {
  // Use eosjs to serialize the transaction (requires chain connection for ABIs)
  const { Api, JsonRpc } = require('eosjs');

  const rpc = new JsonRpc(RPC, { fetch });

  // Fetch ABIs needed for serialization
  console.log('Fetching ABIs from chain for serialization...');
  await rpc.get_abi('eosio');
  await rpc.get_abi(ACCOUNT);

  const info = await rpc.get_info();
  const headBlock = await rpc.get_block(info.head_block_id);

  const api = new Api({
    rpc,
    signatureProvider: null,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });

  const serializedActions = await api.serializeActions(actions);
  console.log('  Actions serialized:', serializedActions.length, 'actions');

  // Build expiration as ISO string (eosjs expects this format)
  const headTime = new Date(info.head_block_time + 'Z');
  const expTime = new Date(headTime.getTime() + 300 * 1000);
  const expiration = expTime.toISOString().replace('Z', '').replace(/\\.\\d+/, '');

  const tx = {
    expiration,
    ref_block_num: headBlock.block_num & 0xffff,
    ref_block_prefix: headBlock.ref_block_prefix,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: serializedActions,
    transaction_extensions: [],
  };

  console.log('  expiration:', expiration);

  return { tx, info, api };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
(async () => {
  const args = process.argv.slice(2);
  const mode = args[0] || '--dry-run';
  const privKey = mode === '--sign' ? args[1] : null;
  const broadcast = args.includes('--broadcast');
  const outputFile = mode === '--output' ? args[1] : null;

  // Read artifacts
  console.log(`Reading wasm  : ${WASM_PATH}`);
  const wasmHex = readWasmHex(WASM_PATH);
  console.log(`  → ${(wasmHex.length / 2).toLocaleString()} bytes hex`);

  console.log(`Reading ABI  : ${ABI_PATH}`);
  const abiHex = readAbiHex(ABI_PATH);
  console.log(`  → ${(abiHex.length / 2).toLocaleString()} bytes hex`);

  console.log(`Reading config: ${CONFIG_PATH}`);
  const configObj = readConfig(CONFIG_PATH);
  console.log(`  → ${Object.keys(configObj).length} fields`);

  // Build actions
  const actions = buildActions(wasmHex, abiHex, configObj);

  if (mode === '--dry-run') {
    const payload = await dryRun(actions);
    if (outputFile) {
      writeFileSync(outputFile, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`Wrote review payload to ${outputFile}`);
    }
  } else if (mode === '--serialize') {
    // Serialize the tx to verify it can be built (no signing)
    const { tx } = await composeSerialized(actions);
    const serializedSizes = tx.actions.map(a => a.data.length);
    console.log('\n✅ Transaction serialized successfully (unsigned).');
    console.log('   Action sizes (hex):', serializedSizes.join(', '));
    console.log('   Total actions:', tx.actions.length);
    console.log('   Ready for signing.');
  } else if (mode === '--sign') {
    if (!privKey) {
      console.error('ERROR: --sign requires a private key argument');
      process.exit(1);
    }

    const { tx, info } = await composeSerialized(actions);

    // Sign the transaction
    const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
    const { Api, JsonRpc } = require('eosjs');
    const signatureProvider = new JsSignatureProvider([privKey]);
    const rpc = new JsonRpc(RPC, { fetch });
    const api = new Api({
      rpc,
      signatureProvider,
      textDecoder: new TextDecoder(),
      textEncoder: new TextEncoder(),
    });

    const serializedTx = api.serializeTransaction(tx);
    const requiredKeys = await signatureProvider.getAvailableKeys();
    const signed = await signatureProvider.sign({
      chainId: info.chain_id,
      requiredKeys,
      serializedTransaction: serializedTx,
      abis: [],
    });

    const pushTx = {
      ...tx,
      signatures: signed.signatures,
    };

    console.log('  Signatures:', signed.signatures.length);

    if (broadcast) {
      console.log('Broadcasting transaction...');
      const result = await rpc.push_transaction(pushTx);
      console.log('✅ TX broadcast!');
      console.log(`   txid: ${result.transaction_id}`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('═══════════════════════════════════════════════════════');
      console.log('  SIGNED TX (not broadcast — --broadcast not set)');
      console.log('═══════════════════════════════════════════════════════');
      const summary = {
        txid_hint: 'signatures present, ready to broadcast',
        expiration: pushTx.expiration,
        ref_block_num: pushTx.ref_block_num,
        signatures_count: pushTx.signatures.length,
        actions: pushTx.actions.map(a => ({
          account: a.account,
          name: a.name,
          data_hex_bytes: a.data.length,
        })),
      };
      console.log(JSON.stringify(summary, null, 2));
      if (outputFile) {
        writeFileSync(outputFile, JSON.stringify(pushTx, null, 2), 'utf8');
        console.log(`Wrote signed tx to ${outputFile}`);
      }
    }
  } else {
    console.error(`Unknown mode: ${mode}. Use --dry-run, --serialize, --output <file>, or --sign <key> [--broadcast]`);
    process.exit(1);
  }

  console.log('\n✅ Done.');
})().catch(err => {
  console.error('❌ ERROR:', err.message || err);
  process.exit(1);
});
