#!/bin/bash
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib"
CLEOS="/home/bagidea/leap/usr/bin/cleos"
RPC="https://waxtestnet.greymass.com"

# Get waxwingsuper public key from chain
WAXWING_PUB=$($CLEOS -u $RPC get account waxwingsuper 2>&1 | grep "active" -A1 | grep -o 'EOS[A-Za-z0-9]\+' | head -1)
echo "WAXWING_PUB=$WAXWING_PUB"

# Get pockethatch1 public key
PH_PUB=$($CLEOS -u $RPC get account pockethatch1 2>&1 | grep "active" -A1 | grep -o 'EOS[A-Za-z0-9]\+' | head -1)
echo "PH_PUB=$PH_PUB"

echo "=== Delegate 5 WAX NET from waxwingsuper to pockethatch1 ==="
$CLEOS -u $RPC push action eosio delegatebw \
  '{"from":"waxwingsuper","receiver":"pockethatch1","stake_net_quantity":"5.00000000 WAX","stake_cpu_quantity":"0.00000000 WAX","transfer":false}' \
  -p waxwingsuper@active --sign-with "$WAXWING_PUB" 2>&1

echo "=== Verify pockethatch1 NET ==="
$CLEOS -u $RPC get account pockethatch1 2>&1 | grep -A5 "net bandwidth"
