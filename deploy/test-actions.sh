#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Test: setpaused (takes a bool) ==="
c push action "$CONTRACT" setpaused '[true]' -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== Test: rmspecies (takes uint64) ==="
c push action "$CONTRACT" rmspecies '[662644]' -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== Test: initplayer via player ==="
c push action "$CONTRACT" initplayer "[\"$PLAYER\"]" -p "$PLAYER@active" 2>&1 | tail -3

echo ""
echo "=== Test: newseason ==="
c push action "$CONTRACT" newseason '["0.0000 HATCH"]' -p "$CONTRACT@active" 2>&1 | tail -5
