// Diagnostic: where does the farm's per-frame cost actually go?
// Runs the real connected farm (waxwingsuper, 21 on-chain creatures) under Chrome
// + GPU and measures rAF cadence in three conditions to isolate the bottleneck.
//
// Usage: FPS_CHANNEL=chrome node diag-farm-perf.mjs [baseUrl]
import { chromium } from 'playwright'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const CHANNEL = process.env.FPS_CHANNEL || ''
const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-gpu-vsync', '--disable-frame-rate-limit']

async function useWaxwingsuper(page) {
  await page.route('**/plugin/wax-wallet/cmd', async (route) => {
    let command = ''
    try { command = JSON.parse(route.request().postData() || '{}').cmd } catch { /* ignore */ }
    if (command !== 'status') return route.continue()
    const res = await route.fetch()
    const body = await res.json()
    for (const a of body?.status?.accounts ?? []) a.selected = a.account === 'waxwingsuper' && a.permission === 'active'
    await route.fulfill({ response: res, body: JSON.stringify(body) })
  })
}

const measure = (page, ms) => page.evaluate((d) => new Promise((resolve) => {
  const deltas = []; let prev = performance.now(); const t0 = prev
  const tick = (now) => { deltas.push(now - prev); prev = now; now - t0 < d ? requestAnimationFrame(tick) : resolve(deltas) }
  requestAnimationFrame(tick)
}), ms)

const stats = (deltas) => {
  const d = deltas.slice(1).filter((x) => x > 0 && x < 2000)
  const mean = d.reduce((a, b) => a + b, 0) / d.length
  return { fps: (1000 / mean).toFixed(1), mean: mean.toFixed(1), n: d.length }
}

async function open(page) {
  await useWaxwingsuper(page)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
  await page.click('button:has-text("Farm")')
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(1500)
}

const browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}), args: GPU_ARGS })

// ── A: animation ON, everything as shipped ──────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await open(page)
  const base = stats(await measure(page, 4000))
  // Confirm quantisation: collect distinct scale values a single agent shows over 2s.
  const scales = await page.evaluate(() => new Promise((resolve) => {
    const set = new Set(); const el = document.querySelector('[data-testid="farm-agent"]'); const t0 = performance.now()
    const tick = () => { const m = /scale\(([-\d.]+)/.exec(el.style.transform || ''); if (m) set.add(m[1]); performance.now() - t0 < 2000 ? requestAnimationFrame(tick) : resolve([...set]) }
    requestAnimationFrame(tick)
  }))
  console.log(`A · shipped (anim ON):        ${base.fps} fps  (${base.mean}ms/frame, ${base.n} frames)`)
  console.log(`    agent#0 distinct scale values over 2s: ${scales.length}  → ${scales.slice(0, 8).join(', ')}`)
  await page.close()
}

// ── B: animation OFF (prefers-reduced-motion → loop never starts) ───────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  const r = stats(await measure(page, 4000))
  console.log(`B · reduced-motion (anim OFF): ${r.fps} fps  (${r.mean}ms/frame) — idle cost floor`)
  await page.close()
}

// ── C: animation ON but every filter killed (CSS + SVG presentation attr) ───
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await open(page)
  await page.addStyleTag({ content: `[data-testid="farm-agent"] *, [data-testid="farm-agent"] svg * { filter: none !important; }` })
  await page.waitForTimeout(500)
  const r = stats(await measure(page, 4000))
  console.log(`C · anim ON, filters KILLED:   ${r.fps} fps  (${r.mean}ms/frame)`)
  await page.close()
}

// ── D: animation ON, sprites hidden (only shadows + boxes move) ─────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await open(page)
  await page.addStyleTag({ content: `.sprite, [data-testid="farm-agent"] svg { visibility: hidden !important; }` })
  await page.waitForTimeout(500)
  const r = stats(await measure(page, 4000))
  console.log(`D · anim ON, sprites HIDDEN:    ${r.fps} fps  (${r.mean}ms/frame) — cost of everything but the SVGs`)
  await page.close()
}

// ── E: animation ON, all backdrop-filter (glass blur) killed ────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await open(page)
  await page.addStyleTag({ content: `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }` })
  await page.waitForTimeout(500)
  const r = stats(await measure(page, 4000))
  console.log(`E · anim ON, backdrop-filter OFF: ${r.fps} fps  (${r.mean}ms/frame)`)
  await page.close()
}

// ── F: anim ON, backdrop-filter OFF *and* sprite filters OFF ────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await open(page)
  await page.addStyleTag({ content: `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    [data-testid="farm-agent"] *, [data-testid="farm-agent"] svg * { filter: none !important; }` })
  await page.waitForTimeout(500)
  const r = stats(await measure(page, 4000))
  console.log(`F · anim ON, blur OFF + filters OFF: ${r.fps} fps  (${r.mean}ms/frame)`)
  await page.close()
}

await browser.close()
