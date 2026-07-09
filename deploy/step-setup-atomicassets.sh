#!/bin/bash
# Task 3b: AtomicAssets collection + schema + template for pockethatch1.
source "$(dirname "$0")/lib.sh"
D="$(dirname "$0")"
WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

# createcol returns an error if the collection already exists; treat that as OK.
run_aa() {
  local act="$1" argf="$2"
  "$CLEOS_BIN" -u "$RPC" push action atomicassets "$act" "$(cat "$D/$argf")" \
    -p "$CONTRACT@active" 2>&1 | tee "/tmp/aa-$act.json" \
    | grep -E 'executed transaction|assertion|error bin' | head -3
  grep -oE '[0-9a-f]{64}' "/tmp/aa-$act.json" | head -1
}

echo "=== createcol ==="
echo "  tx=$(run_aa createcol args-aa-createcol.json)"
echo ""
echo "=== createschema ==="
echo "  tx=$(run_aa createschema args-aa-createschema.json)"
echo ""
echo "=== createtempl ==="
T="$(run_aa createtempl args-aa-createtempl.json)"
echo "  tx=$T"

echo ""
echo "=== resolve the assigned template_id (query AA templates table for our collection) ==="
"$CLEOS_BIN" -u "$RPC" get table atomicassets "$COLLECTION" templates \
  --lower 0 --limit 10 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d['rows']:
    print('template_id=%s  schema=%s  transferable=%s  max_supply=%s' % (r['template_id'], r['schema_name'], r['transferable'], r['max_supply']))
" 2>&1 | head -12
