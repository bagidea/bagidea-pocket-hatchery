#!/bin/bash
source "$(dirname "$0")/lib.sh"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
WAX_KEY="$(tr -d '[:space:]' < "$HOME/.ph/waxwingsuper@active.key")"

echo "=== hard reset keosd ==="
pkill -x keosd 2>/dev/null; sleep 2
KEOSD_DIR="$HOME/.ph/keosd"; WALLET_DIR="$KEOSD_DIR/wallets"
rm -rf "$KEOSD_DIR"; mkdir -p "$WALLET_DIR"; chmod 700 "$WALLET_DIR"
LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib" nohup /home/bagidea/leap/usr/bin/keosd \
  --data-dir "$KEOSD_DIR" --config-dir "$KEOSD_DIR" --wallet-dir "$WALLET_DIR" \
  --unlock-timeout 999999999 >/home/bagidea/.ph/keosd.log 2>&1 &
# wait until keosd answers
for i in $(seq 1 15); do
  "$CLEOS_BIN" wallet list >/dev/null 2>&1 && break
  sleep 1
done
echo "  keosd up: $($CLEOS_BIN wallet list 2>&1 | head -1)"

WPW="$("$CLEOS_BIN" wallet create --to-console 2>&1 | grep -oE 'PW[0-9A-Za-z]+' | head -1)"
echo "$WPW" > "$HOME/.ph/wallet.pw"
echo "  wallet created"

imp() { "$CLEOS_BIN" wallet import --private-key "$1" 2>&1 | grep -oE 'imported private key for: "[^"]+"' || echo "FAIL:$2"; }
echo "  $(imp "$CONTRACT_PRIV" pockethatch1)"
echo "  $(imp "$WAX_KEY" waxwingsuper)"
echo "  keys: $($CLEOS_BIN wallet keys 2>&1 | grep -c EOS)"

echo ""
echo "=== TEST 1: hatch with --use-old-rpc ==="
"$CLEOS_BIN" -u "$RPC" --use-old-rpc push action "$CONTRACT" hatch "[\"$PLAYER\",0]" \
  -p "$PLAYER@active" 2>&1 | head -20
