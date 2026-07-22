/**
 * verify-creature-render.mjs — renders the art lab for real in headless Chrome,
 * screenshots before/after, and asserts the things that must hold:
 *
 *   · no page errors
 *   · every sprite actually rendered an <svg>
 *   · ids are unique across the whole grid (the collision bug)
 *   · the same creature re-renders byte-identically (determinism)
 *   · sprites differ from each other (variety)
 *   · render cost stays sane for a 20-sprite grid
 *
 * Usage: node scripts/verify-creature-render.mjs   (starts/stops its own vite)
 */
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const OUT = new URL('../screenshots/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const PORT = 5199
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url),
  shell: true,
  stdio: 'ignore',
})

const fail = []
const note = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail.push(msg) }

try {
  // wait for vite
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://localhost:${PORT}/plugin/pocket-hatchery/static/artlab.html`); break } catch { await sleep(500) }
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  for (const mode of ['before', 'after']) {
    const t0 = Date.now()
    await page.goto(`http://localhost:${PORT}/plugin/pocket-hatchery/static/artlab.html?mode=${mode}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.body.dataset.artlabReady === '1', null, { timeout: 20000 })
      .catch(() => { throw new Error(`${mode}: art lab never signalled ready. errors: ${errors.slice(0, 3).join(' | ') || 'none'}`) })
    const settled = Date.now() - t0

    const svgCount = await page.locator('svg').count()
    note(svgCount >= 20, `${mode}: ${svgCount} sprites rendered (need >= 20)`)
    note(settled < 8000, `${mode}: grid settled in ${settled}ms (< 8000ms)`)

    // Duplicate-id check — this is what makes six species share one bodyGrad.
    const dupes = await page.evaluate(() => {
      const seen = new Map()
      for (const el of document.querySelectorAll('svg [id]')) {
        seen.set(el.id, (seen.get(el.id) ?? 0) + 1)
      }
      return [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`)
    })
    console.log(`      ${mode}: duplicate ids → ${dupes.length ? dupes.slice(0, 6).join(', ') + (dupes.length > 6 ? ` …(+${dupes.length - 6})` : '') : 'none'}`)
    if (mode === 'after') note(dupes.length === 0, `after: zero duplicate ids across the grid`)

    await page.screenshot({ path: fileURLToPath(new URL(`renderer-${mode}.png`, OUT)), fullPage: true })
    console.log(`      → screenshots/renderer-${mode}.png`)
  }

  note(errors.length === 0, `zero page errors (saw ${errors.length}${errors.length ? ': ' + errors[0].slice(0, 120) : ''})`)

  // Determinism + variety, measured on the real module.
  const probe = await page.evaluate(async () => {
    const { renderCreatureSvg } = await import('/plugin/pocket-hatchery/static/src/creatureRender.ts')
    const text = await (await fetch('/plugin/pocket-hatchery/static/assets/creatures/foxling.svg')).text()
    const g = (n) => (BigInt(n) << 4n | 0n).toString(16).padStart(16, '0') + '0'.repeat(48)
    const a1 = renderCreatureSvg(text, { assetId: '1099500000001', genetics: g(0x1234), rarity: 3 })
    const a2 = renderCreatureSvg(text, { assetId: '1099500000001', genetics: g(0x1234), rarity: 3 })
    const b = renderCreatureSvg(text, { assetId: '1099500000002', genetics: g(0x9ABC), rarity: 3 })
    // Flat (non-gradient) paint must carry the gene too. The paws are the canary:
    // foxling.svg paints them fill="#34D399" with no gradient, so if the palette
    // pass only touches <stop stop-color>, every creature keeps identical mint
    // paws while its gradient body re-hues away from them.
    const stock = '#34D399'
    const paws = new Set()
    let stockLeft = 0
    for (let i = 0; i < 8; i++) {
      const svg = renderCreatureSvg(text, { assetId: 'paw' + i, genetics: g(0x2000 + i * 0x137), rarity: 2 })
      const d = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const pawEls = [...d.querySelectorAll('ellipse')]
        .filter(e => e.getAttribute('cy') === '152' || e.getAttribute('cy') === '160')
      for (const e of pawEls) {
        const f = (e.getAttribute('fill') || '').toLowerCase()
        if (f === stock) stockLeft++
        paws.add(f)
      }
      if (!pawEls.length) return { pawError: 'paw ellipses not found — selector is stale' }
    }

    const t0 = performance.now()
    for (let i = 0; i < 20; i++) renderCreatureSvg(text, { assetId: 'x' + i, genetics: g(0x1000 + i), rarity: i % 6 })
    return {
      deterministic: a1 === a2, distinct: a1 !== b, ms20: performance.now() - t0,
      pawVariants: paws.size, stockLeft,
    }
  })
  note(!probe.pawError, `flat-fill probe located the paws${probe.pawError ? ': ' + probe.pawError : ''}`)
  note(probe.stockLeft === 0, `flat fills re-hued: ${probe.stockLeft} paw(s) still stock #34D399 (want 0)`)
  note(probe.pawVariants >= 6, `flat paw colour varies by gene: ${probe.pawVariants} distinct across 8 creatures (>= 6)`)
  note(probe.deterministic, 'same (assetId, gene) → byte-identical SVG')
  note(probe.distinct, 'different (assetId, gene) → different SVG')
  note(probe.ms20 < 400, `20 fresh renders in ${probe.ms20.toFixed(0)}ms (< 400ms)`)

  await browser.close()
} finally {
  // `vite` runs under a shell here, so killing our child leaves the real server
  // listening. Take the whole tree down, synchronously — an async kill loses the
  // race against process exit and strands a dev server on the port.
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try { process.kill(-vite.pid, 'SIGKILL') } catch { vite.kill('SIGKILL') }
  }
}

console.log(fail.length ? `\n${fail.length} CHECK(S) FAILED` : '\nALL CHECKS PASSED')
process.exit(fail.length ? 1 : 0)
