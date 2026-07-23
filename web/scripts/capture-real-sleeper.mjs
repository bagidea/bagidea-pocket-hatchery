// Capture the REAL on-chain sleeper (asset 1099603752175, waxwingsuper, stage=0)
// standing in its asleep pose amid the awake herd on the connected FarmScene.
//
// NOTHING is crafted. creatrsv2 is NOT intercepted — every creature row comes
// straight off the real chain. The asleep classification is the app's own
// moodFor() reading the real `stage` field; this script only observes and shoots.
// The only thing rewritten is the wallet's `selected` flag in its status reply,
// so the panel connects AS waxwingsuper without disturbing the office wallet's
// live selection (phgamecreatr). Account + keys + every chain read stay real.
//
// Usage: node capture-real-sleeper.mjs <baseUrl>
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const SLEEPER = '1099603752175'

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

async function attempt() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

  // Prove the sleeper row is REAL: capture the raw creatrsv2 RPC reply.
  let sleeperRow = null, liveCount = 0
  page.on('response', async (res) => {
    if (!res.url().includes('/v1/chain/get_table_rows')) return
    try {
      const req = JSON.parse(res.request().postData() || '{}')
      if (req.table !== 'creatrsv2') return
      const body = await res.json()
      const mine = body.rows.filter((r) => r.owner === 'waxwingsuper')
      if (mine.length) liveCount = mine.length
      const s = mine.find((r) => String(r.asset_id) === SLEEPER)
      if (s) sleeperRow = s
    } catch { /* not our read */ }
  })

  await useWaxwingsuper(page)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
  await page.click('button:has-text("Farm")')
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.waitForTimeout(1500) // sprites resolve + first frames

  const agents = await readAgents(page)
  const sleeper = agents.find((a) => a.asset === SLEEPER)

  console.log(`\n── REAL chain read ──`)
  console.log(`  creatrsv2 rows for waxwingsuper (from live RPC): ${liveCount}`)
  console.log(`  raw sleeper row off chain: ${sleeperRow ? `asset_id=${sleeperRow.asset_id} stage=${sleeperRow.stage} owner=${sleeperRow.owner}` : 'NOT SEEN'}`)
  console.log(`  farm rendered ${agents.length} agents`)
  console.log(`  sleeper 2175 in DOM: ${sleeper ? `mood=${sleeper.mood}` : 'MISSING'}`)

  const others = agents.filter((a) => a.asset !== SLEEPER)
  const awakeMoods = new Set(others.map((a) => a.mood))
  console.log(`  other creatures' moods: ${[...awakeMoods].join(', ')} (${others.length} creatures)`)

  // ── assertions on REAL data ──
  const fails = []
  if (String(sleeperRow?.stage) !== '0') fails.push(`sleeper stage on chain != 0 (${sleeperRow?.stage})`)
  if (sleeperRow?.owner !== 'waxwingsuper') fails.push(`sleeper owner != waxwingsuper`)
  if (!sleeper) fails.push('sleeper 2175 not rendered on farm')
  if (sleeper && sleeper.mood !== 'asleep') fails.push(`sleeper mood=${sleeper.mood}, expected asleep`)
  if (others.some((a) => a.mood === 'asleep')) fails.push('an awake (stage>=1) creature was classified asleep')

  // Motion truth: sleeper must NOT walk, the herd must.
  const SAMPLE_MS = 200, WINDOW_MS = 5000
  const path = new Map(agents.map((a) => [a.asset, 0]))
  let prev = agents
  for (let t = 0; t < WINDOW_MS; t += SAMPLE_MS) {
    await page.waitForTimeout(SAMPLE_MS)
    const cur = await readAgents(page)
    for (const a of cur) {
      const b = prev.find((p) => p.asset === a.asset)
      if (b) path.set(a.asset, (path.get(a.asset) ?? 0) + Math.hypot(a.x - b.x, a.y - b.y))
    }
    prev = cur
  }
  const dSleep = path.get(SLEEPER) ?? 0
  const walkers = others.filter((a) => (path.get(a.asset) ?? 0) > 20).length
  console.log(`  sleeper walked ${dSleep.toFixed(1)}px over ${WINDOW_MS / 1000}s · ${walkers}/${others.length} of the herd walked`)
  if (dSleep >= 12) fails.push(`sleeper walked ${dSleep.toFixed(1)}px (should stay put)`)
  if (walkers < Math.ceil(others.length * 0.5)) fails.push(`only ${walkers}/${others.length} of the herd walked`)
  if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`)

  // ── shots ──
  await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(500)
  const stage = await page.$('[data-testid="farm-stage"]')
  await stage.screenshot({ path: join(outDir, 'farm-real-sleeper.png') })

  // Tight crop centred on the sleeper so its Zzz + still pose read clearly.
  const box = await page.$eval(`[data-asset="${SLEEPER}"]`, (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const pad = 90
  await page.screenshot({
    path: join(outDir, 'farm-real-sleeper-crop.png'),
    clip: {
      x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
      width: box.w + pad * 2, height: box.h + pad * 2,
    },
  })
  console.log('  📸 farm-real-sleeper.png · farm-real-sleeper-crop.png')

  await page.close()
  await browser.close()
  return { fails, liveCount, dSleep, walkers, otherCount: others.length }
}

// Retry loop — ERR_NO_BUFFER_SPACE is a host network-buffer hiccup, not our code.
let res = null
for (let i = 1; i <= 4; i++) {
  try {
    res = await attempt()
    break
  } catch (e) {
    const transient = /ERR_NO_BUFFER_SPACE|ERR_NETWORK|Timeout|net::/i.test(e.message)
    console.log(`  ⚠️ attempt ${i} threw: ${e.message}${transient ? ' — retrying' : ''}`)
    if (i === 4 || !transient) { console.log('❌ giving up'); process.exit(1) }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

console.log(`\n${res.fails.length === 0 ? '✅ PASS' : '❌ FAIL'} — real sleeper capture`)
if (res.fails.length) { res.fails.forEach((f) => console.log(`  ❌ ${f}`)); process.exit(1) }
console.log(`  real sleeper 2175 (stage 0) rendered asleep & still among ${res.walkers}/${res.otherCount} walking herd, from ${res.liveCount} live chain rows`)
process.exit(0)
