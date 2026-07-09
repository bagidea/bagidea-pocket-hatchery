#!/bin/bash
source "$(dirname "$0")/lib.sh"
BUILD_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"
P="$PLAYER"

fail() { echo "❌ FAIL: $1"; exit 1; }

echo "========================================="
echo "  Pocket Hatchery — Full Verification"
echo "========================================="

echo ""
echo "=== Step 1: Deploy new contract ==="
OUT=$(cleos -u "$RPC" set contract "$CONTRACT" "$BUILD_DIR" "pockethatch.wasm" "pockethatch.abi" -p "$CONTRACT@active" 2>&1)
echo "$OUT" | grep -E "executed|Skipping|error" | head -3
echo "  Waiting 5s for deploy to confirm..."
sleep 5

echo ""
echo "=== Step 2: Clear old singletons ==="
echo -n "  clearconfig: "
c push action "$CONTRACT" clearconfig '[]' -p "$CONTRACT@active" 2>&1 | grep -q "executed" && echo "✅" || echo "⚠️ (may already be empty)"
echo -n "  clearpool: "
c push action "$CONTRACT" clearpool '[]' -p "$CONTRACT@active" 2>&1 | grep -q "executed" && echo "✅" || echo "⚠️ (may already be empty)"

echo ""
echo "=== Step 3: Configure contract ==="
echo "  setconfig:"
SETCONFIG_OUT=$(c push action "$CONTRACT" setconfig '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchfees1","paused":false,"hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":0,"harvest_cd":0,"breed_cd":86400,"feed_daily_cap":100,"daily_egg_cap":240,"offline_cap_h":8,"tap_egg_cap":60,"feed_boost":1000,"season_index":0,"season_started":0,"rng_oracle":"testoracle11"}}' -p "$CONTRACT@active" 2>&1)
echo "$SETCONFIG_OUT" | head -5
echo "$SETCONFIG_OUT" | grep -q "executed" && echo "  ✅ setconfig" || { echo "  ❌ FAIL"; exit 1; }

echo -n "  setspecies: "
c push action "$CONTRACT" setspecies '{"sp":{"template_id":662644,"growth_rate":1000,"thresh_1":1000,"thresh_2":5000,"thresh_3":20000,"thresh_4":100000,"yield_0":100,"yield_1":300,"yield_2":600,"yield_3":1200,"yield_4":2400,"max_stage":5,"egg_weight":100,"egg_type":0,"family":"Fire"}}' -p "$CONTRACT@active" 2>&1 | grep -q "executed" && echo "✅" || fail "setspecies"

echo -n "  newseason: "
c push action "$CONTRACT" newseason '["0.0000 HATCH"]' -p "$CONTRACT@active" 2>&1 | grep -q "executed" && echo "✅" || fail "newseason"

echo ""
echo "=== Step 4: Init player ==="
echo -n "  initplayer($P): "
c push action "$CONTRACT" initplayer "[\"$P\"]" -p "$P@active" 2>&1 | grep -q "executed" && echo "✅" || fail "initplayer"

echo ""
echo "=== Step 5: Hatch (regular, 150 EGG from starter 200) ==="
echo -n "  hatch($P, 0): "
HATCH_OUT=$(c push action "$CONTRACT" hatch "[\"$P\",0]" -p "$P@active" 2>&1)
if echo "$HATCH_OUT" | grep -q "executed"; then
    echo "✅"
else
    echo "FAILED:"
    echo "$HATCH_OUT" | tail -5
    fail "hatch — datastream crash?"
fi

sleep 1

echo ""
echo "=== Step 6: Resolve minted NFT ==="
ASSET_ID=$(c get table "$CONTRACT" "$CONTRACT" creatures --lower 0 --limit 10 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
mine=[r for r in rows if r['owner']=='$P']
print(mine[-1]['asset_id'] if mine else '')
")
echo "  ASSET_ID=$ASSET_ID"
[ -z "$ASSET_ID" ] && fail "could not resolve minted creature"

echo ""
echo "=== Step 7: Feed + Evolve loop ==="
echo -n "  feed x1: "
c push action "$CONTRACT" feed "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | grep -q "executed" && echo "✅" || fail "feed"

echo -n "  evolve (0->1): "
c push action "$CONTRACT" evolve "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | grep -q "executed" && echo "✅" || fail "evolve"

echo -n "  feed x4: "
for i in 2 3 4 5; do
    c push action "$CONTRACT" feed "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | grep -q "executed" || fail "feed-$i"
done
echo "✅"

echo -n "  evolve (1->2): "
c push action "$CONTRACT" evolve "[\"$P\",$ASSET_ID]" -p "$P@active" 2>&1 | grep -q "executed" && echo "✅" || fail "evolve-2"

echo ""
echo "=== Step 8: Harvest (accumulate EGG) ==="
echo -n "  harvest: "
c push action "$CONTRACT" harvest "[\"$P\"]" -p "$P@active" 2>&1 | grep -q "executed" && echo "✅" || fail "harvest"

echo ""
echo "=== Step 9: Verify state ==="
echo "  Player EGG:"
c get table "$CONTRACT" "$CONTRACT" players --lower "$P" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'    egg_balance = {r[\"egg_balance\"]}')
    print(f'    total_egg_farmed = {r[\"total_egg_farmed\"]}')
"

echo "  Creature stage:"
c get table "$CONTRACT" "$CONTRACT" creatures --lower "$ASSET_ID" --limit 1 2>&1 | python3 -c "
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
echo "  ✅ ALL CHECKS PASSED"
echo "========================================="
