#!/bin/bash
set -euo pipefail

SRC_DIR="/mnt/e/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/contract/pockethatch"
BUILD_DIR="$SRC_DIR/build"

echo "=== Backing up old build ==="
cp "$BUILD_DIR/pockethatch.wasm" "$BUILD_DIR/pockethatch.wasm.bak" 2>/dev/null || true
cp "$BUILD_DIR/pockethatch.abi" "$BUILD_DIR/pockethatch.abi.bak" 2>/dev/null || true

echo "=== Compiling with CDT 3.1.0 ==="
cd "$SRC_DIR"
echo "Source dir: $(pwd)"
echo "Source files:"
ls -la pockethatch.cpp pockethatch.hpp

echo ""
echo "--- cdt-cpp output ---"
cdt-cpp -I . -o "$BUILD_DIR/pockethatch.wasm" pockethatch.cpp --abigen
echo "Exit code: $?"

echo ""
echo "=== Build output ==="
if [ -f "$BUILD_DIR/pockethatch.wasm" ]; then
    echo "WASM: $(wc -c < "$BUILD_DIR/pockethatch.wasm") bytes"
else
    echo "WASM: MISSING"
fi
if [ -f "$BUILD_DIR/pockethatch.abi" ]; then
    echo "ABI:  $(wc -c < "$BUILD_DIR/pockethatch.abi") bytes"
else
    echo "ABI: MISSING"
fi
