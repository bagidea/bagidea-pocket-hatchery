// Feed v2 PANEL hit-test — drives the REAL deployed plugin panel through the
// daemon (http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?feedlab).
// ?feedlab renders 3 self-contained cards on the fast PREVIEW clock (no wallet),
// so we can prove: bar decays real-time · Feed button resets it · rarity+earn show.
import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html?feedlab'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="feedlab-grid"]', { timeout: 10000 })
await sleep(600)

console.log('① Panel renders the Feed v2 cards')
const cards = page.locator('[data-testid="feedlab-grid"] article')
const n = await cards.count()
check('3 creature cards render', n === 3, `${n} cards`)
check('no page JS errors on load', errors.length === 0, errors.slice(0, 2).join(' | '))

// Read satiety % via the barPercent text on a given card (e.g. "88%").
async function pct(i) {
  const txt = await cards.nth(i).locator('text=/%$/').first().innerText().catch(() => '')
  const m = txt.match(/(\d+)%/)
  return m ? Number(m[1]) : NaN
}

console.log('② Rarity + earn rate are shown per card')
const bodyText = await page.locator('[data-testid="feedlab-grid"]').innerText()
check('earn rate unit "EGG/hr" visible', /EGG\/hr/i.test(bodyText))
check('rarity multiplier "×N.NN" visible', /×\d+\.\d{2}/.test(bodyText), (bodyText.match(/×\d+\.\d{2}/) || [])[0] || '')
const states = (bodyText.match(/Full|Hungry|Starving/g) || [])
check('at least one satiety state label visible', states.length >= 1, states.join(','))

console.log('③ Satiety bar decays in real time (card 0 = just fed)')
const p0a = await pct(0)
await sleep(3200)
const p0b = await pct(0)
check('card0 has a % reading', !Number.isNaN(p0a) && !Number.isNaN(p0b), `${p0a}% → ${p0b}%`)
check('card0 satiety DROPPED after 3.2s', p0b < p0a, `${p0a}% → ${p0b}%`)

console.log('④ Feed button resets satiety (find a non-full card, feed it)')
// Pick the card with the lowest %, click its Feed button, expect a jump up.
let lowIdx = 0, lowVal = 101
for (let i = 0; i < n; i++) { const v = await pct(i); if (v < lowVal) { lowVal = v; lowIdx = i } }
const feedBtn = cards.nth(lowIdx).locator('button', { hasText: /Feed/ })
const btnEnabled = await feedBtn.isEnabled().catch(() => false)
check(`card${lowIdx} Feed button present`, (await feedBtn.count()) > 0, `at ${lowVal}%`)
if (btnEnabled) {
  await feedBtn.click()
  await sleep(500)
  const after = await pct(lowIdx)
  check(`feeding card${lowIdx} jumped satiety UP`, after > lowVal, `${lowVal}% → ${after}%`)
} else {
  // On cooldown already — verify the button reflects a cooldown countdown instead.
  const label = await feedBtn.innerText().catch(() => '')
  check(`card${lowIdx} shows cooldown state`, /Feed in|\d+s/.test(label), label)
}

console.log('⑤ Screenshot the live panel')
const shot = 'E:/Projects/bagidea-ai-agents-office/workspace/uploads/feed-v2-panel.png'
await page.screenshot({ path: shot, fullPage: true })
console.log('  📸 ' + shot)

await browser.close()
console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
