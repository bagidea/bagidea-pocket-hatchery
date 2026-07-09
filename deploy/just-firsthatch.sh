#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== firsthatch (after newseason already incremented season_index) ==="
c push action "$CONTRACT" firsthatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1

echo ""
echo "=== Resolve asset_id ==="
sleep 1
c get table "$CONTRACT" "$CONTRACT" creatures --lower 0 --limit 5 2>&1 | python3 -c "
import json,sys
data=sys.stdin.read()
print('Raw:', data[:200])
" 2>&1
