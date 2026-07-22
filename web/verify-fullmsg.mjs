// Headless verification of the "Full — feed again in …" friendly cooldown
// message (Task 1) against the LIVE deployed panel served by the office daemon.
//
// Uses ?feedlab: a wallet-free harness whose "full" cards (lastFed = now) sit on
// the fast preview clock (fed_dur 30s > feed_cd 5s), so for the first 5s each is
// simultaneously ON COOLDOWN and STILL FULL — exactly the just-woken-egg case the
// fix targets. Asserts the friendly copy shows, screenshots, then re-checks after
// the 5s cooldown lapses that the button flips to the plain Feed label.
import { chromium } from 'playwright'

const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/panel.html?feedlab'
const OUT = 'verify-fullmsg.png'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="feedlab-grid"]', { timeout: 15000 })
// Give React one tick to paint the satiety buttons.
await page.waitForTimeout(400)

const feedBtns = await page.locator('button', { hasText: /Feed|Full/ }).allInnerTexts()
const fullMsg = feedBtns.filter((t) => t.includes('Full — feed again in'))

console.log('--- buttons at load (t≈0, within 5s cooldown) ---')
feedBtns.forEach((t) => console.log('  •', JSON.stringify(t)))

await page.screenshot({ path: OUT, fullPage: true })

// After the 5s preview cooldown elapses (still full, fed_until 30s out), the
// button must drop the cooldown copy and offer a plain Feed again.
await page.waitForTimeout(5200)
const after = await page.locator('button', { hasText: /Feed|Full/ }).allInnerTexts()
const stillCooldownFull = after.filter((t) => t.includes('Full — feed again in'))
const plainFeed = after.filter((t) => /🍎 Feed/.test(t))
console.log('--- buttons after cooldown lapses (t≈5.5s) ---')
after.forEach((t) => console.log('  •', JSON.stringify(t)))

await browser.close()

const pass =
  fullMsg.length > 0 &&              // friendly message rendered while full+cooldown
  errors.length === 0 &&             // no page crash
  plainFeed.length > 0 &&            // cooldown lapse → plain Feed offered
  stillCooldownFull.length === 0     // no lingering cooldown copy once feedable

console.log('\n=== RESULT ===')
console.log('friendly "Full — feed again in" shown at load:', fullMsg.length, '(expect ≥1)')
console.log('plain Feed after cooldown lapse            :', plainFeed.length, '(expect ≥1)')
console.log('page errors                                :', errors.length, '(expect 0)')
if (errors.length) errors.forEach((e) => console.log('  !', e))
console.log(pass ? '\n✅ PASS' : '\n❌ FAIL')
process.exit(pass ? 0 : 1)
