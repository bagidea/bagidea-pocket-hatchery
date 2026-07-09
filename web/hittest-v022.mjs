import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))

// 1) feedlab: earn multipliers + satiety meters
await page.goto(BASE + '?feedlab', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const lab = await page.evaluate(() => {
  const txt = document.body.innerText
  const meters = document.querySelectorAll('[class*="satiet" i], [class*="Satiety" i]').length
  const mults = [...txt.matchAll(/×\s*(1\.\d{2})/g)].map(m => m[1])
  const states = ['full','hungry','starving','อิ่ม','หิว'].filter(s => txt.includes(s))
  return { hasEarn: /earn|EGG|\/hr/i.test(txt), mults, meters, states, cards: document.querySelectorAll('article').length }
})
await page.screenshot({ path: 'hittest-v022-feedlab.png', fullPage: true })

// 2) main panel loads clean (no wallet → landing)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const main = await page.evaluate(() => ({
  root: !!document.querySelector('#root')?.children.length,
  hasConnect: /connect|เชื่อม|wallet|กระเป๋า/i.test(document.body.innerText),
  h: document.querySelector('#root')?.getBoundingClientRect().height ?? 0,
}))
await page.screenshot({ path: 'hittest-v022-panel.png', fullPage: true })

console.log('FEEDLAB:', JSON.stringify(lab))
console.log('MAIN   :', JSON.stringify(main))
console.log('ERRORS :', errs.length ? JSON.stringify(errs) : 'none')
await b.close()
if (errs.length) { console.log('❌ JS errors present'); process.exit(1) }
if (!lab.mults.includes('1.10') || !lab.mults.includes('1.40')) { console.log('❌ missing real multipliers'); process.exit(1) }
if (!main.root || main.h < 100) { console.log('❌ main panel did not render'); process.exit(1) }
console.log('✅ v0.2.2 hit-test PASS')
