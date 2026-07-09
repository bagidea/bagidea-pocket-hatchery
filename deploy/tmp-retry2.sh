#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

echo "Waiting 10s for ABI to propagate..."
sleep 10

echo "=== Check on-chain ABI ==="
curl -s "https://waxtestnet.greymass.com/v1/chain/get_abi" -H "content-type: application/json" \
  -d '{"account_name":"pockethatch1"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'abi' in d:
    names=[s['name'] for s in d['abi']['structs']]
    seen=set()
    dups=[]
    for n in names:
        if n in seen: dups.append(n)
        seen.add(n)
    if dups: print('DUPLICATES:', dups)
    else: print('Clean!', len(names), 'structs')
    print('Tables:', [t['name'] for t in d['abi'].get('tables',[])])
else:
    print('Error:', d)
"

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
echo "=== Verify config ==="
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -15

echo ""
echo "=== Verify rewardpool ==="
$CLEOS get table pockethatch1 pockethatch1 rewardpool 2>&1
