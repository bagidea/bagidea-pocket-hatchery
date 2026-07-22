import { chromium } from 'playwright'
const URL = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1280,900'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="farm-agent"]').length >= 21, null, { timeout: 15000 })
await page.waitForTimeout(1500)
async function measure(ms = 2500) {
  return await page.evaluate((dur) => new Promise((res) => {
    const fr = []; let last = 0, raf = 0
    const t = (ts) => { if (last) fr.push(ts - last); last = ts; raf = requestAnimationFrame(t) }
    raf = requestAnimationFrame(t)
    setTimeout(() => { cancelAnimationFrame(raf)
      const avg = fr.reduce((s, x) => s + x, 0) / (fr.length || 1)
      res({ avg: +avg.toFixed(1), long50: fr.filter((f) => f > 50).length, worst: +Math.max(0, ...fr).toFixed(1) }) }, dur)
  }), ms)
}
async function css(id, text) { await page.evaluate(({ id, text }) => {
  let s = document.getElementById(id); if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s) } s.textContent = text }, { id, text }) }
async function clearCss(id) { await page.evaluate((id) => document.getElementById(id)?.remove(), id) }

const r = {}
r.baseline = await measure()
// A) hide the sprite SVGs entirely (keeps agents moving, boxes empty) -> isolates SVG raster
await css('a', '[data-testid="farm-agent"] svg { visibility: hidden !important; }'); r.sprites_hidden = await measure(); await clearCss('a')
// B) promote .sprite itself to its own cached layer (will-change on the filtered node)
await css('b', '[data-testid="farm-agent"] svg { will-change: transform; transform: translateZ(0); }'); r.sprite_own_layer = await measure(); await clearCss('b')
// C) content-visibility auto on agents
await css('c', '[data-testid="farm-agent"] { content-visibility: auto; }'); r.content_vis = await measure(); await clearCss('c')
// D) freeze the sim so no transforms are written (patch rAF-driven writes off)
await page.evaluate(() => { window.__origRAF = window.requestAnimationFrame; window.requestAnimationFrame = () => 0 })
r.sim_frozen = await measure()
await page.evaluate(() => { window.requestAnimationFrame = window.__origRAF })
console.log(JSON.stringify(r, null, 2))
await browser.close()
