#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
PYTHON=/usr/bin/python3
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"

# Deduplicate ABI
$PYTHON -c "
import json
with open('$SRC/pockethatch.abi') as f:
    abi = json.load(f)

# Dedup structs by name (keep first occurrence)
seen = set()
unique_structs = []
for s in abi['structs']:
    if s['name'] not in seen:
        seen.add(s['name'])
        unique_structs.append(s)
abi['structs'] = unique_structs

# Verify tables are defined properly
required_tables = ['config', 'speciescfg', 'players', 'creatures', 'rewardpool']
existing_tables = {t['name'] for t in abi.get('tables', [])}
missing = [t for t in required_tables if t not in existing_tables]
if missing:
    # Add missing tables
    struct_to_table = {
        'config': 'config_row', 'speciescfg': 'species_row',
        'players': 'player_row', 'creatures': 'creature_row', 'rewardpool': 'rewardpool_row'
    }
    table_keys = {
        'config': [], 'speciescfg': ['template_id'],
        'players': ['account'], 'creatures': ['asset_id'], 'rewardpool': []
    }
    key_types = {
        'config': [], 'speciescfg': ['uint64'],
        'players': ['name'], 'creatures': ['uint64'], 'rewardpool': []
    }
    for t in missing:
        abi['tables'].append({
            'name': t, 'index_type': 'i64',
            'key_names': table_keys[t], 'key_types': key_types[t],
            'type': struct_to_table[t]
        })

print(f'Structs: {len(abi[\"structs\"])} (was with dups), Tables: {len(abi[\"tables\"])}')
with open('$SRC/pockethatch.abi', 'w') as f:
    json.dump(abi, f, indent=2)
print('ABI saved clean')
"

echo "=== Check clean ABI ==="
$PYTHON -c "
import json
with open('$SRC/pockethatch.abi') as f: abi = json.load(f)
names = [s['name'] for s in abi['structs']]
print('Struct names:', names)
print('Tables:', [t['name'] for t in abi['tables']])
"

# Copy and deploy
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

rm -rf /tmp/phclean && mkdir -p /tmp/phclean
cp "$SRC/pockethatch.wasm" /tmp/phclean/
cp "$SRC/pockethatch.abi" /tmp/phclean/

echo ""
echo "=== Deploy clean ABI ==="
$CLEOS set contract pockethatch1 /tmp/phclean pockethatch.wasm pockethatch.abi \
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
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -20
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
echo "--- speciescfg ---"
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -10
echo ""
echo "=== DONE ==="
