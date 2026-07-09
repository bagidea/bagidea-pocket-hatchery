#!/bin/bash
source "$(dirname "$0")/lib.sh"
echo "=== creatures table (scope $CONTRACT) ==="
c get table "$CONTRACT" "$CONTRACT" creatures --limit 10 2>&1 | head -40
echo ""
echo "=== HATCH supply ==="
c get currency stats "$TOKEN_CONTRACT" HATCH 2>&1 | python3 -c "import json,sys; print(json.load(sys.stdin)['HATCH']['supply'])"
echo ""
echo "=== atomicassets owned by $PLAYER ==="
c get table atomicassets "$PLAYER" assets --limit 10 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('count=',len(d['rows']))
for r in d['rows']:
    print(r['asset_id'], r['collection_name'], r['schema_name'], 'templ='+str(r['template_id']))
"
