import { chromium } from 'playwright'
const URL = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 } })).newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Connect via waxwing/i }).click()
await page.waitForFunction(() => /([1-9]\d*)\s+collected/.test(document.body.innerText), { timeout: 25000 })
await page.waitForTimeout(1500)

const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const pick = (re) => btns.filter((b) => re.test(b.textContent || ''))
  const summ = (arr) => arr.map((b) => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), disabled: b.disabled }))
  return {
    hatch: summ(pick(/Hatch Egg/)),
    feed: summ(pick(/Feed/)),
    evolve: summ(pick(/Evolve|MAX LEVEL/)),
    harvest: summ(pick(/Harvest EGG/)),
    claim: summ(pick(/Claim Reward/)),
  }
})
for (const [k, v] of Object.entries(info)) {
  const enabled = v.filter((x) => !x.disabled).length
  console.log(`\n${k}: ${v.length} button(s), ${enabled} enabled`)
  v.slice(0, 6).forEach((x) => console.log(`   [${x.disabled ? 'OFF' : 'ON '}] ${x.t}`))
}
await browser.close()
