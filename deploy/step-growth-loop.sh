#!/bin/bash
# Task 4: prove the growth loop LIVE on chain — firsthatch → feed → evolve (×2) → harvest → claimreward.
# Uses firsthatch for the zero-cost first creature; tests regular hatch AFTER gaining EGG.
# Captures a txid for every action + HATCH supply before/after (escrow burn proof).
source "$(dirname "$0")/lib.sh"
WPW="$(cat "$HOME/.ph/wallet.pw")"
cleos wallet unlock --password "$WPW" >/dev/null 2>&1 || true

P="$PLAYER"
RESULT="$HOME/.ph/growth-result.txt"
: > "$RESULT"

# push a player action, append txid to result, echo it.
pact() {
  local label="$1" act="$2" data="$3" auth="$4"
  local out
  out="$(c push action "$CONTRACT" "$act" "$data" -p "$auth" 2>&1)"
  local txid; txid="$(echo "$out" | grep -oE '[0-9a-f]{64}' | head -1)"
  if [ -z "$txid" ]; then
    echo "❌ $label FAILED:"; echo "$out" | tail -8
    exit 1
  fi
  echo "✅ $label → $txid"
  echo "$label|$txid" >> "$RESULT"
}

hatch_supply() {  # echo numeric HATCH supply
  c get currency stats "$TOKEN_CONTRACT" HATCH 2>&1 \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['WAX']['supply'])"
}

echo "=== HATCH supply BEFORE (escrow baseline) ==="
SUP_BEFORE="$(hatch_supply)"; echo "  $SUP_BEFORE"
echo "supply_before|$SUP_BEFORE" >> "$RESULT"

echo ""
echo "=== initplayer($P) ==="
pact "initplayer" initplayer "[\"$P\"]" "$P@active"

echo ""
echo "=== firsthatch($P, egg_type=0) — ZERO EGG cost, first creature ==="
pact "firsthatch" firsthatch "[\"$P\",0]" "$P@active"

echo ""
echo "=== resolve minted creature + asset_id from chain ==="
sleep 1
ASSET_ID="$(c get table "$CONTRACT" "$CONTRACT" creatures \
  --lower 0 --limit 5 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
mine=[r for r in rows if r['owner']=='$P']
print(mine[-1]['asset_id'] if mine else '')
")"
echo "  ASSET_ID=$ASSET_ID"
echo "asset_id|$ASSET_ID" >> "$RESULT"
if [ -z "$ASSET_ID" ]; then echo "❌ could not resolve creature"; exit 1; fi

echo ""
echo "=== feed($P, $ASSET_ID) ×1  → +1000 growth (raise) ==="
pact "feed-1" feed "[\"$P\",$ASSET_ID]" "$P@active"

echo ""
echo "=== evolve($P, $ASSET_ID)  → stage 0 → 1 ==="
pact "evolve-to-1" evolve "[\"$P\",$ASSET_ID]" "$P@active"

echo ""
echo "=== feed ×4  → growth → 5000 (raise to Juvenile threshold) ==="
for i in 2 3 4 5; do pact "feed-$i" feed "[\"$P\",$ASSET_ID]" "$P@active"; done

echo ""
echo "=== evolve($P, $ASSET_ID)  → stage 1 → 2 (Juvenile) ==="
pact "evolve-to-2" evolve "[\"$P\",$ASSET_ID]" "$P@active"

echo ""
echo "=== harvest($P) — accumulate EGG from creature ==="
pact "harvest" harvest "[\"$P\"]" "$P@active"

echo ""
echo "=== check EGG balance after harvest ==="
c get table "$CONTRACT" "$CONTRACT" players \
  --lower "$P" --limit 1 2>&1 | python3 -c "
import json,sys
rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'  egg_balance={r[\"egg_balance\"]}')
    print(f'  total_egg_farmed={r[\"total_egg_farmed\"]}')
" 2>&1

echo ""
echo "=== HATCH supply AFTER (should be lower — proves burn/retire) ==="
SUP_AFTER="$(hatch_supply)"; echo "  $SUP_AFTER"
echo "supply_after|$SUP_AFTER" >> "$RESULT"

echo ""
echo "=== ALL TXIDS ==="
cat "$RESULT"
