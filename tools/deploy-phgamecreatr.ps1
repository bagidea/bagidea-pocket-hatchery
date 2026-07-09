# Pocket Hatchery — Deploy to phgamecreatr
# ==========================================
# Attempts deploy via waxwing pushaction from Windows.
#
# ⚠️  SETCODE OVER PUSHACTION = UNPROVEN for large payloads
#    Small actions (initplayer, harvest, config) are proven working.
#    But setcode carries ~224KB of hex — this has NOT been live-tested.
#    It may hit daemon body-parser limits, curl timeouts, or wharfkit
#    serialization limits. The pushaction format IS correct per waxwing
#    source (index.js:3085 transact → broadcast), but the payload SIZE
#    is the unknown.
#
#    → TRY waxwing first (this script). If it fails, use the WSL fallback.
#    → Once the wallet is unlocked, we can live-test and determine definitively.
#
# PREREQUISITES:
#   1. waxwing wallet UNLOCKED (boss password)
#   2. phgamecreatr key in keystore (verified: PUB_K1_8GYteRNh...)
#   3. phgamecreatr has enough RAM: needs ~127KB free (WASM 112KB + ABI + overhead)
#      Current: ~40KB free — MUST buy RAM first!
#      → waxwing buyram --from waxwingsuper --receiver phgamecreatr --bytes 200000
#
# WASM: pockethatch.wasm (111,810 bytes)
# SHA256: 060b7bff955fa53f3cf40718792679c04766b3f963b52adcec060dc704ae22d1

$ErrorActionPreference = "Stop"
$DAEMON = "http://127.0.0.1:8787"
$WAXWING = "$DAEMON/plugin/wax-wallet/cmd"
$NETWORK = "wax-testnet"
$CONTRACT = "phgamecreatr"
$ACTOR = $CONTRACT

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Resolve-Path "$SCRIPT_DIR\.."
$BUILD_DIR = "$PROJECT_DIR\contract\pockethatch\build"
$WASM_PATH = "$BUILD_DIR\pockethatch.wasm"
$ABI_PATH = "$BUILD_DIR\pockethatch.abi"

Write-Host "═" -NoNewline; Write-Host ("═" * 59)
Write-Host "  Pocket Hatchery — Deploy to $CONTRACT"
Write-Host "═" -NoNewline; Write-Host ("═" * 59)

# ── Verify build artifacts ──────────────────────────────────────────
if (-not (Test-Path $WASM_PATH)) {
    Write-Host "`n❌ WASM not found: $WASM_PATH"
    Write-Host "   Run the WSL compile step first (see contract/pockethatch/compile.sh)"
    exit 1
}
if (-not (Test-Path $ABI_PATH)) {
    Write-Host "`n❌ ABI not found: $ABI_PATH"
    exit 1
}

$wasmBytes = [System.IO.File]::ReadAllBytes($WASM_PATH)
$wasmHash = (Get-FileHash -Path $WASM_PATH -Algorithm SHA256).Hash.ToLower()
$abiJson = Get-Content -Raw $ABI_PATH | ConvertFrom-Json

Write-Host "`n📦 Build Artifacts:"
Write-Host "   WASM: $($wasmBytes.Length) bytes"
Write-Host "   SHA256: $wasmHash"
Write-Host "   ABI:  $(($abiJson | ConvertTo-Json -Depth 1 -Compress).Length) bytes"
Write-Host "   Target: $CONTRACT on WAX testnet"

# ── Check wallet ────────────────────────────────────────────────────
Write-Host "`n🔑 Checking wallet..."
$statusBody = '{"cmd":"status"}'
$statusFile = Join-Path $env:TEMP "_ph_deploy_status.json"
[System.IO.File]::WriteAllText($statusFile, $statusBody, [System.Text.Encoding]::UTF8)
$status = curl.exe -s -X POST $WAXWING -H "content-type: application/json" --data-binary "@$statusFile" | ConvertFrom-Json

if (-not $status.ok) {
    Write-Host "❌ waxwing not responding"
    exit 1
}
if (-not $status.status.unlocked) {
    Write-Host "❌ Wallet is LOCKED!"
    Write-Host "   Unlock first: curl -X POST $WAXWING -d '{\`"cmd\`":\`"unlock\`",\`"args\`":\`"<PASSWORD>\`"}'"
    Write-Host "   Then re-run this script."
    exit 1
}
Write-Host "   ✅ Wallet unlocked | Network: $($status.status.network.name)"

# Verify phgamecreatr key exists
$keyFound = $false
foreach ($acct in $status.status.accounts) {
    if ($acct.account -eq $CONTRACT) { $keyFound = $true; break }
}
if (-not $keyFound) {
    Write-Host "❌ $CONTRACT key not in waxwing keystore!"
    exit 1
}
Write-Host "   ✅ $CONTRACT key in keystore"

# ── Check RAM ───────────────────────────────────────────────────────
Write-Host "`n📊 Checking account RAM..."
$acctBody = "{\`"cmd\`":\`"account\`",\`"args\`":\`"$CONTRACT\`"}"
$acctFile = Join-Path $env:TEMP "_ph_deploy_acct.json"
[System.IO.File]::WriteAllText($acctFile, $acctBody, [System.Text.Encoding]::UTF8)
$acctInfo = curl.exe -s -X POST $WAXWING -H "content-type: application/json" --data-binary "@$acctFile" | ConvertFrom-Json

$ramQuota = $acctInfo.account.ram.quota
$ramUsed = $acctInfo.account.ram.usage
$ramFree = $ramQuota - $ramUsed
$neededRam = $wasmBytes.Length + 15000  # WASM + ABI + overhead

Write-Host "   RAM quota:  $ramQuota bytes"
Write-Host "   RAM used:   $ramUsed bytes"
Write-Host "   RAM free:   $ramFree bytes"
Write-Host "   Needed:     ~$neededRam bytes"

if ($ramFree -lt $neededRam) {
    $shortfall = $neededRam - $ramFree
    $buyBytes = [math]::Max($shortfall + 50000, 200000)
    Write-Host ""
    Write-Host "❌❌❌  HARD STOP — INSUFFICIENT RAM  ❌❌❌"
    Write-Host ""
    Write-Host "   $CONTRACT has $ramFree bytes free but needs ~$neededRam bytes."
    Write-Host "   The chain WILL REJECT setcode without enough RAM."
    Write-Host ""
    Write-Host "   → Buy RAM first (requires waxwingsuper key in keystore + unlocked):"
    Write-Host ""
    Write-Host "   curl -s -X POST $WAXWING -H 'content-type: application/json' -d '{\"cmd\":\"buyram\",\"args\":\"--from waxwingsuper --receiver $CONTRACT --bytes $buyBytes\"}'"
    Write-Host ""
    Write-Host "   Then re-run this script."
    Remove-Item -Force $statusFile, $acctFile -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "   ✅ RAM sufficient"

# ── Step 1: setcode ─────────────────────────────────────────────────
Write-Host "`n📤 [1/2] Deploying WASM (setcode)..."
Write-Host "   ⚠️  ~224KB hex payload — UNPROVEN path. If this fails, use WSL fallback."
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "   Hex length: $($wasmHex.Length) chars (~$([math]::Round($wasmHex.Length/1024,1)) KB)"

$setcodeData = @{
    cmd = "pushaction"
    args = (@{
        network = $NETWORK
        from = $ACTOR
        contract = "eosio"
        action = "setcode"
        data = @{
            account = $CONTRACT
            vmtype = 0
            vmversion = 0
            code = $wasmHex
        }
    } | ConvertTo-Json -Depth 3 -Compress)
} | ConvertTo-Json -Depth 1 -Compress

$setcodeFile = Join-Path $env:TEMP "_ph_setcode.json"
[System.IO.File]::WriteAllText($setcodeFile, $setcodeData, [System.Text.Encoding]::UTF8)
Write-Host "   Request body: $($setcodeData.Length) chars"

Write-Host "   Sending (timeout: 120s)..."
try {
    $setcodeResult = curl.exe -s -X POST $WAXWING `
        -H "content-type: application/json" `
        --data-binary "@$setcodeFile" `
        --max-time 120
    Write-Host "   Result: $($setcodeResult.Substring(0, [math]::Min(300, $setcodeResult.Length)))"
    $setcodeJson = $setcodeResult | ConvertFrom-Json
    if ($setcodeJson.ok) {
        Write-Host "   ✅ WASM deployed! tx: $($setcodeJson.txId)"
        Write-Host "   🔗 $($setcodeJson.explorer)"
    } else {
        Write-Host "   ❌ setcode failed: $($setcodeJson.msg)"
        Write-Host ""
        Write-Host "   ═══════════════════════════════════════════════════════"
        Write-Host "   → waxwing pushaction for large payload = UNPROVEN"
        Write-Host "   → Fallback: WSL + cleos (see WSL FALLBACK section at bottom of this script)"
        Write-Host "   ═══════════════════════════════════════════════════════"
        exit 1
    }
} catch {
    Write-Host "   ❌ HTTP/parse error: $_"
    Write-Host ""
    Write-Host "   ═══════════════════════════════════════════════════════"
    Write-Host "   → setcode via waxwing pushaction FAILED (payload too large?)"
    Write-Host "   → This path is UNPROVEN for ~224KB hex payloads."
    Write-Host "   → Use the proven WSL + cleos fallback below."
    Write-Host "   ═══════════════════════════════════════════════════════"
    exit 1
}

# ── Step 2: setabi ──────────────────────────────────────────────────
Write-Host "`n📋 [2/2] Deploying ABI (setabi)..."
$abiBytes = [System.Text.Encoding]::UTF8.GetBytes(($abiJson | ConvertTo-Json -Depth 3 -Compress))
$abiHex = -join ($abiBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "   ABI hex length: $($abiHex.Length) chars"

$setabiData = @{
    cmd = "pushaction"
    args = (@{
        network = $NETWORK
        from = $ACTOR
        contract = "eosio"
        action = "setabi"
        data = @{
            account = $CONTRACT
            abi = $abiHex
        }
    } | ConvertTo-Json -Depth 3 -Compress)
} | ConvertTo-Json -Depth 1 -Compress

$setabiFile = Join-Path $env:TEMP "_ph_setabi.json"
[System.IO.File]::WriteAllText($setabiFile, $setabiData, [System.Text.Encoding]::UTF8)

try {
    $setabiResult = curl.exe -s -X POST $WAXWING `
        -H "content-type: application/json" `
        --data-binary "@$setabiFile" `
        --max-time 60
    $setabiJson = $setabiResult | ConvertFrom-Json
    if ($setabiJson.ok) {
        Write-Host "   ✅ ABI deployed! tx: $($setabiJson.txId)"
    } else {
        Write-Host "   ❌ setabi failed: $($setabiJson.msg)"
        exit 1
    }
} catch {
    Write-Host "   ❌ HTTP error: $_"
    exit 1
}

# ── Verify ──────────────────────────────────────────────────────────
Write-Host "`n🔍 Verifying code hash..."
$codeHash = curl.exe -s -X POST https://testnet.waxsweden.org/v1/chain/get_code `
    -H "content-type: application/json" `
    -d "{\`"account_name\`":\`"$CONTRACT\`"}" | Select-String -Pattern '"code_hash":"([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value }

if ($codeHash) {
    Write-Host "   On-chain code_hash: $codeHash"
    Write-Host "   Build wasm SHA256:  $wasmHash"
    if ($codeHash -eq $wasmHash) {
        Write-Host "   ✅ HASH MATCH — deploy confirmed!"
    } else {
        Write-Host "   ⚠️  Hash MISMATCH — may need re-deploy"
    }
}

# Cleanup temp files
Remove-Item -Force $statusFile, $acctFile, $setcodeFile, $setabiFile -ErrorAction SilentlyContinue

Write-Host "`n🎉 Deploy complete!"
Write-Host "   Next: node tools/setup-phgamecreatr.mjs"

# ═══════════════════════════════════════════════════════════════════════
# WSL FALLBACK — proven path via cleos
# ═══════════════════════════════════════════════════════════════════════
#
# If waxwing pushaction fails with the large setcode payload, deploy via
# WSL + cleos on the SAME machine (no separate Linux box needed):
#
# PREREQUISITE: keosd wallet with phgamecreatr@active key imported.
#   → Pull key from waxwing with unlock → "accounts" → copy the key
#   → In WSL: cleos wallet import --private-key <PHGAMECREATR_WIF>
#
# <#
# wsl bash -c '
# RPC=https://testnet.waxsweden.org
# ACCT=phgamecreatr
# BUILD="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch/build"
#
# cleos -u "$RPC" set contract "$ACCT" "$BUILD" pockethatch.wasm pockethatch.abi -p "$ACCT"@active
#
# # Verify:
# cleos -u "$RPC" get code "$ACCT"
# # Expected SHA256: 060b7bff955fa53f3cf40718792679c04766b3f963b52adcec060dc704ae22d1
# '
# #>
#
# NOTE: The old deploy-fix-2026-07-01.sh script targets pockethatch1
# (hash 7a61f065), NOT phgamecreatr (hash 060b7bff). Do NOT use it
# for phgamecreatr. Use the cleos command above instead.
