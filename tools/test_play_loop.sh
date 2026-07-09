#!/bin/bash
set -euo pipefail
CLEOS="/home/bagidea/leap/usr/bin/cleos"
WALLET_URL="--wallet-url unix:///home/bagidea/.ph/keosd/keosd.sock"
RPC="https://testnet.waxsweden.org"
export LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib
ACTOR="waxwingsuper"
CONTRACT="phgamecreatr"

echo "=== TEST 1: firsthatch (should succeed or fail with 'already hatched') ==="
"$CLEOS" -u "$RPC" $WALLET_URL push action "$CONTRACT" firsthatch "{\"owner\":\"$ACTOR\",\"egg_type\":0}" -p "$ACTOR@active" 2>&1 || true

echo ""
echo "=== TEST 2: hatch (hatch another egg) ==="
"$CLEOS" -u "$RPC" $WALLET_URL push action "$CONTRACT" hatch "{\"owner\":\"$ACTOR\",\"egg_type\":0}" -p "$ACTOR@active" 2>&1 || true

echo ""
echo "=== TEST 3: feed (existing creature 1099603751654) ==="
"$CLEOS" -u "$RPC" $WALLET_URL push action "$CONTRACT" feed "{\"owner\":\"$ACTOR\",\"asset_id\":1099603751654}" -p "$ACTOR@active" 2>&1 || true

echo ""
echo "=== TEST 4: evolve (existing creature 1099603751654) ==="
"$CLEOS" -u "$RPC" $WALLET_URL push action "$CONTRACT" evolve "{\"owner\":\"$ACTOR\",\"asset_id\":1099603751654}" -p "$ACTOR@active" 2>&1 || true

echo ""
echo "=== TEST 5: claimreward ==="
"$CLEOS" -u "$RPC" $WALLET_URL push action "$CONTRACT" claimreward "{\"owner\":\"$ACTOR\"}" -p "$ACTOR@active" 2>&1 || true
