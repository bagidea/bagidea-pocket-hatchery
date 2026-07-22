// Measure the living farm's real frame performance with the WHOLE herd moving.
//
// Drives the SAME real connected dashboard the other farm scripts use — connect
// as waxwingsuper, whose 21 on-chain creatures give exactly the DoD scene: ~14
// walkers + a stage-0 sleeper (its Zzz) + every creature's contact shadow, all
// animating at once. Nothing is crafted: creatrsv2 is NOT intercepted, only the
// wallet's `selected` flag is rewritten so the panel connects as waxwingsuper
// without disturbing the office wallet.
//
// It reports the ACHIEVED frame cadence (rAF-to-rAF deltas) over a window while
// the farm runs, plus long-frame counts and any main-thread long tasks, and it
// proves the shadow is GPU-cheap by asserting each shadow is a radial-gradient
// with NO box-shadow. Positions are sampled to prove the herd is really moving
// during the measurement (a still farm would trivially hit 60fps).
//
// Usage: node measure-farm-fps.mjs [baseUrl] [seconds]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const SECONDS = Number(process.argv[3] || 8)
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

const readAgents = (page) =>
  page.$$eval('[data-testid="farm-agent"]', (els) =>
    els.map((e) => {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(e.style.transform || '')
      return {
        asset: e.getAttribute('data-asset'),
        mood: e.getAttribute('data-mood'),
        x: m ? parseFloat(m[1]) : NaN,
        y: m ? parseFloat(m[2]) : NaN,
      }
    }))

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

// Playwright's bundled chromium is the software-only headless shell: it re-rasters
// the 21 filtered SVG sprites on the CPU every frame, so its FPS reflects a machine
// with no GPU, not the real panel. Pass FPS_CHANNEL=chrome to drive the installed
// Chrome with the GPU on (new-headless can use ANGLE/D3D11), and FPS_HEADED=1 to
// open a real window if even new-headless falls back to SwiftShader. The script
// prints the live GL renderer so the number is never quietly a software one.
const CHANNEL = process.env.FPS_CHANNEL || ''
const HEADED = process.env.FPS_HEADED === '1'
const GPU_ARGS = [
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-zero-copy',
  '--use-angle=d3d11',
]
// Headless has no display swapchain, so its compositor produces frames slowly even
// when the page is idle — an unusable FPS clock for this GPU-heavy scene. A real
// window (FPS_HEADED=1) is paced by the monitor's own vsync, which is the number
// the CEO actually sees, so we DON'T lift the cap there; 60fps IS the ceiling and
// the jank signal is frames that miss the 16.7ms budget. Only when forced to stay
// headless do we uncap, to read render cost instead of the fake headless clock.
if (!HEADED) GPU_ARGS.push('--disable-gpu-vsync', '--disable-frame-rate-limit')

async function attempt() {
  const browser = await chromium.launch({
    headless: !HEADED,
    ...(CHANNEL ? { channel: CHANNEL } : {}),
    args: CHANNEL || HEADED ? GPU_ARGS : [],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const renderer = await page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl')
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
    } catch { return 'none' }
  }).catch(() => 'n/a')
  console.log(`  GL renderer: ${renderer}`)
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

  await useWaxwingsuper(page)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
  await page.click('button:has-text("Farm")')
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1500) // sprites resolve + first frames

  const agents = await readAgents(page)
  const n = agents.length
  const sleepers = agents.filter((a) => a.mood === 'asleep').length

  // ── Shadow contract: radial-gradient ellipse, NEVER a box-shadow on a creature.
  const shadow = await page.evaluate(() => {
    const boxShadows = new Set()
    let gradientCount = 0, total = 0, agentBoxShadows = 0
    for (const ag of document.querySelectorAll('[data-testid="farm-agent"]')) {
      total++
      if (getComputedStyle(ag).boxShadow !== 'none') agentBoxShadows++
      const sh = ag.querySelector('span[aria-hidden="true"]')
      if (!sh) continue
      const cs = getComputedStyle(sh)
      if (/radial-gradient/.test(cs.backgroundImage)) gradientCount++
      boxShadows.add(cs.boxShadow)
    }
    return { total, gradientCount, boxShadows: [...boxShadows], agentBoxShadows }
  })

  // ── Achieved frame cadence while the herd animates ─────────────────────────
  const perf = await page.evaluate((ms) => new Promise((resolve) => {
    const deltas = []
    const longTasks = []
    let po
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(Math.round(e.duration))
      })
      po.observe({ entryTypes: ['longtask'] })
    } catch { /* longtask unsupported — deltas still tell the story */ }
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

  // First delta is warm-up (gap since observe started); drop it.
  const deltas = perf.deltas.slice(1).filter((d) => d > 0 && d < 1000)
  const frames = deltas.length
  const mean = deltas.reduce((a, b) => a + b, 0) / frames
  const p95 = pct(deltas, 95)
  const p99 = pct(deltas, 99)
  const worst = Math.max(...deltas)
  const avgFps = 1000 / mean
  const minFps = 1000 / worst
  const over20 = deltas.filter((d) => d > 20).length   // dropped a frame at 60fps
  const over32 = deltas.filter((d) => d > 32).length   // ≥2 frames dropped → visible hitch
  const longFrameMs = perf.longTasks.filter((d) => d >= 50)

  // ── Prove the herd was actually moving during the window ───────────────────
  const after = await readAgents(page)
  const moved = after.filter((a) => {
    const b = agents.find((p) => p.asset === a.asset)
    return b && Math.hypot(a.x - b.x, a.y - b.y) > 3
  }).length

  // ── Shots: full stage + a tight crop on the sleeper to read its shadow ─────
  const stage = await page.$('[data-testid="farm-stage"]')
  await stage.screenshot({ path: join(outDir, 'farm-shadows.png') })
  const sleeper = await page.$('[data-mood="asleep"]')
  if (sleeper) {
    const box = await sleeper.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })
    const pad = 70
    await page.screenshot({
      path: join(outDir, 'farm-shadows-crop.png'),
      clip: {
        x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
        width: box.w + pad * 2, height: box.h + pad * 2,
      },
    })
  }

  await page.close()
  await browser.close()

  return {
    n, sleepers, moved, frames, mean, p95, p99, worst, avgFps, minFps,
    over20, over32, longTasks: perf.longTasks, longFrameMs, shadow, errors,
  }
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

console.log(`\n══ Farm perf — ${r.n} real on-chain creatures (${r.moved} moving, ${r.sleepers} asleep) ══`)
console.log(`  frames sampled:   ${r.frames} over ~${SECONDS}s`)
console.log(`  avg FPS:          ${r.avgFps.toFixed(1)}  (mean frame ${r.mean.toFixed(2)}ms)`)
console.log(`  min FPS:          ${r.minFps.toFixed(1)}  (worst frame ${r.worst.toFixed(1)}ms)`)
console.log(`  frame time p95:   ${r.p95.toFixed(2)}ms`)
console.log(`  frame time p99:   ${r.p99.toFixed(2)}ms`)
console.log(`  frames > 20ms:    ${r.over20}  (${(100 * r.over20 / r.frames).toFixed(1)}%)`)
console.log(`  frames > 32ms:    ${r.over32}  (visible hitches)`)
console.log(`  main-thread long tasks (>50ms): ${r.longFrameMs.length}${r.longFrameMs.length ? ' — ' + r.longFrameMs.join(',') + 'ms' : ''}`)
console.log(`  shadow: ${r.shadow.gradientCount}/${r.shadow.total} creatures have a radial-gradient shadow · agents with box-shadow: ${r.shadow.agentBoxShadows}`)
console.log(`  📸 farm-shadows.png · farm-shadows-crop.png`)

const fails = []
if (r.n < 20) fails.push(`only ${r.n} creatures on the farm (expected ~21)`)
if (r.moved < Math.ceil(r.n * 0.5)) fails.push(`only ${r.moved}/${r.n} creatures moved during the window`)
if (r.shadow.gradientCount < r.n) fails.push(`${r.n - r.shadow.gradientCount} creatures missing a radial-gradient shadow`)
if (r.shadow.agentBoxShadows > 0) fails.push(`${r.shadow.agentBoxShadows} creature(s) use box-shadow (banned — repaint cost)`)
if (r.avgFps < 55) fails.push(`avg FPS ${r.avgFps.toFixed(1)} < 55`)
if (r.over32 > r.frames * 0.02) fails.push(`${r.over32} hitching frames (>2% of ${r.frames})`)
if (r.errors.length) fails.push(`page errors: ${r.errors.join(' | ')}`)

console.log(`\n${fails.length === 0 ? '✅ PASS' : '❌ FAIL'} — farm holds 60fps with the full herd + shadows`)
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exit(1) }
process.exit(0)
