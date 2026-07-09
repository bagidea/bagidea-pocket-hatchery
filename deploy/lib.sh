#!/bin/bash
# Shared deploy helpers for Pocket Hatchery → WAX testnet.
# Sourced by every step script. Keeps cleos quoting in ONE place.
set -uo pipefail

export LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib:${LD_LIBRARY_PATH:-}"
CLEOS_BIN="/home/bagidea/leap/usr/bin/cleos"

# Wallet socket — every cleos call uses it
WALLET_URL="unix:///home/bagidea/.ph/keosd/keosd.sock"

# cleos wrapper:  cleos wallet ...   or  cleos -u <rpc> get ...
cleos() { "$CLEOS_BIN" --wallet-url "$WALLET_URL" "$@"; }

# Two healthy peers on the SAME chain (chain_id f16b1833…). waxsweden is the
# canonical testnet API; greymass is the reliable fallback the verify harness uses.
RPC="${PH_RPC:-https://waxtestnet.greymass.com}"

# Run cleos against the chosen RPC. Pass args normally:  c get account foo
c() { cleos -u "$RPC" "$@"; }

# Contract account — must be exactly 12 chars (a free WAX name).
# "pockethatch" is 11 chars = a premium name that needs a name-auction bid
# (the original blocker: "no active bid for name"). So we deploy to pockethatch1
# and use pockethatch1 as the collection_name too (one name everywhere).
CONTRACT="pockethatch1"
# ⚠️ IRON WALL (boss rule, reinforced 2026-06-30 review): NEVER hardcode or
# persist a WIF on disk. The deploy key is injected IN-PROCESS only via the
# PH_CONTRACT_PRIV env var, set in the interactive shell that runs deploy and
# never exported to a file, shell history, log, or chat. Fail loud if missing
# rather than silently falling back. (Previously this line hard-coded the WIF
# — that was the violation.) See [[secret-exposure-2026-06-26]] for the full
# rotation/scrub scope across .secrets/ + hatch-keys.json.
CONTRACT_PRIV="${PH_CONTRACT_PRIV:?FATAL: PH_CONTRACT_PRIV not set in env — refusing to run (iron wall: no WIF on disk). Export it in-process in the deploy shell.}"
CONTRACT_PUB="${PH_CONTRACT_PUB:-EOS6u4i4jMNiaEY6h1BkqjGeWJRRmmdKqWKQkBaKJrmSqSNX3pUBX}"

# Token contract account — 12 chars, free name.
TOKEN_CONTRACT="hatchtokens1"

# AtomicAssets collection + schema names (name type, NOT accounts → no bid needed).
COLLECTION="pockethatch1"
SCHEMA="creatures"

# The player account that will run the growth loop (creator account doubles as player).
PLAYER="${PH_PLAYER:-waxwingsuper}"

# Push a transaction and print just the txid (first occurrence).
txid() {
  grep -oE '"transaction_id"[[:space:]]*:[[:space:]]*"[0-9a-f]+"' | head -1 \
    | sed -E 's/.*:"([0-9a-f]+)".*/\1/'
}
