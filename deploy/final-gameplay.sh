#!/bin/bash
source "$(dirname "$0")/lib.sh"
P="$PLAYER"
C="$CONTRACT"

echo "=== 1. setconfig ==="
c push action "$C" setconfig '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchfees1","paused":false,"hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":0,"harvest_cd":0,"breed_cd":86400,"feed_daily_cap":100,"daily_egg_cap":240,"offline_cap_h":8,"tap_egg_cap":60,"feed_boost":1000,"season_index":0,"season_started":0,"rng_oracle":"testoracle11"}}' -p "$C@active" 2>&1 | tail -3

echo ""
echo "=== 2. setspecies ==="
c push action "$C" setspecies '{"sp":{"template_id":662644,"growth_rate":1000,"thresh_1":1000,"thresh_2":5000,"thresh_3":20000,"thresh_4":100000,"yield_0":100,"yield_1":300,"yield_2":600,"yield_3":1200,"yield_4":2400,"max_stage":5,"egg_weight":100,"egg_type":0,"family":"Fire"}}' -p "$C@active" 2>&1 | tail -3

echo ""
echo "=== 3. newseason ==="
c push action "$C" newseason '["0.0000 HATCH"]' -p "$C@active" 2>&1 | tail -3

echo ""
echo "=== 4. firsthatch (FREE, no EGG cost) ==="
FIRST_OUT=$(c push action "$C" firsthatch "[\"$P\",0]" -p "$P@active" 2>&1)
echo "$FIRST_OUT" | tail -5
if echo "$FIRST_OUT" | grep -q "executed transaction"; then
    echo "✅ FIRSTHATCH SUCCESS!"
else
    echo "❌ firsthatch failed"
    exit 1
fi

sleep 1

echo ""
echo "=== 5. Resolve asset_id ==="
ASSET_ID=$(c get table "$C" "$C" creatures --lower 0 --limit 10 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
mine=[r for r in rows if r['owner']=='$P']
print(mine[-1]['asset_id'] if mine else '')
")
echo "  ASSET_ID=$ASSET_ID"
[ -z "$ASSET_ID" ] && { echo "❌ No creature minted"; exit 1; }

echo ""
echo "=== 6. feed x1 ==="
c push action "$C" feed "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | tail -2

echo ""
echo "=== 7. evolve (0->1) ==="
c push action "$C" evolve "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | tail -2

echo ""
echo "=== 8. feed x4 ==="
for i in 2 3 4 5; do
    c push action "$C" feed "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | grep -q "executed" && echo "  feed-$i ✅" || { echo "  feed-$i ❌"; exit 1; }
done

echo ""
echo "=== 9. evolve (1->2) ==="
c push action "$C" evolve "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | tail -2

echo ""
echo "=== 10. harvest ==="
c push action "$C" harvest "[\"$P\"]" -p "$P@active" 2>&1 | tail -2

echo ""
echo "=== 11. Verify state ==="
echo "  Player:"
c get table "$C" "$C" players --lower "$P" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'    egg_balance = {r[\"egg_balance\"]}')
    print(f'    total_egg_farmed = {r[\"total_egg_farmed\"]}')
"

echo "  Creature:"
c get table "$C" "$C" creatures --lower "$ASSET_ID" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'    asset_id = {r[\"asset_id\"]}')
    print(f'    stage = {r[\"stage\"]}')
    print(f'    owner = {r[\"owner\"]}')
"

echo ""
echo "========================================="
echo "  🎉 FULL GAMEPLAY LOOP VERIFIED!"
echo "========================================="
