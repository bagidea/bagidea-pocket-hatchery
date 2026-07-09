#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"

echo "=== firsthatch (retry) ==="
$CLEOS push action pockethatch1 firsthatch \
  '{"owner":"waxwingsuper","egg_type":0}' \
  -p waxwingsuper@active -p pockethatch1@active 2>&1

echo ""
echo "=== Check creatures ==="
$CLEOS get table pockethatch1 pockethatch1 creatures 2>&1 | head -15
