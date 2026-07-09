# Task A — Close 3 ghosts by pushaction (no setcode)? → ⛔ NO SAFE ACTION EXISTS

**Kevin, 2026-07-09.** Per your pivot: dropped all rebuild/reconstruct; scanned the live `0a21adc3` ABI (23
actions) for an admin/erase/delete/reset/cleanup that removes an orphan `creatures` row via pushaction only.
**Verdict: none is safe. I fired nothing. No chain touched. Ghosts still 3.**

## Live 0a21adc3 — all 23 actions
`accelerate, breed, burncreature, claimreward, clearconfig, clearpool, equipcosmetic, evolve, feed, firsthatch,
fundpool, harvest, hatch, initplayer, newseason, rmspecies, setconfig, setname, setpaused, setspecies,
unlockslot, withdraw, clearspecies`

- `clearconfig` → wipes the config singleton · `clearpool` → reward pool · `clearspecies`/`rmspecies` → species table.
  **None touch `creatures`.**
- The ONLY action that erases a `creatures` row is **`burncreature(owner, asset_id)`** (`crs.erase`, cpp:912).

## Why `burncreature` is NOT a safe cleanup (disqualified 3 ways)
1. **Wrong auth.** `require_auth(owner)` + `check(c_it->owner == owner)` → needs the **stale table-owner's key**
   (`officewax123` for …699, `waxwingsuper` for …700/…707), NOT `phgamecreatr@active` you provisioned.
   phgamecreatr literally cannot call it on these rows.
2. **It burns the REAL NFT.** cpp:857–864 sends `atomicassets::burnasset` to destroy the live asset. These 3 assets
   are live / not-burned / owned by real accounts. The only safeguard is an `nft_exists(collection, owner, …)`
   check — and I'm reading the **configv3 source, not the deployed configv2 binary**, so I can't verify that guard
   behaves identically live. Relying on it to avoid destroying a real asset is an unacceptable, irreversible gamble.
3. **It pays rewards to the wrong account.** cpp:866–910 pays HATCH from the reward pool + refunds EGG to the stale
   owner — economically wrong and it mutates the pool (can interact with the claimreward deadlock).

`burncreature` is a player-facing "burn-my-creature-for-rewards" game action, not an admin orphan-row cleanup.

## Conclusion
There is **no safe pushaction path** on configv2 to close the 3 ghosts. The correct fix is the **configv3
migration** — that source has the `on_assets_transfer` owner-sync handler and we hold the source — but that's a
**separate post-release task** (setcode + configv2→configv3 singleton migration), explicitly not this round.
Guards honored: no setcode, no configv2/keystore touched, nothing broadcast.
