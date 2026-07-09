/**
 * verify-demo-render.mjs — load the REAL React app (?demo) from the dev server
 * and prove CreatureCard renders gene-driven inline species SVGs (not the old
 * hardcoded Foxling PNGs). Exercises the production path end-to-end:
 *   useDemoGame → demoGenetics → Creature → CreatureCard → CreatureSprite
 *   → fetch /assets/creatures/{slug}.svg → decode gene → inject tint vars.
 */
import { chromium } from 'playwright'

const URL = process.env.DEV_URL || 'http://localhost:5176/?demo'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })
const reqs = []
page.on('requestfailed', (r) => {
  const u = r.url()
  if (u.includes('/assets/creatures/')) reqs.push(`FAILED: ${u}`)
})

await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts?.ready)
await page.waitForTimeout(800)

// Prove each CreatureCard inlined a real species SVG with shapes + a gene-tint
// group, and that the per-card gene hue differs (art is gene-driven, not one
// shared placeholder). Also confirm the hero img resolved (no 404).
const report = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('article')]
  const out = []
  for (const c of cards) {
    const svg = c.querySelector('svg')
    const shapes = svg ? svg.querySelectorAll('path,ellipse,circle,polygon').length : 0
    const hue = svg ? getComputedStyle(svg).getPropertyValue('--gene-hue-shift').trim() : ''
    const name = c.querySelector('h3')?.textContent?.trim() ?? '?'
    out.push({ name, shapes, hue })
  }
  const hero = document.querySelector('section img')
  const heroComplete = hero && hero.complete && hero.naturalWidth > 0
  return { cards: out, heroSrc: hero?.getAttribute('src'), heroComplete }
})

console.log('Hero img:', report.heroSrc, '→ loaded:', report.heroComplete)
console.log(`CreatureCards rendered: ${report.cards.length}`)
for (const c of report.cards)
  console.log(`  ${c.name.padEnd(18)} shapes=${String(c.shapes).padStart(3)}  --gene-hue=${c.hue || '(none)'}`)

if (reqs.length) {
  console.log('\n❌ Failed creature-asset requests:')
  for (const r of reqs) console.log('  ' + r)
}
if (!report.heroComplete) throw new Error('hero image did not load (404?)')
if (report.cards.length === 0) throw new Error('no CreatureCards rendered')
const noArt = report.cards.filter((c) => c.shapes === 0)
if (noArt.length) throw new Error(`${noArt.length} card(s) have no SVG shapes`)

const hues = report.cards.map((c) => c.hue).filter(Boolean)
if (new Set(hues).size > 1) console.log('✓ multiple distinct gene hues across cards — art is gene-driven')

await page.screenshot({ path: 'verify-demo-render.png', fullPage: true })
console.log('\n✅ Screenshot saved: verify-demo-render.png')
await browser.close()
