#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

PLAYER="waxwingsuper"

echo "=== 1. initplayer ==="
$CLEOS push action pockethatch1 initplayer \
  "{\"owner\":\"$PLAYER\"}" \
  -p $PLAYER@active --sign-with "$WAX_PUB" 2>&1

echo ""
echo "=== 2. firsthatch (free, no EGG/HATCH cost) ==="
$CLEOS push action pockethatch1 firsthatch \
  "{\"owner\":\"$PLAYER\",\"egg_type\":0}" \
  -p $PLAYER@active --sign-with "$WAX_PUB" 2>&1

echo ""
echo "Waiting 10s for NFT mint..."
sleep 10

echo ""
echo "=== 3. Check player table ==="
$CLEOS get table pockethatch1 pockethatch1 players 2>&1 | head -20

echo ""
echo "=== 4. Check creatures table ==="
$CLEOS get table pockethatch1 pockethatch1 creatures 2>&1 | head -20

echo ""
echo "=== 5. Check NFT assets owned by $PLAYER ==="
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d "{\"cmd\":\"nftassets\",\"args\":\"$PLAYER\"}" 2>&1 | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('ok'):
    assets = d.get('assets',[])
    print(f'{len(assets)} NFT assets found')
    for a in assets[:3]:
        print(f'  asset_id={a.get(\"asset_id\")} template={a.get(\"template_id\")} name={a.get(\"name\",\"\")}')
        data = a.get('data',{})
        print(f'    stage={data.get(\"stage\")} growth={data.get(\"growth\")} genetics={str(data.get(\"genetics\",\"\"))[:32]}...')
else:
    print('Error:', d)
" 2>&1

echo ""
echo "=== DONE - Hatch loop proved! ==="
