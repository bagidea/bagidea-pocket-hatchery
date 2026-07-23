// Feed-v2 reset hit-test against the LIVE deployed plugin (daemon :8787, NOT a
// dev server). Proves on the real bundle that (1) the satiety bar renders per
// state across the tier seed (Full / Hungry / Starving) and (2) clicking Feed
// on the starving card refills its bar and flips it back to Full.
import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?feedlab'
const OUT = 'hittest-feed-reset.png'
const fail = []

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })

const readCards = () =>
  page.$$eval('article[data-rarity]', (els) =>
    els.map((el) => ({
      rarity: el.getAttribute('data-rarity'),
      fill: parseFloat(el.querySelector('[class*="barFill"]')?.style.width) || 0,
      state: (el.querySelector('[class*="stateBadge"]')?.textContent || '').trim(),
    })))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[class*="barFill"]', { timeout: 10000 })
await page.waitForTimeout(1200) // let the fast preview clock separate the seed

const before = await readCards()
console.log('BEFORE:')
before.forEach((c) => console.log('  ', JSON.stringify(c)))

// The seed starts rare at ~20% (starving). Feed it and prove the bar refills.
const target = 'rare'
const btn = await page.$(`article[data-rarity="${target}"] button`)
if (!btn) fail.push(`no feed button on ${target} card`)
else {
  await btn.click()
  await page.waitForTimeout(400)
}

const after = await readCards()
console.log('AFTER feed on', target + ':')
after.forEach((c) => console.log('  ', JSON.stringify(c)))

await page.screenshot({ path: OUT, fullPage: true })
await browser.close()

// Assertions
if (errors.length) fail.push('JS errors: ' + errors.join(' | '))
const b = Object.fromEntries(before.map((c) => [c.rarity, c]))
const a = Object.fromEntries(after.map((c) => [c.rarity, c]))
// At least one state of each kind present in the seed → the meter renders states.
// The state badge text carries an emoji prefix (😋Full / 😕Hungry / 😖Starving),
// so match on substring, not equality.
const seen = before.map((c) => c.state)
for (const s of ['Full', 'Hungry', 'Starving']) {
  if (!seen.some((x) => x.includes(s))) fail.push(`no card in "${s}" state (states seen: ${seen.join(',')})`)
}
// Feed reset: the fed card's fill must jump up and read Full afterwards.
if (a[target] && b[target]) {
  if (a[target].fill <= b[target].fill) fail.push(`${target} fill did not rise (${b[target].fill}→${a[target].fill})`)
  if (!a[target].state.includes('Full')) fail.push(`${target} not Full after feed (got ${a[target].state})`)
}

console.log('JS_ERRORS:', errors.length)
console.log(fail.length ? 'FEEDRESET_FAIL: ' + fail.join(' | ') : 'FEEDRESET_PASS: states render + feed refills the bar')
process.exit(fail.length ? 1 : 0)
