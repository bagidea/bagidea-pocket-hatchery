/**
 * render-all.mjs — Full render pipeline: 12 species × 3 stages = 36 PNGs.
 *
 * resvg-js (Rust/WASM) does NOT support CSS filter: hue-rotate(var(--...)).
 * Fix: inject a native SVG <feColorMatrix type="hueRotate"> into a working copy
 * before render. Canonical SVGs are NEVER touched; browser CSS path unchanged.
 *
 * Stages:
 *   baby  — freshly hatched: softer palette (sat ×0.85, bright ×1.15)
 *   adult — mature, natural: identity (sat ×1.00, bright ×1.00)
 *   elder — ancient, mystical: cool shift +190°, richer sat ×1.25, darker ×0.82
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { Resvg } = require('C:/Users/BagIdea/AppData/Roaming/npm/node_modules/@resvg/resvg-js')

const CREATURES_DIR = resolve(__dirname, '../web/public/assets/creatures')
const OUT_DIR       = resolve(__dirname, '../web/public/assets/preview')
mkdirSync(OUT_DIR, { recursive: true })

/**
 * Inject a native SVG filter replicating CSS hue-rotate + saturate + brightness.
 * The gene-tint group's class is replaced with filter="url(#gene-tint-baked)".
 * The original CSS .gene-tint rule is left intact (browser rendering still uses it).
 */
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

// ── 12 canonical species ──
const SPECIES = [
  { id: 'foxling',    name: 'Foxling'    },
  { id: 'owlet',     name: 'Owlet'      },
  { id: 'droplet',   name: 'Droplet'    },
  { id: 'pebblit',   name: 'Pebblit'    },
  { id: 'sproutling',name: 'Sproutling' },
  { id: 'flicker',   name: 'Flicker'    },
  { id: 'glimmer',   name: 'Glimmer'    },
  { id: 'wisp',      name: 'Wisp'       },
  { id: 'fluffle',   name: 'Fluffle'    },
  { id: 'shellby',   name: 'Shellby'    },
  { id: 'dracling',  name: 'Dracling'   },
  { id: 'buzzle',    name: 'Buzzle'     },
]

// ── 3 growth stages — each with distinct filter + background ──
const STAGES = [
  {
    id:    'baby',
    label: 'Baby (freshly hatched)',
    hue:   0,
    sat:   0.85,
    light: 1.15,
    bg:    '#16213E',
    note:  'soft palette — bright, washed out, youthful',
  },
  {
    id:    'adult',
    label: 'Adult (mature)',
    hue:   0,
    sat:   1.00,
    light: 1.00,
    bg:    '#0D1B2A',
    note:  'natural colours — identity (no shift)',
  },
  {
    id:    'elder',
    label: 'Elder (ancient)',
    hue:   190,
    sat:   1.25,
    light: 0.82,
    bg:    '#08080F',
    note:  'cool +190° shift, rich sat, darker — mystical',
  },
]

const results = []
let errors = []

for (const { id, name } of SPECIES) {
  let svgRaw
  try {
    svgRaw = readFileSync(resolve(CREATURES_DIR, `${id}.svg`), 'utf-8')
  } catch (e) {
    console.error(`  ❌ MISSING SVG for ${id}: ${e.message}`)
    errors.push(`missing-svg:${id}`)
    continue
  }

  for (const { id: stageId, label: stageLabel, hue, sat, light, bg, note } of STAGES) {
    const injected = bakeGeneFilter(svgRaw, hue, sat, light)

    const resvg = new Resvg(injected, {
      fitTo: { mode: 'width', value: 400 },
      background: bg,
    })
    const pngData = resvg.render()
    const pngBuf  = pngData.asPng()

    const outName = `${id}-${stageId}.png`
    const outPath = resolve(OUT_DIR, outName)
    writeFileSync(outPath, pngBuf)

    const sha = createHash('sha256').update(pngBuf).digest('hex').slice(0, 12)
    results.push({ label: `${name} ${stageLabel}`, outPath, sha, note })
    console.log(`  ✅ ${name.padEnd(12)} [${stageId}]  sha256=${sha}  — ${note}`)
  }
}

// ── Hash uniqueness verification ──
console.log('\n── Hash uniqueness check ──')
const hashes = results.map(r => r.sha)
const unique  = new Set(hashes)
if (unique.size === hashes.length) {
  console.log(`  ✅ All ${hashes.length} files UNIQUE — gene filters are producing distinct colours`)
} else {
  const dupes = hashes.filter((h, i) => hashes.indexOf(h) !== i)
  console.log(`  ❌ DUPLICATE hashes: ${dupes.join(', ')} — some renders are byte-identical`)
  process.exit(1)
}

if (errors.length) {
  console.log(`\n  ⚠️  ${errors.length} error(s): ${errors.join(', ')}`)
  process.exit(1)
}

// ── Output path manifest ──
console.log(`\n── Output paths (${results.length} files) ──`)
results.forEach(r => console.log(`  ${r.outPath}`))
console.log(`\n🎨 Done — ${results.length} PNGs written to ${OUT_DIR}`)
