// Proof shots for the on-chain rename: the farm and the creature cards showing
// the SAME name, both read from the NFTs' mutable data on the live chain.
// Nothing is intercepted or stubbed — this is the connected dashboard.
//
// Usage: node shoot-onchain-rename.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const NAMED = '1099603751834' // "Ember Queen"

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })

await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.click('button:has-text("Connect via waxwing")')
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
await page.waitForTimeout(2500)

// Farm — the name tag only shows on hover, so scroll the scene into view and
// hover the renamed creature before shooting.
await page.$eval('[data-testid="farm-agent"]', (el) =>
  el.closest('section')?.scrollIntoView({ block: 'center' }),
)
await page.waitForTimeout(400)
await page.hover(`[data-testid="farm-agent"][data-asset="${NAMED}"]`)
await page.waitForTimeout(600)
// Crop around the hovered creature so the name tag is legible in the proof shot.
const agent = await page.$eval(
  `[data-testid="farm-agent"][data-asset="${NAMED}"]`,
  (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  },
)
const PAD = 130
await page.screenshot({
  path: join(outDir, 'proof-rename-farm.png'),
  clip: {
    x: Math.max(0, agent.x - PAD),
    y: Math.max(0, agent.y - PAD),
    width: agent.width + PAD * 2,
    height: agent.height + PAD * 2,
  },
})

// Cards — the two renamed creatures, filtered down so the crop is readable.
await page.click('button:has-text("🐾 Creatures")')
await page.waitForTimeout(800)
await page.fill('[data-testid="creature-search"]', 'e')
await page.waitForTimeout(600)
const cardBox = await page.$eval(`[data-testid="name-${NAMED}"]`, (el) => {
  const r = el.closest('article').getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
await page.screenshot({ path: join(outDir, 'proof-rename-card.png'), clip: cardBox })

console.log('📸 proof-rename-farm.png · proof-rename-card.png')
await browser.close()
