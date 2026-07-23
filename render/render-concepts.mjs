/**
 * render-concepts.mjs — Render rarity-tier concept SVGs to PNG.
 * Output: web/public/assets/preview/concept/{epic,legendary,mythic}-foxling.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { Resvg } = require('C:/Users/BagIdea/AppData/Roaming/npm/node_modules/@resvg/resvg-js')

const CONCEPT_DIR = resolve(__dirname, '../web/public/assets/creatures/concepts')
const OUT_DIR     = resolve(__dirname, '../web/public/assets/preview/concept')
mkdirSync(OUT_DIR, { recursive: true })

const concepts = [
  { file: 'concept-epic-foxling.svg',      out: 'epic-foxling.png',       bg: '#0C0A1E' },
  { file: 'concept-legendary-foxling.svg', out: 'legendary-foxling.png',  bg: '#0D0804' },
  { file: 'concept-mythic-foxling.svg',    out: 'mythic-foxling.png',     bg: '#02030A' },
]

for (const { file, out, bg } of concepts) {
  const svgRaw = readFileSync(resolve(CONCEPT_DIR, file), 'utf-8')
  const resvg  = new Resvg(svgRaw, { fitTo: { mode: 'width', value: 500 }, background: bg })
  const png    = resvg.render().asPng()
  const outPath = resolve(OUT_DIR, out)
  writeFileSync(outPath, png)
  console.log(`  ✅ ${out}`)
}
console.log('\n🎨 Concept renders done →', OUT_DIR)
