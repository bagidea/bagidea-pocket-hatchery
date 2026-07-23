// Render the REAL daemon-served Pocket Hatchery panel (not a vite dev server) at
// ?feedlab — the wallet-free surface that shows a CreatureCard per rarity tier
// (common→mythic) across 6 species — and screenshot the card grid. Used to prove
// the deployed dark-card redesign is what the office actually serves.
//
//   node scripts/shoot-card-gallery.mjs <outfile.png>
//
// Loads http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?feedlab
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] || 'card-gallery.png'
const mode = process.argv[3] || 'feedlab' // feedlab | awakenlab
const outPath = isAbsolute(out) ? out : join(__dirname, '..', out)
const GRID = `[data-testid="${mode}-grid"]`
const URL = `http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?${mode}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1400, deviceScaleFactor: 2 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  // Wait for the cards to mount + their gene-driven SVG sprites to fetch/render.
  await page.waitForSelector(GRID, { timeout: 15000 })
  await page.waitForFunction(
    (g) => document.querySelectorAll(`${g} article`).length >= 1,
    GRID, { timeout: 15000 },
  )
  await page.waitForFunction(
    (g) => {
      const cards = document.querySelectorAll(`${g} article`).length
      return document.querySelectorAll(`${g} svg`).length >= cards
    },
    GRID, { timeout: 15000 },
  )
  await page.waitForTimeout(1200) // settle float anim + glow
  // The sticky header would paint over the grid's top edge in an element-shot; hide
  // it so the top row of cards is captured cleanly.
  await page.evaluate(() => {
    const h = document.querySelector('header')
    if (h) h.style.display = 'none'
  })
  await page.waitForTimeout(150)
  const grid = page.locator(GRID)
  await grid.screenshot({ path: outPath })
  const rarities = await page.$$eval(`${GRID} article`, (els) =>
    els.map((e) => e.getAttribute('data-rarity')),
  )
  console.log('cards:', rarities.join(', '))
  console.log('svgs :', await page.$$eval(`${GRID} svg`, (e) => e.length))
  console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none')
  console.log('saved:', outPath)
} finally {
  await browser.close()
}
