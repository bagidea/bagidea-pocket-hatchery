#!/bin/bash
set -e

# CDT paths (CDT 4.1.1 installed in WSL at /home/bagidea/cdt)
CDT_BIN="/home/bagidea/cdt/bin/cdt-cpp"
CDT_INC_CONTRACTS="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts"
CDT_INC_CORE="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core"

# Source and build (accessed via /mnt from WSL)
SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="${SRC_DIR}/build"

echo "=== Compiling pockethatch.cpp ==="
echo "CDT: ${CDT_BIN}"
echo "Source: ${SRC_DIR}/pockethatch.cpp"
echo "Output: ${BUILD_DIR}/pockethatch.wasm"

"${CDT_BIN}" \
  -I "${CDT_INC_CONTRACTS}" \
  -I "${CDT_INC_CORE}" \
  -I "${SRC_DIR}" \
  -o "${BUILD_DIR}/pockethatch.wasm" \
  "${SRC_DIR}/pockethatch.cpp" \
  --abigen

echo ""
echo "=== Done ==="
ls -la "${BUILD_DIR}/pockethatch.wasm" "${BUILD_DIR}/pockethatch.abi"
