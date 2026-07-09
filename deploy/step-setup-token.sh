#!/bin/bash
# Task 3a: deploy an eosio.token contract to hatchtokens1, create + issue HATCH.
source "$(dirname "$0")/lib.sh"

CONTRACTS_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/deploy/contracts"
mkdir -p "$CONTRACTS_DIR"
WPW="$(cat "$HOME/.ph/wallet.pw")"
"$CLEOS_BIN" wallet unlock --password "$WPW" >/dev/null 2>&1 || true

echo "=== 1. fetch the standard eosio.token wasm+abi from the live chain ==="
if [ ! -f "$CONTRACTS_DIR/eosiotoken.wasm" ]; then
  "$CLEOS_BIN" -u "$RPC" get code eosio.token \
    -c "$CONTRACTS_DIR/eosiotoken.wasm" \
    -a "$CONTRACTS_DIR/eosiotoken.abi" 2>&1 | tail -2
  ls -la "$CONTRACTS_DIR"
fi

echo ""
echo "=== 2. ensure a key for hatchtokens1 (generate once, reuse) ==="
if [ ! -f "$HOME/.ph/hatchtokens1.priv" ]; then
  "$CLEOS_BIN" create key --to-console > "$HOME/.ph/hatchtokens1.keyout"
  grep -oE '5[A-Za-z0-9]{50}' "$HOME/.ph/hatchtokens1.keyout" | head -1 > "$HOME/.ph/hatchtokens1.priv"
  grep -oE 'EOS[A-Za-z0-9]{50}' "$HOME/.ph/hatchtokens1.keyout" | head -1 > "$HOME/.ph/hatchtokens1.pub"
  rm -f "$HOME/.ph/hatchtokens1.keyout"
fi
TOK_PUB="$(cat "$HOME/.ph/hatchtokens1.pub")"
echo "  hatchtokens1 pubkey: $TOK_PUB"
"$CLEOS_BIN" wallet import --private-key "$(cat "$HOME/.ph/hatchtokens1.priv")" >/dev/null 2>&1 && echo "  key imported"

echo ""
echo "=== 3. create hatchtokens1 account (skip if exists) ==="
if ! "$CLEOS_BIN" -u "$RPC" get account "$TOKEN_CONTRACT" >/dev/null 2>&1; then
  "$CLEOS_BIN" -u "$RPC" system newaccount waxwingsuper "$TOKEN_CONTRACT" \
    "$TOK_PUB" "$TOK_PUB" \
    --stake-net '0.10000000 WAX' --stake-cpu '0.50000000 WAX' \
    --buy-ram-kbytes 200 \
    -p waxwingsuper@active 2>&1 | tee /tmp/tokacct.json | grep -E 'executed transaction|assertion' | head -3
  echo "  TOK_NEWACCT_TX=$(grep -oE '[0-9a-f]{64}' /tmp/tokacct.json | head -1)"
else
  echo "  $TOKEN_CONTRACT already exists"
fi

echo ""
echo "=== 4. deploy eosio.token to hatchtokens1 ==="
"$CLEOS_BIN" -u "$RPC" set contract "$TOKEN_CONTRACT" \
  "$CONTRACTS_DIR" "eosiotoken.wasm" "eosiotoken.abi" \
  -p "$TOKEN_CONTRACT@active" 2>&1 | tee /tmp/tokdep.json | grep -E 'executed transaction|assertion' | head -3
echo "  TOK_DEPLOY_TX=$(grep -oE '[0-9a-f]{64}' /tmp/tokdep.json | head -1)"

echo ""
echo "=== 5. create HATCH token (issuer=waxwingsuper, precision 4, 1B max) ==="
"$CLEOS_BIN" -u "$RPC" push action "$TOKEN_CONTRACT" create \
  '["waxwingsuper", "1000000000.0000 HATCH"]' \
  -p "$TOKEN_CONTRACT@active" 2>&1 | tee /tmp/tokcreate.json | grep -E 'executed transaction|assertion' | head -3
echo "  TOK_CREATE_TX=$(grep -oE '[0-9a-f]{64}' /tmp/tokcreate.json | head -1)"

echo ""
echo "=== 6. issue 10,000,000 HATCH to waxwingsuper (the player/issuer) ==="
"$CLEOS_BIN" -u "$RPC" push action "$TOKEN_CONTRACT" issue \
  '["waxwingsuper", "10000000.0000 HATCH", "bootstrap"]' \
  -p waxwingsuper@active 2>&1 | tee /tmp/tokissue.json | grep -E 'executed transaction|assertion' | head -3
echo "  TOK_ISSUE_TX=$(grep -oE '[0-9a-f]{64}' /tmp/tokissue.json | head -1)"

echo ""
echo "=== verify HATCH balance ==="
"$CLEOS_BIN" -u "$RPC" get currency balance "$TOKEN_CONTRACT" waxwingsuper HATCH 2>&1 | head -2
"$CLEOS_BIN" -u "$RPC" get currency stats "$TOKEN_CONTRACT" HATCH 2>&1 | grep -E 'supply|max_supply|issuer' | head -3
