#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos"
RPC="https://waxtestnet.greymass.com"
TOKEN="hatchtokens1"
TOKEN_PUB="EOS8YFbSveaoUcEeN7SK33YLyYqLjFoyqPCKTfnhMBRY9DuAqDGhB"

echo "=== Check HATCH token stats ==="
$CLEOS -u $RPC get table "$TOKEN" HATCH stat 2>&1

echo ""
echo "=== Check pockethatch1 HATCH balance ==="
$CLEOS -u $RPC get table "$TOKEN" pockethatch1 accounts 2>&1
