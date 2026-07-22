/**
 * farm-probe.mjs — empirical culprit isolation on real GPU.
 * Loads the farm once, then measures rAF frame-time under a series of live
 * mutations. Whichever mutation collapses frame-time names the true cost.
 */
import { chromium } from 'playwright'

const URL = process.argv[2]
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1280,900'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="farm-agent"]').length >= 21, null, { timeout: 15000 })
await page.waitForTimeout(1500)

async function measure(ms = 2500) {
  return await page.evaluate((dur) => new Promise((res) => {
    const fr = []; let last = 0, raf = 0
    const t = (ts) => { if (last) fr.push(ts - last); last = ts; raf = requestAnimationFrame(t) }
    raf = requestAnimationFrame(t)
    setTimeout(() => {
      cancelAnimationFrame(raf)
      const avg = fr.reduce((s, x) => s + x, 0) / (fr.length || 1)
      const long = fr.filter((f) => f > 50).length
      res({ n: fr.length, avg: +avg.toFixed(1), long50: long, worst: +Math.max(0, ...fr).toFixed(1) })
    }, dur)
  }), ms)
}

async function css(id, text) {
  await page.evaluate(({ id, text }) => {
    let s = document.getElementById(id)
    if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s) }
    s.textContent = text
  }, { id, text })
}
async function clearCss(id) { await page.evaluate((id) => document.getElementById(id)?.remove(), id) }

const results = {}
results.baseline = await measure()

// 1) strip SVG-INTERNAL filters (the feGaussianBlur/feMerge glows inside each sprite)
await css('p-svgfilter', '[data-testid="farm-agent"] svg * { filter: none !important; }')
results.no_internal_svg_filters = await measure()
await clearCss('p-svgfilter')

// 2) strip the CSS mood filter (saturate/brightness on hungry/starving/asleep)
await css('p-mood', '[data-testid="farm-agent"] > div > div > div { filter: none !important; }')
results.no_css_mood_filter = await measure()
await clearCss('p-mood')

// 3) hide the zzz keyframe
await css('p-zzz', '[data-testid="farm-agent"] span { animation: none !important; }')
results.no_zzz_anim = await measure()
await clearCss('p-zzz')

// 4) drop will-change on agents
await css('p-wc', '[data-testid="farm-agent"] { will-change: auto !important; }')
results.no_will_change = await measure()
await clearCss('p-wc')

// 5) hide contact shadow (radial-gradient ellipse)
await css('p-sh', '[data-testid="farm-agent"] > span { display: none !important; }')
results.no_shadow = await measure()
await clearCss('p-sh')

// 6) BOTH internal + mood filters off (all filters gone)
await css('p-all', '[data-testid="farm-agent"] svg *, [data-testid="farm-agent"] * { filter: none !important; }')
results.no_any_filter = await measure()
await clearCss('p-all')

console.log(JSON.stringify(results, null, 2))
await browser.close()
