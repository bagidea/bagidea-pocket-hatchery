#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"
WAX_PUB="EOS4xELMsfNLRH4CZVcoixo8sD7WjTvYPmEcZY4mfAzqemKKZ7fab"
PH_PUB="EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX"

# Sign firsthatch with both keys as JSON array
echo "=== firsthatch (JSON array --sign-with) ==="
$CLEOS push action pockethatch1 firsthatch \
  '{"owner":"waxwingsuper","egg_type":0}' \
  -p waxwingsuper@active -p pockethatch1@active \
  --sign-with "[\"$WAX_PUB\",\"$PH_PUB\"]" 2>&1