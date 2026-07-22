import { chromium } from 'playwright'
const URL = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1280,900'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="farm-agent"]').length >= 21, null, { timeout: 15000 })
await page.waitForTimeout(1500)
async function measure(ms = 3000) {
  return await page.evaluate((dur) => new Promise((res) => {
    const fr = []; let last = 0, raf = 0
    const t = (ts) => { if (last) fr.push(ts - last); last = ts; raf = requestAnimationFrame(t) }
    raf = requestAnimationFrame(t)
    setTimeout(() => { cancelAnimationFrame(raf)
      const avg = fr.reduce((s, x) => s + x, 0) / (fr.length || 1)
      res({ avg: +avg.toFixed(1), long50: fr.filter((f) => f > 50).length, worst: +Math.max(0, ...fr).toFixed(1) }) }, dur)
  }), ms)
}
const r = {}
r.baseline = await measure()

// FIX candidate: rasterize each inline sprite SVG to a bitmap <img> ONCE, replace the
// live SVG with it. Static image on a composited layer = cached texture = no re-raster.
await page.evaluate(async () => {
  const holders = [...document.querySelectorAll('[data-testid="farm-agent"] .' + [...document.querySelectorAll('[data-testid="farm-agent"] div')].find(d => d.querySelector('svg'))?.className || '')]
  const spriteDivs = [...document.querySelectorAll('[data-testid="farm-agent"] div')].filter(d => d.firstElementChild && d.firstElementChild.tagName === 'svg')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  for (const div of spriteDivs) {
    const svg = div.firstElementChild
    const rect = svg.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height))
    const xml = new XMLSerializer().serializeToString(svg)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url })
    const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); try { ctx.drawImage(img, 0, 0, w, h) } catch {}
    const out = document.createElement('img')
    out.src = c.toDataURL('image/png'); out.style.width = '100%'; out.style.height = '100%'; out.style.display = 'block'
    div.replaceChildren(out)
  }
})
await page.waitForTimeout(500)
r.sprites_rasterized_to_bitmap = await measure()
console.log(JSON.stringify(r, null, 2))
await browser.close()
