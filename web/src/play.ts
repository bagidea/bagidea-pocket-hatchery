import { speciesNameFromGene } from './geneDecoder'

/**
 * play.ts — the gameplay logic seam for Pocket Hatchery.
 *
 * This is the ONE module the UI imports (App.tsx: `const game = useGameActions()`).
 * It owns three things and nothing else:
 *   1. wallet connect/disconnect   → TWO backends:
 *        'wcw'     — WAX Cloud Wallet / Anchor via @wharfkit/session (a public
 *                    player signs in their own browser wallet).
 *        'waxwing' — the office daemon wallet via waxwing.ts (internal: the game
 *                    drives waxwing status/account/balance + pushaction).
 *   2. gameplay actions             → a unified GameSigner (both backends build the
 *                                      exact same {account, action, data}; only the
 *                                      signer differs) signs + broadcasts to the
 *                                      game contract on the active network.
 *   3. re-reading live chain state  → chain.ts (RPC reads → resources + creatures),
 *                                      reused by both connect modes for consistency.
 *
 * This is PURE LOGIC — no JSX, no CSS, no layout. Monanisa owns presentation; she
 * calls these functions and renders the returned state. Keep that seam clean.
 *
 * Contract: pockethatch1 @ wax-testnet (RPC eosphere.io), table configv2. The
 * active network follows ?network= (default wax-testnet). ABI-verified 2026-07-02
 * — every action signature matches the deployed ABI exactly. Live proof in
 * scripts/verify-play.mjs (WCW shape) + scripts/verify-waxwing-connect.mjs
 * (waxwing round-trip).
 *
 * STATUS (2026-07-02): initplayer + harvest work LIVE (real txids). hatch is
 * blocked by a CONTRACT bug (mint_creature reads back an inline-minted asset
 * before the inline action runs) — web layer is correct; see
 * docs/HATCH-RESOLVE-ROOT-CAUSE.md. Kevin owns the source fix.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@wharfkit/session'
import { login, restore, logout } from './wallet'
import { getContract } from './contract'
import { isPlayable } from './network'
import { waxwingStatus, ensureNetwork, waxwingAccount, waxwingBuildAction, waxwingWaitForIntent, waxwingCancel, waxwingPushAction, openWaxwingPanel, type WaxwingIntent } from './waxwing'
import {
  fetchGameState,
  getTokenBalance,
  type ChainConfig,
  type CreatureRow,
  type PlayerRow,
  type SpeciesRow,
} from './chain'
import { fedDurFor } from './satiety'

export type ConnectMode = 'wcw' | 'waxwing'

// ── UI-facing shapes (must match what App.tsx + CreatureCard consume) ─────────
export interface Resources {
  egg: number
  energy: number
  maxEnergy: number
  hatch: number
  /** Unix seconds of last harvest (0 = never). */
  lastHarvest: number
  /** Unix seconds of last claimreward (0 = never). */
  lastClaimed: number
  /** Cooldown in seconds between harvest / claimreward actions. */
  harvestCd: number
  /** Season index the player last claimed in (0 = never). */
  claimedSeason: number
  /** Current season index from config. */
  currentSeason: number
}

// On-chain rarity = speciescfg.egg_type (0/1/2). Three tiers only — matches
// CreatureCard's Rarity union. GENETICS-SPEC.md §"Rarity อยู่ที่ species level".
export type Rarity = 'common' | 'uncommon' | 'rare'

export interface Creature {
  assetId: string
  name: string
  species: string
  stage: number
  maxStage: number
  rarity: Rarity
  growth: number
  growthToNext: number
  /** 64-char hex genetics string (checksum256 from chain) */
  genetics: string
  /** Unix seconds of the last feed (chain: creature_row.last_fed). 0 = never. Feed-v2 satiety clock. */
  lastFed: number
  /** Unix seconds of the parent's last breed; 0 = never bred. */
  lastBred: number
  /** Breed cooldown duration in seconds (from config.breed_cd). */
  breedCooldown: number
  /** fed_dur (seconds) for this creature's rarity — configv3.fed_dur_* (or spec default). */
  fedDur: number
}

export interface LastAction {
  ok: boolean
  label: string
  error?: string
  /** true when waxwing wallet is locked — UI should open waxwing panel instead of showing an error toast. */
  needsUnlock?: boolean
}

/**
 * A sign-intent awaiting the player's tap. In 'waxwing' mode, every gameplay
 * action first builds an intent (NO broadcast); the UI shows this summary in an
 * amber Sign popup, and only `confirmPending()` (player taps Sign) broadcasts.
 * `cancelPending()` drops it. WCW mode needs no popup — the browser wallet
 * pops its own. This is the CEO rule: no player action broadcasts without a tap.
 */
export interface PendingSign {
  intent: WaxwingIntent
  label: string
}

// Human-readable summary per action for the Sign popup. Costs follow the live
// config (hatch/evolve); shown as a hint, the on-chain truth is the action data.
const ACTION_LABEL: Record<string, string> = {
  initplayer: 'Init Player',
  hatch: 'Hatch Egg',
  firsthatch: 'First Hatch',
  feed: 'Feed',
  evolve: 'Evolve',
  breed: 'Breed',
  harvest: 'Harvest EGG',
  claimreward: 'Claim HATCH Reward',
}

export interface GameActions {
  connectWallet: (mode?: ConnectMode) => Promise<void>
  disconnectWallet: () => Promise<void>
  hatch: (eggType?: number) => Promise<void>
  feed: (assetId: string) => Promise<void>
  evolve: (assetId: string) => Promise<void>
  breed: (parentA: string, parentB: string) => Promise<void>
  harvest: () => Promise<void>
  claimReward: () => Promise<void>
  refresh: () => Promise<void>
  confirmPending: () => Promise<void>
  cancelPending: () => void
  resources: Resources
  creatures: Creature[]
  animating: boolean
  lastAction: LastAction | null
  pendingSign: PendingSign | null
  connectMode: ConnectMode | null
  connectedAs: string | null
  /** Live hatch cost in whole EGG units (from config.hatch_cost). */
  hatchCost: number | null
  /** Live breed cost in whole HATCH units (parsed from config.breed_cost). */
  breedCost: number | null
}

const EMPTY_RESOURCES: Resources = { egg: 0, energy: 0, maxEnergy: 0, hatch: 0, lastHarvest: 0, lastClaimed: 0, harvestCd: 0, claimedSeason: 0, currentSeason: 0 }

// speciescfg.egg_type (0/1/2) → display rarity. Matches CreatureCard's union.
// Exactly three tiers on chain; egg_type is clamped to this range in toCreature.
const RARITY_BY_EGG_TYPE: Rarity[] = ['common', 'uncommon', 'rare']

/** Resolve the live fed_dur (seconds) for a rarity from configv3, or spec default. */
function fedDurFromConfig(cfg: ChainConfig | null, rarity: Rarity): number {
  const live =
    rarity === 'common' ? cfg?.fed_dur_common
      : rarity === 'uncommon' ? cfg?.fed_dur_uncommon
        : cfg?.fed_dur_rare
  return fedDurFor(rarity, undefined, live)
}

/**
 * Pull a readable message out of a WharfKit/contract/waxwing error. EOSIO
 * assertion failures arrive wrapped as `assertion failure with message: <msg>`;
 * unwrap that so the UI can show e.g. "insufficient EGG to hatch" not a stack.
 */
function readableError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/assertion failure with message:\s*(.+?)["']?\s*$/i)
  if (m) return m[1].replace(/^["']|["']$/g, '')
  return msg.split('\n')[0].slice(0, 160)
}

// ── Mapping: on-chain rows → UI shapes ────────────────────────────────────────
function thresholdForStage(sp: SpeciesRow | undefined, stage: number): number {
  if (!sp) return 0
  const thresholds = [sp.thresh_1, sp.thresh_2, sp.thresh_3, sp.thresh_4]
  return thresholds[Math.min(stage, thresholds.length - 1)] ?? 0
}

function toCreature(
  row: CreatureRow,
  species: SpeciesRow[],
  breedCd: number,
  cfg: ChainConfig | null,
): Creature {
  const sp = species.find((s) => s.template_id === row.template_id)
  const growth = row.growth_base + row.fed_growth
  // max_stage on chain = stage COUNT (e.g. 5 → stages 0‑4), so the highest
  // reachable stage number is max_stage − 1. The contract's evolve() checks
  // stage < max_stage, which means evolving FROM stage 4 would hit stage 5 =
  // overflow. We reflect that here so the UI disables the button at the right
  // boundary and evolve()'s own guard matches the contract.
  const isMax = sp ? row.stage >= sp.max_stage - 1 : false
  // Real species name from the gene's species_id (bits 0–3), falling back to
  // the chain's speciescfg.family or the old hardcoded default.
  const name = speciesNameFromGene(row.genetics)
  const rarity = RARITY_BY_EGG_TYPE[Math.min(Math.max(sp?.egg_type ?? 0, 0), 2)]
  return {
    assetId: row.asset_id,
    name,
    species: sp?.family ?? name,
    stage: row.stage,
    maxStage: Math.max(0, (sp?.max_stage ?? 5) - 1),
    rarity,
    growth,
    // At max stage the progress UI is hidden; keep growthToNext sane otherwise.
    growthToNext: isMax ? growth : thresholdForStage(sp, row.stage),
    genetics: row.genetics,
    lastFed: row.last_fed ?? 0,
    lastBred: row.last_bred ?? 0,
    breedCooldown: breedCd,
    fedDur: fedDurFromConfig(cfg, rarity),
  }
}

/**
 * Parse an Antelope asset string (e.g. "50.0000 HATCH") into a numeric amount.
 * Returns the whole units the UI displays (50), ignoring precision.
 */
function parseAssetAmount(asset: string | undefined): number {
  if (!asset) return 0
  const m = asset.match(/([0-9.]+)\s/)
  return m ? Number(m[1]) : 0
}

function toResources(
  cfg: ChainConfig | null,
  player: PlayerRow | null,
  hatchBalance: number,
): Resources {
  // "Energy" = feeds remaining today (feed_daily_cap − feeds_today). This is
  // the on-chain analogue of action energy and matches the live 99/100 read.
  const cap = cfg?.feed_daily_cap ?? 0
  const feeds = player?.feeds_today ?? 0
  return {
    egg: player?.egg_balance ?? 0,
    energy: Math.max(0, cap - feeds),
    maxEnergy: cap,
    hatch: hatchBalance,
    lastHarvest: player?.last_harvest ?? 0,
    lastClaimed: player?.last_claimed ?? 0,
    harvestCd: cfg?.harvest_cd ?? 0,
    claimedSeason: player?.claimed_season ?? 0,
    currentSeason: cfg?.season_index ?? 0,
  }
}

// ── Unified signer: both connect backends expose { actor, push } ──────────────
// The action data built by hatch/feed/evolve/... is IDENTICAL for both backends
// ({owner: actor, ...}); only who signs differs. This keeps the play logic blind
// to the wallet choice.
interface GameSigner {
  actor: string
  push(action: string, data: Record<string, unknown>): Promise<{ txid?: string }>
}

// ── The hook ─────────────────────────────────────────────────────────────────
export function useGameActions(): GameActions {
  // WCW session (only set in 'wcw' mode).
  const [session, setSession] = useState<Session | undefined>(undefined)
  // Waxwing actor (only set in 'waxwing' mode).
  const [waxwingActor, setWaxwingActor] = useState<string | undefined>(undefined)
  const [connectMode, setConnectMode] = useState<ConnectMode | null>(null)
  const [resources, setResources] = useState<Resources>(EMPTY_RESOURCES)
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [animating, setAnimating] = useState(false)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [pendingSign, setPendingSign] = useState<PendingSign | null>(null)
  const [breedCost, setBreedCost] = useState<number | null>(null)
  const [hatchCost, setHatchCost] = useState<number | null>(null)

  // Track the currently-pending intent so cancel/disconnect can drop it.
  // No deferred promise needed — waxwingWaitForIntent polls the daemon, and
  // waxwingCancel + clearing pendingIntentRef is enough to abort the wait.
  const pendingIntentRef = useRef<WaxwingIntent | null>(null)

  // Live refs for creatures/resources so action callbacks read the current state
  // without recreating themselves on every state change.
  const resourcesRef = useRef<Resources>(EMPTY_RESOURCES)
  const creaturesRef = useRef<Creature[]>([])
  const feedBoostRef = useRef<number>(100)
  const configRef = useRef<ChainConfig | null>(null)
  resourcesRef.current = resources
  creaturesRef.current = creatures

  // Live refs so async callbacks read the current connection without it being a
  // dependency that re-creates them on every connect.
  const sessionRef = useRef<Session | undefined>(undefined)
  const waxwingActorRef = useRef<string | undefined>(undefined)
  const modeRef = useRef<ConnectMode | null>(null)
  sessionRef.current = session
  waxwingActorRef.current = waxwingActor
  modeRef.current = connectMode

  // The connected actor (the on-chain account we read state for + sign as),
  // regardless of which backend is connected.
  const currentActor = (): string | undefined => {
    if (modeRef.current === 'wcw') {
      const s = sessionRef.current
      return s ? String(s.actor) : undefined
    }
    if (modeRef.current === 'waxwing') return waxwingActorRef.current
    return undefined
  }

  const refresh = useCallback(async () => {
    const actor = currentActor()
    if (!actor) return
    try {
      const state = await fetchGameState(actor)
      const token = state.config?.token_contract ?? 'hatchtokens1'
      const hatch = await getTokenBalance(token, actor, 'HATCH')
      if (state.config) {
        feedBoostRef.current = state.config.feed_boost || 100
        configRef.current = state.config
        // Keep null when the config field is missing so the UI can show "—"
        // instead of implying a zero-cost action.
        setBreedCost(state.config.breed_cost ? parseAssetAmount(state.config.breed_cost) : null)
        setHatchCost(state.config.hatch_cost ?? null)
      }
      setResources(toResources(state.config, state.player, hatch))
      const breedCd = state.config?.breed_cd ?? 86400
      setCreatures(state.creatures.map((c) => toCreature(c, state.species, breedCd, state.config)))
    } catch (err) {
      // A read hiccup must not crash the dashboard; surface it softly.
      setLastAction({ ok: false, label: 'Refresh', error: readableError(err) })
    }
  }, [])

  // Live-poll while connected so the HUD reflects on-chain changes (and the
  // result of actions signed from another device/wallet).
  useEffect(() => {
    if (!currentActor()) return
    void refresh()
    const id = setInterval(() => void refresh(), 20000)
    return () => clearInterval(id)
  }, [session, waxwingActor, connectMode, refresh])

  // Build the signer for the active backend. Throws (readably) if not connected.
  const buildSigner = useCallback((): GameSigner => {
    const mode = modeRef.current
    if (mode === 'wcw') {
      const s = sessionRef.current
      if (!s) throw new Error('wallet not connected')
      const c = getContract(s)
      return {
        actor: String(s.actor),
        push: (action, data) => c.push(action, data).then((r) => ({ txid: r.txid })),
      }
    }
    if (mode === 'waxwing') {
      const actor = waxwingActorRef.current
      if (!actor) throw new Error('wallet not connected')
      // Intent-gated: build an intent (NO broadcast), open the waxwing panel so
      // the player unlocks + signs THERE (not in the game), then poll the daemon
      // until the intent is resolved. The player's tap IN WAXWING is the only
      // thing that ever broadcasts a gameplay action.
      return {
        actor,
        push: async (action, data) => {
          const label = ACTION_LABEL[action] ?? action
          const intent = await waxwingBuildAction(action, data, actor, { label })
          pendingIntentRef.current = intent
          setPendingSign({ intent, label })
          // Open waxwing so the player can unlock + sign in the wallet UI.
          openWaxwingPanel()
          try {
            const result = await waxwingWaitForIntent(intent.id)
            return result
          } finally {
            pendingIntentRef.current = null
            setPendingSign(null)
          }
        },
      }
    }
    throw new Error('wallet not connected')
  }, [])

  // Run one signed gameplay action through the active backend, then refresh
  // state. Catches contract/wallet errors into `lastAction` instead of throwing
  // — the UI shows the message; the game stays usable.
  const run = useCallback(
    async (label: string, fn: (s: GameSigner) => Promise<{ txid?: string }>) => {
      setAnimating(true)
      try {
        const signer = buildSigner() // throws if not connected → caught below
        const r = await fn(signer)
        const tail = r.txid ? ` · ${r.txid.slice(0, 10)}…` : ''
        setLastAction({ ok: true, label: `${label}${tail}` })
        await refresh()
      } catch (err) {
        const msg = readableError(err)
        if (msg === 'cancelled') {
          setLastAction({ ok: false, label: `${label} — Cancelled` })
        } else if (/locked|LOCKED/.test(msg) && modeRef.current === 'waxwing') {
          // Wallet locked → signal the UI to open waxwing panel instead of showing an error toast.
          setLastAction({ ok: false, label, error: msg, needsUnlock: true })
        } else if (/fetch|network|ECONN|timeout|ENOTFOUND/i.test(msg)) {
          // waxwing daemon unreachable → show a clear error (the real error case).
          setLastAction({ ok: false, label, error: 'Cannot reach waxwing — please open the waxwing wallet panel first' })
        } else {
          setLastAction({ ok: false, label, error: msg })
        }
      } finally {
        setAnimating(false)
      }
    },
    [refresh, buildSigner],
  )

  const connectWallet = useCallback(
    async (mode: ConnectMode = 'wcw') => {
      // Mainnet is wired in config but the game contract is not deployed there
      // yet (Kevin). Block connect with a clear message — testnet only for now.
      if (!isPlayable()) {
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'mainnet game contract not deployed yet — use ?network=wax-testnet',
        })
        return
      }

      if (mode === 'wcw') {
        // restore() re-attaches an existing session; login() pops WCW/Anchor and
        // must run inside the user gesture App.tsx wires to the Connect button.
        let s = await restore()
        if (!s) s = await login()
        sessionRef.current = s
        setSession(s)
        setConnectMode('wcw')
        await refresh()
        return
      }

      // waxwing backend: sync the daemon wallet to the game's network, then read
      // status + the selected account. The wallet MUST be unlocked to sign later;
      // we only check that here and surface a readable message if it's locked
      // (CEO rule: if locked during a sign test, stop and report — never silently
      // fail). The connect itself still succeeds for read-only use.
      await ensureNetwork()
      const st = await waxwingStatus()
      const actor =
        st.accounts.find((a) => a.selected)?.account ?? st.accounts[0]?.account
      if (!actor) {
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'waxwing has no account on this network — import one in the wallet panel',
        })
        return
      }
      // Prove the read path: pull the account info through waxwing (discard for
      // now — the dashboard reads game state via chain.ts for both modes).
      await waxwingAccount(actor)
      waxwingActorRef.current = actor
      setWaxwingActor(actor)
      setConnectMode('waxwing')
      if (!st.unlocked) {
        // Wallet locked → signal UI to open waxwing, not show an error.
        setLastAction({
          ok: false,
          label: 'Connect',
          error: 'waxwing wallet is LOCKED',
          needsUnlock: true,
        })
      }
      await refresh()
    },
    [refresh],
  )

  const disconnectWallet = useCallback(async () => {
    // Never leave a signable intent behind on disconnect.
    const intent = pendingIntentRef.current
    if (intent) void waxwingCancel(intent.id)
    pendingIntentRef.current = null
    setPendingSign(null)
    if (connectMode === 'wcw') {
      try {
        await logout()
      } catch {
        // ignore — clear local state regardless
      }
    }
    sessionRef.current = undefined
    waxwingActorRef.current = undefined
    modeRef.current = null
    setSession(undefined)
    setWaxwingActor(undefined)
    setConnectMode(null)
    setResources(EMPTY_RESOURCES)
    setCreatures([])
  }, [connectMode])

  // hatch: per Kevin's source (pockethatch.cpp:44), initplayer grants 200
  // starter EGG specifically so players use `hatch` (egg_type 0) and bypass the
  // broken `firsthatch`. So hatch() calls `hatch` directly — no firsthatch route.
  const hatch = useCallback(
    (eggType = 0) =>
      run('Hatch', (s) => s.push('hatch', { owner: s.actor, egg_type: eggType })),
    [run],
  )
  const feed = useCallback(
    (assetId: string) =>
      run('Feed', async (s) => {
        // Optimistically bump the creature's growth so the green bar drops
        // immediately, and reset its satiety clock (lastFed → now) so the Feed-v2
        // meter refills at once; refresh() reconciles with on-chain truth after.
        const nowSec = Math.floor(Date.now() / 1000)
        setCreatures((prev) =>
          prev.map((c) =>
            c.assetId === assetId
              ? { ...c, growth: c.growth + feedBoostRef.current, lastFed: nowSec }
              : c,
          ),
        )
        return s.push('feed', { owner: s.actor, asset_id: assetId })
      }),
    [run],
  )
  const evolve = useCallback(
    (assetId: string) => {
      const c = creaturesRef.current.find((c) => c.assetId === assetId)
      if (!c) {
        setLastAction({ ok: false, label: 'Evolve', error: 'Creature not found' })
        return Promise.resolve()
      }
      if (c.stage >= c.maxStage) {
        setLastAction({ ok: false, label: 'Evolve', error: 'Already at max stage — cannot evolve further' })
        return Promise.resolve()
      }
      if (c.growth < c.growthToNext) {
        setLastAction({
          ok: false,
          label: 'Evolve',
          error: `Need ${c.growthToNext} growth (have ${c.growth}) — feed first`,
        })
        return Promise.resolve()
      }
      return run('Evolve', (s) => s.push('evolve', { owner: s.actor, asset_id: assetId }))
    },
    [run],
  )

  const breed = useCallback(
    (parentA: string, parentB: string) => {
      if (parentA === parentB) {
        setLastAction({ ok: false, label: 'Breed', error: 'Must select two different creatures' })
        return Promise.resolve()
      }
      const a = creaturesRef.current.find((c) => c.assetId === parentA)
      const b = creaturesRef.current.find((c) => c.assetId === parentB)
      if (!a || !b) {
        setLastAction({ ok: false, label: 'Breed', error: 'Selected creature not found' })
        return Promise.resolve()
      }
      const now = Math.floor(Date.now() / 1000)
      const cd = a.breedCooldown || 86400
      const aReady = a.lastBred === 0 || now >= a.lastBred + cd
      const bReady = b.lastBred === 0 || now >= b.lastBred + cd
      if (!aReady || !bReady) {
        setLastAction({ ok: false, label: 'Breed', error: 'Parent is on breeding cooldown' })
        return Promise.resolve()
      }
      const cfg = configRef.current
      const cost = parseAssetAmount(cfg?.breed_cost)
      if (cost > 0 && resourcesRef.current.hatch < cost) {
        setLastAction({
          ok: false,
          label: 'Breed',
          error: `Need ${cost} HATCH (have ${resourcesRef.current.hatch})`,
        })
        return Promise.resolve()
      }
      // Breed has complex inline actions (token transfer + AtomicAssets
      // mint + setassetdata × 2) that the buildaction→confirm flow can't
      // sign correctly (bug: tx gets only contract's eosio.code, no player
      // signature). Use pushAction which signs + broadcasts in one step.
      return run('Breed', (s) =>
        waxwingPushAction('breed', {
          owner: s.actor,
          parent_a: parentA,
          parent_b: parentB,
        }, s.actor).then((r) => ({ txid: r.txid })),
      )
    },
    [run],
  )

  const harvest = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const cd = resourcesRef.current.harvestCd || 0
    if (cd > 0 && now < resourcesRef.current.lastHarvest + cd) {
      setLastAction({ ok: false, label: 'Harvest', error: 'Harvest on cooldown' })
      return Promise.resolve()
    }
    return run('Harvest', (s) => s.push('harvest', { owner: s.actor }))
  }, [run])
  const claimReward = useCallback(() => {
    const r = resourcesRef.current
    const now = Math.floor(Date.now() / 1000)
    // Season gate: if already claimed this season, block with a clear message.
    if (r.currentSeason > 0 && r.claimedSeason >= r.currentSeason) {
      setLastAction({ ok: false, label: 'Claim reward', error: `Already claimed for season ${r.currentSeason}` })
      return Promise.resolve()
    }
    // Cooldown gate: within harvest_cd window since last claim.
    const cd = r.harvestCd || 0
    if (cd > 0 && now < r.lastClaimed + cd) {
      setLastAction({ ok: false, label: 'Claim reward', error: 'Claim on cooldown' })
      return Promise.resolve()
    }
    return run('Claim reward', (s) => s.push('claimreward', { owner: s.actor }))
  }, [run])

  // In the current flow, signing happens IN WAXWING (the player unlocks + taps
  // Sign in the wallet panel), not in the game's SignSheet. The game detects the
  // outcome via waxwingWaitForIntent polling. confirmPending opens the waxwing
  // panel so the player can sign there — use when the player dismisses the
  // SignSheet and needs to re-open waxwing to complete the action.
  const confirmPending = useCallback(async () => {
    openWaxwingPanel()
  }, [])

  // The player dismissed the popup — drop the intent (the daemon discards it)
  // and clear pendingSign. The waxwingWaitForIntent poll will detect the intent
  // is gone and throw 'cancelled', which run() catches and shows "Cancelled".
  const cancelPending = useCallback(() => {
    const intent = pendingIntentRef.current
    pendingIntentRef.current = null
    setPendingSign(null)
    if (intent) void waxwingCancel(intent.id)
  }, [])

  return {
    connectWallet,
    disconnectWallet,
    hatch,
    feed,
    evolve,
    breed,
    harvest,
    claimReward,
    refresh,
    confirmPending,
    cancelPending,
    resources,
    creatures,
    animating,
    lastAction,
    pendingSign,
    connectMode,
    connectedAs: connectMode === 'wcw' ? (session ? String(session.actor) : null) : waxwingActor ?? null,
    hatchCost,
    breedCost,
  }
}
