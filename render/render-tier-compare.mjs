/**
 * render-tier-compare.mjs — renders foxling at all 6 tiers side-by-side.
 *
 * Output: web/public/assets/preview/tiers/tier-{common..mythic}.png
 *
 * Each PNG shows the foxling with its tier accessory (none / sparkles /
 * orbit-motes / halo / crown-shards / prismatic) so the visual hierarchy
 * can be reviewed at a glance. resvg renders the static first frame — the
 * accessories are designed to look fully composed even without animation.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const { Resvg } = require('C:/Users/BagIdea/AppData/Roaming/npm/node_modules/@resvg/resvg-js')

const CREATURES_DIR = resolve(__dirname, '../web/public/assets/creatures')
const OUT_DIR       = resolve(__dirname, '../web/public/assets/preview/tiers')
mkdirSync(OUT_DIR, { recursive: true })

// ── Tier definitions ──────────────────────────────────────────────────────────
const TIERS = [
  { id: 0, name: 'common',    label: 'Common',    hex: '#4ADE80', accessory: 'none'         },
  { id: 1, name: 'uncommon',  label: 'Uncommon',  hex: '#2DD4BF', accessory: 'sparkles'     },
  { id: 2, name: 'rare',      label: 'Rare',      hex: '#60A5FA', accessory: 'orbit-motes'  },
  { id: 3, name: 'epic',      label: 'Epic',      hex: '#C084FC', accessory: 'halo'         },
  { id: 4, name: 'legendary', label: 'Legendary', hex: '#FBBF24', accessory: 'crown-shards' },
  { id: 5, name: 'mythic',    label: 'Mythic',    hex: '#F472B6', accessory: 'prismatic'    },
]

// ── Minimal seeded PRNG (mulberry32) ─────────────────────────────────────────
function makePrng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── HSL → hex ────────────────────────────────────────────────────────────────
function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255)
    .toString(16).padStart(2, '0')
  return `#${f(0)}${f(8)}${f(4)}`
}

// ── 4-pointed star path ───────────────────────────────────────────────────────
function star4(cx, cy, outer, innerFrac = 0.38) {
  const inner = outer * innerFrac
  const s = Math.SQRT1_2
  const pts = [
    [cx, cy - outer], [cx + inner * s, cy - inner * s],
    [cx + outer, cy], [cx + inner * s, cy + inner * s],
    [cx, cy + outer], [cx - inner * s, cy + inner * s],
    [cx - outer, cy], [cx - inner * s, cy - inner * s],
  ]
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + 'Z'
}

// ── Accessory SVG generator (mirrors creatureRender.ts accessoryLayer) ────────
function accessorySvg(kind, accentHue, rnd) {
  const p    = 'tc'
  const gold = hslToHex(accentHue, 82, 72)
  const goldBright = hslToHex(accentHue, 68, 90)

  // Orbit-motes helper (reused by halo + crown-shards)
  const orbitMotes = () => Array.from({ length: 8 }, (_, i) => {
    const a      = (i / 8) * 360 + rnd() * 12
    const radius = i % 2 === 0 ? 58 : 68
    const sz     = (1.8 + rnd() * 1.9).toFixed(1)
    const dur    = (11 + i * 0.9 + rnd() * 4).toFixed(1)
    return `<g transform="translate(100 106)">
      <g transform="rotate(${a.toFixed(1)})">
        <circle cx="0" cy="-${radius}" r="${sz}" fill="${gold}" opacity="0.88" filter="url(#${p}soft)"/>
      </g>
      <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0"
        dur="${dur}s" repeatCount="indefinite" additive="sum"/>
    </g>`
  }).join('')

  switch (kind) {
    case 'none':
      return ''

    case 'sparkles': {
      return Array.from({ length: 6 }, (_, i) => {
        const a    = rnd() * Math.PI * 2
        const dist = 56 + rnd() * 18
        const cx   = 100 + Math.cos(a) * dist
        const cy   = 100 + Math.sin(a) * dist * 0.82
        const sz   = 2.5 + rnd() * 2.2
        const dur  = (1.4 + i * 0.28).toFixed(2)
        const spin = (3.8 + i * 0.65).toFixed(1)
        const delay = (rnd() * 1.8).toFixed(2)
        return `<path d="${star4(cx, cy, sz)}" fill="${gold}" opacity="0.85" filter="url(#${p}soft)">
          <animate attributeName="opacity" values="0.85;0.15;0.85" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate"
            from="0 ${cx.toFixed(1)} ${cy.toFixed(1)}" to="360 ${cx.toFixed(1)} ${cy.toFixed(1)}"
            dur="${spin}s" repeatCount="indefinite"/>
        </path>`
      }).join('')
    }

    case 'orbit-motes':
      return orbitMotes()

    case 'halo': {
      const h2  = hslToHex(accentHue, 58, 92)
      const hId = `${p}hglow`
      return `
        <defs>
          <filter id="${hId}" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${gold}"
          stroke-width="7" opacity="0.18" filter="url(#${hId})"/>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${gold}"
          stroke-width="3.0" opacity="0.78" filter="url(#${p}soft)">
          <animate attributeName="opacity" values="0.78;0.36;0.78" dur="3.0s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="100" cy="48" rx="36" ry="10" fill="none" stroke="${h2}"
          stroke-width="1.2" opacity="0.62">
          <animate attributeName="opacity" values="0.62;1.0;0.62" dur="3.0s" repeatCount="indefinite"/>
        </ellipse>
        ${orbitMotes()}`
    }

    case 'crown-shards': {
      const heights = [15, 20, 24, 28, 24, 20, 15]
      const angles  = [-52, -36, -20, 0, 20, 36, 52]
      const shards  = heights.map((h, i) => {
        const a = angles[i]
        const w = (3.2 + h * 0.13).toFixed(1)
        return `<g transform="translate(100 106) rotate(${a}) translate(0 -64)">
          <polygon points="0,${-h} ${w},0 0,${(h * 0.34).toFixed(1)} -${w},0"
            fill="${gold}" opacity="0.90" filter="url(#${p}soft)"/>
          <polygon points="0,${(-h * 0.70).toFixed(1)} 1.6,0 0,${(h * 0.17).toFixed(1)} -1.6,0"
            fill="${goldBright}" opacity="0.68"/>
        </g>`
      }).join('')
      return shards + orbitMotes()
    }

    case 'prismatic': {
      const rainbowCols = [0, 48, 96, 160, 220, 270].map(off =>
        hslToHex((accentHue + off) % 360, 88, 66),
      )
      const rings = rainbowCols.map((col, i) => {
        const rot = i * 7, rx = 70 + i, ry = 63 + i
        const dur = (17 + i * 1.8).toFixed(1)
        return `<ellipse cx="100" cy="100" rx="${rx}" ry="${ry}" fill="none"
          stroke="${col}" stroke-width="2.0" opacity="0.40"
          transform="rotate(${rot} 100 100)" filter="url(#${p}soft)">
          <animateTransform attributeName="transform" type="rotate"
            from="${rot} 100 100" to="${rot + 360} 100 100" dur="${dur}s" repeatCount="indefinite"/>
        </ellipse>`
      }).join('')
      const motes = rainbowCols.flatMap((col, i) => {
        const a = (i / 6) * 360, a2 = a + 30
        const dur1 = (14 + i * 0.7).toFixed(1), dur2 = (19 + i * 0.6).toFixed(1)
        return [
          `<g transform="translate(100 106)"><g transform="rotate(${a})">
            <circle cx="0" cy="-62" r="2.8" fill="${col}" opacity="0.92" filter="url(#${p}soft)"/>
          </g><animateTransform attributeName="transform" type="rotate"
            from="0 0 0" to="360 0 0" dur="${dur1}s" repeatCount="indefinite" additive="sum"/></g>`,
          `<g transform="translate(100 106)"><g transform="rotate(${a2})">
            <circle cx="0" cy="-75" r="1.8" fill="${col}" opacity="0.70" filter="url(#${p}soft)"/>
          </g><animateTransform attributeName="transform" type="rotate"
            from="360 0 0" to="0 0 0" dur="${dur2}s" repeatCount="indefinite" additive="sum"/></g>`,
        ]
      }).join('')
      const crownH = [14, 19, 23, 28, 31, 28, 23, 19, 14]
      const crownA = [-60, -44, -28, -14, 0, 14, 28, 44, 60]
      const crownShards = crownH.map((h, i) => {
        const a   = crownA[i]
        const col = rainbowCols[i % 6]
        const w   = (3.4 + h * 0.12).toFixed(1)
        return `<g transform="translate(100 106) rotate(${a}) translate(0 -66)">
          <polygon points="0,${-h} ${w},0 0,${(h * 0.30).toFixed(1)} -${w},0"
            fill="${gold}" opacity="0.94" filter="url(#${p}soft)"/>
          <polygon points="0,${(-h * 0.65).toFixed(1)} 1.7,0 0,${(h * 0.15).toFixed(1)} -1.7,0"
            fill="${col}" opacity="0.86"/>
          <circle cx="0" cy="${-h}" r="1.5" fill="${col}" opacity="0.98" filter="url(#${p}soft)"/>
        </g>`
      }).join('')
      return rings + motes + crownShards
    }

    default:
      return ''
  }
}

// ── Inject soft-filter def + bake gene filter ─────────────────────────────────
function bakeGeneFilter(svgRaw, hueShift, satMult, lightMult) {
  const id = 'gene-tint-baked'
  const filterXml = `
    <filter id="${id}" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
      <feColorMatrix type="hueRotate" values="${hueShift}" result="hued"/>
      <feColorMatrix in="hued" type="saturate" values="${satMult}" result="sated"/>
      <feComponentTransfer in="sated">
        <feFuncR type="linear" slope="${lightMult}"/>
        <feFuncG type="linear" slope="${lightMult}"/>
        <feFuncB type="linear" slope="${lightMult}"/>
      </feComponentTransfer>
    </filter>`
  let out = svgRaw.replace('</defs>', filterXml + '\n  </defs>')
  out = out.replace('<g class="gene-tint">', `<g filter="url(#${id})">`)
  return out
}

function injectSoftFilter(svgRaw) {
  const def = `
    <filter id="tcsoft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.6"/>
    </filter>`
  return svgRaw.replace('</defs>', def + '\n  </defs>')
}

function injectAccessory(svgRaw, accessorySvgStr) {
  if (!accessorySvgStr) return svgRaw
  return svgRaw.replace('</svg>', accessorySvgStr + '\n</svg>')
}

// ── Background per tier — dark canvas with subtle tier-coloured glow ──────────
const BG = '#0C1022'

// ── Render ────────────────────────────────────────────────────────────────────
const svgBase = readFileSync(resolve(CREATURES_DIR, 'foxling.svg'), 'utf-8')

console.log('Rendering 6-tier comparison for foxling…\n')

for (const tier of TIERS) {
  // Use a fixed seed per tier for deterministic star/mote positions
  const rnd = makePrng(tier.id * 0xDEAD + 0xBEEF)

  // accentHue driven by tier colour for self-consistency
  const accentHue = [120, 170, 220, 290, 45, 330][tier.id]

  const accSvg = accessorySvg(tier.accessory, accentHue, rnd)

  let svg = svgBase
  svg = bakeGeneFilter(svg, 0, 1.0, 1.0)   // identity gene — pure species colours
  svg = injectSoftFilter(svg)
  svg = injectAccessory(svg, accSvg)

  const resvg   = new Resvg(svg, {
    fitTo:      { mode: 'width', value: 400 },
    background: BG,
  })
  const pngData = resvg.render()
  const pngBuf  = pngData.asPng()

  const outPath = resolve(OUT_DIR, `tier-${tier.name}.png`)
  writeFileSync(outPath, pngBuf)
  console.log(`  ✅ [${tier.id}] ${tier.label.padEnd(10)} accessory=${tier.accessory.padEnd(12)} → ${outPath}`)
}

console.log(`\n🎨 Done — 6 PNGs written to ${OUT_DIR}`)
