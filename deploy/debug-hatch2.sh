#!/bin/bash
source "$(dirname "$0")/lib.sh"
WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

echo "=== TEST A: direct transfer 1.0000 HATCH waxwingsuper→pockethatch1 ==="
echo "    (isolates waxwingsuper@active signing from the inline pattern)"
"$CLEOS_BIN" -u "$RPC" push action "$TOKEN_CONTRACT" transfer \
  "[\"$PLAYER\",\"$CONTRACT\",\"1.0000 HATCH\",\"direct-sign-test\"]" \
  -p "$PLAYER@active" 2>&1 | head -12

echo ""
echo "=== TEST B: retry hatch, FULL output ==="
"$CLEOS_BIN" -u "$RPC" push action "$CONTRACT" hatch "[\"$PLAYER\",0]" \
  -p "$PLAYER@active" 2>&1 | head -40
