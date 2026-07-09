#!/bin/bash
# Task 3c: configure the contract — setconfig, setspecies, newseason.
source "$(dirname "$0")/lib.sh"
D="$(dirname "$0")"
WPW="$(cat "$HOME/.ph/wallet.pw")"
cleos wallet unlock --password "$WPW" >/dev/null 2>&1 || true

pushp() {  # action jsonfile extra-auth...
  local act="$1" jf="$2"
  c push action "$CONTRACT" "$act" "$(cat "$D/$jf")" \
    -p "$CONTRACT@active" 2>&1 | tee "/tmp/cfg-$act.json" | grep -E 'executed transaction|assertion' | head -2
  echo "   → tx=$(grep -oE '[0-9a-f]{64}' "/tmp/cfg-$act.json" | head -1)"
}

echo "=== setconfig ==="; pushp setconfig args-setconfig.json
echo "=== setspecies (template_id=662644) ==="; pushp setspecies args-setspecies.json
echo "=== newseason (activates claimreward path, bootstrap=0.0000 HATCH) ==="
c push action "$CONTRACT" newseason '["0.0000 HATCH"]' -p "$CONTRACT@active" 2>&1 | tee /tmp/cfg-newseason.json | grep -E 'executed transaction|assertion' | head -2
echo "   → tx=$(grep -oE '[0-9a-f]{64}' /tmp/cfg-newseason.json | head -1)"

echo ""
echo "=== verify config on chain ==="
c get table "$CONTRACT" "$CONTRACT" config 2>&1 | python3 -c "
import json,sys
r=json.load(sys.stdin)['rows'][0]
for k in ['token_contract','collection','schema_name','hatch_cost','evolve_cost','feed_cd','feed_boost','season_index']:
    print('  ',k,'=',r[k])
" 2>&1 | head -12

echo ""
echo "=== verify species on chain ==="
c get table "$CONTRACT" "$CONTRACT" speciescfg 2>&1 | python3 -c "
import json,sys
r=json.load(sys.stdin)['rows'][0]
for k in ['template_id','growth_rate','thresh_1','thresh_2','max_stage','yield_0','egg_type']:
    print('  ',k,'=',r[k])
" 2>&1 | head -12
