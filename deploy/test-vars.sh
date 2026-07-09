#!/bin/bash
X=hello
echo "X=[$X]"
Y=world
echo "Y=[$Y]"

source "./lib.sh"
echo "CLEOS_BIN=[$CLEOS_BIN]"
echo "RPC=[$RPC]"
cleos wallet list 2>&1
