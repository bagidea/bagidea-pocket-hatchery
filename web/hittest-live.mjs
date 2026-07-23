import { chromium } from 'playwright'

// LIVE office daemon — the running plugin instance, NOT a dist preview.
const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?demo'
const OUT = 'hittest-live.png'

const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="hatch-odds"]', { timeout: 10000 })
await page.waitForTimeout(800) // fonts/sprites settle

const chips = await page.$$eval('[data-testid="hatch-odds"] [data-rarity]', (els) =>
  els.map((el) => {
    const rarity = el.getAttribute('data-rarity')
    const text = el.innerText.replace(/\s+/g, ' ').trim()
    const pct = (text.match(/(\d+)%/) || [])[1] || null
    const mult = (text.match(/×(\d+\.\d+)/) || [])[1] || null
    return { rarity, pct, mult }
  }),
)

const costMatch = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const h = btns.find((b) => /Hatch/i.test(b.innerText))
  return h ? (h.innerText.match(/(\d+)\s*EGG/) || [])[1] || null : null
})

const freePath = await page.$eval('[data-testid="free-path"]', (el) => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)

const rareGlow = await page.$eval('[data-rarity="rare"]', (el) => {
  const s = getComputedStyle(el)
  return s.boxShadow && s.boxShadow !== 'none'
}).catch(() => false)

// Confirm the served bundle version marker so we know it's the reloaded instance.
const title = await page.title()

await page.screenshot({ path: OUT, fullPage: true })
await browser.close()

console.log('SERVED_FROM:', URL)
console.log('TITLE:', title)
console.log('JS_ERRORS:', errors.length)
errors.forEach((e) => console.log('  ', e))
console.log('HATCH_COST_ON_BUTTON:', costMatch)
console.log('CHIPS:', JSON.stringify(chips))
console.log('RARE_GLOW:', rareGlow)
console.log('FREE_PATH:', freePath)

const fail = []
if (errors.length) fail.push('JS errors present')
if (costMatch !== '150') fail.push(`hatch cost on button = ${costMatch}, expected 150`)
const byR = Object.fromEntries(chips.map((c) => [c.rarity, c]))
if (byR.common?.pct !== '70') fail.push('common % != 70')
if (byR.uncommon?.pct !== '25') fail.push('uncommon % != 25')
if (byR.rare?.pct !== '5') fail.push('rare % != 5')
if (byR.common?.mult !== '1.0') fail.push('common mult != 1.0')
if (byR.uncommon?.mult !== '1.1') fail.push('uncommon mult != 1.1')
if (byR.rare?.mult !== '1.4') fail.push('rare mult != 1.4')
if (!rareGlow) fail.push('rare chip has no glow')
if (!freePath) fail.push('free-path line missing')

console.log(fail.length ? 'HITTEST_FAIL: ' + fail.join(' | ') : 'HITTEST_PASS: all assertions ok')
process.exit(fail.length ? 1 : 0)
