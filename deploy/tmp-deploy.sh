#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos"
RPC="https://waxtestnet.greymass.com"
BUILD="/tmp/phbuild"
CONTRACT="pockethatch1"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

# Copy fresh artifacts to WSL-native tmp
mkdir -p "$BUILD"
cp "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build/pockethatch.wasm" "$BUILD/"
cp "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build/pockethatch.abi" "$BUILD/"
echo "=== Artifacts ==="
ls -la "$BUILD/"

echo ""
echo "=== Deploy to $CONTRACT ==="
$CLEOS -u $RPC set contract "$CONTRACT" "$BUILD" pockethatch.wasm pockethatch.abi \
  -p "${CONTRACT}@active" --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Verify new ABI actions ==="
$CLEOS -u $RPC get abi "$CONTRACT" 2>&1 | grep -o '"name": "[a-z]*"' | grep -E 'firsthatch|unlockslot|equipcosmetic|fundpool|newseason' | sort -u
