#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

echo "=== firsthatch ==="
$CLEOS push action pockethatch1 firsthatch \
  '{"owner":"waxwingsuper","egg_type":0}' \
  -p waxwingsuper@active -p pockethatch1@active \
  --sign-with "$WAX_PUB" --sign-with "$PH_PUB" 2>&1

echo ""
echo "Waiting 10s..."
sleep 10

echo ""
echo "=== Check creatures ==="
$CLEOS get table pockethatch1 pockethatch1 creatures 2>&1

echo ""
echo "=== Check NFT ==="
curl -s "https://waxtestnet.greymass.com/v1/chain/get_table_rows" \
  -H "content-type: application/json" \
  -d '{"code":"atomicassets","scope":"waxwingsuper","table":"assets","json":true,"limit":5}' 2>&1 | head -30
