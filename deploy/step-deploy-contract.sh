#!/bin/bash
# Task 2b: deploy the pockethatch wasm+abi to the contract account.
source "$(dirname "$0")/lib.sh"

BUILD_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"
WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

echo "=== set code + abi to $CONTRACT ==="
# Files are named after the source (pockethatch.*), not the 12-char account, so pass
# them explicitly as dir + relative wasm + relative abi.
"$CLEOS_BIN" -u "$RPC" set contract "$CONTRACT" \
  "$BUILD_DIR" "pockethatch.wasm" "pockethatch.abi" \
  -p "$CONTRACT@active" 2>&1 | tee /tmp/deploy.json | grep -E 'executed transaction|error|assertion' | head -5

DEPLOY_TX="$(grep -oE '[0-9a-f]{64}' /tmp/deploy.json | head -1)"
echo ""
echo "DEPLOY_TX=$DEPLOY_TX"

echo ""
echo "=== verify code hash on chain ==="
"$CLEOS_BIN" -u "$RPC" get code "$CONTRACT" 2>&1 | head -2

echo ""
echo "=== verify abi has the gameplay actions ==="
"$CLEOS_BIN" -u "$RPC" get abi "$CONTRACT" 2>&1 | grep -oE '"name": ?"(hatch|firsthatch|feed|evolve|initplayer|setconfig|setspecies|harvest|claimreward|unlockslot|equipcosmetic|fundpool)"' | sort -u
