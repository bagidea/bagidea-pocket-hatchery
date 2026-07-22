/* Pocket Hatchery — measure the REAL painted width of every species sprite.
 * Flamingo (Designer) · 2026-07-17
 *
 * scene.json's minSpacing is centre-to-centre in scene units, and farm.ts's
 * separate() applies it flat at every depth. Picking it off the 216-unit BOX is
 * wrong in both directions: the box is padded, so the body is narrower than 216.
 * This measures the painted bbox of each creature SVG through Chrome's own
 * getBBox() — the same renderer the panel uses — so the number comes off the art
 * instead of out of my head.
 *
 *   node web/scripts/measure-sprite-body.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FARM = join(__dirname, '../public/assets/farm')
const CREATURES = join(__dirname, '../public/assets/creatures')

const SPEC = JSON.parse(readFileSync(join(FARM, 'scene.json'), 'utf8'))
const files = readdirSync(CREATURES).filter((f) => f.endsWith('.svg'))

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
await page.setContent('<body style="margin:0"></body>')

const rows = []
for (const f of files) {
  const svg = readFileSync(join(CREATURES, f), 'utf8')
  const box = await page.evaluate((markup) => {
    document.body.innerHTML = markup
    const svg = document.querySelector('svg')
    // The authored coordinate space, not the CSS size.
    const vb = (svg.getAttribute('viewBox') || '0 0 200 200').split(/\s+/).map(Number)
    let min = Infinity, max = -Infinity, top = Infinity, bottom = -Infinity
    for (const el of svg.querySelectorAll('*')) {
      if (typeof el.getBBox !== 'function') continue
      let b
      try { b = el.getBBox() } catch { continue }
      if (!b || (b.width === 0 && b.height === 0)) continue
      // Ignore anything that spans the whole viewBox — a full-bleed <rect> or a
      // gradient backing plate is not the animal's body.
      if (b.width >= vb[2] * 0.98 && b.height >= vb[3] * 0.98) continue
      min = Math.min(min, b.x); max = Math.max(max, b.x + b.width)
      top = Math.min(top, b.y); bottom = Math.max(bottom, b.y + b.height)
    }
    return { vbW: vb[2], vbH: vb[3], min, max, top, bottom }
  }, svg)

  const wFrac = (box.max - box.min) / box.vbW
  rows.push({ file: f, wFrac, hFrac: (box.bottom - box.top) / box.vbH })
}
await browser.close()

rows.sort((a, b) => b.wFrac - a.wFrac)
const box = SPEC.spriteSize
console.log(`\nsprite box = ${box} scene units at the FRONT edge (scale ${SPEC.depthScaleNear})\n`)
console.log('  species                body/box    body @front   body @back')
for (const r of rows) {
  const front = r.wFrac * box
  const back = front * SPEC.depthScaleFar
  console.log(
    `  ${r.file.replace('.svg', '').padEnd(20)} ${(r.wFrac * 100).toFixed(1).padStart(6)}% ` +
      `${front.toFixed(1).padStart(11)}u ${back.toFixed(1).padStart(11)}u`,
  )
}

const widest = rows[0]
const median = [...rows].sort((a, b) => a.wFrac - b.wFrac)[Math.floor(rows.length / 2)]
console.log(`\n  widest  ${widest.file}: ${(widest.wFrac * box).toFixed(1)}u at the front`)
console.log(`  median  ${(median.wFrac * box).toFixed(1)}u at the front`)
console.log(
  `\n  → shoulder-to-shoulder, no overlap, worst case (two widest at the front, same y):` +
    `\n    minSpacing >= ${Math.ceil(widest.wFrac * box)}\n`,
)
