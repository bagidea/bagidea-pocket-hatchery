/**
 * pack-abi.mjs — Reusable ABI packing module
 * ==========================================
 * Packs an Antelope ABI JSON file into abi_def binary format
 * using eosjs-serialize (same as cleos does internally).
 *
 * Usage:
 *   import { packAbi, packAbiFromPath } from './lib/pack-abi.mjs';
 *   const { packedHex, packedBytes, abiObj } = packAbiFromPath('./build/pockethatch.abi');
 *
 * Dependencies:
 *   eosjs in deploy/nodejs/node_modules/eosjs/dist/eosjs-serialize.js
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEosjs() {
  const eosjsDist = path.resolve(__dirname, '../../deploy/nodejs/node_modules/eosjs/dist');
  return require(eosjsDist + '/eosjs-serialize.js');
}

/**
 * Build the minimal eosio system ABI that defines abi_def.
 * This is the ABI definition cleos uses internally to serialize abi_def.
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
 * Pack an ABI JSON object into abi_def binary.
 * @param {object} abiObj - parsed ABI JSON object
 * @returns {{ packedHex: string, packedBytes: Uint8Array, abiObj: object }}
 */
export function packAbi(abiObj) {
  const { SerialBuffer, createInitialTypes, getTypesFromAbi } = loadEosjs();

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
 * Read an ABI JSON file and pack it into abi_def binary.
 * @param {string} abiPath - path to .abi JSON file
 * @returns {{ packedHex: string, packedBytes: Uint8Array, abiObj: object }}
 */
export function packAbiFromPath(abiPath) {
  const abiObj = JSON.parse(readFileSync(abiPath, 'utf8'));
  return packAbi(abiObj);
}
