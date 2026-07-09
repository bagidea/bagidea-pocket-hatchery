$ErrorActionPreference = "Stop"
$buildDir = "$PSScriptRoot"

# Resolve tools directory (build/ → ../../../tools/)
# build/ = contract/pockethatch/build/ → up 3 levels → Pocket Hatchery/tools/
$toolsDir = Resolve-Path (Join-Path $buildDir "..\..\..\tools")
$packCli = Join-Path $toolsDir "pack-abi-cli.mjs"

Write-Host "=== Deploying to phgamecreatr via waxwing ==="

# Step 1: Read WASM as hex
$wasmPath = Join-Path $buildDir "pockethatch.wasm"
$wasmBytes = [System.IO.File]::ReadAllBytes($wasmPath)
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "[1/2] WASM: $($wasmBytes.Length) bytes, hex: $($wasmHex.Length) chars"

# Build setcode JSON body
$setcodeBody = @{
    cmd = "pushaction"
    args = "eosio setcode `"{\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$wasmHex\`"}`" --actor phgamecreatr"
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setcode..."
$setcodeFile = Join-Path $buildDir "_setcode_body.json"
[System.IO.File]::WriteAllText($setcodeFile, $setcodeBody, [System.Text.Encoding]::UTF8)
$setcodeResult = curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setcodeFile"
Write-Host "  $setcodeResult"

# Step 2: PACK ABI as abi_def binary (NOT hex-encode JSON!)
# The old approach hex-encoded the ABI JSON → chain stored raw JSON text
# → nodeos cannot decode it as abi_def → get_table_rows breaks.
# Fix: pack via eosjs → abi_def binary → correct bytes for setabi.
$abiPath = Join-Path $buildDir "pockethatch.abi"
Write-Host "[2/2] Packing ABI as abi_def binary..."
$abiPackedHex = (node $packCli $abiPath).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pack-abi-cli failed (exit $LASTEXITCODE)"
    Write-Host "  Raw: $abiPackedHex"
    exit 1
}

# DRY-TEST: first byte must be varuint of "eosio::abi/1.X" (~0x0E), NOT 0x7B ("{")
$firstByteHex = $abiPackedHex.Substring(0, 2)
$firstByte = [Convert]::ToInt32($firstByteHex, 16)
if ($firstByte -eq 0x7B) {
    Write-Host "  FATAL: Packed ABI starts with 0x7B ('{') — hex-encoded JSON detected! Aborting."
    Write-Host "  This is the OLD buggy behavior. The packing script should produce abi_def binary."
    exit 1
}
Write-Host "  ABI packed: $($abiPackedHex.Length) hex chars (first byte: 0x$firstByteHex = varuint len, OK)"
Write-Host "  Dry-test PASS: not 0x7B '{', correctly packed as abi_def"

# Build setabi JSON body with PACKED ABI hex
$setabiBody = @{
    cmd = "pushaction"
    args = "eosio setabi `"{\`"account\`":\`"phgamecreatr\`",\`"abi\`":\`"$abiPackedHex\`"}`" --actor phgamecreatr"
} | ConvertTo-Json -Depth 1 -Compress

Write-Host "  Sending setabi..."
$setabiFile = Join-Path $buildDir "_setabi_body.json"
[System.IO.File]::WriteAllText($setabiFile, $setabiBody, [System.Text.Encoding]::UTF8)
$setabiResult = curl.exe -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd -H "content-type: application/json" --data-binary "@$setabiFile"
Write-Host "  $setabiResult"

Write-Host ""
Write-Host "=== Deploy complete ==="
Write-Host "⚠️  Verify with: node tools/verify-loop.mjs --dry"
