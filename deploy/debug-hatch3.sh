#!/bin/bash
source "$(dirname "$0")/lib.sh"
WPW="$(cat "$HOME/.ph/wallet.pw")"

echo "=== close stale wallets, keep only a fresh default ==="
"$CLEOS_BIN" wallet stop 2>&1 | tail -1 || true
# kill + restart keosd cleanly so no stale wallet state lingers
pkill -x keosd 2>/dev/null; sleep 2
KEOSD_DIR="$HOME/.ph/keosd"; WALLET_DIR="$KEOSD_DIR/wallets"
LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib" nohup /home/bagidea/leap/usr/bin/keosd \
  --data-dir "$KEOSD_DIR" --config-dir "$KEOSD_DIR" --wallet-dir "$WALLET_DIR" \
  --unlock-timeout 999999999 >/home/bagidea/.ph/keosd.log 2>&1 &
sleep 3
"$CLEOS_BIN" wallet create --to-console > /tmp/wpw.txt 2>&1
WPW="$(grep -oE 'PW[0-9A-Za-z]+' /tmp/wpw.txt | head -1)"
echo "$WPW" > "$HOME/.ph/wallet.pw"
echo "  new wallet pw saved"

echo "=== re-import only the keys we need ==="
"$CLEOS_BIN" wallet import --private-key "$CONTRACT_PRIV" >/dev/null 2>&1 && echo "  imported pockethatch1(contract)"
"$CLEOS_BIN" wallet import --private-key "$(cat "$HOME/.ph/hatchtokens1.priv")" >/dev/null 2>&1 && echo "  imported hatchtokens1"
# re-dump waxwing keys from the keystore and import (clean)
node /mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket\ Hatchery/deploy/_dump-keys.cjs >/dev/null 2>&1
for kf in "$HOME/.ph"/*.key; do
  "$CLEOS_BIN" wallet import --private-key "$(tr -d '[:space:]' < "$kf")" >/dev/null 2>&1 && echo "  imported $(basename "$kf")"
done
rm -f "$HOME/.ph"/*.key
echo "  keys now in wallet:"; "$CLEOS_BIN" wallet keys 2>&1 | grep EOS | head -10

echo ""
echo "=== retry hatch (clean wallet) ==="
"$CLEOS_BIN" -u "$RPC" push action "$CONTRACT" hatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1 | head -30
