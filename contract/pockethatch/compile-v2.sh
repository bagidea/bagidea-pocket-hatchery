#!/bin/bash
set -e
# Phase B (Feed economy v2) compile — outputs to SEPARATE v2 files so the
# Phase A staged artifact (build/pockethatch.wasm = 0a21adc3) is never touched.
CDT_BIN="/home/bagidea/cdt/bin/cdt-cpp"
CDT_INC_CONTRACTS="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/contracts"
CDT_INC_CORE="/home/bagidea/cdt/opt/cdt/4.1.1/include/eosiolib/core"
SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="${SRC_DIR}/build"

echo "=== Compiling Phase B (Feed v2) ==="
"${CDT_BIN}" \
  --contract pockethatch \
  -I "${CDT_INC_CONTRACTS}" \
  -I "${CDT_INC_CORE}" \
  -I "${SRC_DIR}" \
  -o "${BUILD_DIR}/pockethatch.v2.wasm" \
  "${SRC_DIR}/pockethatch.cpp" \
  --abigen

echo ""
echo "=== Build outputs ==="
ls -la "${BUILD_DIR}/pockethatch.v2.wasm" "${BUILD_DIR}/pockethatch.v2.abi"
sha256sum "${BUILD_DIR}/pockethatch.v2.wasm"
