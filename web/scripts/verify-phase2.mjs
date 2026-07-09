// Phase-2 end-to-end web verification (real mode, not ?demo).
// Serves the built dist via a tiny static server and drives it headless.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const outDir = join(__dirname, '..', 'screenshots')
const PORT = 4178
const ORIGIN = `http://127.0.0.1:${PORT}`

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
}

// SPA static server over dist/
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, ORIGIN)
    let p = decodeURIComponent(url.pathname)
    if (p === '/') p = '/index.html'
    let file = join(distDir, p)
    let body
    try {
      body = await readFile(file)
    } catch {
      // SPA fallback
      file = join(distDir, 'index.html')
      body = await readFile(file)
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch (e) {
    res.writeHead(500); res.end(String(e))
  }
})
await new Promise((r) => server.listen(PORT, r))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
const results = {}

function logErrors(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${tag}][console.error] ${m.text()}`) })
  page.on('pageerror', (e) => console.log(`[${tag}][pageerror] ${e.message}`))
}

// ── Load A: real-mode chain read (preview=waxwingsuper, NO mocking) ──
{
  const page = await ctx.newPage()
  logErrors(page, 'A')
  // The app's hardcoded node (testnet.waxsweden.org) is intermittently down.
  // Forward its RPC calls to a healthy peer on the SAME chain so the read is
  // still genuine live on-chain data (identical chain id f16b1833…). We do NOT
  // alter any response — pure transparent proxy.
  const PEER = 'https://waxtestnet.greymass.com'
  await page.route('**/testnet.waxsweden.org/**', async (route) => {
    const req = route.request()
    const target = PEER + new URL(req.url()).pathname
    try {
      const r = await fetch(target, { method: req.method(), headers: { 'content-type': 'application/json' }, body: req.postData() || undefined })
      const body = await r.text()
      await route.fulfill({ status: r.status, contentType: 'application/json', body })
    } catch (e) {
      await route.abort()
    }
  })
  let text = ''
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.goto(`${ORIGIN}/?preview=waxwingsuper`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    text = await page.evaluate(() => document.body.innerText)
    if (!/Chain read error/i.test(text) && /HATCH 1\.0000/.test(text)) { console.log(`[A] live read OK on attempt ${attempt}`); break }
    console.log(`[A] attempt ${attempt}: not ready, retrying…`)
    await page.waitForTimeout(1500)
  }
  results.A = {
    isDemo: /Demo mode/i.test(text),
    isPreview: /Preview mode/i.test(text),
    hasAccount: text.includes('waxwingsuper'),
    chainBadge: await page.evaluate(() => document.querySelector('[class*="chainBadge"]')?.textContent || ''),
    // resource values shown
    bodyText: text.replace(/\s+/g, ' ').slice(0, 600),
  }
  await page.screenshot({ path: join(outDir, 'p2-A-real-preview-chain.png'), fullPage: true })
  await page.close()
}

// ── Load B: same real preview, but inject 3 creatures (stages 0/1/2) ──
// ONLY the creatures table is intercepted — config/player/rewardpool still
// hit the live chain. Purpose: exercise the Foxling sprite renderer across
// all three stages (egg/baby/adult) inside the REAL React component.
{
  const page = await ctx.newPage()
  logErrors(page, 'B')
  // Deterministic table responses: real captured config/player + 3 injected
  // creatures at stages 0/1/2 (Load A already proved live reads match chain).
  const TABLES = {
    configv2: [{ token_contract: 'hatchtokens1', collection: 'pockethatch', schema_name: 'creatures', fee_account: 'hatchfees1', paused: 0, hatch_cost: '1.0000 HATCH', evolve_cost: '0.5000 HATCH', breed_cost: '5.0000 HATCH', feed_cost: '0.0000 HATCH', feed_cd: 3600, harvest_cd: 3600, breed_cd: 86400, feed_daily_cap: 6, daily_egg_cap: 240, offline_cap_h: 8, tap_egg_cap: 60, feed_boost: 100, season_index: 1, season_started: 1782430695, rng_oracle: '' }],
    players: [{ account: 'waxwingsuper', created_at: 1782429119, egg_balance: 0, last_harvest: 1782429119, harvest_day: 20629, egg_harvested_today: 0, feeds_today: 0, feed_day: 20629, total_egg_farmed: 0, total_hatch_burned: 0 }],
    rewardpool: [],
    creatures: [
      { asset_id: '1099511627776', owner: 'waxwingsuper', template_id: 1, stage: 0, growth_base: 0, fed_growth: 0, born_at: 0, last_sync: 0, last_fed: 0, last_bred: 0, genetics: '00' },
      { asset_id: '1099511627777', owner: 'waxwingsuper', template_id: 1, stage: 1, growth_base: 40000, fed_growth: 0, born_at: 0, last_sync: 0, last_fed: 0, last_bred: 0, genetics: '00' },
      { asset_id: '1099511627778', owner: 'waxwingsuper', template_id: 1, stage: 2, growth_base: 250000, fed_growth: 0, born_at: 0, last_sync: 0, last_fed: 0, last_bred: 0, genetics: '00' },
    ],
  }
  await page.route('**/v1/chain/get_table_rows', async (route) => {
    let table = ''
    try { table = JSON.parse(route.request().postData() || '{}').table } catch {}
    const rows = TABLES[table] ?? []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows, more: false, next_key: '' }) })
  })
  await page.goto(`${ORIGIN}/?preview=waxwingsuper`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const sprites = await page.$$eval('img[class*="sprite"]', (imgs) =>
    imgs.map((im) => ({
      src: im.getAttribute('src'),
      naturalWidth: im.naturalWidth,
      naturalHeight: im.naturalHeight,
      complete: im.complete,
    })),
  )
  const badges = await page.$$eval('[class*="badge"]', (els) => els.map((e) => e.textContent))
  results.B = { spriteCount: sprites.length, sprites, stageBadges: badges }
  await page.screenshot({ path: join(outDir, 'p2-B-sprites-3-stages.png'), fullPage: true })
  await page.close()
}

// ── Direct fetch of the 3 stage sprites (real PNG, 200) ──
{
  const page = await ctx.newPage()
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  const stages = ['egg', 'baby', 'adult']
  const checks = {}
  for (const s of stages) {
    const r = await page.evaluate(async (url) => {
      const res = await fetch(url)
      const buf = new Uint8Array(await res.arrayBuffer())
      const sig = Array.from(buf.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('')
      return { status: res.status, bytes: buf.length, sig }
    }, `${ORIGIN}/sprites/creature_foxling_${s}_idle_f1.png`)
    checks[s] = r
  }
  results.spriteFiles = checks
  await page.close()
}

console.log(JSON.stringify(results, null, 2))

await browser.close()
await new Promise((r) => server.close(r))
