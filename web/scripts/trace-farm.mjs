// Definitive frame profiler: capture a real CDP timeline trace of the running farm
// and name where each frame's time goes (raster / paint / gpu / composite), plus
// count genuine DrawFrame vs DroppedFrame events. Unlike rAF (throttled when
// unfocused) or screencast (encode-bound), the trace reports the compositor's own
// event durations, so it can't be fooled by the measurement harness.
//
// Usage: [FPS_CHANNEL=chrome] node trace-farm.mjs [baseUrl] [seconds]
import { chromium } from 'playwright'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const SECONDS = Number(process.argv[3] || 5)
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const CHANNEL = process.env.FPS_CHANNEL || ''
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11']

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

const REDUCED = process.env.REDUCED === '1'
const browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}), args: GPU_ARGS })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
if (REDUCED) await page.emulateMedia({ reducedMotion: 'reduce' })
await useWaxwingsuper(page)
await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.click('button:has-text("Connect via waxwing")')
await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
await page.click('button:has-text("Farm")')
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)

const client = await page.context().newCDPSession(page)
const events = []
client.on('Tracing.dataCollected', (d) => { for (const e of d.value) events.push(e) })
await client.send('Tracing.start', {
  categories: [
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'devtools.timeline',
    'cc', 'gpu', 'viz', 'benchmark',
  ].join(','),
  transferMode: 'ReportEvents',
})
await page.waitForTimeout(SECONDS * 1000)
await client.send('Tracing.end')
await new Promise((r) => { client.once('Tracing.tracingComplete', r); setTimeout(r, 4000) })
await page.close(); await browser.close()

// ── Bucket complete events (ph:'X') by name, summing durations ──────────────
const byName = new Map()
let drawFrames = 0, droppedFrames = 0, beginFrames = 0
for (const e of events) {
  if (e.name === 'DrawFrame') drawFrames++
  if (e.name === 'DroppedFrame') droppedFrames++
  if (e.name === 'BeginFrame') beginFrames++
  if (e.ph === 'X' && typeof e.dur === 'number') byName.set(e.name, (byName.get(e.name) || 0) + e.dur)
}
const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)

console.log(`\n══ Farm trace over ~${SECONDS}s (${events.length} events) ══`)
console.log(`  DrawFrame: ${drawFrames}   DroppedFrame: ${droppedFrames}   BeginFrame: ${beginFrames}`)
const producedFps = drawFrames / SECONDS
console.log(`  → produced ~${producedFps.toFixed(1)} DrawFrames/s (dropped ${droppedFrames})`)
console.log(`\n  Top event buckets by total duration (ms over the window):`)
for (const [name, us] of top) {
  const ms = us / 1000
  console.log(`    ${(ms / SECONDS).toFixed(1).padStart(6)}ms/s   ${(ms).toFixed(1).padStart(8)}ms total   ${name}`)
}
