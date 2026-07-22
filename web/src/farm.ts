import type { Rarity } from './components/CreatureCard'
import { computeAwaken } from './awaken'
import { computeSatiety, type SatietyConfig } from './satiety'

/**
 * farm.ts — the living-farm simulation seam (PURE LOGIC — no JSX, no CSS, no DOM).
 *
 * Sibling of satiety.ts / awaken.ts: everything the farm needs to reason about
 * WHERE a creature is and WHAT it is doing lives here, so FarmScene just reads
 * these values onto DOM nodes each frame and never owns behaviour itself.
 *
 * ── THE MODEL ────────────────────────────────────────────────────────────────
 * Every creature the player owns becomes one FarmAgent. An agent walks to a
 * random point inside the scene's walkable zone, rests a beat, picks another,
 * and repeats. Nothing here is decorative randomness for its own sake — the
 * behaviour is driven by REAL chain state (see moodFor):
 *
 *   asleep   — creature.stage === 0. It has not woken yet (awaken.ts), so it
 *              LIES STILL. No target, no walking, ever. Harvest/WAX wakes it.
 *   starving — satiety < hungryAt (satiety.ts). Drags: slow, long rests.
 *   hungry   — satiety < fullAt. Noticeably less lively than a fed creature.
 *   content  — fed. Full speed, short rests.
 *
 * Mood is derived, never stored: re-deriving it from (stage, last_fed, now) each
 * refresh means a feed/wake tx shows up in the farm the moment chain state lands,
 * with no separate animation state to keep in sync.
 *
 * ── SCENE UNITS ──────────────────────────────────────────────────────────────
 * All coordinates are SCENE UNITS (FarmSpec.width × FarmSpec.height), not pixels.
 * The view scales the whole layer by one factor, so the sim is resolution- and
 * zoom-independent and never has to be re-run on resize.
 *
 * ── ART SEAM (Flamingo) ──────────────────────────────────────────────────────
 * DEFAULT_FARM_SPEC is a plain rectangle sized for the placeholder scene. When
 * the art direction lands, drop a `assets/farm/scene.json` matching FarmSpec next
 * to the background art and loadFarmSpec() picks it up — the walkable zone, the
 * sprite size and the depth scaling all follow the art with no engine change.
 * An unreadable/absent file falls back to the default rather than blanking the farm.
 */

// ── Deterministic randomness ─────────────────────────────────────────────────
// Same creature → same wander, forever. Mirrors creatureRender.ts's approach: a
// farm that re-rolls its layout on every React re-render would twitch, and a
// Math.random() sim cannot be asserted in a test.

function hash32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Scene ────────────────────────────────────────────────────────────────────

/** An axis-aligned rectangle in scene units. */
export interface FarmZone {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A static piece of scenery standing INSIDE the walkable band (a trough, a hay
 * bale, the lantern post). It has no behaviour — it exists so it can enter the
 * same y-sort as the creatures, which is the only thing that makes a creature
 * walk convincingly behind it. Anchor is bottom-centre, like a creature's feet.
 */
export interface FarmProp {
  /** File name inside assets/farm/. */
  file: string
  /** Centre-x in scene units. */
  x: number
  /** The prop's base — where it meets the ground, in scene units. */
  baseY: number
  /** The prop's own box at scale 1.0 (its viewBox), in scene units. */
  w: number
  h: number
}

export interface FarmSpec {
  /** Scene width in scene units (the view scales this to the container). */
  width: number
  /** Scene height in scene units. */
  height: number
  /** Where feet are allowed to land. Creatures never leave this rectangle. */
  walkable: FarmZone
  /** Sprite box (scene units) at the FRONT of the scene (walkable bottom edge). */
  spriteSize: number
  /** Sprite scale at the BACK of the walkable zone — the depth cue. */
  depthScaleFar: number
  /** Sprite scale at the FRONT of the walkable zone. */
  depthScaleNear: number
  /** How close two agents may stand (scene units, centre to centre). */
  minSpacing: number
  /**
   * Scenery inside the band, y-sorted with the cast. Optional: the scene is
   * still correct without it, so a spec that omits props is not a broken spec.
   */
  props: FarmProp[]
}

/**
 * Fallback scene, used only when the shipped spec (public/assets/farm/scene.json —
 * the file the art owns) is missing or malformed. Keep the two in step: a 16:10
 * stage with a generous ground rectangle, roughly the lower two thirds (the top
 * third reads as sky/backdrop).
 */
export const DEFAULT_FARM_SPEC: FarmSpec = {
  width: 1000,
  height: 620,
  walkable: { x: 70, y: 250, w: 860, h: 320 },
  spriteSize: 120,
  depthScaleFar: 0.72,
  depthScaleNear: 1.0,
  minSpacing: 78,
  props: [],
}

/** True when `v` is a finite number > 0 — spec fields must all be real sizes. */
const isSize = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Validate an art-supplied scene spec. Every field must be present and sane; a
 * partially-filled file is REJECTED rather than merged, because a half-spec
 * (e.g. a walkable zone from the art but a sprite size from the default) puts
 * creatures at the wrong size for the scene — worse than the honest fallback.
 */
export function parseFarmSpec(raw: unknown): FarmSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const z = s.walkable as Record<string, unknown> | undefined
  if (!z || typeof z !== 'object') return null
  if (![s.width, s.height, s.spriteSize, s.depthScaleFar, s.depthScaleNear, s.minSpacing].every(isSize)) return null
  if (!isSize(z.w) || !isSize(z.h)) return null
  if (typeof z.x !== 'number' || typeof z.y !== 'number') return null
  return {
    width: s.width as number,
    height: s.height as number,
    walkable: { x: z.x, y: z.y, w: z.w as number, h: z.h as number },
    spriteSize: s.spriteSize as number,
    depthScaleFar: s.depthScaleFar as number,
    depthScaleNear: s.depthScaleNear as number,
    minSpacing: s.minSpacing as number,
    props: parseProps(s.props),
  }
}

/**
 * Props are parsed leniently, unlike the geometry above: a malformed prop costs
 * one missing hay bale, while malformed geometry puts creatures in the wrong
 * place at the wrong size. So a bad entry is dropped and the rest of the scene
 * still loads, rather than rejecting the whole spec back to the fallback.
 */
function parseProps(raw: unknown): FarmProp[] {
  if (!Array.isArray(raw)) return []
  const out: FarmProp[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    if (typeof p.file !== 'string' || !p.file) continue
    if (typeof p.x !== 'number' || typeof p.baseY !== 'number') continue
    if (!isSize(p.w) || !isSize(p.h)) continue
    out.push({ file: p.file, x: p.x, baseY: p.baseY, w: p.w, h: p.h })
  }
  return out
}

/**
 * Load the scene spec shipped with the art (assets/farm/scene.json), falling
 * back to DEFAULT_FARM_SPEC when it is missing or malformed. `base` is the app's
 * BASE_URL, same as fetchSpeciesSvg.
 */
export async function loadFarmSpec(base: string): Promise<FarmSpec> {
  try {
    const res = await fetch(base + 'assets/farm/scene.json')
    if (!res.ok) return DEFAULT_FARM_SPEC
    return parseFarmSpec(await res.json()) ?? DEFAULT_FARM_SPEC
  } catch {
    return DEFAULT_FARM_SPEC // no art yet / offline → the farm still runs
  }
}

// ── Mood: chain state → how alive a creature looks ───────────────────────────

export type FarmMood = 'asleep' | 'starving' | 'hungry' | 'content'
export type FarmActivity = 'walk' | 'idle' | 'sleep'

/** The chain-backed fields the farm reads off a Creature (play.ts / CreatureCard). */
export interface FarmCreature {
  assetId: string
  /** Species name — the fallback label when the NFT has no player-given name. */
  name: string
  /**
   * The NFT's on-chain `name` (mutable data, written by setname). The farm shows
   * this in preference to `name`: a player who renames a creature has to see that
   * name HERE too, not just on its card — that mismatch was the bug.
   */
  nickname?: string
  genetics: string
  rarity: Rarity
  stage: number
  lastFed?: number
  fedDur?: number
  bornAt?: number
  awakenDur?: number
}

/**
 * Which mood a creature is in RIGHT NOW, from real chain fields only.
 *
 * stage 0 → asleep. There is no `asleep` column on chain: a creature hatches at
 * stage 0 and only reaches stage 1 when woken (awaken.ts), so stage IS the sleep
 * flag. computeAwaken is used rather than `stage === 0` directly so the farm and
 * the AwakenMeter can never disagree about what sleeping means.
 *
 * Otherwise the satiety curve decides: same computeSatiety the card's meter runs,
 * so a creature that reads "Hungry" on its card drags its feet in the farm.
 */
export function moodFor(c: FarmCreature, now: number, config?: SatietyConfig): FarmMood {
  const awaken = computeAwaken(c.stage, c.bornAt ?? 0, now, c.awakenDur ?? 0)
  if (awaken.sleeping) return 'asleep'
  const sat = computeSatiety(c.lastFed ?? 0, now, c.fedDur ?? 0, config)
  if (sat.state === 'starving') return 'starving'
  if (sat.state === 'hungry') return 'hungry'
  return 'content'
}

interface MoodTuning {
  /** Walk speed in scene units per second. */
  speed: number
  /** Rest duration range (seconds) between two walks. */
  restMin: number
  restMax: number
  /** Walk-leg length range (scene units) — a hungry creature won't cross the farm. */
  legMin: number
  legMax: number
}

// A content creature trots; a hungry one wanders less and rests more; a starving
// one barely bothers. The gap must be visible at a glance without a meter — that
// is the whole point of showing satiety in the scene.
const MOOD_TUNING: Record<Exclude<FarmMood, 'asleep'>, MoodTuning> = {
  content: { speed: 46, restMin: 0.8, restMax: 3.0, legMin: 90, legMax: 380 },
  hungry: { speed: 30, restMin: 2.0, restMax: 5.5, legMin: 60, legMax: 220 },
  starving: { speed: 17, restMin: 4.0, restMax: 9.0, legMin: 40, legMax: 130 },
}

// ── Agents ───────────────────────────────────────────────────────────────────

export interface FarmAgent {
  assetId: string
  name: string
  genetics: string
  rarity: Rarity
  stage: number
  mood: FarmMood
  activity: FarmActivity
  /** Position of the creature's FEET in scene units. */
  x: number
  y: number
  /** Current walk target (feet). Meaningless while idle/sleeping. */
  tx: number
  ty: number
  /** 1 = facing right, -1 = facing left (the sprite is mirrored on -1). */
  facing: 1 | -1
  /** Seconds left in the current activity (idle only; walk ends on arrival). */
  timer: number
  /** Per-agent deterministic RNG — seeded from the asset id. */
  rnd: () => number
  /** Free-running seconds, drives the idle bob out of phase per creature. */
  clock: number
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

const rangeIn = (rnd: () => number, lo: number, hi: number): number => lo + rnd() * (hi - lo)

/** Clamp a point to the walkable zone. */
function clampToZone(x: number, y: number, z: FarmZone): { x: number; y: number } {
  return { x: clamp(x, z.x, z.x + z.w), y: clamp(y, z.y, z.y + z.h) }
}

/**
 * Pick the next walk target: a point a mood-appropriate distance away in a random
 * direction, clamped into the walkable zone. Picking by DIRECTION+LENGTH rather
 * than a uniform point in the zone is what makes the walk read as a stroll — a
 * uniform pick sends a creature diagonally across the whole farm every single leg.
 */
function pickTarget(a: FarmAgent, spec: FarmSpec): { x: number; y: number } {
  const t = MOOD_TUNING[a.mood === 'asleep' ? 'content' : a.mood]
  const angle = a.rnd() * Math.PI * 2
  const len = rangeIn(a.rnd, t.legMin, t.legMax)
  // Vertical travel is squashed: the zone is wider than it is deep, and moving
  // mostly sideways keeps the depth (y) reading stable instead of yo-yoing.
  return clampToZone(a.x + Math.cos(angle) * len, a.y + Math.sin(angle) * len * 0.55, spec.walkable)
}

/**
 * Build the agent list for a set of creatures, preserving the position + activity
 * of any agent that already exists (matched by asset id) so a chain refresh does
 * not teleport the farm. New creatures get a deterministic starting spot; agents
 * whose creature disappeared (burned/transferred) are dropped.
 */
export function syncAgents(
  prev: FarmAgent[],
  creatures: FarmCreature[],
  spec: FarmSpec,
  now: number,
  config?: SatietyConfig,
): FarmAgent[] {
  const byId = new Map(prev.map((a) => [a.assetId, a]))
  return creatures.map((c) => {
    const mood = moodFor(c, now, config)
    const existing = byId.get(c.assetId)
    if (existing) {
      // Re-derive mood (a feed/wake tx just landed?) but keep where it stands.
      // Waking mid-nap resumes as a rest so it stands up before it strolls off.
      const activity: FarmActivity =
        mood === 'asleep' ? 'sleep' : existing.activity === 'sleep' ? 'idle' : existing.activity
      return { ...existing, ...creatureFields(c), mood, activity }
    }
    const rnd = mulberry32(hash32(c.assetId + '|farm'))
    const z = spec.walkable
    // Inset the spawn so a fresh creature never starts hugging the fence.
    const x = z.x + z.w * (0.08 + rnd() * 0.84)
    const y = z.y + z.h * (0.12 + rnd() * 0.8)
    const agent: FarmAgent = {
      ...creatureFields(c),
      mood,
      activity: mood === 'asleep' ? 'sleep' : 'idle',
      x,
      y,
      tx: x,
      ty: y,
      facing: rnd() < 0.5 ? -1 : 1,
      timer: rnd() * 2.5,
      rnd,
      clock: rnd() * 10,
    }
    return agent
  })
}

function creatureFields(c: FarmCreature) {
  return {
    assetId: c.assetId,
    name: c.name,
    genetics: c.genetics,
    rarity: c.rarity,
    stage: c.stage,
  }
}

// ── Simulation ───────────────────────────────────────────────────────────────

/** Longest dt we integrate in one step. A backgrounded tab hands back a huge
 *  delta; without this every creature teleports across the farm on return. */
export const MAX_STEP_SEC = 0.1

/**
 * Advance every agent by `dt` seconds. Mutates in place (one allocation-free pass
 * per frame — this runs at 60fps with the whole farm on it).
 *
 * Sleeping agents are skipped entirely: no target, no motion, no separation push.
 * They are furniture the awake ones walk around, which is exactly how a sleeping
 * creature should behave.
 */
export function stepFarm(agents: FarmAgent[], dt: number, spec: FarmSpec): void {
  const step = clamp(dt, 0, MAX_STEP_SEC)
  if (step <= 0) return

  for (const a of agents) {
    a.clock += step
    if (a.activity === 'sleep') continue

    const t = MOOD_TUNING[a.mood === 'asleep' ? 'content' : a.mood]

    if (a.activity === 'idle') {
      a.timer -= step
      if (a.timer <= 0) {
        const target = pickTarget(a, spec)
        a.tx = target.x
        a.ty = target.y
        a.activity = 'walk'
      } else if (a.rnd() < step * 0.35) {
        a.facing = a.facing === 1 ? -1 : 1 // an occasional look around while resting
      }
      continue
    }

    // walk: steer toward the target, easing the last stretch so arrivals settle
    // instead of stopping dead.
    const dx = a.tx - a.x
    const dy = a.ty - a.y
    const dist = Math.hypot(dx, dy)
    if (dist < 2) {
      a.activity = 'idle'
      a.timer = rangeIn(a.rnd, t.restMin, t.restMax)
      continue
    }
    const ease = dist < 26 ? 0.35 + (dist / 26) * 0.65 : 1
    const move = Math.min(dist, t.speed * ease * step)
    a.x += (dx / dist) * move
    a.y += (dy / dist) * move
    // Only commit to a flip on real horizontal travel — a near-vertical leg would
    // otherwise flicker the sprite left/right on floating-point noise.
    if (Math.abs(dx) > 4) a.facing = dx > 0 ? 1 : -1
  }

  separate(agents, spec)

  // Feet stay in the zone even after a separation push.
  for (const a of agents) {
    const p = clampToZone(a.x, a.y, spec.walkable)
    a.x = p.x
    a.y = p.y
  }
}

/**
 * Push overlapping agents apart so the farm never reads as one creature-blob.
 * O(n²), deliberately: a player's farm is tens of creatures, and at n=50 this is
 * 1225 cheap checks per frame — a spatial hash would cost more to maintain than
 * it saves. Sleeping agents are immovable anchors: awake ones get pushed off them
 * (a sleeper does not shuffle aside).
 */
function separate(agents: FarmAgent[], spec: FarmSpec): void {
  const min = spec.minSpacing
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j]
      const dx = b.x - a.x
      // Depth matters less than width for reading overlap — two creatures a full
      // sprite apart in y look stacked, not crowded, so weight dy up.
      const dy = (b.y - a.y) * 1.6
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const push = (min - d) / 2
      const ux = (dx / d) * push
      const uy = ((dy / d) * push) / 1.6
      const aFixed = a.activity === 'sleep'
      const bFixed = b.activity === 'sleep'
      if (aFixed && bFixed) continue
      if (aFixed) {
        b.x += ux * 2
        b.y += uy * 2
      } else if (bFixed) {
        a.x -= ux * 2
        a.y -= uy * 2
      } else {
        a.x -= ux
        a.y -= uy
        b.x += ux
        b.y += uy
      }
    }
  }
}

// ── View math (still pure — the scene just applies these) ────────────────────

export interface AgentTransform {
  /** Sprite box centre-x in scene units. */
  x: number
  /** Sprite box BOTTOM (the feet) in scene units. */
  y: number
  /** Depth scale for the sprite box. */
  scale: number
  /** Stacking order — a creature further down the scene is nearer, so on top. */
  z: number
  /** -1 mirrors the sprite. */
  facing: 1 | -1
  /** Vertical bob offset (scene units) — breathing while idle, gait while walking. */
  bob: number
}

/**
 * Everything the view needs for one agent this frame. Depth (scale + z) comes
 * from the FEET y only: lower on the scene = nearer the camera = bigger and in
 * front. That single rule is what gives the flat scene its sense of ground.
 */
/**
 * Where a base-y sits in the scene's depth, and therefore how big and how far
 * in front it draws. Creatures and props MUST both go through this: two copies
 * of the perspective rule is how a prop ends up sorted or sized against a scene
 * the creatures aren't standing in.
 *
 * `depth` 0 = the back edge, 1 = the front edge.
 */
export function depthFor(baseY: number, spec: FarmSpec): { depth: number; scale: number; z: number } {
  const z = spec.walkable
  const depth = clamp((baseY - z.y) / (z.h || 1), 0, 1)
  return {
    depth,
    scale: spec.depthScaleFar + (spec.depthScaleNear - spec.depthScaleFar) * depth,
    // 1000 slots of depth, so z never collides for any realistic farm size.
    z: Math.round(depth * 1000),
  }
}

/**
 * Depth-scale quantisation step (fraction of full size). WHY this matters for
 * performance, not looks: every species sprite is an SVG full of `<filter>`
 * elements (drop shadows, glows — Chrome rasterises SVG filters on the CPU). A
 * layer is re-rastered whenever its transform SCALE changes, so a raw depth scale
 * that drifts a hair every frame as a creature walks re-rasters all 21 filtered
 * sprites 60×/second — the farm's real cost. Snapping scale to 2% steps keeps the
 * value identical across most frames, so Chrome sees a translate-only delta (pure
 * compositor, no raster) and only re-rasters the one or two creatures actually
 * crossing a step that frame. The X/Y translate stays continuous, so the walk is
 * still perfectly smooth; only the sub-3px size change is quantised, invisibly.
 */
export const SCALE_STEP = 0.02

/** Snap a depth scale to SCALE_STEP so a walking creature's layer isn't re-rastered every frame. */
export function quantizeScale(scale: number): number {
  return Math.round(scale / SCALE_STEP) * SCALE_STEP
}

/**
 * z-index quantisation step (slots). Same performance reason as SCALE_STEP, for the
 * OTHER per-frame write. A creature walking a few px in y shifts its raw z (0…1000)
 * by several slots every frame; writing a new `style.zIndex` re-sorts the stacking
 * context and invalidates the layer's paint, so 20 walkers churning z 60×/second is
 * what pins the raster worker at ~99%. Snapping z to 16-slot buckets means z only
 * changes when a creature crosses a bucket (a few times a second, not every frame),
 * while still ordering any two creatures more than ~5px apart in depth — finer than
 * eye can read, and far finer than minSpacing keeps them. The paint/raster it saves
 * is the difference between ~7fps and a locked 60.
 */
export const Z_STEP = 16

export function transformFor(a: FarmAgent, spec: FarmSpec): AgentTransform {
  const { scale, z } = depthFor(a.y, spec)
  return {
    x: a.x,
    y: a.y,
    scale: quantizeScale(scale),
    z: Math.round(z / Z_STEP) * Z_STEP,
    facing: a.facing,
    bob: bobFor(a),
  }
}

/**
 * Vertical bob. Walking gets a two-step gait; idle gets a slow breath; a sleeper
 * gets a very shallow, very slow rise and fall so it reads as alive-but-out —
 * a perfectly still sprite reads as broken, not asleep.
 */
function bobFor(a: FarmAgent): number {
  switch (a.activity) {
    case 'walk': {
      const rate = a.mood === 'starving' ? 4.2 : a.mood === 'hungry' ? 5.6 : 7.4
      const amp = a.mood === 'content' ? 3.2 : 2.0
      return -Math.abs(Math.sin(a.clock * rate)) * amp
    }
    case 'idle':
      return -Math.sin(a.clock * 1.5) * 1.1
    case 'sleep':
      return -Math.sin(a.clock * 0.7) * 0.7
  }
}

/** Human label for the mood chip on a creature (UI strings are English-only). */
export const MOOD_LABEL: Record<FarmMood, string> = {
  asleep: 'Asleep',
  starving: 'Starving',
  hungry: 'Hungry',
  content: 'Content',
}
