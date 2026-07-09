#!/usr/bin/env node
/**
 * pack-abi-cli.mjs — CLI: pack ABI JSON → abi_def hex
 * =====================================================
 * For use by shell scripts (deploy-waxwing.ps1 / deploy-waxwing.sh)
 * that can't easily use eosjs directly.
 *
 * Usage:
 *   node tools/pack-abi-cli.mjs <path-to-.abi>
 *   → stdout: packed hex only (e.g. "0e656f73696f3a...")
 *   → exit 0 on success, exit 1 on failure
 *
 *   node tools/pack-abi-cli.mjs --json <path-to-.abi>
 *   → stdout: JSON with { packedHex, packedBytes, jsonBytes, firstByte }
 */

import { packAbiFromPath } from './lib/pack-abi.mjs';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const abiPath = args.filter(a => !a.startsWith('--'))[0];

if (!abiPath) {
  console.error('Usage: node tools/pack-abi-cli.mjs [--json] <path-to-.abi>');
  process.exit(1);
}

try {
  const { packedHex, packedBytes, abiObj } = packAbiFromPath(abiPath);
  const jsonLen = JSON.stringify(abiObj).length;

  if (jsonMode) {
    console.log(JSON.stringify({
      ok: true,
      packedHex,
      packedBytes: packedBytes.length,
      jsonBytes: jsonLen,
      firstByte: `0x${packedBytes[0].toString(16)}`,
      savings: `${(jsonLen - packedBytes.length).toLocaleString()} bytes (${((1 - packedBytes.length / jsonLen) * 100).toFixed(1)}%)`,
    }));
  } else {
    // Plain hex output for shell scripts
    process.stdout.write(packedHex);
  }
} catch (e) {
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
  } else {
    console.error(`ERROR: ${e.message}`);
  }
  process.exit(1);
}
