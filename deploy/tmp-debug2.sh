#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos -u https://waxtestnet.greymass.com"

echo "=== Raw code hash ==="
$CLEOS get code pockethatch1 2>&1

echo ""
echo "=== Raw ABI (first 2k) ==="
$CLEOS get abi pockethatch1 2>&1 | head -100

echo ""
echo "=== Try tables with account scope ==="
$CLEOS get table pockethatch1 pockethatch1 speciescfg 2>&1 | head -10
