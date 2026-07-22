import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const browser = await chromium.launch()
let fail = 0

async function check(name, params, wants) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}${params}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const body = await page.innerText('body')
  const hasThai = /[฀-๿]/.test(body)
  console.log(`\n── ${name} (${params}) ──`)
  console.log('console/page errors:', errors.length ? errors.slice(0, 4) : 'none')
  console.log('Thai chars in rendered text:', hasThai ? 'YES ❌' : 'none ✓')
  if (hasThai) fail++
  if (errors.length) fail++
  for (const w of wants) {
    const ok = body.includes(w)
    console.log(`  ${ok ? '✓' : '✗ MISSING'}  "${w}"`)
    if (!ok) fail++
  }
  await page.screenshot({ path: `verify-harvest-${name}.png`, fullPage: true })
  await page.close()
}

// Connected dashboard shell (?dash forces connected=true; no wallet → empty state).
// Exercises the reworked Harvest + Claim quick-action block.
await check('dash', '?dash', ['🌾', 'EGG', 'Claim Reward', 'Hatch Egg'])
// Awaken lab — a sleeping + a ready creature (English wake block).
await check('awaken', '?awakenlab', ['Sleeping', 'Wake now', 'Auto-wakes in'])
// Feed lab — includes a starving creature; check the satiety block renders.
await check('feed', '?feedlab', ['Satiety', 'EGG/hr'])

await browser.close()
console.log(`\n${fail === 0 ? '✅ ALL RENDER CHECKS PASSED' : `❌ ${fail} CHECK(S) FAILED`}`)
process.exit(fail === 0 ? 0 : 1)
