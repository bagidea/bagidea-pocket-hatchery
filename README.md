# 🥚 Pocket Hatchery

> Idle/tap creature-farming game on **WAX**. Creatures are **mutable NFTs that evolve in real time on-chain** — the chain's own clock is the source of truth, never the client. Two-sided revenue (token + NFT market), hardened against the ponzi failure mode that killed most play-to-earn games.

**Status:** 📐 Design phase — on paper, not deployed. Target net: **wax-testnet** first, then mainnet.

This folder is the team's single source of truth for the design. Read in this order:

| Doc | What it answers |
|---|---|
| **[RECONCILIATION.md](RECONCILIATION.md)** | **Read this first.** Maps the whole team's parallel docs together + records the one architectural decision (economy model). |
| **[VISION.md](VISION.md)** | *Why* — the game, the player promise, the platform funnel (web → Office plugins), how we make money on both sides. |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | *How the pieces fit* — accounts, the lazy on-chain growth model, client parity (WAX Cloud Wallet + waxwing), the no-ponzi economy, system diagram. |
| **[CONTRACT.md](CONTRACT.md)** | *The smart contract* — every table, every action, ABI, and the explicit **time-guard / RAM-payer / token-sink** markers the boss asked for. Implementer-ready. |

### Team contributions (parallel work, integrated via RECONCILIATION.md)
| Doc | Author | Canonical for |
|---|---|---|
| **[TOKENOMICS.md](TOKENOMICS.md)** | Sun | **Economy** (dual-currency escrow) — adopted as the canonical economy spine. |
| **[WALLET-INTEGRATION.md](WALLET-INTEGRATION.md)** | Sahara | Wallet/SDK — **WCW (MyCloudWallet) supports wax-testnet**; both chains, one WharfKit codebase. |
| **[ART.md](ART.md)** + `art/` | Monanisa | **Visual direction** — "Cozy-premium creature collector". |

> **Open decision for the boss (one):** confirm adopting Sun's escrow economy over Yamamoto's single-token emission (RECONCILIATION §6). Recommendation: **escrow** — it's the only model that *structurally* can't ponzi.

---

### Key decisions in one screen
- **Contract account** `pockethatch` · 🥚 **EGG** (internal balance, non-tradeable free-to-play reward) + 🐣 **$HATCH** (`eosio.token` @ `hatchtokens1`, **fixed 100M**, escrow-funded) · **NFT** AtomicAssets collection `pockethatch`.
- **Growth is lazy & on-chain:** a creature's progress = `f(current_time_point() − born_at)` + feeding, computed on every read/action. **No client is ever trusted for time.**
- **Both wallets call the same ABI identically** — WAX Cloud Wallet (web, primary) and waxwing (Office, secondary) push the same actions; the contract never special-cases a signer. *(WCW / "MyCloudWallet" works on **both** chains — wax-testnet and mainnet — proven from the connector source by Sahara. Dev leans on Anchor + waxwing for the repeatable testnet proving run; WCW parity is confirmed in the same run with one manual passkey login.)*
- **Anti-ponzi spine (Sun's model, adopted):** EGG (non-tradeable) is the only freely-minted reward; **HATCH is fixed 100M and paid only from a fee-funded escrow pool** — payout ≤ real revenue, structurally. Sinks + per-player daily caps kill the farm-spam/flood vector. No reward is ever paid from new players' money.
- **Players pay their own RAM** on hatch/breed; the house pays only for contract code + global tables.
- **Funnel:** free web play → advanced species, premium lab, automation, marketplace power-tools and seasons live as **Office plugins**. Long-term: NFT marketplace + more games = all plugins.

### Dev environment (ready now)
Boss's testnet account `waxwingsuper` is funded (**1926.70 WAX**, 50 CPU staked, ~13KB free RAM). Verify any time:
```
waxwing setnetwork wax-testnet  →  overview
```
