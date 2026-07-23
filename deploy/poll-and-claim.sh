#!/bin/bash
# Poll harvest → evolve → claimreward for phtestclaimr on phgamecreatr
# Each successful action prints to stdout (Monitor captures it)

W="http://127.0.0.1:8787/plugin/wax-wallet/cmd"
RPC="https://testnet.waxsweden.org"
P="phtestclaimr"
C="phgamecreatr"
A1="1099603752038"
A2="1099603752039"

# ensure signer
curl -s -X POST "$W" -H "content-type: application/json" -d '{"cmd":"select","args":"phtestclaimr"}' > /dev/null

NOW=$(curl -s -X POST "$RPC/v1/chain/get_info" -H "content-type: application/json" -d '{}' | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const t=JSON.parse(d).head_block_time;console.log(Math.floor(new Date(t+'Z').getTime()/1000))})")
echo "START epoch=$NOW EGG=~50 A1=$A1 A2=$A2"

EVOLVED1=0
EVOLVED2=0
CLAIMED=0

while [ $CLAIMED -eq 0 ]; do
  # Try harvest
  R=$(curl -s -X POST "$W" -H "content-type: application/json" -d '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"harvest\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
  OK=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)

  if [ "$OK" = "yes" ]; then
    TX=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||'?')})" 2>/dev/null)
    echo "HARVEST_OK tx=$TX"

    sleep 3
    # Read EGG
    EGG=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
    echo "EGG=$EGG EVOLVED1=$EVOLVED1 EVOLVED2=$EVOLVED2"

    # Try evolve 0->1
    if [ "$EVOLVED1" -eq 0 ] && [ "$EGG" -ge 300 ] 2>/dev/null; then
      R2=$(curl -s -X POST "$W" -H "content-type: application/json" -d "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A1\\\"}}\"}")
      OK2=$(echo "$R2" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX2=$(echo "$R2" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||JSON.parse(d).msg||'?')})" 2>/dev/null)
      if [ "$OK2" = "yes" ]; then
        EVOLVED1=1
        echo "EVOLVE_0to1_OK tx=$TX2"
        sleep 3
        EGG=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d).rows;console.log(r.length?r[0].egg_balance:0)})" 2>/dev/null)
        echo "EGG_AFTER_EVOLVE1=$EGG"
      else
        echo "EVOLVE_0to1_FAIL reason=$TX2"
      fi
    fi

    # Try evolve 1->2
    if [ "$EVOLVED1" -eq 1 ] && [ "$EVOLVED2" -eq 0 ] && [ "$EGG" -ge 600 ] 2>/dev/null; then
      R2=$(curl -s -X POST "$W" -H "content-type: application/json" -d "{\"cmd\":\"pushaction\",\"args\":\"{\\\"from\\\":\\\"phtestclaimr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"evolve\\\",\\\"data\\\":{\\\"owner\\\":\\\"phtestclaimr\\\",\\\"asset_id\\\":\\\"$A1\\\"}}\"}")
      OK2=$(echo "$R2" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX2=$(echo "$R2" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||JSON.parse(d).msg||'?')})" 2>/dev/null)
      if [ "$OK2" = "yes" ]; then
        EVOLVED2=1
        echo "EVOLVE_1to2_OK tx=$TX2"
      else
        echo "EVOLVE_1to2_FAIL reason=$TX2"
      fi
    fi

    # Try claimreward
    if [ "$EVOLVED2" -eq 1 ]; then
      HATCH_BEFORE=$(curl -s -X POST "$RPC/v1/chain/get_currency_balance" -H "content-type: application/json" -d "{\"code\":\"hatchtokens1\",\"account\":\"$P\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(Array.isArray(o)?o.join(','):'[]')})" 2>/dev/null)
      echo "BEFORE_CLAIM HATCH=$HATCH_BEFORE"

      R3=$(curl -s -X POST "$W" -H "content-type: application/json" -d '{"cmd":"pushaction","args":"{\"from\":\"phtestclaimr\",\"contract\":\"phgamecreatr\",\"action\":\"claimreward\",\"data\":{\"owner\":\"phtestclaimr\"}}"}')
      OK3=$(echo "$R3" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).ok?'yes':'no')})" 2>/dev/null)
      TX3=$(echo "$R3" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log(JSON.parse(d).txId||JSON.parse(d).msg||'?')})" 2>/dev/null)

      if [ "$OK3" = "yes" ]; then
        CLAIMED=1
        echo "CLAIMREWARD_OK tx=$TX3"

        sleep 3
        HATCH_AFTER=$(curl -s -X POST "$RPC/v1/chain/get_currency_balance" -H "content-type: application/json" -d "{\"code\":\"hatchtokens1\",\"account\":\"$P\"}" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(Array.isArray(o)?o.join(','):'[]')})" 2>/dev/null)
        P_AFTER=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"players\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}")
        CLAIMS_ROW=$(curl -s -X POST "$RPC/v1/chain/get_table_rows" -H "content-type: application/json" -d "{\"json\":true,\"code\":\"$C\",\"scope\":\"$C\",\"table\":\"claims\",\"lower_bound\":\"$P\",\"upper_bound\":\"$P\",\"limit\":1}")

        echo "AFTER_CLAIM HATCH=$HATCH_AFTER"
        echo "AFTER_CLAIM PLAYER=$P_AFTER"
        echo "AFTER_CLAIM CLAIMS=$CLAIMS_ROW"
        echo "DONE"
        exit 0
      else
        echo "CLAIMREWARD_FAIL reason=$TX3"
      fi
    fi
  else
    MSG=$(echo "$R" | node -e "process.stdin.setEncoding('utf8');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log((JSON.parse(d).msg||'?').substring(0,50))})" 2>/dev/null)
    echo "WAITING msg=$MSG"
  fi

  sleep 30
done
