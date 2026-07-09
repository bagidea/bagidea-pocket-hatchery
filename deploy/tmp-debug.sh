#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"

echo "=== Check ABI ==="
$CLEOS get abi pockethatch1 2>&1 | python3 -c "import sys,json; a=json.load(sys.stdin); print(json.dumps(a,dict(abi=1)).get('abi',{}).keys())" 2>/dev/null || $CLEOS get abi pockethatch1 2>&1 | grep '"name": "config"' | head -2

echo ""
echo "=== Try get table ==="
$CLEOS get table pockethatch1 pockethatch1 config 2>&1 | head -10

echo ""
echo "=== Try with --abi-file ==="
$CLEOS get table --abi-file pockethatch1:/tmp/phbuild/pockethatch.abi pockethatch1 pockethatch1 config 2>&1 | head -10
