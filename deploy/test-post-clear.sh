#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Test setpaused (should work if config is now valid) ==="
c push action "$CONTRACT" setpaused '[true]' -p "$CONTRACT@active" 2>&1 | tail -5

echo ""
echo "=== Check contract RAM ==="
c get account "$CONTRACT" 2>&1 | grep -E "memory|ram|quota|used"
