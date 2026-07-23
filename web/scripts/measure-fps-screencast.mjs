// Trustworthy farm FPS via CDP screencast — counts frames the COMPOSITOR actually
// produces, not requestAnimationFrame callbacks (which Chrome throttles hard for a
// non-focused / headless page, so an rAF clock reads ~8fps on a farm that is really
// running at 60). Page.screencastFrame fires once per committed compositor frame,
// capped at the display rate, so frame count / wall-time is the real render FPS.
//
// Same real connected farm as the other scripts (waxwingsuper, 21 on-chain
// creatures: ~14 walkers + a stage-0 sleeper's Zzz + every creature's contact
// shadow). Nothing crafted; only the wallet `selected` flag is rewritten.
//
// Usage: [FPS_CHANNEL=chrome] node measure-fps-screencast.mjs [baseUrl] [seconds]
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
const CHANNEL = process.env.FPS_CHANNEL || ''
const GPU_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11']

const readAgents = (page) =>
  page.$$eval('[data-testid="farm-agent"]', (els) =>
    els.map((e) => {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(e.style.transform || '')
      return { asset: e.getAttribute('data-asset'), mood: e.getAttribute('data-mood'),
        x: m ? parseFloat(m[1]) : NaN, y: m ? parseFloat(m[2]) : NaN }
    }))

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

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] }

async function attempt() {
  const browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}), args: GPU_ARGS })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
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
  await page.waitForTimeout(1500)

  const agents = await readAgents(page)
  const n = agents.length, sleepers = agents.filter((a) => a.mood === 'asleep').length

  // Shadow contract.
  const shadow = await page.evaluate(() => {
    let gradientCount = 0, total = 0, agentBoxShadows = 0
    for (const ag of document.querySelectorAll('[data-testid="farm-agent"]')) {
      total++
      if (getComputedStyle(ag).boxShadow !== 'none') agentBoxShadows++
      const sh = ag.querySelector('span[aria-hidden="true"]')
      if (sh && /radial-gradient/.test(getComputedStyle(sh).backgroundImage)) gradientCount++
    }
    return { total, gradientCount, agentBoxShadows }
  })

  // ── Real compositor FPS via screencast ─────────────────────────────────────
  const client = await page.context().newCDPSession(page)
  const stamps = []
  client.on('Page.screencastFrame', async (f) => {
    stamps.push(f.metadata.timestamp) // seconds, compositor commit time
    try { await client.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch { /* closing */ }
  })
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 30, everyNthFrame: 1 })
  await page.waitForTimeout(SECONDS * 1000)
  await client.send('Page.stopScreencast').catch(() => {})

  const deltas = []
  for (let i = 1; i < stamps.length; i++) { const dt = (stamps[i] - stamps[i - 1]) * 1000; if (dt > 0 && dt < 2000) deltas.push(dt) }
  const span = stamps.length > 1 ? stamps[stamps.length - 1] - stamps[0] : 0
  const fps = span > 0 ? (stamps.length - 1) / span : 0
  const mean = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1)
  const p95 = pct(deltas, 95), worst = Math.max(0, ...deltas)
  const over20 = deltas.filter((d) => d > 20).length
  const over32 = deltas.filter((d) => d > 32).length

  // Prove the herd moved during the window.
  const after = await readAgents(page)
  const moved = after.filter((a) => { const b = agents.find((p) => p.asset === a.asset); return b && Math.hypot(a.x - b.x, a.y - b.y) > 3 }).length

  // Shots.
  const stage = await page.$('[data-testid="farm-stage"]')
  await stage.screenshot({ path: join(outDir, 'farm-shadows.png') })
  const sleeper = await page.$('[data-mood="asleep"]')
  if (sleeper) {
    const box = await sleeper.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
    const pad = 70
    await page.screenshot({ path: join(outDir, 'farm-shadows-crop.png'),
      clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: box.h + pad * 2 } })
  }

  await page.close(); await browser.close()
  return { n, sleepers, moved, frames: stamps.length, fps, mean, p95, worst, over20, over32, shadow, errors }
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

console.log(`\n══ Farm compositor FPS (CDP screencast) — ${r.n} real creatures (${r.moved} moving, ${r.sleepers} asleep) ══`)
console.log(`  compositor frames: ${r.frames} over ~${SECONDS}s`)
console.log(`  real FPS:          ${r.fps.toFixed(1)}`)
console.log(`  mean frame:        ${r.mean.toFixed(2)}ms`)
console.log(`  frame time p95:    ${r.p95.toFixed(2)}ms`)
console.log(`  worst frame:       ${r.worst.toFixed(1)}ms`)
console.log(`  frames > 20ms:     ${r.over20}  (${(100 * r.over20 / (r.frames - 1 || 1)).toFixed(1)}%)`)
console.log(`  frames > 32ms:     ${r.over32}  (visible hitches)`)
console.log(`  shadow: ${r.shadow.gradientCount}/${r.shadow.total} radial-gradient · box-shadow on agents: ${r.shadow.agentBoxShadows}`)
console.log(`  📸 farm-shadows.png · farm-shadows-crop.png`)

const fails = []
if (r.n < 20) fails.push(`only ${r.n} creatures (expected ~21)`)
if (r.moved < Math.ceil(r.n * 0.5)) fails.push(`only ${r.moved}/${r.n} moved`)
if (r.shadow.gradientCount < r.n) fails.push(`${r.n - r.shadow.gradientCount} creatures missing a radial-gradient shadow`)
if (r.shadow.agentBoxShadows > 0) fails.push(`${r.shadow.agentBoxShadows} agent(s) use box-shadow (banned)`)
if (r.fps < 55) fails.push(`real FPS ${r.fps.toFixed(1)} < 55`)
if (r.over32 > (r.frames - 1) * 0.02) fails.push(`${r.over32} hitching frames`)
if (r.errors.length) fails.push(`page errors: ${r.errors.join(' | ')}`)

console.log(`\n${fails.length === 0 ? '✅ PASS' : '❌ FAIL'} — 60fps with the full herd + shadows`)
if (fails.length) { fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exit(1) }
process.exit(0)
