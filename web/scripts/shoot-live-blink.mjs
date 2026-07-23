// Capture the blink on the LIVE deployed panel: load the demo grid, hover a card
// so it swaps to the live animated SVG, then freeze its SMIL clock at the blink
// peak and screenshot. Proves the shipped closed-eye blink end-to-end.
import { chromium } from 'playwright'

const PANEL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?demo'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900, deviceScaleFactor: 2 } })
await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.waitForSelector('article', { timeout: 15000 })
await page.waitForTimeout(1200)

const card = page.locator('article').first()
await card.hover()            // swap static bitmap → live SVG
await page.waitForTimeout(400)

// Freeze SMIL at a blink peak inside the hovered card's live svg.
await page.evaluate(() => {
  const svg = document.querySelector('article [class*="svgWrap"] svg')
  if (svg && svg.pauseAnimations) {
    svg.pauseAnimations()
    svg.setCurrentTime(4.0) // foxling blink peak ~4.0s
  }
})
await page.waitForTimeout(150)

await card.locator('[class*="artWrap"]').screenshot({ path: 'screenshots/live-blink-panel.png' })
console.log('wrote screenshots/live-blink-panel.png')
await browser.close()
