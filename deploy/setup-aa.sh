#!/bin/bash
source "$(dirname "$0")/lib.sh"
D="$(dirname "$0")"

echo "=== 1. Create AtomicAssets collection ==="
c push action atomicassets createcol "$(cat "$D/args-aa-createcol.json")" -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 2. Create schema ==="
c push action atomicassets createschema "$(cat "$D/args-aa-createschema.json")" -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 3. Create template ==="
c push action atomicassets createtempl "$(cat "$D/args-aa-createtempl.json")" -p "$CONTRACT@active" 2>&1 | tail -3

echo ""
echo "=== 4. Verify collection ==="
c get table atomicassets "$COLLECTION" collections 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    print(f'Collection: {rows[0][\"collection_name\"]}')
else:
    print('Collection not found!')
" 2>&1

echo ""
echo "=== 5. Verify templates ==="
c get table atomicassets "$COLLECTION" templates --lower 0 --limit 10 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
for r in rows:
    print(f'  template_id={r[\"template_id\"]} schema={r[\"schema_name\"]}')
" 2>&1
