# Task A — Ghost-NFT owner reconcile (phgamecreatr)

Verified 2026-07-08. RPC greymass+waxsweden agree: 24 creature rows (by_scope count 48 = incl. secondary index).
Real owner pulled per asset from `test.wax.api.atomicassets.io`.

## 1) Desynced rows (creatures.owner ≠ real AtomicAssets owner)

| asset_id       | creatures.owner | AtomicAssets owner (real) | stage | burned |
|----------------|-----------------|---------------------------|-------|--------|
| 1099603751699  | officewax123    | waxwingsuper              | 0     | no     |
| 1099603751700  | waxwingsuper    | officewax123              | 0     | no     |
| 1099603751707  | waxwingsuper    | officewax123              | 0     | no     |

3 / 24 desynced. All still exist (not burned). Table is stale on the owner field only.

## 2) Root cause (why a notify handler alone won't fix it)

AtomicAssets `transfer` calls `require_recipient(from)` and `require_recipient(to)` — it notifies
ONLY the two accounts in the transfer, NOT arbitrary contracts. In the current "hold-in-wallet"
model, creatures live in USER wallets, so a waxwingsuper→officewax123 P2P transfer never reaches
phgamecreatr → `creatures.owner` drifts. An `on_notify("atomicassets::transfer")` on phgamecreatr
would fire only if the CONTRACT is a transfer party (i.e. a stake/deposit model).

## 3) Proposed fixes — pick one (do NOT setcode yet; review first)

### Option A (fast, minimal) — admin `syncowner` reconcile action
```cpp
// hpp: add action decl
[[eosio::action]] void syncowner(std::vector<uint64_t> asset_ids, name new_owner);

// cpp:
void pockethatch::syncowner(std::vector<uint64_t> asset_ids, name new_owner) {
    require_auth(get_self());                 // admin-only (or a cfg.admin perm)
    creatures_t cr(get_self(), get_self().value);
    for (auto id : asset_ids) {
        auto it = cr.find(id);
        check(it != cr.end(), "no creature row for asset");
        if (it->owner != new_owner)
            cr.modify(it, same_payer, [&](auto& r){ r.owner = new_owner; });
    }
}
```
Reconcile the 3 rows off-chain-verified:
- `syncowner [1099603751699] waxwingsuper`
- `syncowner [1099603751700,1099603751707] officewax123`
Pros: tiny diff, no model change, fixes today. Cons: manual, drift can recur.

### Option B (correct, structural) — stake/deposit model + on_notify
Require a creature be transferred INTO phgamecreatr to be "active" (earning). Then the contract IS a
transfer party and CAN listen:
```cpp
[[eosio::on_notify("atomicassets::transfer")]]
void on_aa_transfer(name from, name to, std::vector<uint64_t> asset_ids, std::string memo) {
    if (to != get_self()) return;             // only deposits into the game
    creatures_t cr(get_self(), get_self().value);
    for (auto id : asset_ids) {
        auto it = cr.find(id);
        if (it != cr.end()) cr.modify(it, same_payer, [&](auto& r){ r.owner = from; }); // from = depositor
    }
}
```
Plus a `withdraw` action that transfers the NFT back and clears/locks earning.
Pros: owner can never drift (contract is custodian). Cons: bigger UX + panel change, users must deposit.

## Recommendation
Ship **Option A `syncowner`** now to clear the 3 ghosts, and put Option B (deposit model) on the
roadmap as the permanent cure. Neither is applied yet — awaiting @Shino review before any setcode.
