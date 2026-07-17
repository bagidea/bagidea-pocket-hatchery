import { useCallback, useState } from 'react'
import type { Creature } from './components/CreatureCard'
import { AWAKEN_DUR_DEFAULT, WAKE_COST_WAX_DEFAULT } from './awaken'

/**
 * Local, fully-reactive game loop for `?demo` mode.
 *
 * The real chain loop (`initplayer → hatch → feed → evolve → harvest →
 * claimreward`) is blocked on a contract deploy (ATTR_MAP fix) that needs the
 * owner's private key. So that a player can still feel the full loop today,
 * this hook mirrors the on-chain economy (constants pulled LIVE from the
 * `pockethatch1` configv2 + speciescfg tables on wax-testnet via Sahara's
 * chain research) in local React state. Nothing leaves the browser.
 *
 * Loop it closes: Harvest EGG → Hatch Egg → Feed → Evolve → Claim Reward.
 *
 * It is deliberately a separate module so the real WharfKit signing path in
 * App.tsx stays untouched — demo only runs while `?demo` is in the URL.
 */

// ── Economy constants (live pockethatch1 configv2 @ wax-testnet) ─────────────
const DAILY_EGG_CAP = 240    // config.daily_egg_cap
const TAP_EGG = 60           // config.tap_egg_cap — EGG per Harvest tap
const FEED_DAILY_CAP = 100   // config.feed_daily_cap
const FEED_BOOST = 1000      // config.feed_boost — growth per feed
// Claim payout scales with the highest-stage creature, mirroring the live
// contract (pockethatch.cpp claimreward base[]={0,0,15,25,45,85}). Claimable
// from Stage-2 (Juvenile) up. Index by stage; clamp to 5.
const CLAIM_SCALE = [0, 0, 15, 25, 45, 85]
const HATCH_EGG_COST = 150   // config.hatch_cost — EGG burned to Hatch one egg
const STARTING_EGG = 0       // initplayer-style: must Harvest to farm first

// Growth thresholds from speciescfg template 662644 (Fire family, the only
// species deployed). Cumulative on-chain: thresh_1=1000, thresh_2=5000,
// thresh_3=20000, thresh_4=100000. Demo uses incremental per-stage targets
// (growth resets to 0 on evolve).
const GROWTH_TO_NEXT: Record<number, number> = {
  0: 1000,  // Egg  → Stage 1 (thresh_1)
  1: 4000,  // Stg1 → Stage 2 (thresh_2 − thresh_1)
  2: 15000, // Stg2 → Stage 3 (thresh_3 − thresh_2)
  3: 80000, // Stg3 → Stage 4 (thresh_4 − thresh_3)
}

// pockethatch1 speciescfg max_stage = 5 → stages 0‑4 (max_stage is a COUNT).
const MAX_STAGE = 5
const MAX_REACHABLE = MAX_STAGE - 1 // highest stage the contract actually allows

// Demo flavor only (chain rarity is species-level, not stage-level). Three tiers
// to match the on-chain model: common → uncommon → rare as a creature matures.
const RARITY_BY_STAGE: Creature['rarity'][] = [
  'common', 'common', 'uncommon', 'rare', 'rare',
]

let demoAssetSeq = 9000 // local-only synthetic asset ids (off the real uint64 range)

// Species pool for demo mode — so the CEO sees variety, not just Foxling everywhere.
const DEMO_SPECIES = [
  'Foxling', 'Owlet', 'Droplet', 'Pebblit', 'Sproutling',
  'Flicker', 'Glimmer', 'Wisp', 'Fluffle', 'Shellby', 'Dracling', 'Buzzle',
]

function pickSpecies(): string {
  return DEMO_SPECIES[Math.floor(Math.random() * DEMO_SPECIES.length)]
}

export interface DemoState {
  egg: number
  eggHarvestedToday: number
  feedsToday: number
  hatch: number
  creatures: Creature[]
  log: string[]
  /** The last hatched creature info — consumed by the HatchOverlay. */
  lastHatched: { speciesId: string; speciesName: string } | null
}

// ── Demo gene encoder (produces valid 64-char hex for geneDecoder) ──────────
const SPECIES_INDEX: Record<string, number> = {
  foxling: 0, owlet: 1, droplet: 2, pebblit: 3, sproutling: 4,
  flicker: 5, glimmer: 6, wisp: 7, fluffle: 8, shellby: 9, dracling: 10, buzzle: 11,
}

function demoGenetics(species: string): string {
  const sid = SPECIES_INDEX[species.toLowerCase()] ?? 0
  const bodyHue = Math.floor(Math.random() * 256)
  const accentHue = Math.floor(Math.random() * 256)
  const patternType = Math.floor(Math.random() * 16)
  const patternHue = Math.floor(Math.random() * 256)
  const saturation = Math.floor(Math.random() * 16)
  const brightness = Math.floor(Math.random() * 16)
  const eyeColor = Math.floor(Math.random() * 16)
  const patOpacity = Math.floor(Math.random() * 16)
  const traitA = Math.floor(Math.random() * 4)
  const traitB = Math.floor(Math.random() * 4)
  const traitC = Math.floor(Math.random() * 4)
  const mutations = Math.random() < 0.1 ? 1 << Math.floor(Math.random() * 4) : 0

  // Encode 64-bit rendering gene → 16 hex chars (per GENE-SPEC.md §2)
  let gene = BigInt(0)
  gene |= BigInt(sid & 0xF) << 0n
  gene |= BigInt(bodyHue & 0xFF) << 4n
  gene |= BigInt(accentHue & 0xFF) << 12n
  gene |= BigInt(patternType & 0xF) << 20n
  gene |= BigInt(patternHue & 0xFF) << 24n
  gene |= BigInt(saturation & 0xF) << 32n
  gene |= BigInt(brightness & 0xF) << 36n
  gene |= BigInt(eyeColor & 0xF) << 40n
  gene |= BigInt(patOpacity & 0xF) << 44n
  gene |= BigInt(traitA & 0xF) << 48n
  gene |= BigInt(traitB & 0xF) << 52n
  gene |= BigInt(traitC & 0xF) << 56n
  gene |= BigInt(mutations & 0xF) << 60n

  const rendering = gene.toString(16).padStart(16, '0').toUpperCase()
  // Full checksum256 = rendering gene + 48 zero-padded chars (192 breeding bits)
  return rendering + '0'.repeat(48)
}

function freshCreature(stage = 0, growth = 0): Creature {
  const id = String(++demoAssetSeq)
  const species = pickSpecies()
  const now = Math.floor(Date.now() / 1000)
  const rarity = RARITY_BY_STAGE[stage] ?? 'rare'
  // Awaken v2: a freshly-hatched creature (stage 0) hatches ASLEEP. bornAt/awakenDur
  // drive the AwakenMeter's sleep timer; wakeCost is the WAX to wake it early. These
  // mirror the on-chain configv3 defaults per rarity (real "1h / 3 WAX" for common).
  return {
    assetId: id,
    name: `${species} #${id}`,
    species,
    stage,
    maxStage: MAX_REACHABLE,
    rarity,
    growth,
    growthToNext: GROWTH_TO_NEXT[stage] ?? 0,
    genetics: demoGenetics(species),
    lastFed: now, // Feed-v2 satiety clock: starts full
    bornAt: now,
    awakenDur: AWAKEN_DUR_DEFAULT[rarity] ?? AWAKEN_DUR_DEFAULT.common,
    wakeCostWax: WAKE_COST_WAX_DEFAULT[rarity] ?? WAKE_COST_WAX_DEFAULT.common,
  }
}

function initialState(): DemoState {
  // Start the CEO with one Baby creature so Feed→Evolve works immediately, and
  // zero EGG so the Harvest→Hatch half of the loop is obvious.
  const starter = freshCreature(1, 0)
  return {
    egg: STARTING_EGG,
    eggHarvestedToday: 0,
    feedsToday: 0,
    hatch: 0,
    creatures: [starter],
    log: ['Demo mode: farm EGG → hatch → feed → evolve → claim reward.'],
    lastHatched: null,
  }
}

export function useDemoGame() {
  const [state, setState] = useState<DemoState>(initialState)

  const withLog = useCallback((prev: DemoState, line: string): DemoState => {
    return { ...prev, log: [line, ...prev.log].slice(0, 8) }
  }, [])

  const harvest = useCallback(() => {
    setState((prev) => {
      const remaining = DAILY_EGG_CAP - prev.eggHarvestedToday
      if (remaining <= 0) return withLog(prev, 'Harvest: daily EGG cap (240) reached.')
      const gain = Math.min(TAP_EGG, remaining)
      return withLog(
        { ...prev, egg: prev.egg + gain, eggHarvestedToday: prev.eggHarvestedToday + gain },
        `🥚 Harvested +${gain} EGG (${prev.egg + gain}/${DAILY_EGG_CAP}).`,
      )
    })
  }, [withLog])

  const hatch = useCallback(() => {
    setState((prev) => {
      if (prev.egg < HATCH_EGG_COST) {
        return withLog(prev, `Hatch: need ${HATCH_EGG_COST} EGG (have ${prev.egg}). Harvest first.`)
      }
      const baby = freshCreature(0, 0)
      return withLog(
        {
          ...prev,
          egg: prev.egg - HATCH_EGG_COST,
          creatures: [...prev.creatures, baby],
          lastHatched: { speciesId: baby.species.toLowerCase(), speciesName: baby.species },
        },
        `🐣 Hatched ${baby.name} (-${HATCH_EGG_COST} EGG). Feed it to grow!`,
      )
    })
  }, [withLog])

  // Awaken v2: wake a sleeping (stage 0) egg → Baby (stage 1). On chain this is a
  // WAX payment (wake_cost) to the contract; in demo it just flips the stage so the
  // hatch → wake → feed loop is playable locally without a wallet.
  const wake = useCallback((assetId: string) => {
    setState((prev) => {
      const target = prev.creatures.find((c) => c.assetId === assetId)
      if (!target) return prev
      if (target.stage !== 0) return withLog(prev, `Wake: #${assetId} is already awake.`)
      const creatures = prev.creatures.map((c) =>
        c.assetId === assetId
          ? {
              ...c,
              stage: 1,
              rarity: RARITY_BY_STAGE[1] ?? c.rarity,
              growth: 0,
              growthToNext: GROWTH_TO_NEXT[1] ?? 0,
              lastFed: 0, // never fed yet → reads full + feed available right after waking
            }
          : c,
      )
      return withLog(
        { ...prev, creatures },
        `⚡ Woke #${assetId} (−${target.wakeCostWax ?? 3} WAX) → Baby. Feed it to grow!`,
      )
    })
  }, [withLog])

  const feed = useCallback((assetId: string) => {
    setState((prev) => {
      if (prev.feedsToday >= FEED_DAILY_CAP) {
        return withLog(prev, `Feed: daily cap (${FEED_DAILY_CAP}) reached.`)
      }
      const creatures = prev.creatures.map((c) => {
        if (c.assetId !== assetId) return c
        if (c.stage >= MAX_REACHABLE) return c
        const growth = c.growth + FEED_BOOST
        return { ...c, growth, lastFed: Math.floor(Date.now() / 1000) } // reset satiety clock
      })
      const target = creatures.find((c) => c.assetId === assetId)
      if (!target || target.stage >= MAX_REACHABLE) {
        return withLog(prev, `Feed: #${assetId} is fully grown.`)
      }
      return withLog(
        { ...prev, feedsToday: prev.feedsToday + 1, creatures },
        `🍎 Fed #${assetId} +${FEED_BOOST} growth (${target.growth}/${target.growthToNext}).`,
      )
    })
  }, [withLog])

  const evolve = useCallback((assetId: string) => {
    setState((prev) => {
      const creature = prev.creatures.find((c) => c.assetId === assetId)
      if (!creature) return prev
      if (creature.stage >= MAX_REACHABLE) {
        return withLog(prev, `Evolve: #${assetId} is already at max stage (Champion).`)
      }
      if (creature.growth < creature.growthToNext) {
        return withLog(
          prev,
          `Evolve: #${assetId} needs ${creature.growthToNext} growth (has ${creature.growth}). Feed more.`,
        )
      }
      const nextStage = creature.stage + 1
      const creatures = prev.creatures.map((c) =>
        c.assetId === assetId
          ? {
              ...c,
              stage: nextStage,
              rarity: RARITY_BY_STAGE[nextStage] ?? c.rarity,
              growth: 0,
              growthToNext: GROWTH_TO_NEXT[nextStage] ?? 0,
            }
          : c,
      )
      const STAGE_LABEL: Record<number, string> = {
        1: 'Baby',
        2: 'Juvenile',
        3: 'Adult',
        4: 'Elite',
        5: 'Champion',
      }
      const label = STAGE_LABEL[nextStage] ?? `Stage ${nextStage}`
      return withLog(
        { ...prev, creatures },
        `✨ Evolved #${assetId} → ${label}${nextStage >= MAX_REACHABLE ? ' (reward-ready!)' : ''}.`,
      )
    })
  }, [withLog])

  const claimReward = useCallback(() => {
    setState((prev) => {
      const highest = prev.creatures.reduce((max, c) => Math.max(max, c.stage), 0)
      const payout = CLAIM_SCALE[Math.min(highest, 5)] ?? 0
      if (payout <= 0) {
        return withLog(prev, 'Claim: need a Stage-2 (Juvenile) creature or higher first. Evolve one up.')
      }
      return withLog(
        { ...prev, hatch: prev.hatch + payout },
        `🎁 Claimed ${payout} HATCH (stage ${highest}, balance ${prev.hatch + payout}).`,
      )
    })
  }, [withLog])

  const initplayer = useCallback(() => {
    setState((prev) =>
      withLog(
        { ...prev, egg: 200, eggHarvestedToday: 0 },
        '👋 Init player: granted 200 starting EGG (demo).',
      ),
    )
  }, [withLog])

  return { state, harvest, hatch, wake, feed, evolve, claimReward, initplayer }
}
