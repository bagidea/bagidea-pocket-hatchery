import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeGeneRender } from '../geneDecoder'
import { fetchSpeciesSvg, rasterizeCreatureBitmap, renderCreatureCached } from '../creatureRender'
import type { SatietyConfig } from '../satiety'
import {
  DEFAULT_FARM_SPEC,
  MOOD_LABEL,
  depthFor,
  loadFarmSpec,
  moodFor,
  stepFarm,
  syncAgents,
  transformFor,
  type FarmAgent,
  type FarmCreature,
  type FarmSpec,
} from '../farm'
import styles from './FarmScene.module.css'

/**
 * FarmScene — the living farm.
 *
 * This component owns PRESENTATION ONLY. Where a creature is and what it is
 * doing belongs to farm.ts; this file loads sprites, runs one animation frame
 * loop, and writes the resulting transforms onto DOM nodes.
 *
 * ── Why the sim never lives in React state ───────────────────────────────────
 * Agent positions change 60× a second. Putting them in useState would re-render
 * the whole scene — and re-mount every sprite's SVG — 60 times a second, which is
 * exactly the fan-spinning outcome this feature must avoid. So React renders the
 * creature list ONCE per chain refresh (a stable list keyed by asset id), and the
 * frame loop mutates `style.transform` on refs. Chain state in, pixels out, no
 * re-render in between.
 *
 * Other costs deliberately paid down:
 *   · one rAF for the whole farm, not one per creature
 *   · the loop stops when the tab is hidden or the farm scrolls out of view
 *   · sprites are rendered once and cached (renderCreatureCached), never per frame
 *   · transforms are written only when they actually changed, so an idle farm
 *     (e.g. every creature asleep) costs a compare and nothing else
 *   · prefers-reduced-motion places every creature and never starts a loop at all
 */

const BASE = import.meta.env.BASE_URL

/**
 * The painted scene, in three bands (docs/FARM-SCENE-SPEC.md §2).
 *
 * Every layer shares the same 1600×900 viewBox as scene.json's width/height, so
 * stacked at inset:0 they self-align with the scaled creature layer — there are
 * no per-layer offsets to keep in step.
 *
 * The bands are SIBLING elements, not one z-index run: creature z (0…1000, from
 * depthFor) only competes inside the middle band, so a front-edge creature can
 * never climb over the foreground grass. Every prop in BACK is rooted above the
 * walkable back edge and everything in FRONT below its front edge, so neither
 * band needs sorting — only the things standing between them do.
 */
const BACK_LAYERS = ['farm-sky.svg', 'farm-hills.svg', 'farm-ground.svg', 'farm-backdrop.svg']
const FRONT_LAYERS = ['farm-foreground.svg', 'farm-fx.svg']

interface FarmSceneProps {
  creatures: FarmCreature[]
  /** Satiety thresholds (preview lab passes a fast clock). Defaults to MOCK. */
  satietyConfig?: SatietyConfig
  /** Click a creature in the farm (e.g. to scroll to its card). */
  onSelect?: (assetId: string) => void
}

/**
 * The clock mood is derived from, ticking so a creature visibly slows as its
 * satiety decays without waiting for a chain refresh. Same client-clock
 * convention as SatietyMeter/AwakenMeter; mood only changes at threshold
 * crossings, so 5s is plenty and costs 12 re-renders a minute, not 60.
 */
function useMoodClock(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 5000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface SpriteEntry {
  /** PNG data URL — the sprite baked to a static bitmap (see rasterizeCreatureBitmap). */
  bitmap: string
  ok: boolean
}

/**
 * Baked creature bitmaps, keyed by `assetId|genetics`. Each sprite is rendered to
 * an SVG once and rasterised to a PNG once — the farm animates the bitmap, never a
 * live SVG, so a walking creature costs a GPU transform and no per-frame raster.
 * (Why a bitmap and not the live SVG: rasterizeCreatureBitmap's comment.)
 */
function useSprites(creatures: FarmCreature[]): Map<string, SpriteEntry> {
  const [sprites, setSprites] = useState<Map<string, SpriteEntry>>(new Map())
  // Only re-run when the actual creature identities change — not on every mood
  // tick, which would refetch the species art every 20s refresh.
  const key = creatures.map((c) => `${c.assetId}:${c.genetics}`).join(',')

  useEffect(() => {
    let alive = true
    const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    void (async () => {
      const next = new Map<string, SpriteEntry>()
      for (const c of creatures) {
        try {
          const { speciesId } = decodeGeneRender(c.genetics)
          const text = await fetchSpeciesSvg(BASE, speciesId)
          const opts = {
            assetId: c.assetId,
            genetics: c.genetics,
            rarity: Math.max(0, RARITY_ORDER.indexOf(c.rarity)),
          }
          const svg = renderCreatureCached(text, opts)
          const bitmap = await rasterizeCreatureBitmap(svg, opts)
          next.set(c.assetId, { bitmap, ok: true })
        } catch {
          // A missing/broken species SVG (or a failed bake) must not take the farm
          // down — that one creature falls back to the egg glyph the CSS draws.
          next.set(c.assetId, { bitmap: '', ok: false })
        }
      }
      if (alive) setSprites(next)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return sprites
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function FarmScene({ creatures, satietyConfig, onSelect }: FarmSceneProps) {
  const now = useMoodClock()
  const [spec, setSpec] = useState<FarmSpec>(DEFAULT_FARM_SPEC)
  const sprites = useSprites(creatures)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const agentsRef = useRef<FarmAgent[]>([])
  const specRef = useRef<FarmSpec>(spec)
  specRef.current = spec

  // Scene spec follows the art when it lands (assets/farm/scene.json).
  useEffect(() => {
    let alive = true
    void loadFarmSpec(BASE).then((s) => {
      if (alive) setSpec(s)
    })
    return () => {
      alive = false
    }
  }, [])

  // Moods are the only per-creature value React itself renders (the chip + the
  // droop styling), so they live in the render pass, recomputed per chain refresh.
  const moods = useMemo(
    () => new Map(creatures.map((c) => [c.assetId, moodFor(c, now, satietyConfig)])),
    [creatures, now, satietyConfig],
  )

  // Rebuild the agent list whenever the creature set or its chain state changes.
  // syncAgents keeps existing agents in place, so a refresh never teleports anyone.
  useEffect(() => {
    agentsRef.current = syncAgents(agentsRef.current, creatures, specRef.current, now, satietyConfig)
  }, [creatures, now, satietyConfig, spec])

  // ── The frame loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let raf = 0
    let last = 0
    let running = false
    let visible = true
    const reduced = prefersReducedMotion()
    // Last transform + z written per agent — skip the DOM write when nothing
    // changed. transform and z are tracked separately so a walk that stays at the
    // same depth (z unchanged) never dirties the stacking order for no reason.
    const painted = new Map<string, string>()
    const paintedZ = new Map<string, number>()
    const paintedFace = new Map<string, number>()

    const paint = () => {
      const spec = specRef.current
      const half = spec.spriteSize / 2
      const box = spec.spriteSize
      for (const a of agentsRef.current) {
        const node = nodeRefs.current.get(a.assetId)
        if (!node) continue
        const t = transformFor(a, spec)
        // translate3d keeps each creature (and the contact shadow riding inside its
        // box) on one compositor layer, so a walk is a pure GPU transform — the
        // sprite's SVG filters and the shadow's gradient are never re-rasterized.
        const css =
          `translate3d(${(t.x - half).toFixed(1)}px,` +
          `${(t.y - box + t.bob).toFixed(1)}px,0)` +
          ` scale(${(t.scale * t.facing).toFixed(3)},${t.scale.toFixed(3)})`
        if (painted.get(a.assetId) !== css) {
          node.style.transform = css
          painted.set(a.assetId, css)
        }
        if (paintedZ.get(a.assetId) !== t.z) {
          node.style.zIndex = String(t.z)
          paintedZ.set(a.assetId, t.z)
        }
        // The facing flip above mirrors the WHOLE agent box, which is what makes a
        // left-walking sprite face left — but it also mirrors the name tag riding
        // inside it, rendering the creature's name backwards. Publish the facing so
        // the tag can undo it in CSS. Written only when the creature turns around,
        // not every frame, so this stays off the per-frame write path.
        if (paintedFace.get(a.assetId) !== t.facing) {
          node.style.setProperty('--face', String(t.facing))
          paintedFace.set(a.assetId, t.facing)
        }
      }
    }

    const frame = (ts: number) => {
      if (!running) return
      const dt = last ? (ts - last) / 1000 : 0
      last = ts
      stepFarm(agentsRef.current, dt, specRef.current)
      paint()
      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running || reduced) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    // Place everyone immediately, so a reduced-motion or not-yet-visible farm is
    // still a correctly laid-out scene rather than a pile at the origin.
    paint()

    // Off-screen / background farms burn nothing.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !document.hidden) start()
      else stop()
    })
    io.observe(stage)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (visible) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [creatures.length, spec])

  // Scale the scene-unit layer to whatever width the panel gives us — the sim
  // itself is resolution-independent and never re-runs on resize.
  useEffect(() => {
    const stage = stageRef.current
    const layer = layerRef.current
    if (!stage || !layer) return
    const apply = () => {
      const k = stage.clientWidth / specRef.current.width
      layer.style.transform = `scale(${k})`
      stage.style.height = `${specRef.current.height * k}px`
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [spec])

  const size = spec.spriteSize

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>The Farm</h2>
        <span className={styles.count}>
          {creatures.length === 0
            ? 'No creatures yet'
            : `${creatures.length} living here`}
        </span>
      </div>

      <div ref={stageRef} className={styles.stage} data-testid="farm-stage">
        {/* Token gradients stay underneath as the honest fallback: if a layer
            fails to load, the stage is still a dusk sky over ground, not a hole. */}
        <div className={styles.sky} />
        <div className={styles.ground} />
        <div className={styles.band}>
          {BACK_LAYERS.map((f) => (
            <img key={f} className={styles.sceneLayer} src={`${BASE}assets/farm/${f}`} alt="" />
          ))}
        </div>
        <div
          ref={layerRef}
          className={styles.layer}
          style={{ width: spec.width, height: spec.height }}
        >
          {spec.props.map((p, i) => {
            // Static scenery: placed once, from the same depth rule the cast
            // uses, so it sits in the one y-sort with them and never re-renders.
            const { scale, z } = depthFor(p.baseY, spec)
            return (
              <img
                key={`${p.file}-${i}`}
                className={styles.prop}
                src={`${BASE}assets/farm/${p.file}`}
                alt=""
                style={{
                  width: p.w,
                  height: p.h,
                  transform:
                    `translate3d(${(p.x - p.w / 2).toFixed(1)}px,${(p.baseY - p.h).toFixed(1)}px,0)` +
                    ` scale(${scale.toFixed(3)})`,
                  zIndex: z,
                }}
              />
            )
          })}
          {creatures.map((c) => {
            const mood = moods.get(c.assetId) ?? 'content'
            const sprite = sprites.get(c.assetId)
            // The NFT's on-chain name wins over the species name — the same rule
            // the creature card uses, so one rename changes both surfaces at once.
            const label = c.nickname || c.name
            return (
              <div
                key={c.assetId}
                ref={(el) => {
                  if (el) nodeRefs.current.set(c.assetId, el)
                  else nodeRefs.current.delete(c.assetId)
                }}
                className={styles.agent}
                style={{ width: size, height: size }}
                data-mood={mood}
                data-asset={c.assetId}
                data-testid="farm-agent"
                title={`${label} · ${MOOD_LABEL[mood]}`}
                onClick={onSelect ? () => onSelect(c.assetId) : undefined}
              >
                {/* Contact shadow — a radial-gradient ellipse, no box-shadow. It is
                    a plain child, so it rides the agent's compositor transform for
                    free (position + depth scale + facing) and costs zero per-frame
                    DOM writes of its own. It sits OUTSIDE .pose so a sleeper's tilt
                    never rotates the shadow off the ground. */}
                <span className={styles.shadow} aria-hidden="true" />
                <div className={styles.pose}>
                  {sprite?.ok ? (
                    <img className={styles.sprite} src={sprite.bitmap} alt="" draggable={false} />
                  ) : (
                    <div className={styles.spriteFallback}>🥚</div>
                  )}
                  {mood === 'asleep' && <span className={styles.zzz}>z</span>}
                </div>
                <span className={styles.tag}>{label}</span>
              </div>
            )
          })}
        </div>

        <div className={styles.band}>
          {FRONT_LAYERS.map((f) => (
            <img key={f} className={styles.sceneLayer} src={`${BASE}assets/farm/${f}`} alt="" />
          ))}
        </div>

        {creatures.length === 0 && (
          <p className={styles.empty}>Hatch an egg to bring the farm to life.</p>
        )}
      </div>

      <p className={styles.legend}>
        Sleeping creatures rest until they wake · hungry ones slow down · feed them to
        liven the farm up.
      </p>
    </div>
  )
}
