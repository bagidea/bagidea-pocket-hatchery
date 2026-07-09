#!/bin/bash
set -e
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"

echo "=== 0. Recompile ==="
cd "$SRC"
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1 | grep -c "warning" | xargs -I{} echo "{} warnings (ricardian, OK)"
echo "WASM: $(wc -c < build/pockethatch.wasm) bytes"

echo "=== 0b. Patch ABI (add table structs + definitions) ==="
python3 -c "
import json
with open('build/pockethatch.abi') as f:
    abi = json.load(f)
abi['structs'] += [
    {'name':'player_row','base':'','fields':[{'name':'account','type':'name'},{'name':'created_at','type':'uint32'},{'name':'egg_balance','type':'uint64'},{'name':'last_harvest','type':'uint32'},{'name':'harvest_day','type':'uint32'},{'name':'egg_harvested_today','type':'uint64'},{'name':'feeds_today','type':'uint32'},{'name':'feed_day','type':'uint32'},{'name':'total_egg_farmed','type':'uint64'},{'name':'total_hatch_burned','type':'uint64'}]},
    {'name':'creature_row','base':'','fields':[{'name':'asset_id','type':'uint64'},{'name':'owner','type':'name'},{'name':'template_id','type':'uint64'},{'name':'stage','type':'uint8'},{'name':'growth_base','type':'uint64'},{'name':'fed_growth','type':'uint64'},{'name':'born_at','type':'uint32'},{'name':'last_sync','type':'uint32'},{'name':'last_fed','type':'uint32'},{'name':'last_bred','type':'uint32'},{'name':'genetics','type':'checksum256'}]},
    {'name':'rewardpool_row','base':'','fields':[{'name':'balance','type':'asset'},{'name':'bootstrap_total','type':'asset'},{'name':'bootstrap_released','type':'uint64'},{'name':'last_release','type':'uint32'},{'name':'lifetime_funded','type':'asset'},{'name':'lifetime_paid','type':'asset'}]}
]
abi['tables'] = [
    {'name':'config','index_type':'i64','key_names':[],'key_types':[],'type':'config_row'},
    {'name':'speciescfg','index_type':'i64','key_names':['template_id'],'key_types':['uint64'],'type':'species_row'},
    {'name':'players','index_type':'i64','key_names':['account'],'key_types':['name'],'type':'player_row'},
    {'name':'creatures','index_type':'i64','key_names':['asset_id'],'key_types':['uint64'],'type':'creature_row'},
    {'name':'rewardpool','index_type':'i64','key_names':[],'key_types':[],'type':'rewardpool_row'}
]
with open('build/pockethatch.abi','w') as f:
    json.dump(abi, f, indent=2)
print(f'ABI: {len(abi[\"structs\"])} structs, {len(abi[\"tables\"])} tables')
"

# Copy to WSL tmp
rm -rf /tmp/phfinal && mkdir -p /tmp/phfinal
cp build/pockethatch.wasm /tmp/phfinal/
cp build/pockethatch.abi /tmp/phfinal/

echo ""
echo "=== 1. Deploy ==="
$CLEOS set contract pockethatch1 /tmp/phfinal pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 2. Clear old config (incompatible binary) ==="
$CLEOS push action pockethatch1 clearconfig '{}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 3. Set config (fast test cooldowns) ==="
$CLEOS push action pockethatch1 setconfig \
  '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchtokens1","paused":false,"hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":60,"harvest_cd":60,"breed_cd":60,"feed_daily_cap":100,"daily_egg_cap":10000,"offline_cap_h":24,"tap_egg_cap":60,"feed_boost":10000,"season_index":0,"season_started":0,"rng_oracle":""}}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 4. Set species (template 662644, fast growth) ==="
$CLEOS push action pockethatch1 setspecies \
  '{"sp":{"template_id":662644,"growth_rate":1000,"thresh_1":36000,"thresh_2":144000,"thresh_3":432000,"thresh_4":1296000,"yield_0":5,"yield_1":15,"yield_2":40,"yield_3":100,"yield_4":300,"max_stage":4,"egg_weight":100,"egg_type":0,"family":"Common"}}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 5. Issue 30M HATCH + transfer to pockethatch1 ==="
$CLEOS push action hatchtokens1 issue \
  '{"to":"waxwingsuper","quantity":"30000000.0000 HATCH","memo":"genesis"}' \
  -p waxwingsuper@active --sign-with "$WAX_PUB" 2>&1

$CLEOS push action hatchtokens1 transfer \
  '{"from":"waxwingsuper","to":"pockethatch1","quantity":"30000000.0000 HATCH","memo":"reward pool"}' \
  -p waxwingsuper@active --sign-with "$WAX_PUB" 2>&1

echo "Balance:"
$CLEOS get table hatchtokens1 pockethatch1 accounts 2>&1

echo ""
echo "=== 6. Start season 1 (1.5M HATCH bootstrap) ==="
$CLEOS push action pockethatch1 newseason \
  '{"bootstrap_release":"1500000.0000 HATCH"}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== 7. Verify all tables ==="
echo "--- config ---"
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -30
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
echo "--- speciescfg ---"
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -15

echo ""
echo "=== DONE ==="
