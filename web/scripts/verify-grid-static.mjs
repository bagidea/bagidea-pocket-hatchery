// Verify the collection-grid perf fix on the LIVE deployed panel:
//   1) at rest, grid sprites are baked <img> bitmaps (no live SMIL/filter SVG)
//   2) on hover, the hovered card swaps to a live inline <svg>
//   3) other cards stay static (only the hovered one goes live)
import { chromium } from 'playwright'

const PANEL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?demo'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(PANEL, { waitUntil: 'networkidle' })

// The demo grid renders a few cards. Wait for sprites to bake (img.staticSprite).
await page.waitForSelector('article', { timeout: 15000 })
await page.waitForTimeout(1500) // let bakes land

const staticImgs = await page.locator('img[class*="staticSprite"]').count()
const liveSvgsAtRest = await page.locator('article [class*="svgWrap"] svg').count()
const cards = await page.locator('article').count()

// Hover the first card → it should go live (inline svg appears inside it).
const firstCard = page.locator('article').first()
await firstCard.hover()
await page.waitForTimeout(400)
const firstHasLiveSvg = await firstCard.locator('[class*="svgWrap"] svg').count()
const firstStillStatic = await firstCard.locator('img[class*="staticSprite"]').count()

// Move away → it should return to static.
await page.mouse.move(5, 5)
await page.waitForTimeout(400)
const firstBackToStatic = await firstCard.locator('img[class*="staticSprite"]').count()

const pass =
  cards > 0 &&
  staticImgs >= cards && // every card baked at rest
  liveSvgsAtRest === 0 && // no live SVG in the grid at rest
  firstHasLiveSvg === 1 && // hovered card is live
  firstStillStatic === 0 &&
  firstBackToStatic === 1 && // returns to static on mouse-out
  errors.length === 0

console.log(JSON.stringify({
  cards, staticImgs, liveSvgsAtRest,
  firstHasLiveSvg, firstStillStatic, firstBackToStatic,
  pageErrors: errors, PASS: pass,
}, null, 2))

await browser.close()
process.exit(pass ? 0 : 1)
