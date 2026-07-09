#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

# First give waxwingsuper some EGG by harvesting (they have no creatures, so harvest gives 0 EGG)
# Actually, we need EGG to hatch. Let's manually add via setconfig to make hatch_cost=0 for testing

echo "=== Lower hatch_cost to 0 for testing ==="
$CLEOS push action pockethatch1 setconfig \
  '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchtokens1","paused":false,"hatch_cost":0,"evolve_cost":0,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":60,"harvest_cd":60,"breed_cd":60,"feed_daily_cap":100,"daily_egg_cap":10000,"offline_cap_h":24,"tap_egg_cap":60,"feed_boost":10000,"season_index":1,"season_started":1782764240,"rng_oracle":""}}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "Waiting 10s..."
sleep 10

echo ""
echo "=== hatch (cost=0) ==="
$CLEOS push action pockethatch1 hatch \
  '{"owner":"waxwingsuper","egg_type":0}' \
  -p waxwingsuper@active -p pockethatch1@active 2>&1

echo ""
echo "=== Check creatures ==="
$CLEOS get table pockethatch1 pockethatch1 creatures 2>&1 | head -15
