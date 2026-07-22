// Awaken-v2 LIVE render verification — drives the real rendered ?awakenlab in a
// headless browser and proves, on screen, that (1) a sleeping (stage 0) creature
// shows the AwakenMeter with a WAX "Wake now" button + a filling sleep bar, (2) a
// creature whose timer has elapsed shows the "Ready — harvest to awaken" state,
// and (3) clicking "Wake now" flips it awake so the SatietyMeter (Feed) takes over
// — the hatch → wake → feed handoff. Complements verify-awaken.mjs (pure model).
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = 'http://localhost:5173/plugin/pocket-hatchery/static/'
const URL = BASE + '?awakenlab'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

// Wake buttons carry "⚡ ปลุกเลย" while sleeping, "กด Harvest เพื่อปลุกฟรี" once ready.
const wakeButtons = () =>
  page.$$eval('button', (els) =>
    els.filter((b) => /ปลุกเลย|ปลุกฟรี/.test(b.textContent))
      .map((b) => ({ text: b.textContent.trim(), disabled: b.disabled })))
// The awaken block's own bar fills (💤 Awaken cards). Read every barFill width.
const barFills = () =>
  page.$$eval('[class*="barFill"]', (els) => els.map((el) => parseFloat(el.style.width) || 0))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="awakenlab-grid"]')
  await page.waitForTimeout(400)

  console.log('① Two sleeping cards render with AwakenMeter')
  const awakenLabels = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /💤\s*การตื่น/.test(e.textContent)).length)
  check('two "💤 การตื่น" blocks present', awakenLabels === 2, `got ${awakenLabels}`)
  const btns0 = await wakeButtons()
  check('two wake buttons present', btns0.length === 2, JSON.stringify(btns0))
  const sleeping = btns0.find((b) => /ปลุกเลย/.test(b.text))
  const ready = btns0.find((b) => /ปลุกฟรี/.test(b.text))
  check('one card is mid-sleep → "⚡ ปลุกเลย · 3 WAX" (enabled)', !!sleeping && /3 WAX/.test(sleeping.text) && !sleeping.disabled, JSON.stringify(sleeping))
  check('one card elapsed → "🌅 พร้อมตื่น — กด Harvest เพื่อปลุกฟรี" (disabled)', !!ready && ready.disabled, JSON.stringify(ready))
  await page.screenshot({ path: join(outDir, 'awakenlab-01-sleeping.png'), fullPage: true })

  console.log('② The sleep-timer bar fills on its own over ~3s (fast clock)')
  const fills0 = await barFills()
  await page.waitForTimeout(3000)
  const fills1 = await barFills()
  // The mid-sleep card's bar must have risen (progress climbs toward auto-awaken).
  check('a sleep bar climbed toward ready', fills1.some((f, i) => f > (fills0[i] ?? 0) + 1),
    `${JSON.stringify(fills0)} → ${JSON.stringify(fills1)}`)
  await page.screenshot({ path: join(outDir, 'awakenlab-02-filling.png'), fullPage: true })

  console.log('③ Clicking "ปลุกเลย" flips the sleeper awake → Feed (SatietyMeter) appears')
  const wakeNow = await page.$('button:has-text("ปลุกเลย")')
  check('Wake now button found', !!wakeNow)
  await wakeNow.click()
  await page.waitForTimeout(500)
  // After waking, the AwakenMeter is replaced by the SatietyMeter — assert its
  // "🍽️ Satiety" label appears and a Feed button (any state) is present.
  const satietyLabels = await page.$$eval('*', (els) =>
    els.filter((e) => e.children.length === 0 && /🍽️\s*Satiety/.test(e.textContent)).length)
  const feedBtns = await page.$$eval('button', (els) =>
    els.filter((b) => /Feed/.test(b.textContent)).length)
  check('a Satiety meter now shows (woke → satiety takes over)', satietyLabels >= 1, `satiety labels: ${satietyLabels}`)
  check('a Feed button now shows', feedBtns >= 1, `feed buttons: ${feedBtns}`)
  const btns2 = await wakeButtons()
  check('one fewer "ปลุกเลย" after waking', (btns2.filter((b) => /ปลุกเลย/.test(b.text)).length) === 0, JSON.stringify(btns2))
  await page.screenshot({ path: join(outDir, 'awakenlab-03-woke-to-feed.png'), fullPage: true })

  console.log('④ No runtime errors on the page')
  check('zero pageerrors/console errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  fail++
  console.log(`  ❌ threw: ${e.message}`)
} finally {
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
console.log(`screenshots → ${outDir}`)
process.exit(fail === 0 ? 0 : 1)
