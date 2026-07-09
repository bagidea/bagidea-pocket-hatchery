#!/bin/bash
set -euo pipefail

CLEOS="/home/bagidea/leap/usr/bin/cleos"
WALLET_URL="--wallet-url unix:///home/bagidea/.ph/keosd/keosd.sock"
export LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib

echo "=== Wallet list ==="
"$CLEOS" $WALLET_URL wallet list 2>&1 || true

# Create wallet if not exist
if ! "$CLEOS" $WALLET_URL wallet list 2>&1 | grep -q '"ph'; then
    echo "Creating wallet ph..."
    PW=$("$CLEOS" $WALLET_URL wallet create --name ph --to-console 2>&1 | grep -oP 'PW5[A-Za-z0-9]+' | tail -1)
    echo "Password: $PW"
    echo "$PW" > /home/bagidea/.ph/wallet.pw
fi

# Import waxwingsuper key
echo "=== Importing key ==="
"$CLEOS" $WALLET_URL wallet import --name ph --private-key PVT_K1_2XApm8dJcxn3h4sbbHVwkR4fZSpDhz2A3yXK7PzfDQQjsc8Uqb 2>&1 || echo "(already imported)"

echo ""
echo "=== Final wallet status ==="
"$CLEOS" $WALLET_URL wallet list 2>&1 || true
"$CLEOS" $WALLET_URL wallet keys 2>&1 || true
