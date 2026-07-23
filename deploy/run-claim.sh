#!/bin/bash
# Pocket Hatchery claimreward proof — polling harvest loop for phtestclaimr
set -e
W="http://127.0.0.1:8787/plugin/wax-wallet/cmd"
RPC="https://testnet.waxsweden.org/v1/chain"
A="1099603752038"
P="phtestclaimr"
C="phgamecreatr"

push() { curl -s -X POST "$W" -H "content-type: application/json" -d "$1"; }
get_player() { curl -s -X POST "$RPC/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}"; }
get_creature() { curl -s -X POST "$RPC/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"creatrsv2\",\"lower_bound\":\"$1\",\"upper_bound\":\"$1\",\"limit\":1}"; }
get_hatch() { curl -s -X POST "$RPC/get_currency_balance" -H "content-type: application/json" -d "{\"code\":\"hatchtokens1\",\"account\":\"$P\"}"; }
get_now() { curl -s -X POST "$RPC/get_info" -H "content-type: application/json" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const t=new Date(JSON.parse(d).head_block_time+'Z');console.log(Math.floor(t.getTime()/1000))})" 2>/dev/null; }
log() { echo "[$(date -u '+%H:%M:%S')] $*"; }

# Select phtestclaimr
push '{"cmd":"select","args":"phtestclaimr"}' > /dev/null

log "=== CLAIMREWARD PROOF (asset $A) ==="
NOW=$(get_now)
log "Chain epoch: $NOW"
EGG_BEFORE=$(get_player | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
log "Starting EGG: $EGG_BEFORE"

HARVESTS=0
EVOLVED1=0
EVOLVED2=0
MAX=60

while [ $HARVESTS -lt $MAX ]; do
  NOW=$(get_now)

  # Try harvest
  RES=$(push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"harvest\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
  OK=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)

  if [ "$OK" = "yes" ]; then
    TX=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||'?')})" 2>/dev/null)
    HARVESTS=$((HARVESTS+1))
    log "✅ HARVEST #$HARVESTS  tx=$TX"
    sleep 3

    EGG=$(get_player | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
    log "EGG now: $EGG"

    # Evolve 0->1 (stage 1->2)
    if [ "$EVOLVED1" -eq 0 ] && [ "$EGG" -ge 300 ] 2>/dev/null; then
      log ">>> Attempting EVOLVE 0->1 on $A (EGG=$EGG)"
      ER=$(push "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A\\\"}}\"}")
      EOK=$(echo "$ER" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      ETX=$(echo "$ER" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?o.txId:o.msg||'?')})" 2>/dev/null)
      if [ "$EOK" = "yes" ]; then
        EVOLVED1=1
        log "✅ EVOLVE 0->1 OK  tx=$ETX"
        sleep 3
        # Verify stage
        STAGE=$(get_creature "$A" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].stage:'?')})" 2>/dev/null)
        log "Creature $A stage now: $STAGE"
        EGG=$(get_player | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
        log "EGG after evolve1: $EGG"
      else
        log "❌ EVOLVE 0->1 FAIL: $ETX"
      fi
    fi

    # Evolve 1->2 (stage 2->3, costs 600)
    if [ "$EVOLVED1" -eq 1 ] && [ "$EVOLVED2" -eq 0 ] && [ "$EGG" -ge 600 ] 2>/dev/null; then
      log ">>> Attempting EVOLVE 1->2 on $A (EGG=$EGG)"
      ER=$(push "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A\\\"}}\"}")
      EOK=$(echo "$ER" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      ETX=$(echo "$ER" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?o.txId:o.msg||'?')})" 2>/dev/null)
      if [ "$EOK" = "yes" ]; then
        EVOLVED2=1
        log "✅ EVOLVE 1->2 OK  tx=$ETX"
        sleep 3
        STAGE=$(get_creature "$A" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].stage:'?')})" 2>/dev/null)
        log "Creature $A stage now: $STAGE"
        EGG=$(get_player | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
        log "EGG after evolve2: $EGG"
      else
        log "❌ EVOLVE 1->2 FAIL: $ETX"
      fi
    fi

    # CLAIMREWARD
    if [ "$EVOLVED2" -eq 1 ]; then
      log "=========================================="
      log ">>> CLAIMREWARD — capturing BEFORE state <<<"
      HATCH_BEFORE=$(get_hatch | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const b=JSON.parse(d);console.log(Array.isArray(b)?(b.length?b.join(','):'0'):'0')})" 2>/dev/null)
      log "HATCH before: $HATCH_BEFORE"

      CR=$(push '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"claimreward\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
      COK=$(echo "$CR" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      CTX=$(echo "$CR" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.ok?o.txId:o.msg||'?')})" 2>/dev/null)

      if [ "$COK" = "yes" ]; then
        log "✅✅✅ CLAIMREWARD SUCCESS  tx=$CTX"
        sleep 5
        HATCH_AFTER=$(get_hatch | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const b=JSON.parse(d);console.log(Array.isArray(b)?(b.length?b.join(','):'0'):'0')})" 2>/dev/null)
        CLAIMS_ROW=$(curl -s -X POST "$RPC/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"claims\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}")
        CS=$(echo "$CLAIMS_ROW" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].claimed_season:'?')})" 2>/dev/null)

        echo ""
        echo "=============================================="
        echo "  FINAL RESULT — claimreward PROOF"
        echo "=============================================="
        echo "  claimreward TX:     $CTX"
        echo "  HATCH BEFORE:       $HATCH_BEFORE"
        echo "  HATCH AFTER:        $HATCH_AFTER"
        echo "  claimed_season:     $CS"
        echo "  Total harvests:     $HARVESTS"
        echo "=============================================="
        echo ""
        log "DONE. Exiting."
        exit 0
      else
        log "❌ CLAIMREWARD FAILED: $CTX"
      fi
    fi
  else
    MSG=$(echo "$RES" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.msg||'?')})" 2>/dev/null)
    if [ $((HARVESTS)) -eq 0 ]; then
      log "⏳ harvest not ready ($MSG) — wait 30s..."
    fi
  fi

  sleep 30
done

log "Max harvests ($MAX) reached. EGG=$EGG EVOLVED1=$EVOLVED1 EVOLVED2=$EVOLVED2"
