#!/bin/bash
set -e
CDT_BIN="/home/bagidea/cdt/bin/cdt-cpp"
CDT_INC_CONTRACTS="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts"
CDT_INC_CORE="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core"
SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="${SRC_DIR}/build"

echo "=== Compiling pockethatch v2 (table names reverted) ==="
"${CDT_BIN}" \
  --contract pockethatch \
  -I "${CDT_INC_CONTRACTS}" \
  -I "${CDT_INC_CORE}" \
  -I "${SRC_DIR}" \
  -o "${BUILD_DIR}/pockethatch.wasm" \
  "${SRC_DIR}/pockethatch.cpp" \
  --abigen

echo ""
echo "=== Build outputs ==="
ls -la "${BUILD_DIR}/pockethatch.wasm" "${BUILD_DIR}/pockethatch.abi"
sha256sum "${BUILD_DIR}/pockethatch.wasm"
echo "Compile OK"
