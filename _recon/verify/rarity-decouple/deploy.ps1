$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false  # no BOM
$verifyDir = "$PSScriptRoot"
$projectDir = Resolve-Path (Join-Path $verifyDir "..\..\..")
$toolsDir = Join-Path $projectDir "tools"
$packCli = Join-Path $toolsDir "pack-abi-cli.mjs"
$api = "http://127.0.0.1:8787/plugin/wax-wallet/cmd"
$rpc = "https://testnet.waxsweden.org"

function Send-Action($bodyObj, $label) {
    $json = $bodyObj | ConvertTo-Json -Depth 1 -Compress
    $bytes = $utf8.GetBytes($json)
    $tmp = New-TemporaryFile
    [System.IO.File]::WriteAllBytes($tmp, $bytes)
    Write-Host "  [$label] Sending..."
    $result = curl.exe -s -X POST $api -H "content-type: application/json" --data-binary "@$tmp"
    Remove-Item $tmp -Force
    return $result
}

Write-Host "=== Rarity-Decouple Deploy to phgamecreatr @ wax-testnet ==="
Write-Host ""

# 0. Verify live code_hash
Write-Host "[0/5] Live code_hash..."
$live = curl.exe -s -X POST "$rpc/v1/chain/get_raw_abi" -H "content-type: application/json" -d '{"account_name":"phgamecreatr"}'
$liveHash = if ($live -match '"code_hash":"([^"]+)"') { $matches[1] } else { "?" }
Write-Host "  Live: $liveHash"

# 1. Pause
Write-Host "[1/5] Pause..."
$r = Send-Action @{cmd="pushaction"; args="phgamecreatr setpaused {`"paused`":true} --actor phgamecreatr"} "pause"
Write-Host "  $r"

# 2. Setcode
Write-Host "[2/5] Setcode..."
$wasmPath = Join-Path $verifyDir "pockethatch.wasm"
$wasmBytes = [System.IO.File]::ReadAllBytes($wasmPath)
$wasmHex = -join ($wasmBytes | ForEach-Object { $_.ToString("x2") })
Write-Host "  WASM: $($wasmBytes.Length) bytes"
$r = Send-Action @{cmd="pushaction"; args="eosio setcode {\`"account\`":\`"phgamecreatr\`",\`"vmtype\`":0,\`"vmversion\`":0,\`"code\`":\`"$wasmHex\`"} --actor phgamecreatr"} "setcode"
Write-Host "  $r"

# 3. Setabi
Write-Host "[3/5] Setabi..."
$abiPath = Join-Path $verifyDir "pockethatch.deploy.abi"
$abiPackedHex = (node $packCli $abiPath).Trim()
Write-Host "  ABI packed: $($abiPackedHex.Length) hex chars"
$r = Send-Action @{cmd="pushaction"; args="eosio setabi {\`"account\`":\`"phgamecreatr\`",\`"abi\`":\`"$abiPackedHex\`"} --actor phgamecreatr"} "setabi"
Write-Host "  $r"

# 4. Clear old creatures (layout migration)
Write-Host "[4/5] Clear creatures..."
$r = Send-Action @{cmd="pushaction"; args="phgamecreatr clearcreatrs {} --actor phgamecreatr"} "clear"
Write-Host "  $r"

# 5. Verify
Write-Host "[5/5] Verify..."
$new = curl.exe -s -X POST "$rpc/v1/chain/get_raw_abi" -H "content-type: application/json" -d '{"account_name":"phgamecreatr"}'
$newHash = if ($new -match '"code_hash":"([^"]+)"') { $matches[1] } else { "?" }
Write-Host "  New code_hash: $newHash"
$expected = "5a321f53e8f8f1a7109fa9e25d0ecc7a85130f0bd71ba4e58bc362decde6655e"
if ($newHash -eq $expected) { Write-Host "  MATCH!" } else { Write-Host "  MISMATCH (expected $expected)" }

Write-Host ""
Write-Host "=== Deploy complete ==="
