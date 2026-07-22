/**
 * farm-trace.mjs — real-GPU performance trace of the living farm.
 *
 * Launches HEADED real Chrome (hardware GPU, NOT headless/SwiftShader), loads the
 * farmperf harness (21 creatures), and captures:
 *   1. rAF frame-time distribution (main-thread cadence, the stutter ground-truth)
 *   2. a CDP devtools.timeline trace, aggregated by phase (scripting / recalc-style
 *      / layout / paint / composite / raster / gc) so the culprit is named, not guessed
 *   3. the live WebGL renderer string, to PROVE we are on a hardware GPU
 *
 * Usage: node scripts/farm-trace.mjs <url> <label> <seconds?>
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const URL = process.argv[2]
const LABEL = process.argv[3] || 'run'
const SECONDS = Number(process.argv[4] || 7)

// Bucket a trace event name to a DevTools "Summary" phase.
function phaseOf(name) {
  if (/FunctionCall|EvaluateScript|V8\.|MajorGC|MinorGC|GCEvent|RunMicrotasks|TimerFire|FireAnimationFrame|RunTask/.test(name)) {
    if (/GC/.test(name)) return 'gc'
    return 'scripting'
  }
  if (/UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|InvalidateLayout|ScheduleStyleRecalculation/.test(name)) return 'recalc-style'
  if (/Layout|Layerize|UpdateLayerTree/.test(name)) return 'layout'
  if (/Paint|PrePaint|Rasterize|RasterTask|DecodeImage|Draw|ImageDecode/.test(name)) {
    if (/Raster|Rasterize|RasterTask/.test(name)) return 'raster'
    return 'paint'
  }
  if (/Commit|CompositeLayers|Composite|ProxyMain|ActivateLayerTree|BeginFrame|DrawFrame/.test(name)) return 'composite'
  return 'other'
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: [
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--window-size=1280,900',
  ],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } })
const client = await page.context().newCDPSession(page)

await page.goto(URL, { waitUntil: 'load' })
// Wait until the full cast is mounted.
await page.waitForFunction(() => document.querySelectorAll('[data-testid="farm-agent"]').length >= 21, null, { timeout: 15000 })

// Prove hardware GPU (not SwiftShader).
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl')
  if (!gl) return 'no-webgl'
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'no-ext'
})
const software = /swiftshader|software|llvmpipe|basic render/i.test(renderer)

// Let it settle so the cast starts walking before we measure.
await page.waitForTimeout(1200)

// Install an rAF frame-time collector.
await page.evaluate(() => {
  const w = window
  w.__frames = []
  let last = 0
  const tick = (t) => {
    if (last) w.__frames.push(t - last)
    last = t
    w.__raf = requestAnimationFrame(tick)
  }
  w.__raf = requestAnimationFrame(tick)
})

// Start the CDP timeline trace.
const events = []
client.on('Tracing.dataCollected', (e) => { for (const ev of e.value) events.push(ev) })
const done = new Promise((res) => client.once('Tracing.tracingComplete', res))
await client.send('Tracing.start', {
  categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8,blink,cc,gpu,blink.user_timing',
  transferMode: 'ReportEvents',
  bufferUsageReportingInterval: 500,
})

await page.waitForTimeout(SECONDS * 1000)

await client.send('Tracing.end')
await done

const frames = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__frames })

// ── Frame-time stats ────────────────────────────────────────────────────────
const sorted = [...frames].sort((a, b) => a - b)
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0
const avg = frames.reduce((s, x) => s + x, 0) / (frames.length || 1)
const long16 = frames.filter((f) => f > 16.7).length
const long50 = frames.filter((f) => f > 50).length
const worst = Math.max(0, ...frames)

// ── Trace phase aggregation (complete X events, top-level only) ──────────────
const byPhase = {}
let total = 0
for (const ev of events) {
  if (ev.ph !== 'X' || typeof ev.dur !== 'number') continue
  // Only main-thread renderer events carry these names; sum self-ish durations.
  const ph = phaseOf(ev.name || '')
  byPhase[ph] = (byPhase[ph] || 0) + ev.dur
  total += ev.dur
}
// top event names by total dur (for the flame-chart-style culprit)
const byName = {}
for (const ev of events) {
  if (ev.ph !== 'X' || typeof ev.dur !== 'number') continue
  byName[ev.name] = (byName[ev.name] || 0) + ev.dur
}
const topNames = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 14)
  .map(([n, d]) => ({ name: n, ms: +(d / 1000).toFixed(1) }))

const out = {
  label: LABEL,
  url: URL,
  gpu: { renderer, software },
  frames: {
    count: frames.length,
    avgMs: +avg.toFixed(2),
    p50: +pct(50).toFixed(2),
    p95: +pct(95).toFixed(2),
    p99: +pct(99).toFixed(2),
    worstMs: +worst.toFixed(2),
    long_gt16_7: long16,
    long_gt50: long50,
    pctLong16: +((long16 / (frames.length || 1)) * 100).toFixed(1),
  },
  tracePhasesMs: Object.fromEntries(Object.entries(byPhase).map(([k, v]) => [k, +(v / 1000).toFixed(1)])),
  traceTotalMs: +(total / 1000).toFixed(1),
  topEventsMs: topNames,
}

writeFileSync(`scripts/trace-${LABEL}.json`, JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))

await browser.close()
