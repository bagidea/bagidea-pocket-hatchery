# 🥚 Pocket Hatchery — Game Guide

Welcome to Pocket Hatchery, a virtual pet game where you hatch, raise, and evolve NFT creatures on the WAX blockchain. This guide covers everything a new player needs to know. No blockchain experience required.

---

## 1. What is Pocket Hatchery?

Pocket Hatchery is a creature-collection idle game running on the **WAX blockchain**. Every creature you hatch is an **NFT** you truly own — stored in the AtomicAssets collection **`phgamecreatr`**. The game uses two tokens:

| Token | Symbol | Contract | Purpose |
|-------|--------|----------|---------|
| 🥚 EGG | EGG (0 decimals) | *(in-game soft currency)* | Hatch eggs, evolve creatures, daily actions |
| 💎 HATCH | HATCH (4 decimals) | `hatchtokens1` | Premium currency — breed, accelerate, burn rewards, seasonal claims |

**You do not need to buy anything to start.** The game is free to play. You get your first creature via the tutorial, and from there you earn EGG by caring for your creatures.

---

## 2. Getting Started

### 2.1 Connect Your Wallet

When you open Pocket Hatchery, you will see a landing page with two connection options:

```
┌──────────────────────────────────────────┐
│         🥚 Pocket Hatchery               │
│                                          │
│   [ Connect (WAX Cloud Wallet) ]         │
│   [ Connect via waxwing ]                │
└──────────────────────────────────────────┘
```

- **WAX Cloud Wallet (WCW)** — A web-based wallet. Good for desktop and mobile.
- **waxwing** — The office's built-in wallet. Use this if you already have a waxwing account.

### 2.2 First-Time Setup (initplayer)

If this is your first time playing, the game will ask you to run **initplayer** — a one-time on-chain action that creates your player profile. This costs a tiny amount of WAX for the CPU/bandwidth (typically less than 0.01 WAX on testnet). After that, you land on the dashboard.

### 2.3 Safety Note

Every action in Pocket Hatchery opens a **signing sheet** before anything goes on-chain. You review what you are signing (action name, contract, data) and can **cancel at any time**. Nothing is broadcast until you tap **Sign**.

---

## 3. How to Play

### 3.1 🥚 Hatch Egg

Hatching creates a new creature NFT. Every hatch costs **150 EGG** (flat, regardless of rarity). Rarity is determined by RNG at the moment of hatching.

```
  You                          Contract
  │                              │
  │  hatch(owner, egg_type=0)    │
  │─────────────────────────────▶│
  │                              │  roll_egg_type() → rarity 0-5
  │                              │  mint NFT (AtomicAssets)
  │                              │  set stage=0, start awaken timer
  │  ◄─ creature NFT (asset_id)  │
  │                              │
```

| Parameter | Value |
|-----------|-------|
| Cost | 150 EGG |
| Rarity | Random (see Section 5 for odds) |
| Result | New creature NFT at stage 0 (Egg) |

---

### 3.2 ⏳ Awaken Timer

After hatching, your creature is at **stage 0** (Egg) and cannot earn EGG yet. You must wait for the **awaken timer** to expire, which automatically promotes the creature to **stage 1** (Hatchling).

| Rarity | Awaken Time | WAX Wake Cost |
|--------|------------|---------------|
| Common | 1 hour | 3 WAX |
| Uncommon | 1.5 hours | 5 WAX |
| Rare | 2 hours | 10 WAX |
| Epic | 2.5 hours | 20 WAX |
| Legendary | 3 hours | 40 WAX |
| Mythic | 3 hours | 80 WAX |

**Impatient?** You can pay WAX to wake the creature instantly. This is optional — just wait and the timer resolves on its own. The next time you harvest, any creature whose awaken timer has elapsed will automatically advance to stage 1 and begin earning.

```
  Hatch (stage 0)
    │
    ├── Wait (1h – 3h) ──▶ Auto-awaken on next harvest (FREE)
    │
    └── Pay WAX (3 – 80) ──▶ Wake instantly
```

---

### 3.3 🍎 Feed

Feeding fills your creature's **satiety bar** so it can earn EGG and grow. A hungry creature earns nothing.

| Parameter | Value |
|-----------|-------|
| Cost | **FREE** (0 EGG) |
| Cooldown | 6 hours per creature |
| Daily limit | 3 feeds per creature |
| Growth boost | +100 growth per feed |
| Satiety duration | Varies by rarity (see table below) |

**Satiety by rarity** — rarer creatures stay full longer:

| Rarity | Fed Duration | Feeds Needed (approx.) |
|--------|-------------|----------------------|
| Common | 48 hours (2 days) | Every other day |
| Uncommon | 72 hours (3 days) | Twice a week |
| Rare | 120 hours (5 days) | Once or twice a week |
| Epic | 7 days | Once a week |
| Legendary | 10 days | ~3 times a month |
| Mythic | 14 days | Twice a month |

> **Key rule:** Rarer creatures are easier to care for. Common creatures need attention every 2 days; Mythic creatures only need feeding twice a month.

---

### 3.4 🌾 Harvest EGG

Harvest collects the EGG your creatures have earned since your last harvest.

| Parameter | Value |
|-----------|-------|
| Cooldown | 1 hour |
| Offline cap | 8 hours (earnings beyond 8h are lost) |
| Daily cap | 240 base, scales with rarity (see table) |
| Earnings formula | `stage_yield × hours_fed × earn_mult × avg_satiety` |

**Daily EGG cap by your best rarity:**

| Best Rarity | Daily Cap | Earn Multiplier |
|-------------|-----------|-----------------|
| Common | 240 | ×1.0 |
| Uncommon | 264 | ×1.1 |
| Rare | 336 | ×1.4 |
| Epic | 432 | ×1.8 |
| Legendary | 576 | ×2.4 |
| Mythic | 792 | ×3.3 |

> The cap scales with your **best owned rarity** that is currently fed. A Mythic creature nets up to 792 EGG per day, while a Common creature nets 240.

```
  Feed creature ──▶ Satiety 100% ──▶ Creature earns EGG passively
                                        │
                                        ▼
                                   Harvest (1h cd)
                                        │
                                        ▼
                                  EGG added to balance
```

---

### 3.5 ✨ Evolve

Evolve advances your creature to the next stage, increasing its EGG yield and HATCH burn value. Your creature must be **fed** and have enough **growth**.

| Parameter | Value |
|-----------|-------|
| Cost | **300 × (current stage + 1)** EGG |
| Requirements | Growth threshold met + creature is fed |
| Growth source | Passive accumulation while fed + feed boost (+100) + accelerate (HATCH) |

**Evolve costs per transition:**

| Transition | Stage | Cost |
|-----------|-------|------|
| Hatchling → Juvenile | 1 → 2 | 600 EGG |
| Juvenile → Adult | 2 → 3 | 900 EGG |
| Adult → Evolved | 3 → 4 | 1,200 EGG |
| Evolved → Final | 4 → 5 | 1,500 EGG |
| **Total (1→5)** | | **4,200 EGG** |

```
  Stage 1 (Hatchling)
    │  Feed regularly → growth accumulates
    │  Reach thresh_2 (5,000 growth) + be fed
    ▼
  Stage 2 (Juvenile)  — costs 600 EGG
    │  Keep feeding → more growth
    ▼
  Stage 3 (Adult)     — costs 900 EGG
    │
    ▼
  Stage 4 (Evolved)   — costs 1,200 EGG
    │
    ▼
  Stage 5 (Final)     — costs 1,500 EGG  🏆
```

---

### 3.6 💕 Breed

Breeding pairs two of your creatures to produce a new offspring NFT. Both parents must be at least stage 1.

| Parameter | Value |
|-----------|-------|
| Cost | **5.0000 HATCH** |
| Cooldown | 24 hours per parent |
| Token flow | 40% burned, 60% goes to reward pool |
| Result | New creature with genetics blended from both parents |

```
  Parent A (stage 1+)  +  Parent B (stage 1+)
          │                       │
          └───────┬───────────────┘
                  │  breed action (5 HATCH)
                  ▼
          Offspring NFT
          (inherits blended genes from both parents)
```

---

### 3.7 🔥 Burn

Burning **destroys** the creature NFT permanently. In return, you receive a **HATCH reward** and a small **EGG refund**. The HATCH reward scales with both the creature's **stage** and **rarity**.

| Rarity | EGG Refund |
|--------|-----------|
| Common | 8 |
| Uncommon | 12 |
| Rare | 16 |
| Epic | 21 |
| Legendary | 26 |
| Mythic | 30 |

**HATCH burn rewards (sample):**

| Stage | Common | Rare | Epic | Mythic |
|-------|--------|------|------|--------|
| 0 (Egg) | 2 HATCH | 20 HATCH | 50 HATCH | 300 HATCH |
| 2 (Juvenile) | 10 HATCH | 100 HATCH | 250 HATCH | 1,500 HATCH |
| 5 (Final) | 100 HATCH | 1,000 HATCH | 2,500 HATCH | **15,000 HATCH** |

> Burning is a strategic decision. A fully-raised Mythic at stage 5 is worth 15,000 HATCH, but you lose the creature forever.

---

### 3.8 🎁 Claim Season Reward

Once per season, you can claim a HATCH reward based on your highest-stage creature.

| Parameter | Value |
|-----------|-------|
| Frequency | 1 claim per player per season |
| Requirements | At least one creature at stage 2+ AND currently fed |
| Payout (stage 2) | 15 HATCH |
| Payout (stage 3) | 25 HATCH |
| Payout (stage 4) | 45 HATCH |
| Payout (stage 5) | 85 HATCH |

> The reward pool is limited. If the pool runs dry, claims are paused until the pool is refilled (via breeding fees or developer injection).

---

## 4. Creature Lifecycle

Every creature progresses through six stages:

```
  Stage 0           Stage 1          Stage 2         Stage 3        Stage 4        Stage 5
  ┌──────┐         ┌──────────┐     ┌──────────┐    ┌───────┐      ┌────────┐     ┌───────┐
  │ EGG  │ ──▶    │ HATCHLING│──▶  │ JUVENILE │──▶ │ ADULT │──▶  │ EVOLVED│──▶  │ FINAL │
  └──────┘         └──────────┘     └──────────┘    └───────┘      └────────┘     └───────┘
  Awaken timer     Can earn EGG     Can claim       Higher yield   Near max       MAX level
  (1h – 3h)        Can be fed       reward (>=2)                                     🏆
```

| Stage | Name | Key Unlocks |
|-------|------|-------------|
| 0 | Egg | Just hatched — waiting to awaken |
| 1 | Hatchling | Can earn EGG, be fed, breed |
| 2 | Juvenile | Eligible for seasonal claim reward |
| 3 | Adult | Higher EGG yield |
| 4 | Evolved | Near-max yield |
| 5 | Final | Maximum yield and burn value |

---

## 5. Rarity System

There are **6 rarity tiers**. When you hatch an egg, the game rolls RNG against these weights:

| Tier | Rarity | Drop Chance | 1 in N Hatches | Earn Multi | Fed Duration | Daily Cap |
|------|--------|------------|----------------|------------|-------------|-----------|
| 0 | 🟢 Common | 69.00% | 1.4 | ×1.0 | 48h | 240 |
| 1 | 🔵 Uncommon | 20.00% | 5 | ×1.1 | 72h | 264 |
| 2 | 🟣 Rare | 8.00% | 12.5 | ×1.4 | 120h | 336 |
| 3 | 🟡 Epic | 2.50% | 40 | ×1.8 | 7 days | 432 |
| 4 | 🟠 Legendary | 0.45% | 222 | ×2.4 | 10 days | 576 |
| 5 | 🔴 Mythic | 0.05% | 2,000 | ×3.3 | 14 days | 792 |

**What to expect:**

| Goal | Hatches Needed (average) | EGG Cost | Time (Common tier) |
|------|------------------------|----------|-------------------|
| First Uncommon | 5 | 750 EGG | ~3 days |
| First Rare | 12.5 | 1,875 EGG | ~10 days |
| First Epic | 40 | 6,000 EGG | ~28 days |
| First Legendary | 222 | 33,300 EGG | ~97 days |
| First Mythic | 2,000 | 300,000 EGG | ~1.3 years |

> Mythic is a genuine long-term chase. Most players will see their first Epic within a month of daily play. Legendary and Mythic are aspirational goals.

---

## 6. Tips for Beginners

### 🥚 Day 1-3: Get Your First Creatures

1. **Hatch your first egg** (150 EGG). Wait 1 hour for it to awaken.
2. **Feed it.** Feeding is free — there is no reason not to keep your creatures fed.
3. **Harvest every few hours.** The 1-hour cooldown means you can harvest frequently, but the 8-hour offline cap means you never lose more than 8 hours of earnings.
4. **Hatch more eggs** as you earn EGG. More creatures = more total earnings.

### 🥚 Week 1: Evolve and Diversify

5. **Evolve your best creature** as soon as it has enough growth and is fed. Higher stages earn more EGG.
6. **Aim for at least one Rare.** With 12-13 hatches, you have a good chance. A Rare earns 40% more than a Common.
7. **Claim your season reward** once you have a stage 2+ creature that is fed. Free HATCH.

### 🥚 Month 1: Build Your Collection

8. **Focus on one high-rarity creature.** Pour your evolve EGG into your rarest creature first — its higher daily cap benefits all your earnings.
9. **Keep 2-3 creatures fed.** You do not need to feed every creature. Focus on your best earners.
10. **Breed strategically.** Breeding costs 5 HATCH and has a 24-hour cooldown per parent. Only breed when you have spare HATCH and want to try for a specific gene combination.

### 🥚 General Wisdom

| Do | Do Not |
|----|--------|
| Feed before going offline | Let creatures starve (earn 0) |
| Harvest regularly (every 1-8 hours) | Harvest more than once per hour (wasted) |
| Evolve your rarest creature first | Evolve low-rarity creatures unless you have spare EGG |
| Burn duplicates you do not need | Burn your only high-rarity creature |
| Claim season reward as soon as eligible | Miss a season — claims do not stack |

### Token Flow Summary

```
         HATCH                         EGG                          WAX
   ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
   │ Breed (cost) │           │ Hatch (-150) │           │ Wake (cost)  │
   │ Accelerate   │──burn──▶  │ Evolve (-)   │           │ (optional)   │
   │ Burn (reward)│           │ (free)       │           │              │
   │ Claim (reward)│          │ Harvest (+)  │           │              │
   └──────────────┘           └──────────────┘           └──────────────┘
   Hard currency              Soft currency              Real money
   Scarce, deflationary       Earned through care        Convenience only
```

---

## Quick Reference Card

| Action | Cost | Cooldown | Key Requirement |
|--------|------|----------|-----------------|
| Hatch | 150 EGG | None | None |
| Feed | FREE | 6h | 3/day max |
| Harvest | FREE | 1h | 8h offline cap |
| Evolve | 300×(stage+1) EGG | None | Growth threshold + fed |
| Breed | 5 HATCH | 24h/parent | Both stage 1+ |
| Burn | Creature destroyed | None | None |
| Claim | FREE | 1/season | Stage 2+ + fed |
| Wake (WAX) | 3-80 WAX | None | Stage 0 only |
| Unlock Slot | 500/1,200/2,500 EGG | None | Slots 4/5/6 |

**Slot limits:** You start with 3 free creature slots. To hold more creatures, unlock additional slots:
- 4th slot: **500 EGG**
- 5th slot: **1,200 EGG**
- 6th slot: **2,500 EGG**
- Beyond 6th: cost doubles each slot

---

*Pocket Hatchery — hatch, raise, evolve, and collect. Your creatures, your journey.* 🥚
