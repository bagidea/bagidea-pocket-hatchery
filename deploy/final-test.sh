#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Deploy ==="
cleos -u "$RPC" set contract "$CONTRACT" "$BUILD_DIR" "pockethatch.wasm" "pockethatch.abi" -p "$CONTRACT@active" 2>&1 | grep -E "executed|Skipping|error" | head -3
BUILD_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"

echo ""
echo "=== 1. initplayer (gets 200 starter EGG) ==="
c push action "$CONTRACT" initplayer "[\"$PLAYER\"]" -p "$PLAYER@active" 2>&1 | grep -E "executed|error"

echo ""
echo "=== 2. regular hatch (costs 150 EGG) ==="
c push action "$CONTRACT" hatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1 | grep -E "executed|error"

echo ""
echo "=== 3. Resolve asset_id ==="
sleep 1
ASSET_ID=$(c get table "$CONTRACT" "$CONTRACT" creatures --lower 0 --limit 5 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
mine=[r for r in rows if r['owner']=='$PLAYER']
print(mine[-1]['asset_id'] if mine else '')
")
echo "ASSET_ID=$ASSET_ID"

if [ -z "$ASSET_ID" ]; then
    echo "NO CREATURE MINTED — hatch failed silently"
    exit 1
fi

echo ""
echo "=== 4. feed ==="
c push action "$CONTRACT" feed "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | grep -E "executed|error"

echo ""
echo "=== 5. evolve (0->1) ==="
c push action "$CONTRACT" evolve "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | grep -E "executed|error"

echo ""
echo "=== 6. Check player EGG (should be 200-150-300=-250? no, evolve costs EGG too) ==="
c get table "$CONTRACT" "$CONTRACT" players --lower "$PLAYER" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'  egg_balance = {r[\"egg_balance\"]}')
    print(f'  total_egg_farmed = {r[\"total_egg_farmed\"]}')
"

echo ""
echo "=== 7. Check creature ==="
c get table "$CONTRACT" "$CONTRACT" creatures --lower "$ASSET_ID" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'  asset_id = {r[\"asset_id\"]}')
    print(f'  stage = {r[\"stage\"]}')
"

echo ""
echo "=== ✅ DONE ==="
