#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"

python3 -c "
import json
with open('$SRC/pockethatch.abi') as f:
    abi = json.load(f)

# Ensure these structs exist (add if missing)
needed_structs = {
    'player_row': [
        {'name':'account','type':'name'},{'name':'created_at','type':'uint32'},
        {'name':'egg_balance','type':'uint64'},{'name':'last_harvest','type':'uint32'},
        {'name':'harvest_day','type':'uint32'},{'name':'egg_harvested_today','type':'uint64'},
        {'name':'feeds_today','type':'uint32'},{'name':'feed_day','type':'uint32'},
        {'name':'total_egg_farmed','type':'uint64'},{'name':'total_hatch_burned','type':'uint64'}
    ],
    'creature_row': [
        {'name':'asset_id','type':'uint64'},{'name':'owner','type':'name'},
        {'name':'template_id','type':'uint64'},{'name':'stage','type':'uint8'},
        {'name':'growth_base','type':'uint64'},{'name':'fed_growth','type':'uint64'},
        {'name':'born_at','type':'uint32'},{'name':'last_sync','type':'uint32'},
        {'name':'last_fed','type':'uint32'},{'name':'last_bred','type':'uint32'},
        {'name':'genetics','type':'checksum256'}
    ],
    'rewardpool_row': [
        {'name':'balance','type':'asset'},{'name':'bootstrap_total','type':'asset'},
        {'name':'bootstrap_released','type':'uint64'},{'name':'last_release','type':'uint32'},
        {'name':'lifetime_funded','type':'asset'},{'name':'lifetime_paid','type':'asset'}
    ]
}
existing = {s['name'] for s in abi['structs']}
for name, fields in needed_structs.items():
    if name not in existing:
        abi['structs'].append({'name': name, 'base': '', 'fields': fields})
        print(f'Added: {name}')

# Ensure tables exist
needed_tables = {
    'config': ('config_row', []),
    'speciescfg': ('species_row', ['template_id']),
    'players': ('player_row', ['account']),
    'creatures': ('creature_row', ['asset_id']),
    'rewardpool': ('rewardpool_row', [])
}
existing_tables = {t['name'] for t in abi.get('tables', [])}
for tname, (ttype, keys) in needed_tables.items():
    if tname not in existing_tables:
        abi.setdefault('tables', []).append({
            'name': tname, 'index_type': 'i64',
            'key_names': keys, 'key_types': ['uint64']*len(keys),
            'type': ttype
        })
        print(f'Added table: {tname}')

# Remove any duplicates
seen = set()
abi['structs'] = [s for s in abi['structs'] if not (s['name'] in seen or seen.add(s['name']))]

print(f'Final: {len(abi[\"structs\"])} structs, {len(abi[\"tables\"])} tables')
print('Structs:', sorted([s['name'] for s in abi['structs']]))
print('Tables:', sorted([t['name'] for t in abi['tables']]))

with open('$SRC/pockethatch.abi', 'w') as f:
    json.dump(abi, f, indent=2)
"

echo ""
echo "=== Copy to tmp ==="
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

rm -rf /tmp/phfix && mkdir -p /tmp/phfix
cp "$SRC/pockethatch.wasm" /tmp/phfix/
cp "$SRC/pockethatch.abi" /tmp/phfix/

echo ""
echo "=== Deploy ==="
$CLEOS set contract pockethatch1 /tmp/phfix pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

echo ""
echo "Waiting 15s..."
sleep 15

echo ""
echo "=== Clearconfig ==="
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
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -15
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
