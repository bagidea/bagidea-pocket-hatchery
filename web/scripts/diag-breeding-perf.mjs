// Profile the BREEDING screen's real frame performance.
//
// Same harness as measure-farm-fps.mjs: connect as waxwingsuper (21 real
// on-chain creatures) by rewriting only the wallet's `selected` flag — nothing
// is mocked. Then open the 🧬 Breeding tab and measure the achieved frame
// cadence (rAF-to-rAF deltas) + main-thread long tasks while the selector grid
// sits there animating.
//
// The smoking gun this prints: how many LIVE <svg> creature sprites vs baked
// <img> bitmaps are in the breeding grid. N live filter+SMIL SVGs re-raster on
// the CPU every frame → the jank the CEO reported.
//
// Playwright's bundled chromium is the software renderer, so its per-frame SVG
// raster cost is exactly what we want to read here (GPU would hide it). We uncap
// vsync to read render cost, not the fake headless clock.
//
// Usage: node diag-breeding-perf.mjs [baseUrl] [seconds]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const SECONDS = Number(process.argv[3] || 6)
const TAG = process.env.PERF_TAG || 'before'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

async function useWaxwingsuper(page) {
  await page.route('**/plugin/wax-wallet/cmd', async (route) => {
    let command = ''
    try { command = JSON.parse(route.request().postData() || '{}').cmd } catch { /* ignore */ }
    if (command !== 'status') return route.continue()
    const res = await route.fetch()
    const body = await res.json()
    for (const a of body?.status?.accounts ?? []) {
      a.selected = a.account === 'waxwingsuper' && a.permission === 'active'
    }
    await route.fulfill({ response: res, body: JSON.stringify(body) })
  })
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

const GPU_ARGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit']

async function attempt() {
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

  await useWaxwingsuper(page)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('button:has-text("Breeding")', { timeout: 20000 })
  await page.click('button:has-text("Breeding")')
  // Selector grid renders one card per creature; wait for the sprites to resolve.
  await page.waitForSelector('button[aria-pressed]', { timeout: 20000 })
  await page.waitForTimeout(1800) // sprites fetch + bake + first frames settle

  // ── Smoking gun: live <svg> vs baked <img> inside the breeding selector grid ──
  const sprites = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button[aria-pressed]')]
    let liveSvg = 0, bakedImg = 0
    for (const c of cards) {
      if (c.querySelector('svg')) liveSvg++
      else if (c.querySelector('img')) bakedImg++
    }
    return { cards: cards.length, liveSvg, bakedImg }
  })

  // ── Achieved frame cadence while the grid animates ─────────────────────────
  const perf = await page.evaluate((ms) => new Promise((resolve) => {
    const deltas = []
    const longTasks = []
    let po
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(Math.round(e.duration))
      })
      po.observe({ entryTypes: ['longtask'] })
    } catch { /* longtask unsupported */ }
    let prev = performance.now()
    const t0 = prev
    const tick = (now) => {
      deltas.push(now - prev)
      prev = now
      if (now - t0 < ms) requestAnimationFrame(tick)
      else { try { po && po.disconnect() } catch { /* ignore */ } resolve({ deltas, longTasks }) }
    }
    requestAnimationFrame(tick)
  }), SECONDS * 1000)

  const deltas = perf.deltas.slice(1).filter((d) => d > 0 && d < 2000)
  const frames = deltas.length
  const mean = deltas.reduce((a, b) => a + b, 0) / frames
  const p95 = pct(deltas, 95)
  const p99 = pct(deltas, 99)
  const worst = Math.max(...deltas)
  const avgFps = 1000 / mean
  const over20 = deltas.filter((d) => d > 20).length
  const over32 = deltas.filter((d) => d > 32).length
  const longFrameMs = perf.longTasks.filter((d) => d >= 50)

  const grid = await page.$('button[aria-pressed]')
  if (grid) await grid.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: join(outDir, `breeding-perf-${TAG}.png`) })

  await page.close()
  await browser.close()

  return { sprites, frames, mean, p95, p99, worst, avgFps, over20, over32, longFrameMs, longTasks: perf.longTasks, errors }
}

let r = null
for (let i = 1; i <= 4; i++) {
  try { r = await attempt(); break }
  catch (e) {
    const transient = /ERR_NO_BUFFER_SPACE|ERR_NETWORK|Timeout|net::/i.test(e.message)
    console.log(`  ⚠️ attempt ${i} threw: ${e.message}${transient ? ' — retrying' : ''}`)
    if (i === 4 || !transient) { console.log('❌ giving up'); process.exit(1) }
    await new Promise((res) => setTimeout(res, 1500))
  }
}

console.log(`\n══ Breeding perf [${TAG}] — software renderer (reads per-frame SVG raster cost) ══`)
console.log(`  grid cards:       ${r.sprites.cards}`)
console.log(`  LIVE <svg>:       ${r.sprites.liveSvg}   ← re-raster every frame`)
console.log(`  baked <img>:      ${r.sprites.bakedImg}`)
console.log(`  frames sampled:   ${r.frames} over ~${SECONDS}s`)
console.log(`  avg FPS:          ${r.avgFps.toFixed(1)}  (mean frame ${r.mean.toFixed(2)}ms)`)
console.log(`  min FPS:          ${(1000 / r.worst).toFixed(1)}  (worst frame ${r.worst.toFixed(1)}ms)`)
console.log(`  frame p95 / p99:  ${r.p95.toFixed(2)}ms / ${r.p99.toFixed(2)}ms`)
console.log(`  frames > 20ms:    ${r.over20}  (${(100 * r.over20 / r.frames).toFixed(1)}%)`)
console.log(`  frames > 32ms:    ${r.over32}  (visible hitches)`)
console.log(`  long tasks >50ms: ${r.longFrameMs.length}${r.longFrameMs.length ? ' — ' + r.longFrameMs.join(',') + 'ms' : ''}`)
if (r.errors.length) console.log(`  ⚠️ page errors: ${r.errors.join(' | ')}`)
console.log(`  📸 breeding-perf-${TAG}.png`)
process.exit(0)
