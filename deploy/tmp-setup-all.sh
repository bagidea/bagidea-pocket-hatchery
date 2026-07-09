#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"

echo "=== 1. Set on-chain config (collection=pockethatch1, harvest_cd=60s for fast test) ==="
$CLEOS push action pockethatch1 setconfig \
  "{\"cfg\":{\"token_contract\":\"hatchtokens1\",\"collection\":\"pockethatch1\",\"schema_name\":\"creatures\",\"fee_account\":\"hatchtokens1\",\"paused\":false,\"hatch_cost\":150,\"evolve_cost\":300,\"breed_cost\":\"5.0000 HATCH\",\"feed_cost\":0,\"slot_cost\":500,\"cosmetic_cost\":100,\"name_cost\":\"1.0000 HATCH\",\"install_cap_bonus\":72,\"feed_cd\":60,\"harvest_cd\":60,\"breed_cd\":60,\"feed_daily_cap\":100,\"daily_egg_cap\":10000,\"offline_cap_h\":24,\"tap_egg_cap\":60,\"feed_boost\":10000,\"season_index\":0,\"season_started\":0,\"rng_oracle\":\"\"}}" \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 2. Set species (template 662644, fast growth for testing) ==="
$CLEOS push action pockethatch1 setspecies \
  "{\"sp\":{\"template_id\":662644,\"growth_rate\":1000,\"thresh_1\":36000,\"thresh_2\":144000,\"thresh_3\":432000,\"thresh_4\":1296000,\"yield_0\":5,\"yield_1\":15,\"yield_2\":40,\"yield_3\":100,\"yield_4\":300,\"max_stage\":4,\"egg_weight\":100,\"egg_type\":0,\"family\":\"Common\"}}" \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 3. Issue 30M HATCH to pockethatch1 (reward pool bootstrap) ==="
$CLEOS push action hatchtokens1 issue \
  '{"to":"pockethatch1","quantity":"30000000.0000 HATCH","memo":"genesis reward pool"}' \
  -p waxwingsuper@active --sign-with "$WAX_PUB" 2>&1

echo ""
echo "=== 4. Verify pockethatch1 HATCH balance ==="
$CLEOS get table hatchtokens1 pockethatch1 accounts 2>&1

echo ""
echo "=== 5. Start season 1 with 1.5M HATCH bootstrap ==="
$CLEOS push action pockethatch1 newseason \
  '{"bootstrap_release":"1500000.0000 HATCH"}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 6. Verify reward pool ==="
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1

echo ""
echo "=== 7. Verify config ==="
$CLEOS get table pockethatch1 pockethatch1 config 2>&1

echo ""
echo "=== DONE ==="
