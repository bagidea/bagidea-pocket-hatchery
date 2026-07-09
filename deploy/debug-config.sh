#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== 1. setpaused(true) — reads config, modifies paused, writes back ==="
c push action "$CONTRACT" setpaused '[true]' -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 2. setpaused(false) — second read-modify-write ==="
c push action "$CONTRACT" setpaused '[false]' -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 3. firsthatch — uses _cfg() ==="
c push action "$CONTRACT" firsthatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1 | tail -5
