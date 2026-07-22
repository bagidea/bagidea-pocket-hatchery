$ErrorActionPreference = "Stop"
$buildDir = "$PSScriptRoot"

Write-Host "=== Deploying Rarity 6-Tier to phgamecreatr (Step 1-3) ==="

# ── Step 1: setcode (tiers dormant) ──
$wasmPath = Join-Path $buildDir "pockethatch.wasm"
$wasmBytes = [System.IO.File]::ReadAllBytes($wasmPath)
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "[1/3] WASM: $($wasmBytes.Length) bytes, hex: $($wasmHex.Length) chars"

$setcodeArgs = "eosio setcode `"{\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$wasmHex\`"}`" --actor phgamecreatr"
$setcodeBody = @{
    cmd = "pushaction"
    args = $setcodeArgs
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setcode..."
$setcodeFile = Join-Path $buildDir "_setcode_6tier_body.json"
[System.IO.File]::WriteAllText($setcodeFile, $setcodeBody, [System.Text.Encoding]::UTF8)
$setcodeResult = & curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setcodeFile"
Write-Host "  $setcodeResult"

if ($setcodeResult -match "locked|LOCKED") {
    Write-Host "  FATAL: Wallet locked. Unlock waxwing first."
    exit 1
}
if ($setcodeResult -notmatch '"ok":true') {
    Write-Host "  ERROR: setcode failed. Aborting."
    exit 1
}

# ── Step 2: setabi (pack ABI as abi_def binary) ──
$toolsDir = Resolve-Path (Join-Path $buildDir "..\..\..\tools")
$packCli = Join-Path $toolsDir "pack-abi-cli.mjs"
$abiPath = Join-Path $buildDir "pockethatch.merged.abi"

# First, merge the ABI with the generated one (or use the generated one directly)
# The generated ABI already has all 18 new fields
$genAbiPath = Join-Path $buildDir "pockethatch.abi"
if (-not (Test-Path $genAbiPath)) {
    Write-Host "  ERROR: Generated ABI not found at $genAbiPath"
    exit 1
}

Write-Host "[2/3] Packing ABI (with 6-tier fields)..."
$abiPackedHex = (node $packCli $genAbiPath).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pack-abi-cli failed (exit $LASTEXITCODE)"
    Write-Host "  Raw: $abiPackedHex"
    exit 1
}

$firstByteHex = $abiPackedHex.Substring(0, 2)
$firstByte = [Convert]::ToInt32($firstByteHex, 16)
if ($firstByte -eq 0x7B) {
    Write-Host "  FATAL: Packed ABI starts with 0x7B ('{') — hex-encoded JSON! Aborting."
    exit 1
}
Write-Host "  ABI packed: $($abiPackedHex.Length) hex chars (first byte: 0x$firstByteHex, OK)"

$setabiArgs = "eosio setabi `"{\`"account\`":\`"phgamecreatr\`",\`"abi\`":\`"$abiPackedHex\`"}`" --actor phgamecreatr"
$setabiBody = @{
    cmd = "pushaction"
    args = $setabiArgs
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setabi..."
$setabiFile = Join-Path $buildDir "_setabi_6tier_body.json"
[System.IO.File]::WriteAllText($setabiFile, $setabiBody, [System.Text.Encoding]::UTF8)
$setabiResult = & curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setabiFile"
Write-Host "  $setabiResult"

if ($setabiResult -notmatch '"ok":true') {
    Write-Host "  ERROR: setabi failed. Aborting."
    exit 1
}

# ── Step 3: setconfig with LOCKED weights ──
# earn_mult + fed_dur = from Sun's spec (RARITY-6TIER-SPEC.md)
# rarity_w_epic/legendary/mythic = 0 (LOCKED until Monanisa delivers template_ids)
Write-Host "[3/3] Setting configv3 with 6-tier numbers (epic+ weights LOCKED at 0)..."
$cfg = @{
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
    season_index = 3
    season_started = 1783659821
    rng_oracle = "phgamecreatr"
    rarity_w_common = 6900
    rarity_w_uncommon = 2000
    rarity_w_rare = 800
    rarity_w_epic = 0
    rarity_w_legendary = 0
    rarity_w_mythic = 0
    burn_base_hatch = "10.0000 HATCH"
    fed_dur_common = 172800
    fed_dur_uncommon = 259200
    fed_dur_rare = 432000
    fed_dur_epic = 604800
    fed_dur_legendary = 864000
    fed_dur_mythic = 1209600
    earn_mult_common = 10000
    earn_mult_uncommon = 11000
    earn_mult_rare = 14000
    earn_mult_epic = 20000
    earn_mult_legendary = 32000
    earn_mult_mythic = 50000
    cap_scales_rarity = 1
}

$cfgJson = ($cfg | ConvertTo-Json -Depth 2 -Compress)
$setconfigArgs = "phgamecreatr setconfig `"{\`"cfg\`":$cfgJson}`" --actor phgamecreatr"
$setconfigBody = @{
    cmd = "pushaction"
    args = $setconfigArgs
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setconfig (locked weights)..."
$setconfigFile = Join-Path $buildDir "_setconfig_6tier_body.json"
[System.IO.File]::WriteAllText($setconfigFile, $setconfigBody, [System.Text.Encoding]::UTF8)
$setconfigResult = & curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setconfigFile"
Write-Host "  $setconfigResult"

if ($LASTEXITCODE -ne 0 -or $setconfigResult -notmatch '"ok":true') {
    Write-Host "  ERROR: setconfig failed."
    exit 1
}

Write-Host ""
Write-Host "=== Rarity 6-Tier Steps 1-3 complete ==="
Write-Host "Next: Monanisa delivers template_ids → setspecies tier 3/4/5 →"
Write-Host "      setconfig with live epic/legendary/mythic weights"
