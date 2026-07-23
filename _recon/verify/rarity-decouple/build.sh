#!/bin/bash
set -e
CDT=/home/bagidea/cdt/bin/cdt-cpp
INC1=/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts
INC2=/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core
SRCDIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
OUT="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/_recon/verify/rarity-decouple/pockethatch.wasm"

echo "=== Building pockethatch (rarity-decouple) ==="
$CDT -I "$INC1" -I "$INC2" -I "$SRCDIR" -o "$OUT" "$SRCDIR/pockethatch.cpp" --abigen
echo "=== Build complete ==="
sha256sum "$OUT"
ls -la "$OUT" "${OUT%.wasm}.abi"
