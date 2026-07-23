import { chromium } from 'playwright'

// LIVE office daemon — the running plugin instance, NOT a dist preview.
const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?demo'
const OUT = 'hittest-6tier.png'

// LIVE deployed configv3 numbers (phgamecreatr, wax-testnet) — the top tiers
// were retuned DOWN from the RARITY-6TIER-SPEC §1 draft (×2.0/3.2/5.0) before
// deploy. earn_mult bp 10000/11000/14000/18000/24000/33000 → ×1.0…×3.3.
const EXPECT = [
  { rarity: 'common',    pct: '69',   mult: '1.0' },
  { rarity: 'uncommon',  pct: '20',   mult: '1.1' },
  { rarity: 'rare',      pct: '8',    mult: '1.4' },
  { rarity: 'epic',      pct: '2.5',  mult: '1.8' },
  { rarity: 'legendary', pct: '0.45', mult: '2.4' },
  { rarity: 'mythic',    pct: '0.05', mult: '3.3' },
]

const errors = []
// Declared up front: the phase-2 card loop below pushes into `fail` before the
// phase-1 block does, so a `const` at its old spot sat in the temporal dead zone
// and a genuinely missing card threw a ReferenceError instead of a clean FAIL.
const fail = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="hatch-odds"]', { timeout: 10000 })
await page.waitForTimeout(800) // fonts/sprites settle

const chips = await page.$$eval('[data-testid="hatch-odds"] [data-rarity]', (els) =>
  els.map((el) => {
    const rarity = el.getAttribute('data-rarity')
    const text = el.innerText.replace(/\s+/g, ' ').trim()
    const label = (el.querySelector('span')?.innerText || '').trim()
    const pct = (text.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1] || null
    const mult = (text.match(/×\s*(\d+(?:\.\d+)?)/) || [])[1] || null
    const glow = (() => { const s = getComputedStyle(el); return !!s.boxShadow && s.boxShadow !== 'none' })()
    return { rarity, label, pct, mult, glow }
  }),
)

const costMatch = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const h = btns.find((b) => /Hatch/i.test(b.innerText))
  return h ? (h.innerText.match(/(\d+)\s*EGG/) || [])[1] || null : null
})

const freePath = await page.$eval('[data-testid="free-path"]', (el) => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)

await page.screenshot({ path: OUT, fullPage: true })

// ── Phase 2: ?feedlab — prove CreatureCard renders all 6 tiers live ──────────
const FEEDLAB = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?feedlab'
await page.goto(FEEDLAB, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-rarity]', { timeout: 10000 })
await page.waitForTimeout(800)
const cards = await page.$$eval('article[data-rarity]', (els) =>
  els.map((el) => ({
    rarity: el.getAttribute('data-rarity'),
    icon: (el.querySelector('[class*="rarityIcon"]')?.textContent || '').trim(),
    sparkles: el.querySelectorAll('[class*="sparkle"] > span, [class*="sparkles"] span').length,
    gradient: (() => {
      const fill = el.querySelector('[class*="progressFill"]')
      return fill ? getComputedStyle(fill).backgroundImage : ''
    })(),
  })),
)
await page.screenshot({ path: 'hittest-6tier-cards.png', fullPage: true })
await browser.close()

console.log('CARD_PAGE:', FEEDLAB)
console.log('CARD_COUNT:', cards.length)
cards.forEach((c) => console.log('  ', JSON.stringify(c)))
const cardByR = Object.fromEntries(cards.map((c) => [c.rarity, c]))
const EXPECT_ICON = { common: 'C', uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L', mythic: 'M' }
for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
  const c = cardByR[r]
  if (!c) { fail.push(`card ${r} not rendered`); continue }
  if (c.icon !== EXPECT_ICON[r]) fail.push(`card ${r} icon = ${c.icon}, expected ${EXPECT_ICON[r]}`)
  if (!c.gradient || c.gradient === 'none') fail.push(`card ${r} progress gradient missing`)
}
for (const r of ['epic', 'legendary', 'mythic']) {
  if (!cardByR[r]?.sparkles) fail.push(`card ${r} has no sparkle particles`)
}

console.log('SERVED_FROM:', URL)
console.log('JS_ERRORS:', errors.length)
errors.forEach((e) => console.log('  ', e))
console.log('HATCH_COST_ON_BUTTON:', costMatch)
console.log('CHIP_COUNT:', chips.length)
chips.forEach((c) => console.log('  ', JSON.stringify(c)))
console.log('FREE_PATH:', freePath)

if (errors.length) fail.push('JS errors present')
if (chips.length !== 6) fail.push(`chip count = ${chips.length}, expected 6`)
const byR = Object.fromEntries(chips.map((c) => [c.rarity, c]))
for (const e of EXPECT) {
  const c = byR[e.rarity]
  if (!c) { fail.push(`${e.rarity} chip missing`); continue }
  if (!c.label) fail.push(`${e.rarity} has empty label`)
  if (c.pct !== e.pct) fail.push(`${e.rarity} % = ${c.pct}, expected ${e.pct}`)
  if (c.mult !== e.mult) fail.push(`${e.rarity} mult = ${c.mult}, expected ${e.mult}`)
}
// Top tiers must carry their own accent glow (epic/legendary/mythic CSS applied).
for (const r of ['epic', 'legendary', 'mythic']) {
  if (!byR[r]?.glow) fail.push(`${r} chip has no accent box-shadow`)
}
if (costMatch !== '150') fail.push(`hatch cost on button = ${costMatch}, expected 150`)
if (!freePath) fail.push('free-path line missing')

console.log(fail.length ? 'HITTEST_FAIL: ' + fail.join(' | ') : 'HITTEST_PASS: all 6-tier assertions ok')
process.exit(fail.length ? 1 : 0)
