#!/bin/bash
# Clean-slate keosd + wallet + key import. Run after node _dump-keys.cjs.
source "$(dirname "$0")/lib.sh"

KEOSD_DIR="$HOME/.ph/keosd"
WALLET_DIR="$KEOSD_DIR/wallets"

echo "=== kill any stale keosd ==="
pkill -x keosd 2>/dev/null && sleep 2 || true
rm -rf "$HOME/eosio-wallet" "$KEOSD_DIR"
mkdir -p "$WALLET_DIR"
chmod 700 "$WALLET_DIR"

# make sure the key dump is present (caller ran node _dump-keys.cjs)
if ! ls "$HOME/.ph"/*.key >/dev/null 2>&1; then
  echo "FATAL: no ~/.ph/*.key — run: node _dump-keys.cjs"; exit 1
fi

echo "=== start fresh keosd ==="
LD_LIBRARY_PATH="/home/bagidea/leap/usr/lib:${LD_LIBRARY_PATH:-}" \
  nohup /home/bagidea/leap/usr/bin/keosd \
    --data-dir "$KEOSD_DIR" --config-dir "$KEOSD_DIR" \
    --wallet-dir "$WALLET_DIR" \
    --unlock-timeout 999999999 \
    >"$HOME/.ph/keosd.log" 2>&1 &
echo "  started keosd pid $!"
sleep 3
# confirm it is up
"$CLEOS_BIN" wallet list 2>&1 | head -2

echo "=== create + unlock wallet ==="
WPW="$("$CLEOS_BIN" wallet create --to-console 2>&1 | grep -oE 'PW[0-9A-Za-z]+' | head -1 || true)"
if [ -z "$WPW" ]; then
  echo "  create failed; keosd.log tail:"; tail -5 "$HOME/.ph/keosd.log"; exit 1
fi
echo "$WPW" > "$HOME/.ph/wallet.pw"; chmod 600 "$HOME/.ph/wallet.pw"
echo "  wallet created (pw saved to ~/.ph/wallet.pw)"

echo "=== import keys ==="
import_one() {
  local label="$1" key="$2"
  if "$CLEOS_BIN" wallet import --private-key "$key" >/dev/null 2>&1; then
    echo "  imported $label"
  else
    echo "  $label import failed"
  fi
}
for kf in "$HOME/.ph"/*.key; do
  [ -f "$kf" ] || continue
  import_one "$(basename "$kf")" "$(tr -d '[:space:]' < "$kf")"
done
import_one "pockethatch(contract)" "$CONTRACT_PRIV"

echo "=== wallet public keys ==="
"$CLEOS_BIN" wallet keys 2>&1

echo "=== shred key dump ==="
rm -f "$HOME/.ph"/*.key
echo "  shredded"
