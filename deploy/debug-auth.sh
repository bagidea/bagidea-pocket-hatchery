#!/bin/bash
source "$(dirname "$0")/lib.sh"
WPW="$(cat "$HOME/.ph/wallet.pw")"

echo "=== keosd wallet list + open/unlock status ==="
"$CLEOS_BIN" wallet list 2>&1
echo "--- unlock default ---"
"$CLEOS_BIN" wallet unlock --password "$WPW" 2>&1 | tail -1
echo "--- wallet public keys ---"
"$CLEOS_BIN" wallet keys 2>&1 | head -10

echo ""
echo "=== players table (did initplayer apply?) ==="
c get table "$CONTRACT" "$CONTRACT" players --limit 5 2>&1 | head -20

echo ""
echo "=== retry initplayer (full output) ==="
"$CLEOS_BIN" -u "$RPC" push action "$CONTRACT" initplayer "[\"$PLAYER\"]" -p "$PLAYER@active" 2>&1 | head -15
