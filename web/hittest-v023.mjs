import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?feedlab'
const OUT = 'hittest-v023.png'

const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="feedlab-grid"]', { timeout: 10000 })
await page.waitForTimeout(1200) // let sprites/fonts settle

const cards = await page.$$eval('[data-testid="feedlab-grid"] [data-rarity]', (els) =>
  els.map((el) => {
    const rarity = el.getAttribute('data-rarity')
    const text = el.innerText.replace(/\s+/g, ' ').trim()
    const mult = (text.match(/×(\d+\.\d+)/) || [])[1] || null
    const egg = (text.match(/(\d+\.\d+)\s*EGG\/hr/i) || [])[1] || null
    const full = (text.match(/full:\s*(\d+\.\d+)/i) || [])[1] || null
    const feedBtn = !!el.querySelector('button')
    return { rarity, mult, egg, full, feedBtn }
  }),
)

await page.screenshot({ path: OUT, fullPage: true })
await browser.close()

console.log('JS_ERRORS:', errors.length)
errors.forEach((e) => console.log('  ', e))
console.log('CARDS:', JSON.stringify(cards, null, 2))
