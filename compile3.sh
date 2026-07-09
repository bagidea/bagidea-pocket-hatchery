#!/bin/bash
set -e

# CDT 3.1.0
CDT_BIN="/home/bagidea/cdt3/usr/bin/cdt-cpp"
CDT_INC_CONTRACTS="/home/bagidea/cdt3/usr/opt/cdt/3.1.0/include/eosiolib/contracts"
CDT_INC_CORE="/home/bagidea/cdt3/usr/opt/cdt/3.1.0/include/eosiolib/core"

SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="${SRC_DIR}/build"

echo "=== Compiling with CDT 3.1.0 ==="
echo "CDT: ${CDT_BIN}"
echo "Source: ${SRC_DIR}/pockethatch.cpp"
echo "Output: ${BUILD_DIR}/pockethatch.wasm"

"${CDT_BIN}" \
  -I "${CDT_INC_CONTRACTS}" \
  -I "${CDT_INC_CORE}" \
  -I "${SRC_DIR}" \
  -o "${BUILD_DIR}/pockethatch.wasm" \
  "${SRC_DIR}/pockethatch.cpp" \
  --abigen \
  2>&1 | tail -30

echo ""
echo "=== Done ==="
ls -la "${BUILD_DIR}/pockethatch.wasm" "${BUILD_DIR}/pockethatch.abi"
