#!/bin/bash
# Step 0: probe chain + every account we care about. Read-only.
source "$(dirname "$0")/lib.sh"

echo "=== chain info ==="
c get info 2>&1 | grep -E 'chain_id|head_block_num|head_block_time' | head -3

for acct in waxwingsuper pockethatch hatchtokens1 hatchfees1 atomicassets eosio.token; do
  echo ""
  echo "=== account: $acct ==="
  out="$(c get account "$acct" 2>&1)"
  if echo "$out" | grep -qi "unknown key\|not found\|does not exist"; then
    echo "  (does NOT exist)"
  else
    echo "$out" | grep -E 'created|privileged|liquid:|RAM quota:|RAM usage:|cpu_weight|net_weight' | head -8
  fi
done

echo ""
echo "=== pockethatch code hash ==="
c get code pockethatch 2>&1 | head -3

echo ""
echo "=== atomicassets code hash ==="
c get code atomicassets 2>&1 | head -2
