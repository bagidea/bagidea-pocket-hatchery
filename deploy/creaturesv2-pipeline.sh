#!/bin/bash
# ─── Pocket Hatchery · creaturesv2 Migration Pipeline ────────────────────────
# STATUS: DRY-RUN ONLY — ALL COMMANDS COMMENTED OUT
# DATE:   2026-07-19
# AUTHOR: Kevin (Engineer)
#
# DO NOT EXECUTE until ALL of these are true:
#   ☐ CEO greenlights schema migration
#   ✅ Monanisa delivered PNG art — 12 files (6 tiers × front/back, 1080×1542)
#   ☐ PNGs pinned to IPFS → CIDs verified (HTTP 200 image/png) — NEED CREDENTIALS
#   ☐ CID_PLACEHOLDER_* replaced with real CIDs in createtempl JSON
#   ☐ Wallet unlocked with phgamecreatr@active key
#
# Post-execution verification:
#   ☐ AtomicHub testnet renders cards (img + backimg) correctly
#   ☐ IPFS URLs respond 200 (no dead thumbnails)
#   ☐ Existing NFTs still display (setassetdata applied)
#   ☐ hatch() mints under creaturesv2 (new template IDs)
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# ── Wallet setup ────────────────────────────────────────────────────────────
# The waxwing daemon wallet must be UNLOCKED and phgamecreatr must be selected.
# Verify before proceeding:
#   curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#     -H "content-type: application/json" \
#     -d '{"cmd":"status"}'
#   # → selected: "phgamecreatr", network: "wax-testnet"
#
#   curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#     -H "content-type: application/json" \
#     -d '{"cmd":"chaininfo"}'
#   # → confirm we're on wax-testnet

push_aa() {
  # push an atomicassets action via waxwing
  local ACTION="$1"
  local ARGS_FILE="$2"
  echo "=== atomicassets::$ACTION ==="
  # UNCOMMENT TO EXECUTE:
  # curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  #   -H "content-type: application/json" \
  #   -d "{\"cmd\":\"pushaction\",\"args\":\"{\\\"network\\\":\\\"wax-testnet\\\",\\\"from\\\":\\\"phgamecreatr\\\",\\\"contract\\\":\\\"atomicassets\\\",\\\"action\\\":\\\"$ACTION\\\",\\\"data\\\":$(cat "$ARGS_FILE" | jq -c '.payload')}\"}"
}

push_ph() {
  # push a phgamecreatr action via waxwing
  local ACTION="$1"
  local ARGS_FILE="$2"
  echo "=== phgamecreatr::$ACTION ==="
  # UNCOMMENT TO EXECUTE:
  # curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
  #   -H "content-type: application/json" \
  #   -d "{\"cmd\":\"pushaction\",\"args\":\"{\\\"network\\\":\\\"wax-testnet\\\",\\\"from\\\":\\\"phgamecreatr\\\",\\\"contract\\\":\\\"phgamecreatr\\\",\\\"action\\\":\\\"$ACTION\\\",\\\"data\\\":$(cat "$ARGS_FILE")\"}\"}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: createschema "creaturesv2"
# ═══════════════════════════════════════════════════════════════════════════════
# Adds img (type: image) + backimg (type: image) to the schema format.
# AtomicAssets assigns these as IMMUTABLE fields — they're baked into each
# minted NFT from template immutable_data.
#
# Payload: deploy/args-aa-createschema-creaturesv2.json
# Auth:    phgamecreatr@active (phgamecreatr IS in authorized_accounts of
#          collection phgamecreatr — verified on-chain 2026-07-19)
#
# UNCOMMENT TO EXECUTE:
# push_aa "createschema" "deploy/args-aa-createschema-creaturesv2.json"

# Verify:
#   curl -s "https://test.wax.api.atomicassets.io/atomicassets/v1/schemas?collection_name=phgamecreatr" | jq '.data[] | select(.schema_name=="creaturesv2")'

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: setschematyp "creaturesv2"
# ═══════════════════════════════════════════════════════════════════════════════
# Tells AtomicHub how to render img/backimg fields (mediatype: "image" →
# IPFS CID → <img> tag in the card UI).
#
# Payload: deploy/args-aa-setschematyp-creaturesv2.json
# Auth:    phgamecreatr@active
#
# UNCOMMENT TO EXECUTE:
# push_aa "setschematyp" "deploy/args-aa-setschematyp-creaturesv2.json"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: createtempl × 7 — one per species/rarity combo (includes new mythic)
# ═══════════════════════════════════════════════════════════════════════════════
# BEFORE RUNNING THIS STEP:
#   1. ✅ Monanisa delivered PNG art (12 files: 6 tiers × front/back, 1080×1542)
#   2. Pin each PNG to IPFS (Pinata / web3.storage / nft.storage) → 12 CIDs
#   3. The art is TIER-based (not species-based):
#         Common    → CID_COMMON_FRONT     + CID_COMMON_BACK
#         Uncommon  → CID_UNCOMMON_FRONT   + CID_UNCOMMON_BACK
#         Rare      → CID_RARE_FRONT       + CID_RARE_BACK
#         Epic      → CID_EPIC_FRONT       + CID_EPIC_BACK
#         Legendary → CID_LEGENDARY_FRONT  + CID_LEGENDARY_BACK
#         Mythic    → CID_MYTHIC_FRONT     + CID_MYTHIC_BACK
#      Same-tier species share the same front/back CIDs (e.g., Drakember + Foxling Rare both use RARE CIDs)
#   4. Verify each CID: curl -sI "https://ipfs.io/ipfs/$CID" | head -1
#      → MUST return HTTP/2 200 (image/png)
#      → Also check cloudflare: curl -sI "https://cloudflare-ipfs.com/ipfs/$CID" | head -1
#   5. Replace CID_PLACEHOLDER_* in deploy/args-aa-createtempl-creaturesv2.json
#      → 12 unique placeholders, each appears in 1-2 template(s)
#      → Search-and-replace: CID_PLACEHOLDER_COMMON_FRONT → Qm...
#
# AtomicAssets assigns template_id sequentially (counter). Record each one:
#   curl -s "https://test.wax.api.atomicassets.io/atomicassets/v1/templates?collection_name=phgamecreatr&schema_name=creaturesv2" | jq '.data[] | {template_id, name: .immutable_data.name}'
#
# UNCOMMENT TO EXECUTE (one per template — split createtempl JSON array into individual payloads):
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-EMBERLING.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-BLAZETAIL.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-DRAKEMBER.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-FOXLING_RARE.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-FOXLING_EPIC.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-FOXLING_LEGENDARY.json"
# push_aa "createtempl" "deploy/args-aa-createtempl-creaturesv2-FOXLING_MYTHIC.json"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: setconfig — switch schema_name to creaturesv2
# ═══════════════════════════════════════════════════════════════════════════════
# After this, the contract mints under creaturesv2 schema. The existing
# creatures table (creatrsv2) is unaffected.
#
# Current configv3.schema_name = "creatures"
# New     configv3.schema_name = "creaturesv2"
#
# Read current config first:
#   curl -s -X POST https://wax-testnet.eosphere.io/v1/chain/get_table_rows \
#     -H "content-type: application/json" \
#     -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"configv3","json":true,"limit":1}' | jq '.rows[0].schema_name'
#
# UNCOMMENT TO EXECUTE:
# # Build setconfig payload from current config + schema_name override:
# push_ph "setconfig" "deploy/args-setconfig-creaturesv2.json"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: setspecies — update speciescfg with new template IDs
# ═══════════════════════════════════════════════════════════════════════════════
# Each speciescfg row has a template_id. After createtempl, the new template
# IDs must replace the old ones. Read current speciescfg:
#   curl -s -X POST https://wax-testnet.eosphere.io/v1/chain/get_table_rows \
#     -H "content-type: application/json" \
#     -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"spccfgv2","json":true,"limit":20}' | jq '.rows[] | {template_id,family,egg_type}'
#
# UNCOMMENT TO EXECUTE (one per species — 7 total including new mythic):
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-EMBERLING.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-BLAZETAIL.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-DRAKEMBER.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-FOXLING_RARE.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-FOXLING_EPIC.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-FOXLING_LEGENDARY.json"
# push_ph "setspecies" "deploy/setspecies/args-setspecies-creaturesv2-FOXLING_MYTHIC.json"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: setassetdata — populate img/backimg on EXISTING NFTs
# ═══════════════════════════════════════════════════════════════════════════════
# Existing NFTs were minted under the OLD "creatures" schema which has NO
# img/backimg fields. They cannot change schema (AtomicAssets has no
# "changeschema" action). We have two options:
#
# Option A (recommended): Use setassetdata to set img + backimg in MUTABLE data.
#   - AtomicHub reads mutable data for rendering too
#   - Non-destructive, preserves mint history
#   - Downside: img/backimg live in mutable instead of immutable
#
# Option B: Burn + re-mint under creaturesv2.
#   - Clean: img/backimg are proper immutable fields
#   - Destructive: loses on-chain mint history, old asset_ids
#   - High risk: burning 70+ NFTs is irreversible
#
# Option C: Hybrid — setassetdata for old NFTs; new mints get creaturesv2.
#   - Old NFTs: mutable img/backimg
#   - New NFTs: immutable img/backimg
#   - AtomicHub can render both (checks immutable first, falls back to mutable)
#
# The boss will decide. For now, the setassetdata commands are drafted below.
#
# Existing NFTs by template (as of 2026-07-19):
#   template 662976 (Emberling):   10 issued → need Emberling front/back CIDs
#   template 662977 (Blazetail):   13 issued → need Blazetail front/back CIDs
#   template 662978 (Drakember):    3 issued → need Drakember front/back CIDs
#   template 663046 (Foxling R):    2 issued → need Foxling R front/back CIDs
#   template 662889 (empty imm.):  40 issued → generic/placeholder art
#   template 662906-662910:         3 issued → generic/placeholder art
#
# For each asset_id, call atomicassets::setassetdata:
#   {
#     "authorized_editor": "phgamecreatr",
#     "asset_owner": "<owner>",
#     "asset_id": "<asset_id>",
#     "new_mutable_data": [
#       {"key": "img",     "value": ["string", "Qm<CID_FRONT>"]},
#       {"key": "backimg", "value": ["string", "Qm<CID_BACK>"]}
#     ]
#   }
#
# UNCOMMENT TO EXECUTE (loop over each NFT):
# for ASSET_ID in <list of asset_ids>; do
#   OWNER=$(curl -s ... | jq -r ".rows[0].asset_owner")
#   TEMPLATE=$(curl -s ... | jq -r ".rows[0].template_id")
#   # resolve CID by template → species/rarity
#   curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#     -H "content-type: application/json" \
#     -d "{\"cmd\":\"pushaction\",\"args\":\"{\\\"network\\\":\\\"wax-testnet\\\",\\\"from\\\":\\\"phgamecreatr\\\",\\\"contract\\\":\\\"atomicassets\\\",\\\"action\\\":\\\"setassetdata\\\",\\\"data\\\":{\\\"authorized_editor\\\":\\\"phgamecreatr\\\",\\\"asset_owner\\\":\\\"$OWNER\\\",\\\"asset_id\\\":\\\"$ASSET_ID\\\",\\\"new_mutable_data\\\":[{\\\"key\\\":\\\"img\\\",\\\"value\\\":[\\\"string\\\",\\\"$CID_FRONT\\\"]},{\\\"key\\\":\\\"backimg\\\",\\\"value\\\":[\\\"string\\\",\\\"$CID_BACK\\\"]}]}}\"}"
# done

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION CHECKLIST (post-execution)
# ═══════════════════════════════════════════════════════════════════════════════
#
# ☐ Schema exists:
#     curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#       -H "content-type: application/json" \
#       -d '{"cmd":"nftschemas","args":"phgamecreatr"}'
#     # → should show "creaturesv2" with img + backimg in format
#
# ☐ Templates exist with IPFS CIDs:
#     curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#       -H "content-type: application/json" \
#       -d '{"cmd":"nfttemplates","args":"phgamecreatr"}'
#     # → find creaturesv2 templates, check immutable_data has img + backimg
#
# ☐ IPFS CIDs resolve (HTTP 200):
#     for CID in $ALL_CIDS; do
#       STATUS=$(curl -sI "https://ipfs.io/ipfs/$CID" | head -1)
#       echo "$CID → $STATUS"
#     done
#     # → every CID must return HTTP/2 200
#
# ☐ Config updated:
#     curl -s -X POST https://wax-testnet.eosphere.io/v1/chain/get_table_rows \
#       -H "content-type: application/json" \
#       -d '{"code":"phgamecreatr","scope":"phgamecreatr","table":"configv3","json":true,"limit":1}' \
#       | jq '.rows[0].schema_name'
#     # → should print "creaturesv2"
#
# ☐ AtomicHub renders cards:
#     Open https://test.wax.atomichub.io/explorer/collection/phgamecreatr
#     → check a creature card shows front art, flip to see back art
#
# ☐ Test hatch:
#     curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
#       -H "content-type: application/json" \
#       -d '{"cmd":"pushaction","args":"{\"network\":\"wax-testnet\",\"from\":\"waxwingsuper\",\"contract\":\"phgamecreatr\",\"action\":\"hatch\",\"data\":{\"owner\":\"waxwingsuper\",\"egg_type\":0}}"}'
#     # → new NFT should be minted under creaturesv2 with img + backimg

echo "=== creaturesv2 pipeline — DRY-RUN COMPLETE ==="
echo "All commands are commented out. Replace CID placeholders before executing."
echo "Next: wait for Monanisa's PNG art → pin to IPFS → replace CIDs → CEO greenlight."
