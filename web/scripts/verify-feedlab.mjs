// Feed-v2 LIVE verification — drives the real rendered ?feedlab in a headless
// browser and proves, on screen, that (1) the satiety bar decays over time and
// (2) clicking Feed refills it. Complements verify-satiety.mjs (pure model):
// this one exercises the React component + 1s tick end-to-end.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = 'http://localhost:5173/plugin/pocket-hatchery/static/'
const URL = BASE + '?feedlab'

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

// Read each satiety bar's fill width (%) straight off the inline style.
const readFills = () =>
  page.$$eval('[class*="barFill"]', (els) =>
    els.map((el) => parseFloat(el.style.width) || 0))
// Read each state badge label (Full / Hungry / Starving).
const readStates = () =>
  page.$$eval('[class*="stateBadge"]', (els) => els.map((el) => el.textContent.trim()))

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[class*="barFill"]')
  await page.waitForTimeout(300)

  console.log('① Three satiety bars render')
  const fills0 = await readFills()
  check('3 satiety bars present', fills0.length === 3, `got ${fills0.length}`)
  const states0 = await readStates()
  check('state badges render', states0.length === 3, JSON.stringify(states0))
  check('bars start at different fills (staggered decay)',
    new Set(fills0.map((f) => Math.round(f))).size >= 2, JSON.stringify(fills0))
  await page.screenshot({ path: join(outDir, 'feedlab-01-initial.png'), fullPage: true })

  console.log('② Bars decay over ~4s (the bar falls on its own)')
  await page.waitForTimeout(4000)
  const fills1 = await readFills()
  check('every bar dropped', fills1.every((f, i) => f < fills0[i]),
    `${JSON.stringify(fills0)} → ${JSON.stringify(fills1)}`)
  await page.screenshot({ path: join(outDir, 'feedlab-02-decayed.png'), fullPage: true })

  console.log('③ Clicking Feed refills that creature\'s bar')
  // The 3rd card (legendary) starts lowest → find its Feed button and click it.
  const feedBtns = await page.$$('[class*="feedBtn"]')
  check('feed buttons present', feedBtns.length === 3, `got ${feedBtns.length}`)
  const before = (await readFills())[2]
  // Its cooldown (preview) is 5s and it was seeded 24s ago → not on cooldown.
  await feedBtns[2].click()
  await page.waitForTimeout(300)
  const after = (await readFills())[2]
  check('fed bar jumped back up', after > before, `${before}% → ${after}%`)
  check('fed bar is (near) full', after >= 95, `${after}%`)
  const statesAfter = await readStates()
  check('fed creature reads Full', /Full/.test(statesAfter[2]), statesAfter[2])
  await page.screenshot({ path: join(outDir, 'feedlab-03-fed.png'), fullPage: true })

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
