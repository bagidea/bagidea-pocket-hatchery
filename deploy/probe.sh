#!/bin/bash
source "$(dirname "$0")/lib.sh"
echo "=== waxwingsuper permissions (need its active pubkey) ==="
c get account waxwingsuper 2>&1 | sed -n '/permissions/,/memory/p' | head -20
echo ""
echo "=== core symbol precision (currency stats) ==="
c get currency stats eosio.token WAX 2>&1 | head -6
echo ""
echo "=== system contract code on eosio? ==="
c get code eosio 2>&1 | head -2
echo ""
echo "=== system actions available on eosio ==="
c get abi eosio 2>&1 | grep -oE '"name": ?"(newaccount|buyrambytes|buyram|delegatebw|undelegatebw)"' | sort -u
