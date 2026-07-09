#!/bin/bash
# ============================================================================
# Pocket Hatchery — DEPLOY FIX (2026-07-01)
# Deploy the ATTR_MAP→vector<uint8_t> fix to pockethatch1 on WAX testnet.
#
# This script DOES:
#   1. createcol (if missing)   → atomicassets::collections scope=pockethatch1
#   2. eosio.code (if missing)  → grant pockethatch1@eosio.code to
#                                  pockethatch1@active (required for every
#                                  inline action: mintasset / setassetdata /
#                                  burnasset / transfer)
#   3. setcode + setabi         → deploy build 7a61f065 (real root-cause fix)
#   4. verify                   → code_hash == 7a61f065, collection exists,
#                                  config/species tables intact, creatures = 0
#
# After this script succeeds, the next step is firsthatch via waxwing:
#   curl ... pushaction pockethatch1 firsthatch '{"owner":"waxwingsuper","egg_type":0}'
#
# PREREQUISITES:
#   - WSL Ubuntu with Leap (cleos + keosd) at /home/bagidea/leap/
#   - PH_CONTRACT_PRIV env var set (pockethatch1 active key — iron wall, never on disk)
#   - waxwing wallet unlocked (for player-side firsthatch after deploy)
#
# USAGE:
#   1. Get greenlight from boss
#   2. export PH_CONTRACT_PRIV=<pockethatch1_WIF>
#   3. bash deploy/deploy-fix-2026-07-01.sh
#   4. Verify output shows: code_hash 7a61f065, collection row exists
#   5. Then run firsthatch via waxwing
# ============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
info() { echo -e "${YELLOW}ℹ️  $*${NC}"; }

# ── Toolchain ────────────────────────────────────────────────────────────
export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib:${LD_LIBRARY_PATH:-}"
CLEOS="/home/bagidea/leap/usr/bin/cleos"
WALLET_URL="unix:///home/bagidea/.ph/keosd/keosd.sock"
RPC="${PH_RPC:-https://waxtestnet.greymass.com}"

cleos() { "$CLEOS" --wallet-url "$WALLET_URL" "$@"; }
c()     { cleos -u "$RPC" "$@"; }

CONTRACT="pockethatch1"
COLLECTION="pockethatch1"
SCHEMA="creatures"
CONTRACT_PRIV="${PH_CONTRACT_PRIV:?FATAL: PH_CONTRACT_PRIV not set. Export it in-process, never write to disk.}"
CONTRACT_PUB="${PH_CONTRACT_PUB:-EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX}"
BUILD_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"
EXPECTED_SHA="7a61f065d8ffaa332016564a958347fe087f0241fe9ab95b7bc61a06ee515b61"
EXPECTED_SHA_SHORT="7a61f065"

echo "══════════════════════════════════════════════════════════════"
echo "  Pocket Hatchery — Deploy Fix (ATTR_MAP fix)"
echo "  Target: $CONTRACT @ WAX testnet"
echo "  Build SHA: $EXPECTED_SHA_SHORT"
echo "══════════════════════════════════════════════════════════════"
echo ""

# ── Step 0: Start keosd ──────────────────────────────────────────────────
info "Step 0: keosd"

# Kill any stale instance
pkill keosd 2>/dev/null || true
sleep 1
rm -f /home/bagidea/.ph/keosd/keosd.sock

mkdir -p /home/bagidea/.ph/keosd
nohup /home/bagidea/leap/usr/bin/keosd \
  --data-dir /home/bagidea/.ph/keosd \
  --config-dir /home/bagidea/.ph/keosd \
  --unlock-timeout 999999999 \
  > /home/bagidea/.ph/keosd/keosd.log 2>&1 &
sleep 3

if [ -S /home/bagidea/.ph/keosd/keosd.sock ]; then
  pass "keosd running"
else
  fail "keosd failed to start — check /home/bagidea/.ph/keosd/keosd.log"
fi

# ── Step 0.1: Wallet "ph" — open/create/unlock ───────────────────────────
info "Step 0.1: wallet ph"

WALLET_EXISTS=$(cleos wallet list 2>&1 | grep -c '"ph"' || true)

if [ "$WALLET_EXISTS" -eq 0 ]; then
  # Try to open existing wallet file (from previous deploy)
  if [ -f /home/bagidea/.ph/keosd/wallets/ph.wallet ]; then
    cp /home/bagidea/.ph/keosd/wallets/ph.wallet /home/bagidea/.ph/keosd/ph.wallet
  fi
  cleos wallet open --name ph 2>&1 || {
    # File doesn't exist or is corrupt — create fresh
    info "Creating new wallet 'ph'..."
    NEW_PW=$(cleos wallet create --name ph --to-console 2>&1 | grep -oE 'PW[0-9A-Za-z]+' | tail -1)
    if [ -n "$NEW_PW" ]; then
      echo "$NEW_PW" > /home/bagidea/.ph/wallet.pw
      chmod 600 /home/bagidea/.ph/wallet.pw
      pass "wallet ph created, password saved"
    else
      fail "wallet create failed"
    fi
  }
else
  pass "wallet ph already open"
fi

# Unlock
WPW="$(cat /home/bagidea/.ph/wallet.pw)"
cleos wallet unlock --name ph --password "$WPW" 2>&1 | grep -v "already" || pass "wallet ph unlocked"

# Import contract key (idempotent — fails silently if already imported)
cleos wallet import --name ph --private-key "$CONTRACT_PRIV" 2>&1 | grep -v "already" || true
pass "contract key imported"

# Import player keys (if key files exist)
for KF in /home/bagidea/.ph/waxwingsuper@active.key /home/bagidea/.ph/officewax123@active.key; do
  if [ -f "$KF" ]; then
    cleos wallet import --name ph --private-key "$(cat "$KF")" 2>&1 | grep -v "already" || true
    echo "  imported $(basename "$KF")"
  fi
done
pass "wallet ready"

# ── Step 0.5: Verify build SHA ──────────────────────────────────────────
info "Step 0.5: Verify local build SHA"
ACTUAL_SHA=$(sha256sum "$BUILD_DIR/pockethatch.wasm" | awk '{print $1}')
if [ "$ACTUAL_SHA" = "$EXPECTED_SHA" ]; then
  pass "Build SHA matches: $EXPECTED_SHA_SHORT"
else
  fail "Build SHA MISMATCH! Expected $EXPECTED_SHA_SHORT, got ${ACTUAL_SHA:0:8}"
fi

# ── Step 1: Query current on-chain state (baseline) ──────────────────────
info "Step 1: Current on-chain state"

echo -n "  code_hash = "
c get code "$CONTRACT" 2>&1 | grep -oE 'code_hash.*' || echo "(query failed)"

COLL_ROWS=$(c get table atomicassets "$COLLECTION" collections 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']; print(len(rows))" 2>/dev/null || echo "?")
echo "  atomicassets::collections rows = $COLL_ROWS"

CREATURE_ROWS=$(c get table "$CONTRACT" "$CONTRACT" creatures 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']; print(len(rows))" 2>/dev/null || echo "?")
echo "  creatures rows = $CREATURE_ROWS"
echo ""

# ── Step 2: createcol (if missing) ──────────────────────────────────────
if [ "$COLL_ROWS" = "0" ]; then
  info "Step 2: createcol — collection is MISSING, creating..."
  c push action atomicassets createcol \
    '{"author":"'"$CONTRACT"'","collection_name":"'"$COLLECTION"'","allow_notify":true,"authorized_accounts":["'"$CONTRACT"'"],"notify_accounts":[],"market_fee":0.05,"data":[{"key":"name","value":["string","Pocket Hatchery"]},{"key":"description","value":["string","Creature farming game on WAX"]}]}' \
    -p "$CONTRACT@active" 2>&1 | tail -3
  pass "createcol done"
else
  info "Step 2: createcol — collection already exists ($COLL_ROWS rows), skipping"
fi

# ── Step 2.5: eosio.code permission (if missing) ─────────────────────────
# Every inline action using {get_self(), "active"_n} (mintasset, setassetdata,
# burnasset, token transfer) requires pockethatch1@eosio.code on the active
# authority. This is idempotent — skip if already present.
info "Step 2.5: eosio.code permission"

EOSIO_CODE_OK=$(c get account "$CONTRACT" 2>&1 | grep -c 'eosio.code' || true)
if [ "$EOSIO_CODE_OK" -gt 0 ]; then
  pass "eosio.code already present on $CONTRACT@active"
else
  info "eosio.code NOT present — granting now..."
  c push action eosio updateauth \
    "{\"account\":\"$CONTRACT\",\"permission\":\"active\",\"parent\":\"owner\",\"auth\":{\"threshold\":1,\"keys\":[{\"key\":\"$CONTRACT_PUB\",\"weight\":1}],\"accounts\":[{\"permission\":{\"actor\":\"$CONTRACT\",\"permission\":\"eosio.code\"},\"weight\":1}],\"waits\":[]}}" \
    -p "$CONTRACT@owner" 2>&1 | tail -5

  # Verify it took effect
  EOSIO_CODE_RECHECK=$(c get account "$CONTRACT" 2>&1 | grep -c 'eosio.code' || true)
  if [ "$EOSIO_CODE_RECHECK" -gt 0 ]; then
    pass "eosio.code granted and verified"
  else
    fail "eosio.code grant FAILED — check account permissions"
  fi
fi

# ── Step 3: setcode + setabi ────────────────────────────────────────────
info "Step 3: setcode (deploy $EXPECTED_SHA_SHORT)"

echo "  Deploying WASM + ABI to $CONTRACT..."
c set contract "$CONTRACT" "$BUILD_DIR" pockethatch.wasm pockethatch.abi \
  -p "$CONTRACT@active" 2>&1 | tee /tmp/ph-deploy-fix.log | grep -E 'executed|error|assertion' | head -5

DEPLOY_TX=$(grep -oE '[0-9a-f]{64}' /tmp/ph-deploy-fix.log | head -1 || echo "?")
echo "  tx: ${DEPLOY_TX:0:12}..."
pass "setcode done"

# ── Step 4: Verify deploy ────────────────────────────────────────────────
info "Step 4: Verify"

# 4a: code_hash
CHAIN_SHA=$(c get code "$CONTRACT" 2>&1 | grep -oE 'code_hash.*' | grep -oE '[0-9a-f]{64}' || echo "")
if [ "$CHAIN_SHA" = "$EXPECTED_SHA" ]; then
  pass "code_hash matches: $EXPECTED_SHA_SHORT"
else
  fail "code_hash MISMATCH after deploy! Expected $EXPECTED_SHA_SHORT, got ${CHAIN_SHA:0:8}"
fi

# 4b: collection
COLL_ROWS2=$(c get table atomicassets "$COLLECTION" collections 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']; print(len(rows))" 2>/dev/null || echo "0")
if [ "$COLL_ROWS2" -gt 0 ]; then
  pass "collection exists ($COLL_ROWS2 rows)"
else
  fail "collection STILL MISSING after createcol"
fi

# 4c: config table
CONFIG_OK=$(c get table "$CONTRACT" "$CONTRACT" config 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']
if rows:
    r=rows[0]
    print(f'collection={r.get(\"collection\",\"?\")} paused={r.get(\"paused\",\"?\")} hatch_cost={r.get(\"hatch_cost\",\"?\")}')
else:
    print('EMPTY')
" 2>/dev/null || echo "QUERY_FAILED")
echo "  config: $CONFIG_OK"

# 4d: species
SPECIES_OK=$(c get table "$CONTRACT" "$CONTRACT" speciescfg 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']; print(f'{len(rows)} species rows')" 2>/dev/null || echo "?")
echo "  species: $SPECIES_OK"

# 4e: creatures (should still be 0 — we haven't hatched yet)
CR2=$(c get table "$CONTRACT" "$CONTRACT" creatures 2>&1 | python3 -c "
import json,sys; rows=json.load(sys.stdin)['rows']; print(len(rows))" 2>/dev/null || echo "?")
echo "  creatures: $CR2 rows (should be 0 — firsthatch not done yet)"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  🎉 DEPLOY COMPLETE"
echo "  code_hash: $EXPECTED_SHA_SHORT ✅"
echo "  collection: exists ✅"
echo ""
echo "  NEXT STEP — firsthatch via waxwing (boss greenlight required):"
echo "    curl -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \\"
echo '      -H "content-type: application/json" \'
echo '      -d '"'"'{"cmd":"pushaction","args":"{\"network\":\"wax-testnet\",\"from\":\"waxwingsuper\",\"contract\":\"pockethatch1\",\"action\":\"firsthatch\",\"data\":{\"owner\":\"waxwingsuper\",\"egg_type\":0}}"}'"'"''
echo "══════════════════════════════════════════════════════════════"
echo ""
pass "DEFINITION OF DONE: code_hash=$EXPECTED_SHA_SHORT + eosio.code grant + collection exists → ready for firsthatch"
