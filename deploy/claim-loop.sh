#!/bin/bash
# Simple claimreward proof — wait for cooldowns, then execute sequence
W="http://127.0.0.1:8787/plugin/wax-wallet/cmd"
RPC="https://testnet.waxsweden.org"
A1="1099603752038"
A2="1099603752039"
P="phtestclaimr"
C="phgamecreatr"

push() { curl -s -X POST "$W" -H "content-type: application/json" -d "$1"; }
get_egg() { curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null; }

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }

step_harvest() {
  log "HARVEST attempt..."
  push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"harvest\",\"data\":{\"owner\":\"phtestclaimr\"}}"}' | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?'OK:'+o.txId:'FAIL:'+(o.msg||'?'))})" 2>/dev/null
}

step_evolve1() {
  log "EVOLVE 0->1 on $A1..."
  push "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A1\\\"}}\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?'OK:'+o.txId:'FAIL:'+(o.msg||'?'))})" 2>/dev/null
}

step_evolve2() {
  log "EVOLVE 1->2 on $A1..."
  push "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A1\\\"}}\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?'OK:'+o.txId:'FAIL:'+(o.msg||'?'))})" 2>/dev/null
}

step_claim() {
  log "===== BEFORE CLAIM ====="
  HATCH_BEFORE=$(curl -s -X POST "$RPC/v1/chain/get_currency_balance" -H "content-type: application/json" -d "{\"code\":\"hatchtokens1\",\"account\":\"$P\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(Array.isArray(o)?o.join(', '):'0')})" 2>/dev/null)
  log "HATCH before: $HATCH_BEFORE"

  P_BEFORE=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}")
  log "Players before: $P_BEFORE"

  log "CLAIMREWARD attempt..."
  RES=$(push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"claimreward\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
  log "claimreward result: $RES"

  OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
  TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'?')})" 2>/dev/null)

  if [ "$OK" = "yes" ]; then
    sleep 3
    log "===== AFTER CLAIM ====="
    HATCH_AFTER=$(curl -s -X POST "$RPC/v1/chain/get_currency_balance" -H "content-type: application/json" -d "{\"code\":\"hatchtokens1\",\"account\":\"$P\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(Array.isArray(o)?o.join(', '):'0')})" 2>/dev/null)
    log "HATCH after: $HATCH_AFTER"

    CLAIMS=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"claims\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}")
    log "Claims: $CLAIMS"

    echo "========================================="
    echo "FINAL RESULT"
    echo "========================================="
    echo "claimreward TX: $TX"
    echo "HATCH BEFORE: $HATCH_BEFORE"
    echo "HATCH AFTER: $HATCH_AFTER"
    echo "Claims table: $CLAIMS"
    echo "========================================="
    return 0
  else
    log "CLAIM FAILED: $TX"
    return 1
  fi
}

# ---- MAIN LOOP ----
log "=== STARTING CLAIMREWARD LOOP ==="
log "Creatures: $A1, $A2"
EGG=$(get_egg)
log "Starting EGG: $EGG"

HARVEST_COUNT=0
EVOLVED1=0
EVOLVED2=0
MAX_HARVESTS=30

while [ $HARVEST_COUNT -lt $MAX_HARVESTS ]; do
  # Wait for harvest cooldown (poll every 30s)
  WAITED=0
  while [ $WAITED -lt 120 ]; do  # max 1 hour wait per cycle
    sleep 30
    WAITED=$((WAITED + 1))
    # Try harvest
    R=$(push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"harvest\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
    OK=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
    if [ "$OK" = "yes" ]; then
      TX=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||'?')})" 2>/dev/null)
      log "✅ HARVEST #$((HARVEST_COUNT+1)) OK  tx=$TX"
      HARVEST_COUNT=$((HARVEST_COUNT + 1))
      sleep 3
      EGG=$(get_egg)
      log "EGG now: $EGG"
      break
    fi
    if [ $((WAITED % 4)) -eq 0 ]; then
      MSG=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.msg||'?')})" 2>/dev/null)
      log "⏳ waiting for harvest cooldown... ($MSG)"
    fi
  done

  # Check evolve 0->1
  if [ "$EVOLVED1" -eq 0 ] && [ "$EGG" -ge 300 ] 2>/dev/null; then
    R=$(step_evolve1)
    if echo "$R" | grep -q "^OK:"; then
      EVOLVED1=1
      sleep 3
      EGG=$(get_egg)
      log "EGG after evolve1: $EGG"
      TX_ID=$(echo "$R" | cut -d: -f2)
      log "evolve 0->1 TX: $TX_ID"
    fi
  fi

  # Check evolve 1->2
  if [ "$EVOLVED1" -eq 1 ] && [ "$EVOLVED2" -eq 0 ] && [ "$EGG" -ge 600 ] 2>/dev/null; then
    R=$(step_evolve2)
    if echo "$R" | grep -q "^OK:"; then
      EVOLVED2=1
      sleep 3
      EGG=$(get_egg)
      log "EGG after evolve2: $EGG"
      TX_ID=$(echo "$R" | cut -d: -f2)
      log "evolve 1->2 TX: $TX_ID"
    fi
  fi

  # Check claim
  if [ "$EVOLVED2" -eq 1 ]; then
    step_claim && exit 0
  fi
done

log "Max harvests reached. EGG=$EGG EVOLVED1=$EVOLVED1 EVOLVED2=$EVOLVED2"
