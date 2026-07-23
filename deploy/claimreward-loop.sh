#!/bin/bash
# claimreward proof loop for phtestclaimr on phgamecreatr
# State: 2 creatures stage 1, 50 EGG, needs harvest -> evolve 0->1 -> evolve 1->2 -> claimreward

WALLET="http://127.0.0.1:8787/plugin/wax-wallet/cmd"
RPC="https://testnet.waxsweden.org"
ASSET1="1099603752038"
ASSET2="1099603752039"
PLAYER="phtestclaimr"
CONTRACT="phgamecreatr"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

push() {
  local data="$1"
  curl -s -X POST "$WALLET" -H "content-type: application/json" -d "$data"
}

select_player() {
  push '{"cmd":"select","args":"phtestclaimr"}' > /dev/null
}

get_player() {
  curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" \
    -d "{\"json\":true,\"code\":\"$CONTRACT\",\"scope\":\"$CONTRACT\",\"table\":\"players\",\"lower_bound\":\"$PLAYER\",\"upper_bound\":\"$PLAYER\",\"limit\":1}"
}

get_creature() {
  local aid="$1"
  curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" \
    -d "{\"json\":true,\"code\":\"$CONTRACT\",\"scope\":\"$CONTRACT\",\"table\":\"creatrsv2\",\"lower_bound\":\"$aid\",\"upper_bound\":\"$aid\",\"limit\":1}"
}

get_hatch_balance() {
  curl -s -X POST "$RPC/v1/chain/get_currency_balance" -H "content-type: application/json" \
    -d "{\"code\":\"hatchtokens1\",\"account\":\"$PLAYER\",\"symbol\":\"HATCH\"}"
}

harvest_action() {
  push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"harvest\",\"data\":{\"owner\":\"phtestclaimr\"}}"}'
}

evolve_action() {
  local aid="$1"
  push "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$aid\\\"}}\"}"
}

claim_action() {
  push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"claimreward\",\"data\":{\"owner\":\"phtestclaimr\"}}"}'
}

get_now() {
  curl -s -X POST "$RPC/v1/chain/get_info" | python3 -c "import sys,json; print(json.load(sys.stdin)['head_block_time'])" 2>/dev/null || \
  curl -s -X POST "$RPC/v1/chain/get_info" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const t=JSON.parse(d).head_block_time;const d2=new Date(t+'Z');console.log(Math.floor(d2.getTime()/1000))})" 2>/dev/null
}

# Track phase
PHASE="harvest"  # harvest | evolve1 | harvest2 | evolve2 | claim | done
EVOLVED1="no"
EVOLVED2="no"
CLAIMED="no"

select_player

log "=== CLAIMREWARD PROOF LOOP STARTED ==="
log "Phase: $PHASE | EGG: checking | Evolved1: $EVOLVED1 | Evolved2: $EVOLVED2"

while true; do
  NOW=$(get_now)
  if [ -z "$NOW" ]; then
    sleep 30
    continue
  fi

  # Read player state
  PJSON=$(get_player)
  EGG=$(echo "$PJSON" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:'unknown')})" 2>/dev/null)
  LAST_HARVEST=$(echo "$PJSON" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].last_harvest:'0')})" 2>/dev/null)

  if [ "$EGG" = "unknown" ]; then
    log "ERROR: cannot read player table"
    sleep 30
    continue
  fi

  # Phase logic
  case "$PHASE" in
    harvest)
      if [ "$EVOLVED1" = "yes" ] && [ "$EVOLVED2" = "no" ]; then
        PHASE="harvest2"
        continue
      fi
      NEXT_HARVEST=$((LAST_HARVEST + 3600))
      if [ "$NOW" -ge "$NEXT_HARVEST" ]; then
        log "⏰ Harvest cooldown passed! last_harvest=$LAST_HARVEST now=$NOW → harvesting..."
        RES=$(harvest_action)
        OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
        TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'unknown')})" 2>/dev/null)
        if [ "$OK" = "yes" ]; then
          log "✅ HARVEST OK  tx=$TX"
          sleep 5
          # Re-read EGG
          PJSON=$(get_player)
          EGG=$(echo "$PJSON" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:'unknown')})" 2>/dev/null)
          log "Egg balance after harvest: $EGG"
          if [ "$EGG" -ge 300 ] 2>/dev/null && [ "$EVOLVED1" = "no" ]; then
            PHASE="evolve1"
          elif [ "$EGG" -ge 600 ] 2>/dev/null && [ "$EVOLVED1" = "yes" ] && [ "$EVOLVED2" = "no" ]; then
            PHASE="evolve2"
          elif [ "$EVOLVED1" = "yes" ] && [ "$EVOLVED2" = "yes" ]; then
            PHASE="claim"
          fi
        else
          log "❌ HARVEST FAILED: $TX"
        fi
      else
        REMAIN=$((NEXT_HARVEST - NOW))
        log "⏳ Harvest cooldown: ${REMAIN}s remaining (EGG=$EGG, last_harvest=$LAST_HARVEST)"
      fi
      ;;
    evolve1)
      log "🔧 Attempting evolve 0→1 on $ASSET1 (EGG=$EGG)"
      RES=$(evolve_action "$ASSET1")
      OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'unknown')})" 2>/dev/null)
      if [ "$OK" = "yes" ]; then
        log "✅ EVOLVE 0→1 OK  tx=$TX"
        EVOLVED1="yes"
        PHASE="harvest"
      else
        log "❌ EVOLVE 0→1 FAILED: $TX"
        PHASE="harvest"
      fi
      ;;
    harvest2)
      NEXT_HARVEST=$((LAST_HARVEST + 3600))
      if [ "$NOW" -ge "$NEXT_HARVEST" ]; then
        log "⏰ Harvest2 cooldown passed! harvesting..."
        RES=$(harvest_action)
        OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
        TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'unknown')})" 2>/dev/null)
        if [ "$OK" = "yes" ]; then
          log "✅ HARVEST2 OK  tx=$TX"
          sleep 5
          PJSON=$(get_player)
          EGG=$(echo "$PJSON" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:'unknown')})" 2>/dev/null)
          log "Egg balance after harvest2: $EGG"
          if [ "$EGG" -ge 600 ] 2>/dev/null; then
            PHASE="evolve2"
          fi
        else
          log "❌ HARVEST2 FAILED: $TX"
        fi
      else
        REMAIN=$((NEXT_HARVEST - NOW))
        log "⏳ Harvest2 cooldown: ${REMAIN}s remaining (EGG=$EGG)"
      fi
      ;;
    evolve2)
      log "🔧 Attempting evolve 1→2 on $ASSET1 (EGG=$EGG)"
      RES=$(evolve_action "$ASSET1")
      OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'unknown')})" 2>/dev/null)
      if [ "$OK" = "yes" ]; then
        log "✅ EVOLVE 1→2 OK  tx=$TX"
        EVOLVED2="yes"
        PHASE="claim"
      else
        log "❌ EVOLVE 1→2 FAILED: $TX"
        PHASE="harvest2"
      fi
      ;;
    claim)
      log "🏆 ===== BEFORE CLAIMREWARD ====="
      HATCH_BEFORE=$(get_hatch_balance)
      log "HATCH before: $HATCH_BEFORE"
      PJSON=$(get_player)
      log "Player before: $PJSON"
      C1=$(get_creature "$ASSET1")
      log "Creature $ASSET1: $C1"

      RES=$(claim_action)
      OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.txId||o.msg||'unknown')})" 2>/dev/null)
      if [ "$OK" = "yes" ]; then
        log "✅✅✅ CLAIMREWARD SUCCESS! tx=$TX"
        sleep 5
        log "🏆 ===== AFTER CLAIMREWARD ====="
        HATCH_AFTER=$(get_hatch_balance)
        log "HATCH after: $HATCH_AFTER"
        PJSON=$(get_player)
        log "Player after: $PJSON"

        # Get claimed_season from claims table
        CLAIM_ROW=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" \
          -d "{\"json\":true,\"code\":\"$CONTRACT\",\"scope\":\"$CONTRACT\",\"table\":\"claims\",\"lower_bound\":\"$PLAYER\",\"upper_bound\":\"$PLAYER\",\"limit\":1}")
        log "Claims table: $CLAIM_ROW"

        log "========== FINAL SUMMARY =========="
        log "claimreward TX: $TX"
        log "HATCH BEFORE: $HATCH_BEFORE"
        log "HATCH AFTER: $HATCH_AFTER"
        log "===================================="
        PHASE="done"
      else
        log "❌ CLAIMREWARD FAILED: $TX"
        PHASE="harvest2"
      fi
      ;;
    done)
      log "🎉 ALL DONE! Exiting loop."
      exit 0
      ;;
  esac

  sleep 60
done
