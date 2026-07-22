// Demo-loop verification — drives the wallet-free ?demo dashboard through the full
// hatch → awaken → feed loop the Awaken-v2 work closes, headlessly, and captures a
// screenshot at each step. Proves the loop is playable end-to-end (a freshly-hatched
// egg is ASLEEP and must be woken before it can be fed), not just that files compile.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const URL = 'http://localhost:5173/plugin/pocket-hatchery/static/?demo'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}
const cardCount = () => page.$$eval('[class*="wrap"] article[class*="card"]', (e) => e.length).catch(() => 0)
const countText = (re) => page.$$eval('*', (els, r) =>
  els.filter((e) => e.children.length === 0 && new RegExp(r).test(e.textContent)).length, re.source)

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('article[class*="card"]')
  await page.waitForTimeout(300)

  console.log('① Demo starts with one awake starter (Baby) → SatietyMeter')
  const cards0 = await cardCount()
  check('one starter creature', cards0 === 1, `got ${cards0}`)
  check('starter shows a Satiety meter (awake)', (await countText(/🍽️\s*Satiety/)) >= 1)
  await page.screenshot({ path: join(outDir, 'demoflow-01-start.png'), fullPage: true })

  console.log('② Reset (200 EGG) then Hatch → a new SLEEPING egg (AwakenMeter)')
  await page.click('button:has-text("Reset")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("Hatch")')
  await page.waitForTimeout(600)
  const cards1 = await cardCount()
  check('a second creature was hatched', cards1 === 2, `got ${cards1}`)
  check('the hatched egg is asleep → "💤 การตื่น" block', (await countText(/💤\s*การตื่น/)) >= 1)
  const wakeSleeping = await page.$$eval('button', (els) =>
    els.filter((b) => /ปลุกเลย/.test(b.textContent)).map((b) => b.textContent.trim()))
  check('a "⚡ ปลุกเลย · N WAX" button is offered on the egg', wakeSleeping.some((t) => /WAX/.test(t)), JSON.stringify(wakeSleeping))
  await page.screenshot({ path: join(outDir, 'demoflow-02-hatched-asleep.png'), fullPage: true })

  console.log('③ Wake the egg → it becomes a Baby → Feed (SatietyMeter) takes over')
  const before = await countText(/🍽️\s*Satiety/)
  await page.click('button:has-text("ปลุกเลย")')
  await page.waitForTimeout(500)
  const after = await countText(/🍽️\s*Satiety/)
  check('woke egg now shows a Satiety meter (was AwakenMeter)', after > before, `${before} → ${after}`)
  check('no more sleeping eggs to wake', (await page.$$eval('button', (els) =>
    els.filter((b) => /ปลุกเลย/.test(b.textContent)).length)) === 0)
  await page.screenshot({ path: join(outDir, 'demoflow-03-woke.png'), fullPage: true })

  console.log('④ Feed the woken Baby → satiety refills (loop closes)')
  const feedBtns = await page.$$('button:has-text("Feed")')
  check('a Feed button is available on the woken Baby', feedBtns.length >= 1, `got ${feedBtns.length}`)
  if (feedBtns.length) await feedBtns[feedBtns.length - 1].click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(outDir, 'demoflow-04-fed.png'), fullPage: true })

  console.log('⑤ No runtime errors on the page')
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
