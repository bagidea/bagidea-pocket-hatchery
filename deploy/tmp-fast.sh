#!/bin/bash
set -e
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
SRC="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"

# 0. Recompile
echo "=== 0. Recompile ==="
cd "$SRC"
cdt-cpp -I . -o build/pockethatch.wasm pockethatch.cpp --abigen 2>&1 | tail -3
echo "Recompile OK ($(wc -c < build/pockethatch.wasm) bytes)"

# Patch ABI: add missing structs + tables
# We use the previously-patched ABI as a template, or patch the freshly generated one
# For simplicity, copy the existing patched ABI from the previous build
# Actually just redo the patches inline using sed replacements
cp build/pockethatch.abi build/pockethatch.abi.bak

# Insert player_row, creature_row, rewardpool_row into structs AND fix tables
# This is hacky but works: inject the 3 structs before '],"actions":'
# And replace '"tables": []' with the full tables definition

# Step 1: inject structs before closing of struct array
# Find the line with '],"actions":' and insert before it
STRUCTS_INSERT='        },
        {
            "name": "player_row",
            "base": "",
            "fields": [
                { "name": "account", "type": "name" },
                { "name": "created_at", "type": "uint32" },
                { "name": "egg_balance", "type": "uint64" },
                { "name": "last_harvest", "type": "uint32" },
                { "name": "harvest_day", "type": "uint32" },
                { "name": "egg_harvested_today", "type": "uint64" },
                { "name": "feeds_today", "type": "uint32" },
                { "name": "feed_day", "type": "uint32" },
                { "name": "total_egg_farmed", "type": "uint64" },
                { "name": "total_hatch_burned", "type": "uint64" }
            ]
        },
        {
            "name": "creature_row",
            "base": "",
            "fields": [
                { "name": "asset_id", "type": "uint64" },
                { "name": "owner", "type": "name" },
                { "name": "template_id", "type": "uint64" },
                { "name": "stage", "type": "uint8" },
                { "name": "growth_base", "type": "uint64" },
                { "name": "fed_growth", "type": "uint64" },
                { "name": "born_at", "type": "uint32" },
                { "name": "last_sync", "type": "uint32" },
                { "name": "last_fed", "type": "uint32" },
                { "name": "last_bred", "type": "uint32" },
                { "name": "genetics", "type": "checksum256" }
            ]
        },
        {
            "name": "rewardpool_row",
            "base": "",
            "fields": [
                { "name": "balance", "type": "asset" },
                { "name": "bootstrap_total", "type": "asset" },
                { "name": "bootstrap_released", "type": "uint64" },
                { "name": "last_release", "type": "uint32" },
                { "name": "lifetime_funded", "type": "asset" },
                { "name": "lifetime_paid", "type": "asset" }
            ]
        }'

# Use sed to insert before '],"actions":'
# The ABI is a single-line or multi-line JSON. Use a placeholder approach.
# Actually, the ABI from CDT is pretty-printed. Let's just use a Python one-liner if available, or fall back to a simpler approach.
# Check for python3
if command -v python3 &>/dev/null; then
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
print('ABI patched:', len(abi['structs']), 'structs,', len(abi['tables']), 'tables')
" 2>&1
else
    echo "WARNING: python3 not available, ABI tables will be missing"
fi

# Copy to WSL tmp
rm -rf /tmp/phbuild4 && mkdir -p /tmp/phbuild4
cp build/pockethatch.wasm /tmp/phbuild4/
cp build/pockethatch.abi /tmp/phbuild4/
echo "Files ready: $(ls /tmp/phbuild4/)"

# 1. Deploy
echo ""
echo "=== 1. Deploy ==="
$CLEOS set contract pockethatch1 /tmp/phbuild4 pockethatch.wasm pockethatch.abi \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

# 2. Issue HATCH to waxwingsuper then transfer to pockethatch1
echo ""
echo "=== 2. Issue 30M HATCH ==="
$CLEOS push action hatchtokens1 issue \
  '{"to":"waxwingsuper","quantity":"30000000.0000 HATCH","memo":"genesis"}' \
  -p waxwingsuper@active --sign-with "$WAX_PUB" 2>&1

echo "Transfer to pockethatch1..."
$CLEOS push action hatchtokens1 transfer \
  '{"from":"waxwingsuper","to":"pockethatch1","quantity":"30000000.0000 HATCH","memo":"reward pool"}' \
  -p waxwingsuper@active --sign-with "$WAX_PUB" 2>&1

echo ""
echo "Balance:"
$CLEOS get table hatchtokens1 pockethatch1 accounts 2>&1

# 3. Set species
echo ""
echo "=== 3. Set species ==="
$CLEOS push action pockethatch1 setspecies \
  '{"sp":{"template_id":662644,"growth_rate":1000,"thresh_1":36000,"thresh_2":144000,"thresh_3":432000,"thresh_4":1296000,"yield_0":5,"yield_1":15,"yield_2":40,"yield_3":100,"yield_4":300,"max_stage":4,"egg_weight":100,"egg_type":0,"family":"Common"}}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

# 4. Start season
echo ""
echo "=== 4. Start season 1 ==="
$CLEOS push action pockethatch1 newseason \
  '{"bootstrap_release":"1500000.0000 HATCH"}' \
  -p pockethatch1@active --sign-with "$PH_PUB" 2>&1

# 5. Verify
echo ""
echo "=== 5. Verify ==="
echo "--- rewardpool ---"
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
echo "--- speciescfg ---"
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -10
echo "--- config (may fail if old data incompatible) ---"
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -10 || echo "(config table needs setconfig to overwrite old data)"
