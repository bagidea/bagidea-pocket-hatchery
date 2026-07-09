#!/bin/bash
set -e
SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="$SRC_DIR/build"
CDT_INCLUDE="/tmp/cdt-extract/usr/opt/cdt/4.1.1/include"
BIN="/tmp/cdt-extract/usr/bin/cdt-cpp"

echo "=== Compiling pockethatch.cpp ==="
echo "Source: $SRC_DIR/pockethatch.cpp"
echo "Output: $BUILD_DIR/pockethatch.wasm"

"$BIN" \
  -I "$CDT_INCLUDE" \
  -I "$SRC_DIR" \
  -o "$BUILD_DIR/pockethatch.wasm" \
  "$SRC_DIR/pockethatch.cpp" \
  --abigen

echo "=== Done ==="
ls -la "$BUILD_DIR/pockethatch.wasm" "$BUILD_DIR/pockethatch.abi"
