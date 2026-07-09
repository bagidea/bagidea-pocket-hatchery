#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Adding eosio.code permission to pockethatch1@active ==="
c push action eosio updateauth "{\"account\":\"$CONTRACT\",\"permission\":\"active\",\"parent\":\"owner\",\"auth\":{\"threshold\":1,\"keys\":[{\"key\":\"$CONTRACT_PUB\",\"weight\":1}],\"accounts\":[{\"permission\":{\"actor\":\"$CONTRACT\",\"permission\":\"eosio.code\"},\"weight\":1}],\"waits\":[]}}" -p "$CONTRACT@owner" 2>&1 | tail -5

echo ""
echo "=== Verify ==="
c get account "$CONTRACT" 2>&1 | grep -A 10 "permission links"
