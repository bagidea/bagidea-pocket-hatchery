/**
 * render-preview.mjs — render upgraded creature SVGs to PNG, with real gene tinting.
 *
 * resvg-js (Rust/WASM) does NOT support CSS filter: hue-rotate(var(--...)).
 * Fix: inject a native SVG <feColorMatrix type="hueRotate"> + feComponentTransfer
 * into a working copy of each SVG, swap the gene-tint class to use it, then render.
 * The canonical SVGs are unchanged; the original CSS path still works in the browser.
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
const OUT_DIR = resolve(__dirname, '../web/public/assets/preview')
mkdirSync(OUT_DIR, { recursive: true })

/**
 * Inject a native SVG filter that replicates CSS hue-rotate + saturate + brightness.
 * The gene-tint group's class is replaced with filter="url(#gene-tint-baked)".
 * The original CSS .gene-tint rule is left intact (browser rendering still uses it).
 */
function bakeGeneFilter(svgRaw, hueShift, satMult, lightMult) {
  const id = 'gene-tint-baked'
  // feColorMatrix type="hueRotate" matches CSS hue-rotate() exactly (SVG spec §15.10)
  // feColorMatrix type="saturate"  approximates CSS saturate()
  // feComponentTransfer linear slope ≈ CSS brightness()
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

  // Inject filter definition before </defs>
  let out = svgRaw.replace('</defs>', filterXml + '\n  </defs>')

  // Replace the gene-tint group's class attribute with a filter attribute.
  // The CSS rule stays for browser use; here we swap to the SVG filter path.
  out = out.replace('<g class="gene-tint">', `<g filter="url(#${id})">`)

  return out
}

const SPECIES = [
  { id: 'flicker',    label: 'Flicker (Fire)' },
  { id: 'droplet',    label: 'Droplet (Water)' },
  { id: 'sproutling', label: 'Sproutling (Leaf)' },
]

// stage1: identity (no shift) — shows natural colours
// stage2: 130° hue shift, +20% sat, +5% brightness — clearly different palette
const GENE_VARIANTS = [
  { label: 'stage1', hue: 0,   sat: 1.0,  light: 1.0,  bg: '#1A1A2E', note: 'base colours (gene default)' },
  { label: 'stage2', hue: 130, sat: 1.20, light: 1.05, bg: '#0D1B2A', note: 'evolved tint (hue +130°, sat ×1.2)' },
]

const results = []

for (const { id, label } of SPECIES) {
  const svgRaw = readFileSync(resolve(CREATURES_DIR, `${id}.svg`), 'utf-8')

  for (const { label: stage, hue, sat, light, bg, note } of GENE_VARIANTS) {
    const injected = bakeGeneFilter(svgRaw, hue, sat, light)

    const resvg = new Resvg(injected, {
      fitTo: { mode: 'width', value: 400 },
      background: bg,
    })
    const pngData = resvg.render()
    const pngBuf = pngData.asPng()

    const outName = `${id}-${stage}.png`
    const outPath = resolve(OUT_DIR, outName)
    writeFileSync(outPath, pngBuf)

    const sha = createHash('sha256').update(pngBuf).digest('hex').slice(0, 12)
    results.push({ label: `${label} ${stage}`, outPath, sha, note })
    console.log(`  ✅ ${label} (${stage}) sha256=${sha}  [${note}]`)
  }
}

// Verify no two files share the same hash
console.log('\n── Hash uniqueness check ──')
const hashes = results.map(r => r.sha)
const unique = new Set(hashes)
if (unique.size === hashes.length) {
  console.log(`  ✅ All ${hashes.length} files are UNIQUE (no duplicates)`)
} else {
  const dupes = hashes.filter((h, i) => hashes.indexOf(h) !== i)
  console.log(`  ❌ DUPLICATE hashes found: ${dupes.join(', ')}`)
  process.exit(1)
}

// Print path list for media rendering
console.log('\n── Output paths ──')
results.forEach(r => console.log(`  ${r.outPath}  [sha=${r.sha}]`))
console.log(`\n🎨 Done — ${results.length} PNGs in ${OUT_DIR}`)
