#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Check config before firsthatch ==="
c get table "$CONTRACT" "$CONTRACT" config 2>&1 | head -5

echo ""
echo "=== Check species ==="
c get table "$CONTRACT" "$CONTRACT" speciescfg 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
print(f'{len(rows)} species found')
" 2>&1

echo ""
echo "=== firsthatch (retry) ==="
c push action "$CONTRACT" firsthatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1
