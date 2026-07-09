#!/bin/bash
source "$(dirname "$0")/lib.sh"

echo "=== Test accelerate (name, uint64, asset) ==="
# accelerate needs an existing creature - let's just see if the deserialization works
c push action "$CONTRACT" accelerate "[\"$PLAYER\",999999,\"1.0000 HATCH\"]" -p "$PLAYER@active" 2>&1 | tail -5

echo ""
echo "=== Test breed (name, uint64, uint64) ==="
c push action "$CONTRACT" breed "[\"$PLAYER\",999999,999998]" -p "$PLAYER@active" 2>&1 | tail -5

echo ""
echo "=== Test setname (name, uint64, string) ==="
c push action "$CONTRACT" setname "[\"$PLAYER\",999999,\"testname\"]" -p "$PLAYER@active" 2>&1 | tail -5

echo ""
echo "=== Test burncreature (name, uint64) ==="
c push action "$CONTRACT" burncreature "[\"$PLAYER\",999999]" -p "$PLAYER@active" 2>&1 | tail -5

echo ""
echo "=== Test unlockslot (name, uint8) ==="
c push action "$CONTRACT" unlockslot "[\"$PLAYER\",4]" -p "$PLAYER@active" 2>&1 | tail -5

echo ""
echo "=== Test equipcosmetic (name, uint64, uint64) ==="
c push action "$CONTRACT" equipcosmetic "[\"$PLAYER\",999999,123]" -p "$PLAYER@active" 2>&1 | tail -5
