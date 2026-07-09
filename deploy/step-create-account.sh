#!/bin/bash
# Task 2a: create the pockethatch contract account under waxwingsuper (creator).
source "$(dirname "$0")/lib.sh"

WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

echo "=== system newaccount waxwingsuper → pockethatch ==="
# owner + active both bound to the contract pubkey we hold.
# RAM: 1500 KB up front (code+abi ≈ 110 KB, rest for tables + AtomicAssets metadata).
# Stake 0.5 NET + 2.0 CPU (WAX testnet still honours stake-based resources).
"$CLEOS_BIN" -u "$RPC" system newaccount waxwingsuper "$CONTRACT" \
  "$CONTRACT_PUB" "$CONTRACT_PUB" \
  --stake-net '0.50000000 WAX' \
  --stake-cpu '2.00000000 WAX' \
  --buy-ram-kbytes 1500 \
  -p waxwingsuper@active 2>&1 | tee /tmp/newacct.json | grep -E '"transaction_id"|elapsed|status' | head -5

echo ""
echo "=== verify account exists ==="
"$CLEOS_BIN" -u "$RPC" get account "$CONTRACT" 2>&1 | grep -E 'created|liquid:|RAM quota:|cpu_weight|net_weight' | head -6
