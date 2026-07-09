#!/bin/bash
# Read-only live chain probe — confirms the 3 blockers Kevin reported.
# No keys, no writes. Safe to run anytime.
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib:${LD_LIBRARY_PATH:-}"
C="/home/bagidea/leap/usr/bin/cleos"
R="${PH_RPC:-https://waxtestnet.greymass.com}"
CONTRACT="pockethatch1"
BUILT="7a61f065d8ffaa332016564a958347fe087f0241fe9ab95b7bc61a06ee515b61"

echo "=== 1. LIVE CODE_HASH ==="
LIVE=$("$C" -u "$R" get code "$CONTRACT" 2>&1 | grep -oE '[0-9a-f]{64}' | head -1)
echo "  live   : ${LIVE:0:16}..."
echo "  built  : ${BUILT:0:16}...  (ATTR_MAP→vector<uint8_t> fix, NOT yet deployed)"
if [ "$LIVE" = "$BUILT" ]; then echo "  → FIX ALREADY DEPLOYED ✅"; else echo "  → FIX NOT ON CHAIN (old code live) ❌"; fi
echo ""

echo "=== 2. COLLECTION (atomicassets scope=$CONTRACT) ==="
COLL=$("$C" -u "$R" get table atomicassets "$CONTRACT" collections 2>&1 \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('rows',[])))" 2>/dev/null || echo "?")
echo "  rows: $COLL"
echo ""

echo "=== 3. CREATURES ($CONTRACT scope) ==="
CR=$("$C" -u "$R" get table "$CONTRACT" "$CONTRACT" creatures 2>&1 \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('rows',[])))" 2>/dev/null || echo "?")
echo "  rows: $CR"
echo ""

echo "=== 4. CONFIG + SPECIES (sanity) ==="
"$C" -u "$R" get table "$CONTRACT" "$CONTRACT" config 2>&1 | python3 -c "import json,sys; r=json.load(sys.stdin).get('rows',[]); print('config:', r[0] if r else 'EMPTY')" 2>/dev/null || echo "config: (query failed)"
"$C" -u "$R" get table "$CONTRACT" "$CONTRACT" speciescfg 2>&1 | python3 -c "import json,sys; print('species:', len(json.load(sys.stdin).get('rows',[])), 'rows')" 2>/dev/null || echo "species: (query failed)"
