#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"

# Copy patched ABI
rm -rf /tmp/phbuild2
mkdir -p /tmp/phbuild2
cp "$SRC/pockethatch.wasm" /tmp/phbuild2/
cp "$SRC/pockethatch.abi" /tmp/phbuild2/

echo "=== Redeploy with patched ABI ==="
$CLEOS set contract pockethatch1 /tmp/phbuild2 pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Verify tables ==="
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -5
echo "---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1 | head -5
