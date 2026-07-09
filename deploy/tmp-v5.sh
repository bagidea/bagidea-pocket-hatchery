#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"

echo "=== Recompile ==="
cd "$SRC"
rm -f build/pockethatch.wasm build/pockethatch.abi
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1 | grep -c "warning" | xargs -I{} echo "{} warnings"
echo "WASM: $(wc -c < build/pockethatch.wasm) bytes"
md5sum build/pockethatch.wasm

echo "=== Patch ABI ==="
python3 -c "
import json
with open('build/pockethatch.abi') as f: abi = json.load(f)
# Add missing structs
needed = {
    'player_row': [{'name':'account','type':'name'},{'name':'created_at','type':'uint32'},{'name':'egg_balance','type':'uint64'},{'name':'last_harvest','type':'uint32'},{'name':'harvest_day','type':'uint32'},{'name':'egg_harvested_today','type':'uint64'},{'name':'feeds_today','type':'uint32'},{'name':'feed_day','type':'uint32'},{'name':'total_egg_farmed','type':'uint64'},{'name':'total_hatch_burned','type':'uint64'}],
    'creature_row': [{'name':'asset_id','type':'uint64'},{'name':'owner','type':'name'},{'name':'template_id','type':'uint64'},{'name':'stage','type':'uint8'},{'name':'growth_base','type':'uint64'},{'name':'fed_growth','type':'uint64'},{'name':'born_at','type':'uint32'},{'name':'last_sync','type':'uint32'},{'name':'last_fed','type':'uint32'},{'name':'last_bred','type':'uint32'},{'name':'genetics','type':'checksum256'}],
    'rewardpool_row': [{'name':'balance','type':'asset'},{'name':'bootstrap_total','type':'asset'},{'name':'bootstrap_released','type':'uint64'},{'name':'last_release','type':'uint32'},{'name':'lifetime_funded','type':'asset'},{'name':'lifetime_paid','type':'asset'}]
}
existing = {s['name'] for s in abi['structs']}
for n, f in needed.items():
    if n not in existing: abi['structs'].append({'name':n,'base':'','fields':f})
# Tables — use configv2
abi['tables'] = [
    {'name':'configv2','index_type':'i64','key_names':[],'key_types':[],'type':'config_row'},
    {'name':'speciescfg','index_type':'i64','key_names':['template_id'],'key_types':['uint64'],'type':'species_row'},
    {'name':'players','index_type':'i64','key_names':['account'],'key_types':['name'],'type':'player_row'},
    {'name':'creatures','index_type':'i64','key_names':['asset_id'],'key_types':['uint64'],'type':'creature_row'},
    {'name':'rewardpool','index_type':'i64','key_names':[],'key_types':[],'type':'rewardpool_row'}
]
# Dedup
seen=set(); abi['structs']=[s for s in abi['structs'] if not(s['name'] in seen or seen.add(s['name']))]
print(f'Structs: {len(abi[\"structs\"])}, Tables: {len(abi[\"tables\"])}')
with open('build/pockethatch.abi','w') as f: json.dump(abi,f,indent=2)
"

rm -rf /tmp/phv5 && mkdir -p /tmp/phv5
cp build/pockethatch.wasm /tmp/phv5/
cp build/pockethatch.abi /tmp/phv5/

echo ""
echo "=== Deploy ==="
$CLEOS set contract pockethatch1 /tmp/phv5 pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "Waiting 15s..."
sleep 15

echo ""
echo "=== Setconfig (configv2 = fresh table) ==="
$CLEOS push action pockethatch1 setconfig \
  '{"cfg":{"token_contract":"hatchtokens1","collection":"pockethatch1","schema_name":"creatures","fee_account":"hatchtokens1","paused":false,"hatch_cost":150,"evolve_cost":300,"breed_cost":"5.0000 HATCH","feed_cost":0,"slot_cost":500,"cosmetic_cost":100,"name_cost":"1.0000 HATCH","install_cap_bonus":72,"feed_cd":60,"harvest_cd":60,"breed_cd":60,"feed_daily_cap":100,"daily_egg_cap":10000,"offline_cap_h":24,"tap_egg_cap":60,"feed_boost":10000,"season_index":0,"season_started":0,"rng_oracle":""}}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Newseason ==="
$CLEOS push action pockethatch1 newseason \
  '{"bootstrap_release":"1500000.0000 HATCH"}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== VERIFY ==="
$CLEOS get table pockethatch1 pockethatch1 configv2 2>&1 | head -20
echo "---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
echo "---"
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -5
echo ""
echo "=== DONE ==="
