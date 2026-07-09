# RECONCILIATION — integrating the team's parallel docs

> The boss staffed **the whole team in parallel** on Pocket Hatchery, so several docs landed in this folder at once. This file is the **integration map + the one architectural decision** the team surfaced. Read this *before* any individual doc, then you'll know how they fit.

**Assembled by Yamamoto (lead architect) · 2026-06-26**

---

## 1. The doc map — who owns what

| Doc | Author | Subject | Status |
|---|---|---|---|
| **VISION.md** | Yamamoto | Why — game, loop, funnel, two-sided revenue | ✅ |
| **ARCHITECTURE.md** | Yamamoto | How — accounts, lazy on-chain growth, wallet parity, economy *(reconciled to Sun's model, §3)* | ✅ revised |
| **CONTRACT.md** | Yamamoto | What — tables/actions/ABI for `pockethatch` *(reconciled, §3)* | ✅ revised |
| **TOKENOMICS.md** | **Sun** | Economy spine — dual-currency escrow, sinks, caps, distribution | ✅ **adopted as canonical economy** |
| **WALLET-INTEGRATION.md** | **Sahara** | WCW/Anchor/WharfKit research — **WCW (MyCloudWallet) supports wax-testnet**; both chains, one codebase | ✅ (key findings adopted) |
| **ART.md** + `art/` | **Monanisa** | Visual direction — "Cozy-premium creature collector", soft-3D isometric | ✅ adopted as visual SYNC |
| **README.md** | Yamamoto | Entry index | ✅ |

The four content threads are **complementary**, not competing — *except one fork* (§2), now resolved (§3).

---

## 2. THE fork — emission vs escrow (the only real conflict)

Two different economic architectures were proposed for the reward currency:

| | Yamamoto v1 (CONTRACT §6, original) | **Sun (TOKENOMICS)** |
|---|---|---|
| Tradeable token | `HATCH`, single currency | `$HATCH`, fixed **100M** supply forever |
| How rewards are paid | **Minted** on `claim` via `eosio.token::issue` under a *decaying emission schedule* | **Never minted** as a reward. Paid out of an **escrow reward pool** funded by real fee revenue + a fixed, decaying, *sunset* bootstrap allocation. **Payout ≤ pool balance** (hard on-chain check). |
| Free-to-play reward currency | (same HATCH) | **`EGG`** — soft currency, freely produced by idle/tap, but **not tradeable (no DEX pair)** → its inflation is gameplay-only, never financial |
| Ponzi resistance | Sinks offset a decaying mint; leans deflationary under heavy play | **Structurally impossible** to pay out more than real revenue; the tradeable coin is never printed from nothing |

**Why this matters (boss's #1 stated bar = no-ponzi):** a *decaying mint is still a mint from nothing.* If sinks ever lag, my v1 is a slow faucet — exactly the Axie/StepN death-spiral failure mode. Sun's escrow model **cuts the faucet at the root**: the tradeable coin cannot exist unless real economic activity (fees) or a fixed, sunset bootstrap budget puts it there. That is strictly stronger, and it is the model the boss asked for.

---

## 3. The decision (RECOMMENDED — pending boss confirm)

> **✅ Adopt Sun's dual-currency escrow model as the canonical economy.** Reconcile Yamamoto's CONTRACT/ARCHITECTURE to it. Everything else in Yamamoto's design — **lazy on-chain growth (`current_time_point()`), creature/player tables, RAM model, wallet parity, ABI, time-guards** — carries over unchanged, because Sun's TOKENOMICS *assumes* that exact growth model (idle harvest verified by `current_time_point()`). Only the **token model + reward/sink mechanics** change.

### What that changes in CONTRACT.md / ARCHITECTURE.md
1. **Two currencies, not one.** Add **`EGG`** as an **internal contract balance** (not an `eosio.token` — it's never traded, so it doesn't need to be one; a per-player `uint64` in the `players` table suffices). `HATCH` stays the `eosio.token`, now **fixed 100M supply**.
2. **`claim` splits:**
   - `harvest()` → mints **EGG** (internal balance), bounded by **daily cap + offline-accrual cap** (per Sun §3.2: 240 EGG/day web, 312 with Office; 8–12h offline).
   - `claimreward()` (season / milestone) → pays **HATCH out of the escrow reward pool**, asserting `payout ≤ pool_balance`. **No `issue` of HATCH for gameplay.**
3. **Sinks, split by currency** (per Sun §3.3–3.4):
   - EGG sinks: `feed`, `hatch`, `evolve`, slot-unlock, cosmetic-reroll.
   - HATCH sinks: `breed`, premium egg, season pass, listing boost, naming — each **part-burn / part-to-pool** (e.g. breed 5 HATCH = 40% burn + 60% → pool).
4. **New table §1.5 `rewardpool`** — escrow: tracks HATCH held for payouts, funded by fee-routing + bootstrap decaying release + the "to-pool" half of HATCH sinks. `withdraw`/sweep moves only treasury/fee shares, never the pool.
5. **Genesis distribution** (per Sun §1): 100M HATCH minted **once** at contract init into the allocation buckets (reward pool 30M, LP 20M, treasury 15M, team 15M vested, ecosystem 10M, community 10M). No further `issue` ever.

### What it does NOT change
- Lazy growth model, `sync()`, `currentGrowth()` (ARCHITECTURE §3). EGG production rate = `stage_yield[stage]` over time — same math, just denominated in EGG.
- Creature/player table shape (add one field: `egg_balance` on player).
- RAM model (players pay their own).
- ABI / wallet parity.
- All time-guards.

---

## 4. Sahara's finding folded into the wallet story (ARCHITECTURE §4, CONTRACT §10)

> **Correction note (Yamamoto → team):** an earlier draft of this section and of ARCHITECTURE §4 / CONTRACT §10 / README / UI-KIT **inverted** Sahara's result — they read as "WCW is mainnet-only, does NOT work on testnet." That was wrong and was exactly the trap Sahara warned against ("อย่าฟันธงว่าทำไม่ได้"). The statements below are the corrected ones, taken straight from Sahara's source-code proof in WALLET-INTEGRATION.md §0.

Sahara proved from the **plugin source code** (`@wharfkit/wallet-plugin-cloudwallet` 1.6.5): **WCW — now the passkey "MyCloudWallet" — DOES support wax-testnet.** The testnet chainId (`f16b1833…8a12`) ships in the connector's default `supportedChains` (with a `// … new wallet` comment), and `login()` binds whatever chain you hand the SessionKit — so testnet passes validation and returns a testnet session. The lingering "mainnet only" docs pages describe the **old** wallet; the new MyCloudWallet added testnet. (Both proven two ways: GitHub raw `src/index.ts` + the published jsdelivr bundle.)

What's left is **one manual end-to-end UX round**, not a blocker — the passkey login + popup needs a human click, so it can't be proven headless. The connector support is settled; the click just has to be seen once (WALLET-INTEGRATION.md §6, step ก).

| Environment | Signers that work |
|---|---|
| **wax-testnet (dev now)** | **WCW (MyCloudWallet)** — supported by the connector + **Anchor** (trusted fallback / most reliable dev signer: faucet private key signs directly, no popup) + **waxwing** (our own, `waxwingsuper` funded) |
| **wax-mainnet (prod)** | **WCW (MyCloudWallet)** primary + Anchor + waxwing |

- **One codebase, both wallets, both chains.** The web client (WharfKit SessionKit, per Sahara §3) ships **WCW + Anchor together** and **does NOT strip WCW from testnet** — the player picks the wallet at login. Moving to mainnet is just an env switch (`VITE_CHAIN=mainnet`); no signing-code change.
- The **ABI is identical** across every wallet — "same actions" holds fully, on **both** chains. That is the boss's "เล่นด้วย WCW" (เส้น ก) requirement, and it is satisfiable on testnet.
- **Anchor + faucet key is the dev signer we lean on** for headless/repeatable proving (it signs with an imported key, no passkey/popup) — not because WCW can't, but because it's the most reliable for an automated testnet proving run. waxwing is the convenient in-Office signer (already funded). WCW parity is confirmed in the same testnet run (WALLET-INTEGRATION §6 ก), not deferred to mainnet.

---

## 5. Monanisa's art direction (visual SYNC)

ART.md sets the look: **"Cozy-premium creature collector"** — soft-3D, round, huggable creatures on a warm isometric farm. Not pixel-art (old GameFi), not cold realistic 3D. This is the bar for "กราฟิกสวยทันสมัย" (boss's explicit requirement). CONTRACT/ARCHITECTURE reference it as the visual source-of-truth; the `mutable_data` `stage` field drives which creature render the NFT shows at each evolution.

---

## 6. Open item for the boss

- **Confirm the §3 decision** (adopt Sun's escrow model). If you prefer the single-token decaying-emission model instead, say so and I'll revert the CONTRACT/ARCHITECTURE economy sections — but my recommendation is escrow, because it's the only one that *structurally* can't ponzi, which is your stated #1 priority.
