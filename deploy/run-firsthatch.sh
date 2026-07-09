#!/bin/bash
source "$(dirname "$0")/lib.sh"
echo "=== firsthatch (free, no EGG cost) ==="
c push action "$CONTRACT" firsthatch "[\"$PLAYER\",0]" -p "$PLAYER@active" 2>&1
