// Headless re-render of the marketplace mock pages → PNG.
// Run from art/marketplace-mock/:  node render-mock.mjs
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// playwright is installed under web/, not here — resolve it relative to this file.
// (CJS package — named exports land on .default when imported this way)
const pw = await import(
  pathToFileURL(resolve(import.meta.dirname, '../../web/node_modules/playwright/index.js')).href
)
const chromium = pw.chromium ?? pw.default.chromium

const SHOTS = [
  { file: 'browse.html', out: 'render-browse.png', width: 1440 },
  { file: 'detail.html', out: 'render-detail.png', width: 1440 },
  // Interactive board — proves the LISTINGS array renders the right numbers.
  { file: 'marketplace.html', out: 'render-marketplace.png', width: 1440 },
]

const browser = await chromium.launch({ headless: true })
try {
  for (const s of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: 1000 },
      deviceScaleFactor: 2,
    })
    await page.goto(pathToFileURL(resolve(s.file)).href, { waitUntil: 'networkidle' })
    await page.screenshot({ path: s.out, fullPage: true })
    await page.close()
    console.log('wrote', s.out)
  }
} finally {
  await browser.close()
}
