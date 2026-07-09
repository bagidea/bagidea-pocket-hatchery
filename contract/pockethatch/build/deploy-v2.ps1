$ErrorActionPreference = "Stop"
$buildDir = "$PSScriptRoot"

# Resolve tools directory
$toolsDir = Resolve-Path (Join-Path $buildDir "..\..\..\tools")
$packCli = Join-Path $toolsDir "pack-abi-cli.mjs"

Write-Host "=== Deploying Feed v2 to phgamecreatr via waxwing ==="

# Step 1: Read v2 WASM as hex
$wasmPath = Join-Path $buildDir "pockethatch.v2.wasm"
$wasmBytes = [System.IO.File]::ReadAllBytes($wasmPath)
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "[1/3] WASM v2: $($wasmBytes.Length) bytes, hex: $($wasmHex.Length) chars"

# Build setcode JSON body
$setcodeBody = @{
    cmd = "pushaction"
    args = "eosio setcode `"{\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$wasmHex\`"}`" --actor phgamecreatr"
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setcode..."
$setcodeFile = Join-Path $buildDir "_setcode_v2_body.json"
[System.IO.File]::WriteAllText($setcodeFile, $setcodeBody, [System.Text.Encoding]::UTF8)
$setcodeResult = curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setcodeFile"
Write-Host "  $setcodeResult"

# Check for lock error
if ($setcodeResult -match "locked|LOCKED") {
    Write-Host "  FATAL: Wallet is locked. Unlock waxwing first, then re-run."
    exit 1
}

# Step 2: Pack merged ABI (with table definitions) as abi_def binary
$abiPath = Join-Path $buildDir "pockethatch.v2.merged.abi"
Write-Host "[2/3] Packing ABI v2 (with tables) as abi_def binary..."
$abiPackedHex = (node $packCli $abiPath).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pack-abi-cli failed (exit $LASTEXITCODE)"
    Write-Host "  Raw: $abiPackedHex"
    exit 1
}

# DRY-TEST: first byte must be varuint, NOT 0x7B ("{" = raw JSON)
$firstByteHex = $abiPackedHex.Substring(0, 2)
$firstByte = [Convert]::ToInt32($firstByteHex, 16)
if ($firstByte -eq 0x7B) {
    Write-Host "  FATAL: Packed ABI starts with 0x7B ('{') — hex-encoded JSON detected! Aborting."
    exit 1
}
Write-Host "  ABI packed: $($abiPackedHex.Length) hex chars (first byte: 0x$firstByteHex, OK)"

# Build setabi JSON body
$setabiBody = @{
    cmd = "pushaction"
    args = "eosio setabi `"{\`"account\`":\`"phgamecreatr\`",\`"abi\`":\`"$abiPackedHex\`"}`" --actor phgamecreatr"
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setabi..."
$setabiFile = Join-Path $buildDir "_setabi_v2_body.json"
[System.IO.File]::WriteAllText($setabiFile, $setabiBody, [System.Text.Encoding]::UTF8)
$setabiResult = curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setabiFile"
Write-Host "  $setabiResult"

# Step 3: setconfig with correct Feed v2 values
Write-Host "[3/3] Setting configv3 with Feed v2 parameters..."

# Build setconfig JSON with CORRECT earn_mult values (verified from speciescfg 2026-07-09)
$cfgData = @{
    cfg = @{
        token_contract = "hatchtokens1"
        collection = "phgamecreatr"
        schema_name = "creatures"
        fee_account = "phgamecreatr"
        paused = 0
        hatch_cost = 150
        evolve_cost = 300
        breed_cost = "5.0000 HATCH"
        feed_cost = 12
        slot_cost = 500
        cosmetic_cost = 100
        name_cost = "1.0000 HATCH"
        install_cap_bonus = 72
        feed_cd = 21600
        harvest_cd = 3600
        breed_cd = 86400
        feed_daily_cap = 3
        daily_egg_cap = 240
        offline_cap_h = 8
        tap_egg_cap = 60
        feed_boost = 100
        season_index = 1
        season_started = 1783454322
        rng_oracle = "phgamecreatr"
        rarity_w_common = 700
        rarity_w_uncommon = 250
        rarity_w_rare = 50
        burn_base_hatch = "10.0000 HATCH"
        fed_dur_common = 172800
        fed_dur_uncommon = 259200
        fed_dur_rare = 432000
        earn_mult_common = 10000
        earn_mult_uncommon = 11000
        earn_mult_rare = 14000
        cap_scales_rarity = 1
    }
}

$setconfigBody = @{
    cmd = "pushaction"
    args = "phgamecreatr setconfig '$($cfgData | ConvertTo-Json -Depth 3 -Compress)' --actor phgamecreatr"
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setconfig..."
$setconfigFile = Join-Path $buildDir "_setconfig_v3_body.json"
[System.IO.File]::WriteAllText($setconfigFile, $setconfigBody, [System.Text.Encoding]::UTF8)
$setconfigResult = curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setconfigFile"
Write-Host "  $setconfigResult"

Write-Host ""
Write-Host "=== Feed v2 Deploy complete ==="
Write-Host "Next: verify on-chain & swap CONFIG_TABLE in chain.ts to 'configv3'"
