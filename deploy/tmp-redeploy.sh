#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
cd "/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
echo "=== Recompiling ==="
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1 | tail -5
echo "RC=$?"
echo ""
echo "=== Copying to WSL tmp ==="
rm -rf /tmp/phbuild
mkdir -p /tmp/phbuild
cp build/pockethatch.wasm /tmp/phbuild/
cp build/pockethatch.abi /tmp/phbuild/
ls -la /tmp/phbuild/

echo ""
echo "=== Redeploying ==="
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
$CLEOS set contract pockethatch1 /tmp/phbuild pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Verify deploy ==="
$CLEOS get abi pockethatch1 2>&1 | grep -o '"name": "[a-z]*"' | grep -E 'firsthatch|unlockslot|equipcosmetic|fundpool' | sort -u
