#!/bin/bash
source "$(dirname "$0")/lib.sh"
echo "=== Config table ==="
c get table "$CONTRACT" "$CONTRACT" config 2>&1
