# VISION — Pocket Hatchery

> *Hatch a creature. Put it in your pocket. Come back tomorrow — it grew. Not because an app said so, but because the blockchain's own clock ticked and everyone can verify it.*

This is the **north star** for the whole team. If a feature doesn't serve one of the goals below, it doesn't ship. Designers, engineers, and marketing all argue from here.

---

## 1. The one-line promise

**A creature-farming idle game where your creatures genuinely grow over real time, on-chain, and you can prove it to anyone.** Tap to hatch, come back to feed, watch them evolve through stages, breed rare ones, and trade them — all backed by NFTs you actually own in your own wallet.

### Why this, why now
- The last wave of "play-to-earn" games collapsed because their economies were **ponzis** — early players were paid from late players' deposits, and the music stopped. Players learned to distrust the whole model.
- Pocket Hatchery rebuilds trust on the one thing a blockchain does undeniably: **verifiable time and verifiable state**. The creature's growth isn't a number a server hands you — it's a deterministic function of the chain's clock. Anyone can recompute it. No server can fudge it, and no client can lie about it.
- That "you can verify it" feeling is the **novelty hook** and the marketing spine. It's also the honesty the boss demands: *truth, not theatre*.

---

## 2. The player experience (the loop)

```
        ┌──────────────────────────  the daily loop  ──────────────────────────┐
        │                                                                        │
   HATCH an egg  ──►  FEED & wait (real time grows it)  ──►  EVOLVE stage  ──►  │
   (pay WAX-RAM        ▲                              ▲            ▲            │
    + burn HATCH)      │                              │            │            │
        │              └──── come back tomorrow ──────┘            │            │
        ▼                                                             │            │
   HARVEST 🥚EGG ◄──────────────────────────────────  breed two creatures ───────┘
   (daily-capped,        (farming yield —              → rarer offspring (NFT)
    non-tradeable)        non-tradeable, no DEX)        + big HATCH sink
        │
        ├─► spend EGG on feed / hatch / evolve / cosmetic (sinks)
        ▼
   CLAIM 🐣HATCH  (season reward — paid from a fee-funded escrow pool, never minted)
        │
        ▼
   TRADE: HATCH on Alcor DEX · creatures on the NFT market
```

**Design values for the loop (boss's standard: easy, modern, draws real players):**
1. **30-second onboarding.** Land on the web app, connect WAX Cloud Wallet (the wallet WAX players already have — zero new install to start), hatch your first creature free. First evolve within minutes.
2. **Tap, don't grind.** Idle-first. The satisfying beat is the *evolve tap* after time has passed — not 100 taps/day. Respects the player's day.
3. **Genuinely own it.** Every creature is a real AtomicAssets NFT in *your* wallet. Sell it on any WAX marketplace, send it to a friend, keep it forever — we can't take it back.
4. **Transparent economy.** EGG caps, sinks, and the reward-pool rules are all on-chain and documented (see `CONTRACT.md` §1.5/§6 + `TOKENOMICS.md`). No hidden taps.

---

## 3. The "evolves in real time on-chain" hook (our moat)

This is the part that's different and the part we must get exactly right.

- A creature **does not** store "level = 5" and get bumped on each action. That model trusts the client and invites cheating.
- Instead the contract stores a **growth baseline** (`born_at`, checkpointed growth, feeding boosts) and the creature's *current* progress is **computed** from `current_time_point()` every time it matters. See ARCHITECTURE.md §3 for the exact formula.
- The visible **form** (egg → hatchling → juvenile → adult → elder) changes when the player taps **Evolve** — that action recomputes growth, checks the milestone, advances the stage, mirrors the new look into the NFT's mutable data, and burns a little HATCH. The evolve tap is both the gameplay beat and the on-chain sync point.
- **What the player feels:** "I hatched it yesterday, forgot about it, and today it's a juvenile — and I can show anyone the transaction history proving it grew on its own." That feeling is the product.

> Marketing line: *"Creatures that grow while you sleep. Provable. Unfakeable. Yours."*

---

## 4. Two-sided revenue (how we eat)

The boss's hard requirement: **revenue on both sides — the house and the players.** Both must win or neither does.

### House (us) earns from:
| Stream | Mechanism |
|---|---|
| **NFT marketplace fees** | Every creature/egg trade on the market pays a % fee to the house. (Primary via AtomicMarket; long-term our own marketplace plugin — see §6.) |
| **Genesis drop / primary sale** | A limited first sale of genesis eggs & rare species for WAX → funds development + seeds HATCH liquidity on Alcor DEX. |
| **HATCH token position** | The house holds a fixed, transparent, vested allocation of HATCH. As the game economy grows and HATCH gets used (and burned), that position appreciates. **Not** a money-printer — supply is sink-bounded. |
| **Premium actions** (via Office plugin — see §6) | Advanced lab, automation, accelerated growth, cosmetics — micro-sinks routed to the house. |

### Players earn from:
| Stream | Mechanism |
|---|---|
| **Farming yield (🥚 EGG)** | Active creatures passively accrue **EGG** (non-tradeable — no DEX pair), **daily-capped** per player. Spent on feed/hatch/evolve/slot/cosmetic. |
| **Season reward (🐣 $HATCH)** | A share of the **escrow reward pool**, paid for season/milestone rank — funded by **real fee revenue**, never minted. |
| **Breeding & selling** | Breed rare/genesis-trait creatures and sell them on the open market for WAX or HATCH. |
| **Trading HATCH** | Earned HATCH is freely tradeable on Alcor — liquid from day one via the genesis-sale liquidity seed. |

**Critical fairness property (the anti-ponzi line):** *no player's reward is funded by another player's deposit.*

> ⚠ **SUPERSEDED detail below — the canonical economy is Sun's `TOKENOMICS.md` (dual-currency escrow), adopted per RECONCILIATION §3.** An earlier draft of this paragraph said farming yield was *"minted from a decaying emission schedule"* — that was the single-token v1 model, now replaced. The principle (no reward from new players' money) survives; the *mechanism* is strictly stronger now:
> - Farming yield is **🥚 EGG, non-tradeable** — no DEX pair means its inflation is gameplay-only, never financial. It's an internal balance, not a coin minted onto a market.
> - The tradeable **🐣 $HATCH** is **fixed 100M forever** and is **never minted as a reward** — season/milestone HATCH is paid only from a **fee-funded escrow pool** (`payout ≤ pool balance`, hard on-chain check). The Axie/StepN faucet-at-root failure mode is structurally gone.

New players grow the economy (more NFTs, more trades, more fees that refill the pool); they do not pay old players. This is spelled out as math in `TOKENOMICS.md` §3–4 and in `CONTRACT.md` §1.5 (`rewardpool`) / §2.5 (`harvest` + `claimreward`).

---

## 5. The platform funnel — web → BagIdea Office

Pocket Hatchery is not just a game; it's the **first concrete funnel** for the BagIdea Office platform.

```
   PUBLIC WEB APP (pockethatch.io)                BAGIDEA OFFICE + PLUGINS (desktop)
   ───────────────────────────────                ──────────────────────────────────
   • Free to play, WAX Cloud Wallet                 • Install Office → unlock advanced:
   • Full core loop: hatch/feed/evolve/                - premium & genesis species
     claim/breed/trade                                 - breeding lab (batch, pedigree)
   • This is the hook — get millions in the door      - auto-claim / auto-feed automation
   • Deliberately simple & browser-only               - accelerated growth + cosmetics
                                                       - seasons, leaderboards, meta-crafting
                                                       - the NFT marketplace (power tools)
                                            │
                                            └── long term: more games + the marketplace
                                                all live as Office plugins
```

**The bet:** the web game is genuinely fun and free, so the top of the funnel is huge and frictionless. The deepest, most rewarding layer — rare creatures, automation, the marketplace — lives in the Office plugin, which is the thing our company actually distributes and grows. Players who fall in love with the creatures *want* the desktop experience. That's the bridge from "a game people play" to "a platform people install."

> waxwing (our wallet plugin) is the secondary path: power users who already run Office can sign every Pocket Hatchery action from waxwing instead of WCW. **Same ABI, either wallet** — see ARCHITECTURE.md §4.

---

## 6. Long-term platform vision

Pocket Hatchery is **proof #1** that the BagIdea Office plugin model works for a real game economy. From here:

1. **A first-class NFT Marketplace plugin** — trading for Pocket Hatchery creatures first, then any WEX/Antelope NFT. Replaces dependency on third-party markets; the fee stays with us.
2. **More games as plugins** — each new game (a battle game using these creatures, a crafting game, etc.) ships as a plugin that reads the same NFTs. Creatures become **cross-game assets**.
3. **The Office becomes the launcher** — one desktop app, many games + tools, one wallet (waxwing), all composable. That's the platform payoff.

---

## 7. Non-goals (what we are *not* doing)

- **Not a "click 1000 times to earn" faucet.** Idle means time does the work; tapping is for meaningful beats (hatch, feed, evolve, breed), not spam.
- **Not a ponzi / not "guaranteed ROI."** No marketing ever promises returns. HATCH is a game token with sinks, not an investment contract.
- **Not custody of player assets.** We never hold creatures or tokens on the player's behalf beyond the instant an action needs them. Your wallet, your NFTs.
- **Not trusting the client for anything that affects balance** — time, growth, RNG, ownership. All on-chain. (See CONTRACT.md §8 security.)
- **Not shipping without a real testnet proving run.** Boss's rule: blockchain work is verified with real transactions on wax-testnet, not mocks.

---

## 8. Definition of done (for the design phase — this folder)

- [x] VISION.md — this file.
- [ ] ARCHITECTURE.md — system model, lazy-growth math, wallet parity, economy.
- [ ] CONTRACT.md — tables, actions, ABI, and the time-guard / RAM / sink markers.
- [ ] Team review (designers confirm the loop feels right; engineers confirm the contract is buildable as written).
- [ ] **Then, and only then:** build the contract → deploy to wax-testnet → prove the loop with real transactions (boss's bar).

> **UI note:** visual/UX direction for the web app and the Office panel is intentionally **deferred to Monanisa/Flamingo** and is not a blocker for this design phase. SYNC point marked in ARCHITECTURE.md §9.
