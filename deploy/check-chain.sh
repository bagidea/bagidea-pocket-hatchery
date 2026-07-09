#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib:${LD_LIBRARY_PATH:-}"
CLEOS="/home/bagidea/leap/usr/bin/cleos"
RPC="https://waxtestnet.greymass.com"

echo "=== Chain Info ==="
"$CLEOS" -u "$RPC" get info 2>&1 | head -5

echo ""
echo "=== Account pockethatch1 ==="
"$CLEOS" -u "$RPC" get account pockethatch1 2>&1 | head -10

echo ""
echo "=== Account hatchtokens1 ==="
"$CLEOS" -u "$RPC" get account hatchtokens1 2>&1 | head -10
