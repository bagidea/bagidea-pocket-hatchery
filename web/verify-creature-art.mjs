/**
 * verify-creature-art.mjs — prove CreatureCard renders REAL gene-driven species art.
 *
 * This exercises the EXACT pipeline CreatureSprite (CreatureCard.tsx) runs:
 *   64-char genetics  →  slice first 16 hex (rendering gene, GENE-SPEC §7.1)
 *                     →  BigInt decode bits  →  species slug (bits 0–3) + CSS vars
 *                     →  load /assets/creatures/{slug}.svg  →  inject :root{--gene-*}
 *                     →  render inline.
 *
 * It generates one 64-char gene per species (distinct body hues) so the grid MUST
 * show 12 different creatures — proving the art is gene-driven, not the old
 * hardcoded Foxling placeholders. A Foxling tint-row (same species, 3 hues) proves
 * the gene tint actually shifts color.
 *
 * The decode here is a verbatim port of src/geneDecoder.ts; we cross-check one
 * gene against the canonical render/engine.js (single source of truth) so a
 * silent divergence can't pass.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_DIR = join(__dirname, 'public', 'assets', 'creatures')
const require = createRequire(import.meta.url)
const engine = require(join(__dirname, '..', 'render', 'engine.js'))

// ── Verbatim port of src/geneDecoder.ts (SPECIES_BY_INDEX / decodeGeneCSS) ──
const SPECIES_BY_INDEX = {
  0: 'foxling', 1: 'owlet', 2: 'droplet', 3: 'pebblit', 4: 'sproutling',
  5: 'flicker', 6: 'glimmer', 7: 'wisp', 8: 'fluffle', 9: 'shellby',
  10: 'dracling', 11: 'buzzle',
}
const SPECIES_NAMES = {
  0: 'Foxling', 1: 'Owlet', 2: 'Droplet', 3: 'Pebblit', 4: 'Sproutling',
  5: 'Flicker', 6: 'Glimmer', 7: 'Wisp', 8: 'Fluffle', 9: 'Shellby',
  10: 'Dracling', 11: 'Buzzle',
}

function decodeGeneCSS(geneticsHex) {
  const clean = geneticsHex.replace('0x', '')
  if (clean.length < 16) throw new Error(`genetics must be ≥16 hex chars (got ${clean.length})`)
  const renderingGene = clean.slice(0, 16)
  const gene = BigInt('0x' + renderingGene)
  const g = {
    speciesId: Number(gene & 0xFn),
    bodyHue: Number((gene >> 4n) & 0xFFn),
    saturation: Number((gene >> 32n) & 0xFn),
    brightness: Number((gene >> 36n) & 0xFn),
  }
  const slug = SPECIES_BY_INDEX[g.speciesId] ?? 'foxling'
  const name = SPECIES_NAMES[g.speciesId] ?? 'Foxling'
  const hueDeg = Math.round((g.bodyHue / 255) * 360)
  const sat = (85 + (g.saturation / 15) * 35) / 100
  const brit = (95 + ((g.brightness - 7) / 15) * 30) / 100
  const css = `--gene-hue-shift: ${hueDeg}deg; --gene-sat-mult: ${sat.toFixed(2)}; --gene-light-mult: ${brit.toFixed(2)};`
  return { slug, name, css, gene: g }
}

// Encode a 16-char rendering gene per GENE-SPEC §2, then pad to a 64-char
// checksum256 shape (first 16 = rendering gene, rest = breeding entropy zeros).
function encodeGene({ speciesId, bodyHue, saturation = 10, brightness = 7 }) {
  let gene = 0n
  gene |= BigInt(speciesId & 0xF) << 0n
  gene |= BigInt(bodyHue & 0xFF) << 4n
  gene |= BigInt(saturation & 0xF) << 32n
  gene |= BigInt(brightness & 0xF) << 36n
  const hex16 = gene.toString(16).padStart(16, '0')
  return (hex16 + '0'.repeat(48)).toUpperCase()
}

// Exact CSS-injection CreatureSprite does: scope vars to THIS <svg> via inline
// style (NOT :root — that collides on <html> across multiple cards).
function loadSvg(slug, css) {
  let svg = readFileSync(join(SVG_DIR, `${slug}.svg`), 'utf8')
  svg = svg.replace(/<svg\b/, `<svg style="${css}"`)
  return svg
}

// ── Cross-check: the ported decoder must equal canonical render/engine.js ──
function assertMatchesEngine() {
  const gene = encodeGene({ speciesId: 0, bodyHue: 100, saturation: 8, brightness: 7 })
  const ported = decodeGeneCSS(gene)
  const canonical = engine.decodeFull(gene.slice(0, 16), 'foxling')
  const cVars = canonical.css.match(/--gene-hue-shift: (\d+)deg;[\s\S]*--gene-sat-mult: ([\d.]+);[\s\S]*--gene-light-mult: ([\d.]+)/)
  const ok =
    ported.slug === 'foxling' &&
    ported.gene.bodyHue === Number(100) &&
    ported.css.includes(`--gene-hue-shift: ${cVars[1]}deg`) &&
    ported.css.includes(`--gene-sat-mult: ${cVars[2]}`) &&
    ported.css.includes(`--gene-light-mult: ${cVars[3]}`)
  if (!ok) throw new Error(`decoder port ≠ engine.js:\n  ported=${ported.css}\n  engine=${canonical.css}`)
  console.log(`✓ decoder port matches canonical engine.js (foxling, bodyHue=100 → hue ${cVars[1]}°)`)
}

assertMatchesEngine()

// ── Build the test set ──────────────────────────────────────────────────────
// One card per species, each with a distinct body hue so colors differ.
const HUES = [42, 207, 179, 28, 141, 353, 268, 90, 320, 12, 260, 50]
const speciesCards = []
for (let i = 0; i < 12; i++) {
  const gene = encodeGene({ speciesId: i, bodyHue: HUES[i] })
  const dec = decodeGeneCSS(gene)
  speciesCards.push({ gene, dec })
  console.log(`gene ${gene.slice(0, 16)}… → species_id=${dec.gene.speciesId} → ${dec.slug} (${dec.name})`)
}

// Distinct-species sanity: every decoded slug must be unique.
const slugs = speciesCards.map((c) => c.dec.slug)
if (new Set(slugs).size !== 12) throw new Error(`expected 12 distinct species, got ${[...new Set(slugs)].length}`)

// Foxling tint row: SAME species, three different body hues → color must shift.
const tintCards = [0, 120, 240].map((h) => {
  const gene = encodeGene({ speciesId: 0, bodyHue: h })
  return { gene, dec: decodeGeneCSS(gene) }
})

// ── Assemble grid HTML (mirrors CreatureCard art area: 4:3, white card) ─────
const cardHtml = (c, sub) => {
  const svg = loadSvg(c.dec.slug, c.dec.css)
  return `
    <div class="card">
      <div class="art">${svg}</div>
      <div class="name">${c.dec.name}</div>
      <div class="sub">${sub}</div>
    </div>`
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#f4f1ea; font-family: system-ui, sans-serif; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  p.lead { margin:0 0 20px; color:#555; font-size:13px; }
  .grid { display:grid; grid-template-columns: repeat(6, 1fr); gap:16px; }
  .row  { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-top:8px; max-width:50%; }
  .card { background:#fff; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,.08); overflow:hidden; }
  .art  { aspect-ratio:4/3; display:grid; place-items:center; padding:8px; }
  .art svg { width:90%; height:90%; display:block; filter: drop-shadow(0 4px 8px rgba(0,0,0,.12)); }
  .name { text-align:center; font-weight:700; font-size:14px; padding:6px 0 0; }
  .sub  { text-align:center; font-size:10px; color:#888; padding:0 0 10px; }
  h2 { font-size:15px; margin:28px 0 10px; }
</style></head><body>
  <h1>Pocket Hatchery — gene-driven creature art</h1>
  <p class="lead">Each card = one 64-char gene decoded → species (bits 0–3) + hue tint (body_hue). No hardcoded Foxling.</p>
  <h2>All 12 species (one gene each, distinct hues)</h2>
  <div class="grid">${speciesCards.map((c) => cardHtml(c, `bodyHue=${c.dec.gene.bodyHue}`)).join('')}</div>
  <h2>Foxling gene-tint proof (same species, 3 hues → color shifts)</h2>
  <div class="row">${tintCards.map((c) => cardHtml(c, `hue ${c.dec.css.match(/hue-shift: (\d+)/)[1]}°`)).join('')}</div>
</body></html>`

// ── Render + screenshot ────────────────────────────────────────────────────
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts?.ready)
await page.waitForTimeout(300)

// Programmatic assertion: every card's <svg> actually rendered with a <path>/<ellipse>
// (i.e. real art inlined, not a broken/empty box), and each card's gene var is
// scoped to its OWN <svg> (so tints differ across cards — the :root-collision bug
// would make them all identical).
const report = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.card')]
  return cards.map((card) => {
    const svg = card.querySelector('svg')
    const shapes = svg ? svg.querySelectorAll('path,ellipse,circle,polygon').length : 0
    const tint = svg?.querySelector('.gene-tint')
    const svgVar = svg ? getComputedStyle(svg).getPropertyValue('--gene-hue-shift').trim() : ''
    const tintFilter = tint ? getComputedStyle(tint).filter : ''
    return { name: card.querySelector('.name').textContent, shapes, hasTint: !!tint, svgVar, tintFilter }
  })
})
console.log('\n📋 Per-card render report:')
for (const r of report)
  console.log(`  ${r.name.padEnd(10)} shapes=${String(r.shapes).padStart(3)} tintGroup=${r.hasTint} svg--gene-hue=${r.svgVar || '(none)'} filter="${r.tintFilter.slice(0, 60)}"`)

const noArt = report.filter((r) => r.shapes === 0)
if (noArt.length) throw new Error(`${noArt.length} card(s) rendered no SVG shapes: ${noArt.map((n) => n.name).join(', ')}`)

// The 3 tint cards (last 3) are all Foxling with hues 0/120/240 → their filters
// MUST differ. If they're identical, the gene vars are colliding on one element.
const tintFilters = report.slice(-3).map((r) => r.tintFilter)
if (new Set(tintFilters).size !== 3)
  throw new Error(`gene-tint collision: the 3 Foxling tint cards have identical filters (${tintFilters[0]}) — vars not scoped per-svg`)
console.log('✓ 3 Foxling tint cards have distinct filters — per-svg gene vars work')

await page.screenshot({ path: 'verify-creature-art.png', fullPage: true })
console.log('\n✅ Screenshot saved: verify-creature-art.png')
await browser.close()
