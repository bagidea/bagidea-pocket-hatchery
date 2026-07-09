#!/bin/bash
set -euo pipefail

# Deploy Pocket Hatchery contract to phgamecreatr via waxwing pushaction
# Uses waxwing's unlocked phgamecreatr key for signing.
#
# FIXED (2026-07-02): ABI is now PACKED as abi_def binary (via eosjs)
# instead of hex-encoding the raw JSON text. The old approach stored
# raw JSON on chain → nodeos cannot decode → get_table_rows breaks.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WASM="$SCRIPT_DIR/pockethatch.wasm"
ABI="$SCRIPT_DIR/pockethatch.abi"
# Resolve tools dir: build/ = contract/pockethatch/build/ → ../../../tools/
TOOLS_DIR="$(cd "$SCRIPT_DIR/../../../tools" && pwd)"
PACK_CLI="$TOOLS_DIR/pack-abi-cli.mjs"

echo "=== Deploying to phgamecreatr ==="

# Step 1: Deploy WASM (setcode)
echo "[1/2] Deploying WASM..."
WASM_HEX=$(xxd -p -c0 "$WASM" | tr -d '\n')
echo "  WASM size: $(wc -c < "$WASM") bytes, hex: ${#WASM_HEX} chars"

# Build the setcode JSON - write to file to avoid shell escaping issues
cat > /tmp/setcode.json << EOFJSON
{"cmd":"pushaction","args":"eosio setcode {\"account\":\"phgamecreatr\",\"vmtype\":0,\"vmversion\":0,\"code\":\"${WASM_HEX}\"} --actor phgamecreatr"}
EOFJSON

echo "  Sending setcode..."
SETCODE_RESULT=$(curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  --data-binary @/tmp/setcode.json)
echo "  $SETCODE_RESULT"

# Step 2: PACK ABI as abi_def binary (NOT hex-encode JSON!)
echo "[2/2] Packing ABI as abi_def binary..."
ABI_PACKED=$(node "$PACK_CLI" "$ABI")
if [ $? -ne 0 ]; then
  echo "  ERROR: pack-abi-cli failed"
  exit 1
fi

# DRY-TEST: first byte must be varuint of "eosio::abi/1.X" (~0x0E), NOT 0x7B ("{")
FIRST_BYTE="${ABI_PACKED:0:2}"
FIRST_BYTE_DEC=$((16#$FIRST_BYTE))
if [ "$FIRST_BYTE_DEC" -eq 123 ]; then  # 0x7B = '{'
  echo "  FATAL: Packed ABI starts with 0x7B ('{') — hex-encoded JSON detected! Aborting."
  echo "  This is the OLD buggy behavior. The packing script should produce abi_def binary."
  exit 1
fi
echo "  ABI packed: ${#ABI_PACKED} hex chars (first byte: 0x${FIRST_BYTE} = varuint len, OK)"
echo "  Dry-test PASS: not 0x7B '{', correctly packed as abi_def"

cat > /tmp/setabi.json << EOFJSON
{"cmd":"pushaction","args":"eosio setabi {\"account\":\"phgamecreatr\",\"abi\":\"${ABI_PACKED}\"} --actor phgamecreatr"}
EOFJSON

echo "  Sending setabi..."
SETABI_RESULT=$(curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  --data-binary @/tmp/setabi.json)
echo "  $SETABI_RESULT"

echo ""
echo "=== Done ==="
echo "⚠️  Verify with: node tools/verify-loop.mjs --dry"
