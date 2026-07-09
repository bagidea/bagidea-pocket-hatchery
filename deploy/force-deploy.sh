#!/bin/bash
source "$(dirname "$0")/lib.sh"

BUILD="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"

echo "=== Force set contract ==="
cleos -u "$RPC" set contract "$CONTRACT" "$BUILD" "pockethatch.wasm" "pockethatch.abi" -p "$CONTRACT@active" 2>&1 | tail -5

echo ""
echo "=== Verify code hash ==="
c get code "$CONTRACT" 2>&1 | head -2

echo ""
echo "=== Test clearconfig ==="
c push action "$CONTRACT" clearconfig '[]' -p "$CONTRACT@active" 2>&1 | tail -10

echo ""
echo "=== Test setconfig ==="
c push action "$CONTRACT" setconfig '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchfees1","paused":false,"hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":0,"harvest_cd":0,"breed_cd":86400,"feed_daily_cap":100,"daily_egg_cap":240,"offline_cap_h":8,"tap_egg_cap":60,"feed_boost":1000,"season_index":0,"season_started":0,"rng_oracle":"testoracle11"}}' -p "$CONTRACT@active" 2>&1 | tail -5

echo ""
echo "=== Test newseason ==="
c push action "$CONTRACT" newseason '["0.0000 HATCH"]' -p "$CONTRACT@active" 2>&1 | tail -5

echo ""
echo "=== Verify config ==="
c get table "$CONTRACT" "$CONTRACT" config 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print('CONFIG OK:')
    print('  hatch_cost =', r['hatch_cost'])
    print('  evolve_cost =', r['evolve_cost'])
    print('  season_index =', r['season_index'])
else:
    print('Config table empty')
" 2>&1
