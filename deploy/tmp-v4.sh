#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"

echo "=== Recompile ==="
cd "$SRC"
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1 | tail -2

echo "=== Check ABI tables (linter-patched) ==="
python3 -c "import json; abi=json.load(open('build/pockethatch.abi')); print('structs:', len(abi['structs']), 'tables:', len(abi.get('tables',[])))"

echo "=== Check for duplicate structs ==="
python3 -c "
import json
with open('build/pockethatch.abi') as f: abi = json.load(f)
names = [s['name'] for s in abi['structs']]
seen = set()
for n in names:
    if n in seen: print('DUPLICATE:', n)
    seen.add(n)
print('All unique' if len(names)==len(seen) else 'DUPLICATES FOUND')
"

echo "=== Copy to tmp ==="
rm -rf /tmp/phv4 && mkdir -p /tmp/phv4
cp build/pockethatch.wasm /tmp/phv4/
cp build/pockethatch.abi /tmp/phv4/

echo ""
echo "=== Deploy (with linter-fixed ABI) ==="
$CLEOS set contract pockethatch1 /tmp/phv4 pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Clear old config ==="
$CLEOS push action pockethatch1 clearconfig '{}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Set config ==="
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
echo "--- config ---"
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -15
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
echo "--- speciescfg ---"
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -10
