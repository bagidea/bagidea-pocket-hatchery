#!/bin/bash
source "$(dirname "$0")/lib.sh"
WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

echo "=== previous hatch tx abf6655f status on chain ==="
c get transaction abf6655fadad0e6962efceb00a88af9aed99411bfd149ae634d82483066e2eb0 2>&1 \
  | python3 -c "import json,sys; d=json.load(sys.stdin); t=d.get('trx',{}).get('trx',{}); print('id=',d.get('id'),'  status=',d.get('last_irreversible_block'),'? ; receipt=',str(d.get('traces',[{}])[0].get('receipt',{}).get('status')) if d.get('traces') else 'no-trace')" 2>&1 | head -3

echo ""
echo "=== retry hatch with FULL output ==="
"$CLEOS_BIN" -u "$RPC" push action "$CONTRACT" hatch "[\"$PLAYER\",0]" -p "$PLAYER@active" \
  -x 120 2>&1 | head -60
