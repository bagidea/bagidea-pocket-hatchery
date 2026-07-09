#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

echo "=== firsthatch (dual auth via wallet) ==="
$CLEOS push action pockethatch1 firsthatch \
  '{"owner":"waxwingsuper","egg_type":0}' \
  -p waxwingsuper@active -p pockethatch1@active 2>&1

echo ""
echo "Waiting 15s for mint + propagation..."
sleep 15

echo ""
echo "=== Check creatures table ==="
$CLEOS get table pockethatch1 pockethatch1 creatures 2>&1

echo ""
echo "=== Check player ==="
$CLEOS get table pockethatch1 pockethatch1 players 2>&1

echo ""
echo "=== NFT via waxwing ==="
curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  -H "content-type: application/json" \
  -d '{"cmd":"nftassets","args":"waxwingsuper"}' 2>&1 | head -60
