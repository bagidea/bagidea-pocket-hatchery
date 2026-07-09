#!/usr/bin/env node
/**
 * pack-abi-dry.mjs — Dry-test ABI packing for phgamecreatr
 * ==========================================================
 * Packs the contract ABI as abi_def binary (using eosjs) and PROVES correctness
 * WITHOUT broadcasting. Verifies all three verification points:
 *
 *   (1) Pack ABI correctly → first byte must be varuint32 of "eosio::abi/1.X"
 *       (e.g. 0x0F) NOT 0x7B (ASCII '{') that the old broken scripts produce
 *   (2) Length comparison: packed binary << JSON text
 *   (3) Check current on-chain ABI (get_raw_abi + get_abi) — does old ABI decode?
 *
 * ⚠️  THIS SCRIPT DOES NOT BROADCAST. CEO must unlock phgamecreatr first.
 *
 * Usage:
 *   node tools/pack-abi-dry.mjs
 *
 * Dependencies:
 *   eosjs in deploy/nodejs/node_modules (already installed)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── config ──────────────────────────────────────────────────────────
const RPC = 'https://testnet.waxsweden.org';
const HYPERION = 'https://testnet.waxsweden.org';  // same node, v2 history
const CONTRACT = 'phgamecreatr';
const ABI_PATH = path.resolve(__dirname, '../contract/pockethatch/build/pockethatch.abi');

// ── eosjs serialization (same approach as pack-abi.cjs) ─────────────
function loadEosjs() {
  const eosjsDist = path.resolve(__dirname, '../deploy/nodejs/node_modules/eosjs/dist');
  return require(eosjsDist + '/eosjs-serialize.js');
}

/**
 * Build the eosio system ABI that defines abi_def (minimal).
 * This matches what cleos uses internally to pack the ABI.
 */
function buildSystemAbi() {
  return {
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
}

/**
 * Pack ABI JSON → abi_def binary.
 * Returns { packedHex, packedBytes, abiObj }
 */
function packAbi(abiPath) {
  const { SerialBuffer, createInitialTypes, getTypesFromAbi } = loadEosjs();

  // Read and prepare ABI object
  const abiObj = JSON.parse(readFileSync(abiPath, 'utf8'));
  // Ensure all abi_def fields exist
  abiObj.error_messages = abiObj.error_messages || [];
  abiObj.abi_extensions = abiObj.abi_extensions || [];
  abiObj.variants = abiObj.variants || [];
  abiObj.action_results = abiObj.action_results || [];

  // Build serializer types from system ABI
  const builtinTypes = getTypesFromAbi(createInitialTypes(), buildSystemAbi());
  const buf = new SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() });
  const abiDefType = builtinTypes.get('abi_def');

  if (!abiDefType) throw new Error('abi_def type not found in builtin types');

  abiDefType.serialize(buf, abiObj);
  const packedBytes = buf.asUint8Array();
  const packedHex = Buffer.from(packedBytes).toString('hex');

  return { packedHex, packedBytes, abiObj };
}

/**
 * Analyse first bytes of packed output.
 * The first field of abi_def is `version` (string), serialized as varuint32 length + data.
 * "eosio::abi/1.2" = 15 chars → first byte = 0x0F
 */
function analyseFirstBytes(packedHex, packedBytes) {
  const firstByte = packedBytes[0];
  const firstByteHex = firstByte.toString(16).padStart(2, '0');

  // Try to read the version string (varuint32 length-prefixed)
  // varuint32: read bytes until MSB=0
  let len = 0;
  let shift = 0;
  let pos = 0;
  while (pos < packedBytes.length) {
    const b = packedBytes[pos++];
    len |= (b & 0x7f) << shift;
    shift += 7;
    if ((b & 0x80) === 0) break;
    if (shift >= 35) break; // safety
  }

  const versionStr = new TextDecoder().decode(packedBytes.slice(pos, pos + len));
  const isCorrect = firstByte !== 0x7B; // 0x7B = '{' = JSON text (WRONG)

  return {
    firstByteHex: `0x${firstByteHex}`,
    firstByteDec: firstByte,
    isCorrect,
    versionStr,
    varuintLen: len,
    varuintBytes: pos,
  };
}

// ── RPC helpers ──────────────────────────────────────────────────────
async function rpc(endpoint, body) {
  const res = await fetch(`${RPC}/v1/chain/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function hyperionGetActions(account, pos = -1, offset = -1) {
  const url = `${HYPERION}/v2/history/get_actions?account=${account}&filter=eosio:setabi&limit=3&sort=desc`;
  const res = await fetch(url);
  return res.json();
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(65));
  console.log('  PACK ABI DRY-TEST — phgamecreatr');
  console.log('  Verify packing WITHOUT broadcasting');
  console.log('═'.repeat(65));

  // ═══════════════════════════════════════════════════════════════════
  // (1) PACK ABI CORRECTLY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Step 1: Pack ABI as abi_def binary ──');

  let packedHex, packedBytes, abiObj;
  try {
    ({ packedHex, packedBytes, abiObj } = packAbi(ABI_PATH));
    console.log(`   ✅ Packed successfully`);
  } catch (e) {
    console.log(`   ❌ Pack failed: ${e.message}`);
    process.exit(1);
  }

  const jsonText = JSON.stringify(abiObj);
  console.log(`   ABI JSON:  ${jsonText.length.toLocaleString()} bytes`);
  console.log(`   Packed:    ${packedBytes.length.toLocaleString()} bytes`);
  console.log(`   Ratio:     ${((packedBytes.length / jsonText.length) * 100).toFixed(1)}%`);
  console.log(`   Hex:       ${packedHex.length.toLocaleString()} chars`);

  // ═══════════════════════════════════════════════════════════════════
  // (2) DRY-TEST: First byte analysis
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Step 2: First-byte analysis ──');

  const analysis = analyseFirstBytes(packedHex, packedBytes);
  console.log(`   First byte:   ${analysis.firstByteHex} (${analysis.firstByteDec})`);
  console.log(`   Version str:  "${analysis.versionStr}"`);
  console.log(`   Varuint size: ${analysis.varuintBytes} byte(s)`);

  if (analysis.isCorrect) {
    console.log(`   ✅ PASS: First byte is ${analysis.firstByteHex} (varuint of version string)`);
    console.log(`      NOT 0x7B "{". This IS correctly packed abi_def.`);
  } else {
    console.log(`   ❌ FAIL: First byte is 0x7B = ASCII '{{'. This would be raw JSON — WRONG!`);
    process.exit(1);
  }

  // Show first 32 bytes of packed hex
  const preview = packedHex.slice(0, 64).match(/.{1,2}/g).join(' ');
  console.log(`   Packed preview: ${preview}...`);

  // Compare: what the OLD broken scripts would produce
  const oldBrokenHex = Buffer.from(jsonText, 'utf8').toString('hex');
  const oldFirstByte = Buffer.from(jsonText, 'utf8')[0];
  console.log(`\n   ── Comparison with OLD broken scripts ──`);
  console.log(`   Old (hex-encode JSON):`);
  console.log(`     First byte: 0x${oldFirstByte.toString(16)} = ASCII '${String.fromCharCode(oldFirstByte)}'`);
  console.log(`     Length:     ${oldBrokenHex.length.toLocaleString()} chars (hex)`);
  console.log(`     Bytes:      ${jsonText.length.toLocaleString()} (JSON text length)`);
  console.log(`   New (packed abi_def):`);
  console.log(`     First byte: 0x${packedBytes[0].toString(16).padStart(2, '0')} = varuint length prefix`);
  console.log(`     Length:     ${packedHex.length.toLocaleString()} chars (hex)`);
  console.log(`     Bytes:      ${packedBytes.length.toLocaleString()} (packed binary)`);
  console.log(`   Savings:     ${(jsonText.length - packedBytes.length).toLocaleString()} bytes (${((1 - packedBytes.length / jsonText.length) * 100).toFixed(1)}%)`);

  // ═══════════════════════════════════════════════════════════════════
  // (3) VERIFY CURRENT ON-CHAIN ABI (the corrupted one)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Step 3: Current on-chain ABI diagnostics ──');

  // 3a: get_raw_abi — get the raw bytes
  console.log('   3a: get_raw_abi...');
  let rawAbiBytes = null;
  let rawAbiIsJson = false;
  let rawAbiFirstByte = null;
  try {
    const rawAbi = await rpc('get_raw_abi', { account_name: CONTRACT });
    if (rawAbi.abi) {
      let rawData = rawAbi.abi;
      // IMPORTANT: get_raw_abi returns BASE64, not hex!
      // Base64 strings contain A-Za-z0-9+/=, not just 0-9a-f
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(rawData) && !/^[0-9a-fA-F]+$/.test(rawData.slice(0, 4));
      const isHex = /^[0-9a-fA-F]+$/.test(rawData);

      if (isBase64 || (!isHex && rawData.length > 10)) {
        // Decode base64 → raw bytes
        rawAbiBytes = Buffer.from(rawData, 'base64');
        console.log(`   Raw ABI: ${rawData.length.toLocaleString()} chars (base64) → ${rawAbiBytes.length.toLocaleString()} bytes`);
      } else {
        rawAbiBytes = Buffer.from(rawData, 'hex');
        console.log(`   Raw ABI: ${rawData.length.toLocaleString()} chars (hex) → ${rawAbiBytes.length.toLocaleString()} bytes`);
      }
      console.log(`   ABI hash: ${rawAbi.abi_hash}`);

      rawAbiFirstByte = rawAbiBytes[0];
      const rawFirstChar = String.fromCharCode(rawAbiFirstByte);
      console.log(`   First byte: 0x${rawAbiFirstByte.toString(16).padStart(2, '0')} (ASCII '${rawFirstChar}')`);
      if (rawAbiFirstByte === 0x7B) {
        rawAbiIsJson = true;
        console.log(`   ❌ CONFIRMED: Current on-chain ABI is hex-encoded JSON ('{') — CORRUPTED!`);
        console.log(`      → nodeos cannot decode this as abi_def`);
        console.log(`      → get_table_rows(json=true) WILL FAIL`);
      } else if (rawAbiFirstByte < 0x20) {
        console.log(`   ✅ Current on-chain ABI appears to be packed abi_def (varuint ${rawAbiFirstByte})`);
      } else {
        console.log(`   ⚠️  Unknown format — first byte 0x${rawAbiFirstByte.toString(16)}`);
      }
    } else {
      console.log(`   ❌ No ABI on chain: ${JSON.stringify(rawAbi).substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`   ❌ get_raw_abi failed: ${e.message}`);
  }

  // 3b: get_abi — try standard JSON decode
  console.log('\n   3b: get_abi (JSON decode)...');
  try {
    const abiResult = await rpc('get_abi', { account_name: CONTRACT });
    if (abiResult.abi) {
      const decodedAbi = typeof abiResult.abi === 'string'
        ? JSON.parse(abiResult.abi)
        : abiResult.abi;
      console.log(`   ✅ get_abi SUCCEEDS: version=${decodedAbi.version}, ${(decodedAbi.actions||[]).length} actions, ${(decodedAbi.tables||[]).length} tables`);
    } else if (abiResult.error) {
      console.log(`   ❌ get_abi FAILS: ${abiResult.error.what?.substring(0, 200)}`);
      console.log(`      → Confirms ABI is corrupted — nodeos cannot unpack it`);
    } else {
      console.log(`   ⚠️  Unexpected: ${JSON.stringify(abiResult).substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`   ❌ get_abi threw: ${e.message}`);
  }

  // 3c: Check if get_table_rows works with json=true
  console.log('\n   3c: get_table_rows(json=true) — can the ABI decode tables?...');
  try {
    const rows = await rpc('get_table_rows', {
      json: true,
      code: CONTRACT,
      scope: CONTRACT,
      table: 'configv2',
      limit: 1,
    });
    if (rows.rows !== undefined) {
      console.log(`   ✅ Table decode SUCCEEDS: ${rows.rows.length} row(s) returned`);
      if (rows.rows.length > 0) {
        console.log(`      Sample: ${JSON.stringify(rows.rows[0]).substring(0, 120)}`);
      }
    } else if (rows.error) {
      console.log(`   ❌ Table decode FAILS: ${rows.error.what?.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`   ❌ get_table_rows threw: ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // (4) HYPERION: Last setabi history
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Step 4: Hyperion — last setabi transactions ──');

  try {
    const hist = await hyperionGetActions(CONTRACT);
    if (hist.actions && hist.actions.length > 0) {
      console.log(`   Found ${hist.actions.length} recent setabi(s):`);
      for (const act of hist.actions) {
        const ts = act.timestamp;
        const txId = (act.trx_id || '').slice(0, 14);
        const data = act.act?.data;
        const abiField = data?.abi;

        // Hyperion may return abi as hex string OR as array of numbers
        let abiHex = '';
        let abiLen = 0;
        let firstByte = null;

        if (typeof abiField === 'string') {
          abiHex = abiField;
          abiLen = abiField.length;
          firstByte = parseInt(abiField.slice(0, 2), 16);
        } else if (Array.isArray(abiField)) {
          // Array of numbers → convert first few to hex
          abiHex = abiField.map(b => b.toString(16).padStart(2, '0')).join('');
          abiLen = abiField.length;
          firstByte = abiField[0];
        } else if (abiField && typeof abiField === 'object') {
          abiHex = JSON.stringify(abiField).substring(0, 100);
          abiLen = abiHex.length;
        }

        let formatLabel;
        if (firstByte === null || firstByte === undefined) {
          formatLabel = '⚠️  unknown format';
        } else if (firstByte === 0x7B) {
          formatLabel = '❌ HEX-ENCODED JSON (corrupted — starts with "{")';
        } else if (firstByte < 0x20) {
          formatLabel = `✅ packed abi_def (varuint ${firstByte} = version string length)`;
        } else {
          formatLabel = `⚠️  unexpected first byte 0x${firstByte.toString(16)}`;
        }

        console.log(`   ${ts} | tx ${txId}...`);
        console.log(`     ABI: ${abiLen.toLocaleString()} entries, first byte: 0x${firstByte?.toString(16) || '??'}`);
        console.log(`     ${formatLabel}`);
      }
    } else {
      console.log(`   No setabi transactions found in Hyperion`);
    }
  } catch (e) {
    console.log(`   ❌ Hyperion query failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // (5) SAVE PACKED OUTPUT (for review, NOT broadcast)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n── Step 5: Save packed output for review ──');

  const outPath = path.resolve(__dirname, '../temp/packed-abi-dry.json');
  const outDir = path.dirname(outPath);
  const { mkdirSync, writeFileSync } = await import('fs');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    at: new Date().toISOString(),
    contract: CONTRACT,
    abiVersion: abiObj.version,
    jsonBytes: jsonText.length,
    packedBytes: packedBytes.length,
    packedHex: packedHex,
    firstByteHex: `0x${packedBytes[0].toString(16).padStart(2, '0')}`,
    firstByteDec: packedBytes[0],
    varuintDecoded: analysis.versionStr,
    rawAbiOnChain: rawAbiBytes ? `first byte 0x${rawAbiFirstByte?.toString(16)} (${rawAbiIsJson ? 'CORRUPTED JSON' : 'packed abi_def'})` : '(not fetched)',
    note: 'DO NOT BROADCAST without CEO approval',
  }, null, 2), 'utf8');
  console.log(`   Saved: ${outPath}`);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(65));
  console.log('  DRY-TEST SUMMARY');
  console.log('═'.repeat(65));
  console.log(`  ABI version:    ${abiObj.version}`);
  console.log(`  JSON → packed:  ${jsonText.length.toLocaleString()} → ${packedBytes.length.toLocaleString()} bytes (${((1 - packedBytes.length / jsonText.length) * 100).toFixed(1)}% smaller)`);
  console.log(`  First byte:     0x${packedBytes[0].toString(16).padStart(2, '0')} (${analysis.isCorrect ? '✅ correct' : '❌ WRONG'})`);

  if (analysis.isCorrect && packedBytes[0] !== 0x7B) {
    console.log(`\n  ✅ PACKING IS CORRECT — ready to deploy after CEO unlocks phgamecreatr.`);
  } else {
    console.log(`\n  ❌ PACKING FAILED — DO NOT USE.`);
  }

  console.log(`\n  ⚠️  REMINDER: This script did NOT broadcast anything.`);
  console.log(`     CEO must unlock phgamecreatr before anyone runs setabi.`);
  console.log(`     Then use: node tools/pack-abi-dry.mjs (this script)`);
  console.log(`     to verify the packed output before deploying.`);

  // Return the packed hex for potential use
  return { packedHex, packedBytes, abiObj, analysis };
}

main().catch(e => {
  console.error(`\n💥 FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
