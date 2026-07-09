/**
 * Pack the ABI using abi_def binary format, then submit via waxwing pushaction.
 */
const fs = require('fs');
const path = require('path');
const eosjsDist = path.resolve(__dirname, '../deploy/nodejs/node_modules/eosjs/dist');
const ser = require(eosjsDist + '/eosjs-serialize.js');

const { SerialBuffer, createInitialTypes, getTypesFromAbi } = ser;
const DAEMON = 'http://127.0.0.1:8787';
const WAXWING = DAEMON + '/plugin/wax-wallet/cmd';

async function main() {
  // Read ABI and ensure all abi_def fields exist
  const abiObj = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../contract/pockethatch/build/pockethatch.abi'), 'utf8'
  ));
  // Ensure all abi_def fields exist
  abiObj.error_messages = abiObj.error_messages || [];
  abiObj.abi_extensions = abiObj.abi_extensions || [];
  abiObj.variants = abiObj.variants || [];
  abiObj.action_results = abiObj.action_results || [];

  // Define the base eosio ABI that defines abi_def
  const eosioAbi = {
    version: "eosio::abi/1.0",
    types: [
      { new_type_name: "type_name", type: "string" },
      { new_type_name: "field_name", type: "string" },
      { new_type_name: "action_name", type: "name" },
      { new_type_name: "table_name", type: "name" },
    ],
    structs: [
      {
        name: "abi_def", base: "",
        fields: [
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
        ],
      },
      { name: "type_def", base: "", fields: [{ name: "new_type_name", type: "string" }, { name: "type", type: "string" }] },
      { name: "field_def", base: "", fields: [{ name: "name", type: "string" }, { name: "type", type: "string" }] },
      { name: "struct_def", base: "", fields: [{ name: "name", type: "string" }, { name: "base", type: "string" }, { name: "fields", type: "field_def[]" }] },
      { name: "action_def", base: "", fields: [{ name: "name", type: "action_name" }, { name: "type", type: "string" }, { name: "ricardian_contract", type: "string" }] },
      { name: "table_def", base: "", fields: [{ name: "name", type: "table_name" }, { name: "index_type", type: "string" }, { name: "key_names", type: "string[]" }, { name: "key_types", type: "string[]" }, { name: "type", type: "string" }] },
      { name: "clause_pair", base: "", fields: [{ name: "id", type: "string" }, { name: "body", type: "string" }] },
      { name: "error_message", base: "", fields: [{ name: "error_code", type: "uint64" }, { name: "error_msg", type: "string" }] },
      { name: "abi_extension", base: "", fields: [{ name: "type", type: "uint16" }, { name: "data", type: "bytes" }] },
      { name: "variant_def", base: "", fields: [{ name: "name", type: "string" }, { name: "types", type: "string[]" }] },
      { name: "action_result_def", base: "", fields: [{ name: "name", type: "action_name" }, { name: "result_type", type: "string" }] },
    ],
    actions: [], tables: [], ricardian_clauses: [], error_messages: [], abi_extensions: [], variants: [],
  };

  // Create types and pack ABI
  const builtinTypes = getTypesFromAbi(createInitialTypes(), eosioAbi);
  const buf = new SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
  const abiDefType = builtinTypes.get('abi_def');

  if (!abiDefType) {
    console.error('abi_def type not found!');
    return;
  }

  console.log('Packing ABI...');
  abiDefType.serialize(buf, abiObj);
  const packedBytes = buf.asUint8Array();
  console.log('Packed:', packedBytes.length, 'bytes (from', JSON.stringify(abiObj).length, 'bytes JSON)');

  // Hex encode
  const packedHex = Buffer.from(packedBytes).toString('hex');

  // Unlock
  console.log('\nUnlocking...');
  await fetch(WAXWING, {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({cmd:'unlock', args:process.env.HATCH_KEYSTORE_PW})
  }).then(r => r.json()).then(r => console.log(r.ok ? '✅ unlocked' : '❌ '+r.msg));

  // Submit setabi
  console.log('Deploying packed ABI...');
  const body = JSON.stringify({
    cmd: 'pushaction',
    args: JSON.stringify({
      network: 'wax-testnet',
      from: 'phgamecreatr',
      contract: 'eosio',
      action: 'setabi',
      data: { account: 'phgamecreatr', abi: packedHex }
    })
  });

  const res = await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body });
  const r = await res.json();
  console.log(r.ok ? '✅ tx: '+(r.txId||'').substring(0,20) : '❌ '+(r.msg||'').substring(0,200));

  // Verify
  await new Promise(r => setTimeout(r, 4000));
  console.log('\nVerifying...');
  const vres = await fetch('https://testnet.waxsweden.org/v1/chain/get_abi', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({account_name:'phgamecreatr'})
  });
  const v = JSON.parse(await vres.text());
  if (v.abi) {
    console.log('✅ ABI works!');

    // Test initplayer
    console.log('\nTesting initplayer...');
    const tbody = JSON.stringify({
      cmd: 'pushaction',
      args: JSON.stringify({
        network: 'wax-testnet', from: 'phgamecreatr',
        contract: 'phgamecreatr', action: 'initplayer',
        data: { owner: 'waxwingsuper' }
      })
    });
    const tr = await (await fetch(WAXWING, { method: 'POST', headers: {'content-type':'application/json'}, body: tbody })).json();
    console.log(tr.ok ? '✅ initplayer works!' : '❌ '+(tr.msg||'').substring(0,200));
  } else {
    console.log('❌', v.error?.what?.substring(0,200) || JSON.stringify(v).substring(0,200));
  }
}

main().catch(e => console.error('FATAL:', e.message));
