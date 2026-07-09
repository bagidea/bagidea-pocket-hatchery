#!/bin/bash
set -euo pipefail

CLEOS="/home/bagidea/leap/usr/bin/cleos"
WALLET_URL="--wallet-url unix:///home/bagidea/.ph/keosd/keosd.sock"

# Ensure keosd is running
if ! pgrep keosd > /dev/null; then
    echo "Starting keosd..."
    nohup /home/bagidea/leap/usr/bin/keosd \
      --data-dir /home/bagidea/.ph/keosd \
      --config-dir /home/bagidea/.ph/keosd \
      --wallet-dir /home/bagidea/.ph/keosd/wallets \
      --unlock-timeout 999999999 \
      > /home/bagidea/.ph/keosd/keosd.log 2>&1 &
    sleep 2
fi

# Check if wallet "ph" exists
if env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet list 2>&1 | grep -q '"ph'; then
    echo "Wallet 'ph' exists"
    # Check if unlocked
    if env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet list 2>&1 | grep -q '"ph \*"'; then
        echo "Wallet 'ph' is unlocked"
    else
        echo "Unlocking wallet 'ph'..."
        env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet unlock --name ph --password "$(cat $HOME/.ph/wallet.pw)" 2>&1 || {
            echo "WARNING: Could not unlock wallet — password may be stale"
            echo "Removing and recreating wallet..."
            # Remove wallet file
            rm -f /home/bagidea/.ph/keosd/wallets/ph.wallet
        }
    fi
fi

# Create wallet if needed
if ! env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet list 2>&1 | grep -q '"ph'; then
    echo "Creating wallet 'ph'..."
    PW=$(env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet create --name ph --to-console 2>&1 | grep -oP 'PW5[A-Za-z0-9]+' | tail -1)
    if [ -n "$PW" ]; then
        echo "$PW" > /home/bagidea/.ph/wallet.pw
        echo "Wallet created, password saved"
    fi
fi

echo ""
echo "=== Importing keys ==="

# Contract key
env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet import --name ph \
  --private-key "${PH_CONTRACT_PRIV:?FATAL: set PH_CONTRACT_PRIV in-process (iron wall: no WIF on disk)}" 2>&1 || echo "(already imported)"

# Player key
env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet import --name ph \
  --private-key "$(cat /home/bagidea/.ph/waxwingsuper@active.key)" 2>&1 || echo "(already imported)"

echo ""
echo "=== Wallet status ==="
env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet list 2>&1
echo ""
env LD_LIBRARY_PATH=/home/bagidea/leap/usr/lib "$CLEOS" $WALLET_URL wallet keys 2>&1
