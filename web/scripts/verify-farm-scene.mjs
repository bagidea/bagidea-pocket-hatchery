// Living-farm verification — proves the farm engine on the REAL connected
// dashboard (the surface the CEO plays: "Connect via waxwing" as waxwingsuper).
//
// Two passes, because one alone can't prove both halves:
//
//   PASS 1 · LIVE   — no interception whatsoever. Every table (creatrsv2,
//                     configv3, spccfgv2, players, rewardpool) is the real chain.
//                     Proves the farm is populated from real owned creatures and
//                     that they actually walk.
//   PASS 2 · MOODS  — intercepts ONLY creatrsv2 to inject a stage-0 sleeper and a
//                     long-unfed (starving) creature. waxwingsuper's 19 on-chain
//                     creatures are ALL awake and recently fed, so a live read
//                     cannot exercise the asleep/starving branches. Every other
//                     table still hits the real chain, so awaken_dur / fed_dur are
//                     live configv3 values — only the creatures' existence is
//                     crafted, never the timing rules.
//
// Usage: node verify-farm-scene.mjs <baseUrl>
//   e.g. node verify-farm-scene.mjs http://127.0.0.1:8787/plugin/pocket-hatchery/
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

/** Read every farm agent's live transform straight off the DOM. */
const readAgents = (page) =>
  page.$$eval('[data-testid="farm-agent"]', (els) =>
    els.map((e) => {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(e.style.transform || '')
      return {
        asset: e.getAttribute('data-asset'),
        mood: e.getAttribute('data-mood'),
        x: m ? parseFloat(m[1]) : NaN,
        y: m ? parseFloat(m[2]) : NaN,
        z: parseInt(e.style.zIndex || '0', 10),
      }
    }))

/**
 * Point the panel's connect at waxwingsuper (the account that actually owns
 * creatures on chain) WITHOUT touching the office wallet's real selection —
 * waxwing's live `selected` account is phgamecreatr, the contract account, and
 * flipping it would disturb whoever else is using the wallet. So we rewrite only
 * the `selected` flag in the wallet's own status reply; the account is real, its
 * keys are real, and every chain read below still goes to the real chain.
 */
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

/** Connect as waxwingsuper and open the Farm tab. */
async function openFarm(page) {
  await useWaxwingsuper(page)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
  await page.click('button:has-text("Farm")')
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.waitForTimeout(1200) // sprites resolve + first frames run
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
  return { page, errors }
}

const browser = await chromium.launch({ headless: true })

// ══ PASS 1 — LIVE chain, zero interception ══════════════════════════════════
try {
  console.log(`\n═══ PASS 1 · LIVE chain (no interception) — ${PANEL} ═══`)
  const { page, errors } = await newPage(browser)

  // Prove the creature rows really came off chain: capture the raw RPC reply.
  let liveRows = null
  page.on('response', async (res) => {
    if (!res.url().includes('/v1/chain/get_table_rows')) return
    try {
      const req = JSON.parse(res.request().postData() || '{}')
      if (req.table === 'creatrsv2') {
        const body = await res.json()
        liveRows = body.rows.filter((r) => r.owner === 'waxwingsuper')
      }
    } catch { /* not our read */ }
  })

  await openFarm(page)

  const t0 = await readAgents(page)
  console.log(`① Farm rendered ${t0.length} agents · chain returned ${liveRows?.length ?? '?'} creatrsv2 rows for waxwingsuper`)
  check('① agents come from the REAL creatrsv2 read (count matches the chain rows)',
    liveRows !== null && t0.length === liveRows.length, `agents=${t0.length} rows=${liveRows?.length}`)
  check('① every agent carries a real on-chain asset_id',
    t0.length > 0 && t0.every((a) => liveRows.some((r) => r.asset_id === a.asset)),
    JSON.stringify(t0.slice(0, 3)))

  // Movement: sample twice and demand real displacement.
  await page.waitForTimeout(3000)
  const t1 = await readAgents(page)
  const moved = t1.filter((a) => {
    const b = t0.find((p) => p.asset === a.asset)
    return b && Math.hypot(a.x - b.x, a.y - b.y) > 3
  })
  console.log(`② ${moved.length}/${t1.length} creatures changed position over 3s`)
  check('② creatures actually walk (most moved within 3s)', moved.length >= Math.ceil(t1.length * 0.5),
    `moved=${moved.length}/${t1.length}`)

  // Depth: z-order must follow the feet's y — lower on screen = in front.
  // The y we can read here is the sprite's painted top, which carries the walk
  // BOB (a few px of gait) on top of the feet position z is derived from. So only
  // pairs separated by more than the bob are a real depth ordering to assert;
  // inside that band the two creatures are at the same depth by eye anyway.
  const BOB_PX = 8
  const sorted = [...t1].sort((a, b) => a.y - b.y)
  const inversions = []
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++)
      if (sorted[j].y - sorted[i].y > BOB_PX && sorted[j].z < sorted[i].z)
        inversions.push({ back: Math.round(sorted[i].y), front: Math.round(sorted[j].y) })
  check('③ z-order follows the Y axis (lower creature = drawn in front)', inversions.length === 0,
    JSON.stringify(inversions))

  // Spacing: no creature-blob.
  let worst = Infinity
  for (let i = 0; i < t1.length; i++)
    for (let j = i + 1; j < t1.length; j++)
      worst = Math.min(worst, Math.hypot(t1[i].x - t1[j].x, (t1[i].y - t1[j].y) * 1.6))
  console.log(`④ closest pair on the farm: ${worst === Infinity ? 'n/a' : worst.toFixed(1)}px`)
  check('④ creatures keep their distance (no overlapping blob)', t1.length < 2 || worst > 30,
    `closest=${worst.toFixed(1)}`)

  check('⑤ no runtime errors on the page', errors.length === 0, errors.join(' | '))

  // Shoot the stage itself — the farm sits below the fold on a 900px viewport.
  await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await (await page.$('[data-testid="farm-stage"]')).screenshot({ path: join(outDir, 'farm-live.png') })
  console.log('  📸 screenshots → farm-live.png')
  await page.close()
} catch (e) {
  fail++
  console.log(`  ❌ PASS 1 threw: ${e.message}`)
}

// ══ PASS 2 — mood binding (only creatrsv2 crafted) ══════════════════════════
try {
  console.log(`\n═══ PASS 2 · mood binding (creatrsv2 crafted, all other tables LIVE) ═══`)
  const { page, errors } = await newPage(browser)

  // Real genetics cloned from an on-chain waxwingsuper creature so the sprite +
  // gene decode path runs for real.
  const GENE = '036b0eacc068ea55c4270ae4a036821fcf234ad54c6572154d5765baed2ab965'
  const now = Math.floor(Date.now() / 1000)
  const CRAFT = [
    { // ASLEEP — stage 0, mid sleep timer → must lie still
      asset_id: '1150000000001', owner: 'waxwingsuper', template_id: 662889, stage: 0,
      growth_base: 0, fed_growth: 0, born_at: now - 900, last_sync: now, last_fed: 0, last_bred: 0, genetics: GENE,
    },
    { // STARVING — awake, unfed for 30 days → satiety 0
      asset_id: '1150000000002', owner: 'waxwingsuper', template_id: 662978, stage: 2,
      growth_base: 1500, fed_growth: 100, born_at: now - 3000000, last_sync: now, last_fed: now - 2592000, last_bred: 0, genetics: GENE,
    },
    { // CONTENT — awake, just fed → full satiety
      asset_id: '1150000000003', owner: 'waxwingsuper', template_id: 662978, stage: 2,
      growth_base: 1500, fed_growth: 100, born_at: now - 3000000, last_sync: now, last_fed: now - 60, last_bred: 0, genetics: GENE,
    },
  ]

  await page.route('**/v1/chain/get_table_rows', async (route) => {
    let table = ''
    try { table = JSON.parse(route.request().postData() || '{}').table } catch { /* ignore */ }
    if (table === 'creatrsv2') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ rows: CRAFT, more: false, next_key: '' }) })
    } else {
      await route.continue()
    }
  })

  await openFarm(page)

  const a0 = await readAgents(page)
  const moodOf = (id) => a0.find((a) => a.asset === id)?.mood
  console.log(`⑥ moods read from chain fields: ${a0.map((a) => `${a.asset.slice(-1)}=${a.mood}`).join(' ')}`)
  check('⑥ stage 0 (never woken) → asleep', moodOf('1150000000001') === 'asleep', String(moodOf('1150000000001')))
  check('⑥ awake + unfed 30d → starving', moodOf('1150000000002') === 'starving', String(moodOf('1150000000002')))
  check('⑥ awake + just fed → content', moodOf('1150000000003') === 'content', String(moodOf('1150000000003')))

  // The load-bearing one: a sleeper must NOT walk while the fed one does.
  //
  // Measured as PATH LENGTH — the sum of every step across the window — not the
  // straight line from first to last sample. A roamer that wanders out and back
  // ends near where it started, so net displacement scores it as "didn't move"
  // and the fed-vs-starving comparison becomes a coin flip. Distance walked is
  // what "roams further" actually means; path length is the thing that measures it.
  const SAMPLE_MS = 200, WINDOW_MS = 6000
  const path = new Map(a0.map((a) => [a.asset, 0]))
  let prev = a0
  for (let t = 0; t < WINDOW_MS; t += SAMPLE_MS) {
    await page.waitForTimeout(SAMPLE_MS)
    const cur = await readAgents(page)
    for (const a of cur) {
      const b = prev.find((p) => p.asset === a.asset)
      if (b) path.set(a.asset, (path.get(a.asset) ?? 0) + Math.hypot(a.x - b.x, a.y - b.y))
    }
    prev = cur
  }
  const dSleep = path.get('1150000000001'), dStarve = path.get('1150000000002'), dContent = path.get('1150000000003')
  console.log(`⑦ distance walked over ${WINDOW_MS / 1000}s (path length, ${SAMPLE_MS}ms samples) — asleep ${dSleep.toFixed(1)}px · starving ${dStarve.toFixed(1)}px · content ${dContent.toFixed(1)}px`)
  // The sleeper may be nudged a few px by a neighbour's separation push; what it
  // must never do is walk. Its own gait is zero.
  check('⑦ the asleep creature does NOT walk', dSleep < 12, `walked ${dSleep.toFixed(1)}px`)
  check('⑦ the fed creature roams further than the starving one', dContent > dStarve,
    `content=${dContent.toFixed(1)} starving=${dStarve.toFixed(1)}`)

  const zzz = await page.$$eval('[data-mood="asleep"]', (els) => els.length)
  check('⑧ the sleeper is visibly marked asleep in the scene', zzz >= 1, `got ${zzz}`)
  check('⑨ no runtime errors on the page', errors.length === 0, errors.join(' | '))

  await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  await (await page.$('[data-testid="farm-stage"]')).screenshot({ path: join(outDir, 'farm-moods.png') })
  console.log('  📸 screenshots → farm-moods.png')
  await page.close()
} catch (e) {
  fail++
  console.log(`  ❌ PASS 2 threw: ${e.message}`)
}

await browser.close()
console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
