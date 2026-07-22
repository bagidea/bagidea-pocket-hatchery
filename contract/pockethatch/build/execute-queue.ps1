$ErrorActionPreference = "Stop"
$buildDir = "$PSScriptRoot"
$waxwing = "http://127.0.0.1:8787/plugin/wax-wallet/cmd"

# ═══════════════════════════════════════════════════════════════════
# Pocket Hatchery 6-Tier Deploy Queue
# Target: phgamecreatr @ WAX testnet
# ABI: pockethatch.merged.abi (44-field config_row + 7 tables)
# Config values: CHAIN-ECHOED from live configv3 (raw hex decode)
# Species: spccfgv2 SURVIVES setcode (verified 4 rows on chain)
#          → only 3 NEW species (663046/47/48) need binding
# ═══════════════════════════════════════════════════════════════════

function Send-PushAction($description, $argsStr) {
    Write-Host ">>> $description" -ForegroundColor Cyan
    $body = @{ cmd = "pushaction"; args = $argsStr } | ConvertTo-Json -Depth 1 -Compress
    $bodyFile = Join-Path $buildDir "_tmp_body.json"
    [System.IO.File]::WriteAllText($bodyFile, $body, [System.Text.Encoding]::UTF8)
    $result = & curl.exe -s -X POST $waxwing -H "content-type: application/json" --data-binary "@$bodyFile"
    Write-Host $result
    if ($result -notmatch '"ok":true') {
        Write-Host "  FAILED: $description" -ForegroundColor Red
        $abort = Read-Host "Continue? (y/n)"
        if ($abort -ne 'y') { exit 1 }
    }
    Write-Host ""
}

# ── Pre-flight ──────────────────────────────────────────────────
Write-Host "=== PRE-FLIGHT ===" -ForegroundColor Yellow
$status = & curl.exe -s -X POST $waxwing -H "content-type: application/json" -d '{"cmd":"status"}'
Write-Host $status
if ($status -match '"locked":true') {
    Write-Host "FATAL: Wallet locked. Unlock first." -ForegroundColor Red
    exit 1
}

Write-Host "`nChain-echo summary (raw hex decode of live configv3, 212 bytes):"
Write-Host "  All numeric fields verified = hpp-defaults (no offline tuning detected)"
Write-Host "  season_index=3  season_started=1783659821"
Write-Host "  hatch=150 evolve=300 breed=5.0000 feed=12"
Write-Host "  rarity_w: 700/250/50  fed_dur: 172800/259200/432000"
Write-Host "  burn_base_hatch=10.0000  earn_mult: 10000/11000/14000"
Write-Host "  spccfgv2: 4 species live (662889/662976/662977/662978) — survive setcode"
$ok = Read-Host "Proceed? (y/n)"
if ($ok -ne 'y') { exit 1 }

# ═══ STEP 1: clearconfig (OLD contract → purge incompatible binary) ═══
Write-Host "`n=== STEP 1/7: clearconfig (old contract) ===" -ForegroundColor Green
Write-Host "  WHY: old configv3 binary (212 bytes, ~30 fields) is incompatible"
Write-Host "       with new 44-field struct. Purge before setcode so new contract"
Write-Host "       creates a fresh singleton row."
Send-PushAction "clearconfig (old contract)" "phgamecreatr clearconfig '{}' --actor phgamecreatr"

# ═══ STEP 2: setcode (deploy new wasm) ═══════════════════════════════
Write-Host "=== STEP 2/7: setcode ===" -ForegroundColor Green
$wasmPath = Join-Path $buildDir "pockethatch.wasm"
if (-not (Test-Path $wasmPath)) { Write-Host "FATAL: $wasmPath not found"; exit 1 }
$wasmBytes = [System.IO.File]::ReadAllBytes($wasmPath)
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "WASM: $($wasmBytes.Length) bytes, hex: $($wasmHex.Length) chars"
$setcodeArgs = "eosio setcode `"{\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$wasmHex\`"}`" --actor phgamecreatr"
Send-PushAction "setcode phgamecreatr" $setcodeArgs

# ═══ STEP 3: setabi (deploy merged ABI — 44 fields + 7 tables) ══════
Write-Host "=== STEP 3/7: setabi (merged ABI: 44-field config_row + 7 tables) ===" -ForegroundColor Green
$abiPath = Join-Path $buildDir "pockethatch.merged.abi"
if (-not (Test-Path $abiPath)) { Write-Host "FATAL: $abiPath not found — run merge step first"; exit 1 }

$toolsDir = Resolve-Path (Join-Path $buildDir "..\..\..\tools")
$packCli = Join-Path $toolsDir "pack-abi-cli.mjs"
if (-not (Test-Path $packCli)) {
    Write-Host "FATAL: pack-abi-cli.mjs not found at $packCli" -ForegroundColor Red
    exit 1
}

Write-Host "Packing ABI (merged: 44 config fields + 7 tables)..."
$abiPackedHex = (node $packCli $abiPath).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "FATAL: pack-abi-cli failed (exit $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "Raw: $abiPackedHex"
    exit 1
}
$firstByteHex = $abiPackedHex.Substring(0, 2)
$firstByte = [Convert]::ToInt32($firstByteHex, 16)
if ($firstByte -eq 0x7B) {
    Write-Host "FATAL: Packed ABI starts with 0x7B ('{') — hex-encoded JSON! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "ABI packed: $($abiPackedHex.Length) hex chars (first byte: 0x$firstByteHex, OK)"
$setabiArgs = "eosio setabi `"{\`"account\`":\`"phgamecreatr\`",\`"abi\`":\`"$abiPackedHex\`"}`" --actor phgamecreatr"
Send-PushAction "setabi (merged ABI, 7 tables)" $setabiArgs

Write-Host "  VERIFY: after this, get_table_rows configv3/spccfgv2/creatrsv2 should work"

# ═══ STEP 4: setpaused(true) — lock during setup ════════════════════
Write-Host "=== STEP 4/7: setpaused(true) ===" -ForegroundColor Green
Send-PushAction "setpaused(true)" "phgamecreatr setpaused '{\"paused\":1}' --actor phgamecreatr"

# ═══ STEP 5: setspecies — 3 NEW species only (spccfgv2 survives setcode) ═══
Write-Host "=== STEP 5/7: setspecies (3 NEW: Epic/Legendary/Mythic) ===" -ForegroundColor Green
Write-Host "  spccfgv2 on chain already has 4 species (verified): 662889/662976/662977/662978"
Write-Host "  Only binding 3 NEW tier 3/4/5 species: 663046 (Epic) / 663047 (Legendary) / 663048 (Mythic)"
Write-Host "  All Fire family base yields (100/300/600/1200/2400/4800) — rarity premium from config earn_mult"

Send-PushAction "setspecies 663046 (Foxling Epic, egg_type=3)" `
    "phgamecreatr setspecies '{\"sp\":{\"template_id\":663046,\"growth_rate\":600,\"thresh_1\":3000,\"thresh_2\":15000,\"thresh_3\":60000,\"thresh_4\":200000,\"thresh_5\":350000,\"yield_0\":100,\"yield_1\":300,\"yield_2\":600,\"yield_3\":1200,\"yield_4\":2400,\"yield_5\":4800,\"max_stage\":5,\"egg_weight\":10,\"egg_type\":3,\"family\":\"Fire\"}}' --actor phgamecreatr"

Send-PushAction "setspecies 663047 (Foxling Legendary, egg_type=4)" `
    "phgamecreatr setspecies '{\"sp\":{\"template_id\":663047,\"growth_rate\":500,\"thresh_1\":4000,\"thresh_2\":20000,\"thresh_3\":80000,\"thresh_4\":250000,\"thresh_5\":450000,\"yield_0\":100,\"yield_1\":300,\"yield_2\":600,\"yield_3\":1200,\"yield_4\":2400,\"yield_5\":4800,\"max_stage\":5,\"egg_weight\":10,\"egg_type\":4,\"family\":\"Fire\"}}' --actor phgamecreatr"

Send-PushAction "setspecies 663048 (Foxling Mythic, egg_type=5)" `
    "phgamecreatr setspecies '{\"sp\":{\"template_id\":663048,\"growth_rate\":400,\"thresh_1\":5000,\"thresh_2\":25000,\"thresh_3\":100000,\"thresh_4\":350000,\"thresh_5\":600000,\"yield_0\":100,\"yield_1\":300,\"yield_2\":600,\"yield_3\":1200,\"yield_4\":2400,\"yield_5\":4800,\"max_stage\":5,\"egg_weight\":10,\"egg_type\":5,\"family\":\"Fire\"}}' --actor phgamecreatr"

# ═══ STEP 6: setconfig (SMOKE TEST) + hatch + verify ═════════════
Write-Host "=== STEP 6/7: SMOKE TEST — setconfig(smoke) → hatch Epic → verify ===" -ForegroundColor Yellow

$cfgSmoke = Get-Content (Join-Path $buildDir "cfg_smoke.json") -Raw | ConvertFrom-Json
$cfgSmokeJson = ($cfgSmoke | ConvertTo-Json -Depth 2 -Compress)
$setconfigSmokeArgs = "phgamecreatr setconfig `"{\`"cfg\`":$cfgSmokeJson}`" --actor phgamecreatr"
Send-PushAction "setconfig (smoke-test: epic=1, others=0)" $setconfigSmokeArgs

Write-Host "Unpausing for smoke test hatch..."
Send-PushAction "setpaused(false) for hatch" "phgamecreatr setpaused '{\"paused\":0}' --actor phgamecreatr"

Write-Host "SMOKE: hatch waxwingsuper → MUST produce Epic (template 663046)"
Send-PushAction "initplayer waxwingsuper (if needed)" "phgamecreatr initplayer '{\"owner\":\"waxwingsuper\"}' --actor waxwingsuper"
Send-PushAction "SMOKE HATCH: waxwingsuper" "phgamecreatr hatch '{\"owner\":\"waxwingsuper\",\"egg_type\":0}' --actor waxwingsuper"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║  VERIFY SMOKE TEST NOW:                      ║" -ForegroundColor Yellow
Write-Host "║                                              ║" -ForegroundColor Yellow
Write-Host "║  curl wax-wallet/cmd -d                      ║" -ForegroundColor Yellow
Write-Host "║   '{\"cmd\":\"nfttemplates\",\"args\":            ║" -ForegroundColor Yellow
Write-Host "║     \"{\\\"collection\\\":\\\"phgamecreatr\\\"}\"}'     ║" -ForegroundColor Yellow
Write-Host "║                                              ║" -ForegroundColor Yellow
Write-Host "║  EXPECT: 663046 issued_supply: 0 → 1         ║" -ForegroundColor Yellow
Write-Host "║  If STILL 0: smoke test FAILED — STOP HERE   ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""

$smokeOk = Read-Host "Did 663046 issued_supply go 0→1? (y/n)"
if ($smokeOk -ne 'y') {
    Write-Host "Smoke test FAILED. DO NOT proceed to real weights!" -ForegroundColor Red
    Write-Host "Set paused back: phgamecreatr setpaused '{\"paused\":1}' --actor phgamecreatr"
    exit 1
}

# ═══ STEP 7: setconfig (REAL WEIGHTS) + verify ═══════════════════
Write-Host "=== STEP 7/7: setconfig (REAL weights — CEO LOCKED) ===" -ForegroundColor Green
Write-Host "  Weights: 6900/2000/800/250/45/5 (10000 bp total)"
Write-Host "  Earn: x1.0/x1.1/x1.4/x2.0/x3.2/x5.0 (Sun adjusted)"
Write-Host "  fed_dur: 48h/72h/120h/168h/240h/336h"
Write-Host "  paused=0 (contract open for players)"

$cfgReal = Get-Content (Join-Path $buildDir "cfg_real.json") -Raw | ConvertFrom-Json
$cfgRealJson = ($cfgReal | ConvertTo-Json -Depth 2 -Compress)
$setconfigRealArgs = "phgamecreatr setconfig `"{\`"cfg\`":$cfgRealJson}`" --actor phgamecreatr"
Send-PushAction "setconfig (REAL: 6900/2000/800/250/45/5)" $setconfigRealArgs

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  QUEUE COMPLETE                          ║" -ForegroundColor Green
Write-Host "║                                          ║" -ForegroundColor Green
Write-Host "║  VERIFY FINAL STATE:                     ║" -ForegroundColor Green
Write-Host "║  1. get_table_rows configv3 (7 tables)   ║" -ForegroundColor Green
Write-Host "║  2. nfttemplates → all 7 species listed  ║" -ForegroundColor Green
Write-Host "║  3. spccfgv2 → 7 rows (4 old + 3 new)    ║" -ForegroundColor Green
Write-Host "║  4. 663046 issued_supply = 1             ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Contract: phgamecreatr @ WAX testnet"
Write-Host "Config: 6-tier, real weights 6900/2000/800/250/45/5"
Write-Host "ABI: pockethatch.merged.abi (44 fields + 7 tables)"
Write-Host "Species: 7 total (4 existing + 3 new Epic/Legendary/Mythic)"
Write-Host "Smoke test: PASSED ✓ (663046 issued 0→1)"
