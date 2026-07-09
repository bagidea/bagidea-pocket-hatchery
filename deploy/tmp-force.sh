#!/bin/bash
set -e
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"

echo "=== Force clean rebuild ==="
cd "$SRC"
rm -f build/pockethatch.wasm build/pockethatch.abi
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1
echo "WASM: $(wc -c < build/pockethatch.wasm) bytes"

# Quick hash check
md5sum build/pockethatch.wasm

# Clean ABI (remove duplicates that linter added)
python3 -c "
import json
with open('build/pockethatch.abi') as f: abi = json.load(f)
seen = set()
abi['structs'] = [s for s in abi['structs'] if s['name'] not in seen and not seen.add(s['name'])]
# Ensure tables exist
required = {'config':'config_row','speciescfg':'species_row','players':'player_row','creatures':'creature_row','rewardpool':'rewardpool_row'}
existing = {t['name'] for t in abi.get('tables',[])}
for tname, ttype in required.items():
    if tname not in existing:
        abi.setdefault('tables',[]).append({
            'name':tname,'index_type':'i64','key_names':[],'key_types':[],'type':ttype
        })
print(f'Structs: {len(abi[\"structs\"])}, Tables: {len(abi[\"tables\"])}')
with open('build/pockethatch.abi','w') as f: json.dump(abi,f,indent=2)
"

rm -rf /tmp/phforce && mkdir -p /tmp/phforce
cp build/pockethatch.wasm /tmp/phforce/
cp build/pockethatch.abi /tmp/phforce/

echo ""
echo "=== Deploy (force wasm+abi) ==="
$CLEOS set contract pockethatch1 /tmp/phforce pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Verify code hash changed ==="
$CLEOS get code pockethatch1 2>&1 | head -2

echo ""
echo "Waiting 15s for propagation..."
sleep 15

echo ""
echo "=== Clearconfig (low-level db_remove_i64) ==="
$CLEOS push action pockethatch1 clearconfig '{}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "=== Setconfig ==="
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
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -20
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1

echo ""
echo "=== DONE! ==="
