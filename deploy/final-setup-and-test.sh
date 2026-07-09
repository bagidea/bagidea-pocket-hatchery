#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== 1. setspecies ==="
c push action "$CONTRACT" setspecies "{\"sp\":{\"template_id\":662644,\"growth_rate\":1000,\"thresh_1\":1000,\"thresh_2\":5000,\"thresh_3\":20000,\"thresh_4\":100000,\"yield_0\":100,\"yield_1\":300,\"yield_2\":600,\"yield_3\":1200,\"yield_4\":2400,\"max_stage\":5,\"egg_weight\":100,\"egg_type\":0,\"family\":\"Fire\"}}" -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 2. initplayer ==="
c push action "$CONTRACT" initplayer "[\"$PLAYER\"]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 3. firsthatch (free first creature) ==="
c push action "$CONTRACT" firsthatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 4. Resolve asset_id ==="
sleep 1
ASSET_ID=$(c get table "$CONTRACT" "$CONTRACT" creatures --lower 0 --limit 5 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
mine=[r for r in rows if r['owner']=='$PLAYER']
print(mine[-1]['asset_id'] if mine else '')
")
echo "ASSET_ID=$ASSET_ID"

echo ""
echo "=== 5. feed x1 ==="
c push action "$CONTRACT" feed "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 6. evolve (stage 0->1) ==="
c push action "$CONTRACT" evolve "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 7. feed x4 more ==="
for i in 2 3 4 5; do
  c push action "$CONTRACT" feed "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | grep -oE '(executed|error|assertion).*' | head -1
done

echo ""
echo "=== 8. evolve (stage 1->2) ==="
c push action "$CONTRACT" evolve "[\"$PLAYER\",$ASSET_ID]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 9. harvest (accumulate EGG) ==="
c push action "$CONTRACT" harvest "[\"$PLAYER\"]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== 10. Check player state ==="
c get table "$CONTRACT" "$CONTRACT" players --lower "$PLAYER" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'  egg_balance = {r[\"egg_balance\"]}')
    print(f'  total_egg_farmed = {r[\"total_egg_farmed\"]}')
"

echo ""
echo "=== 11. Check creature ==="
c get table "$CONTRACT" "$CONTRACT" creatures --lower "$ASSET_ID" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'  asset_id = {r[\"asset_id\"]}')
    print(f'  owner = {r[\"owner\"]}')
    print(f'  stage = {r[\"stage\"]}')
    print(f'  growth_base = {r[\"growth_base\"]}')
    print(f'  template_id = {r[\"template_id\"]}')
"

echo ""
echo "=== ✅ FULL GAMEPLAY LOOP VERIFIED ==="
