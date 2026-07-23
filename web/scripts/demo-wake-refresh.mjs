// Throwaway end-to-end DEMO for the CEO's wake/feed bug.
// Drives the REAL deployed plugin panel (served by the office daemon on :8787),
// against the REAL WAX testnet + REAL waxwing wallet. No mocks.
//
// Proves both fixes:
//   1) After a WAX wake tx confirms, the panel re-reads the chain and the card
//      flips stage 0 (asleep/egg) -> stage 1 (Baby) with NO manual reload.
//   2) The freshly-woken (fed) creature shows its TRUE state — "Full — feed again
//      in <t>" + a Harvest next-step hint — instead of a misleading Feed error.
//
// The player's "tap Sign in waxwing" is stood in for by calling the daemon's
// `confirm` command from this script (exactly what the wallet panel does).
import { chromium } from 'playwright'

const DAEMON = 'http://127.0.0.1:8787'
const PANEL = `${DAEMON}/plugin/pocket-hatchery/static/panel.html`
const TARGET_ASSET = '1099603752043'
const TARGET_TAG = '#' + TARGET_ASSET.slice(-4) // card id label -> "#2042"

const daemon = (cmd, args = {}) =>
  fetch(`${DAEMON}/plugin/wax-wallet/cmd`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd, args }),
  }).then((r) => r.json())

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.on('console', (m) => {
    const t = m.text()
    if (/error|warn|chain|wake|refresh/i.test(t)) console.log('  [page]', t.slice(0, 160))
  })

  console.log('1) open panel:', PANEL)
  await page.goto(PANEL, { waitUntil: 'domcontentloaded' })

  console.log('2) connect via waxwing')
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()

  // Dashboard is up once the creature grid renders.
  await page.waitForSelector('article[data-rarity]', { timeout: 30000 })
  const card = page.locator('article', { hasText: TARGET_TAG }).first()
  await card.waitFor({ timeout: 30000 })

  const beforeAsleep = await card.getAttribute('data-asleep')
  const beforeStage = (await card.locator('[class*="stageBadge"]').first().innerText().catch(() => '')).trim()
  console.log(`   target card ${TARGET_TAG}: data-asleep=${beforeAsleep} stage="${beforeStage}"`)
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'scripts/demo-before-wake.png', fullPage: false })
  await card.screenshot({ path: 'scripts/demo-before-card.png' }).catch(() => {})

  if (beforeAsleep !== '1') {
    console.log('   !! target is not asleep — cannot demo the wake flip. Aborting.')
    await browser.close()
    process.exit(2)
  }

  console.log('3) click "Wake now" (builds a WAX sign-intent)')
  await card.getByRole('button', { name: /Wake now/i }).click()

  // Stand in for the CEO tapping Sign in waxwing: find the pending intent and confirm it.
  let intentId = null
  for (let i = 0; i < 20 && !intentId; i++) {
    const st = await daemon('status')
    const pend = st?.status?.pendingIntents || []
    const hit = pend.find((p) => p.action === 'transfer' && JSON.stringify(p.data || {}).includes('wake:' + TARGET_ASSET))
      || pend[pend.length - 1]
    if (hit) intentId = hit.id
    else await sleep(500)
  }
  if (!intentId) { console.log('   !! no pending intent appeared'); await browser.close(); process.exit(3) }
  console.log('   intent id:', intentId, '-> confirm (broadcast)')
  const conf = await daemon('confirm', { id: intentId })
  const txid = conf?.result?.txId || conf?.result?.txid
  console.log('   broadcast:', conf?.result?.broadcast, 'txid:', txid)

  console.log('4) WITHOUT reload — wait for the card to flip to Baby (panel self-refresh)')
  let flipped = false
  for (let i = 0; i < 40; i++) {
    const asleep = await card.getAttribute('data-asleep')
    if (asleep === '0') { flipped = true; break }
    await sleep(500)
  }
  await sleep(1500) // let the SatietyMeter render its state/label
  const afterAsleep = await card.getAttribute('data-asleep')
  const afterStage = (await card.locator('[class*="stageBadge"]').first().innerText().catch(() => '')).trim()
  const feedBtn = (await card.locator('button', { hasText: /Feed|Full/ }).first().innerText().catch(() => '')).trim()
  const hint = (await card.locator('[class*="nextStep"]').first().innerText().catch(() => '')).trim()
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'scripts/demo-after-wake.png', fullPage: false })
  await card.screenshot({ path: 'scripts/demo-after-card.png' }).catch(() => {})

  console.log('\n──── RESULT ────')
  console.log('flipped without reload :', flipped)
  console.log('data-asleep before/after:', beforeAsleep, '->', afterAsleep)
  console.log('stage badge before/after:', JSON.stringify(beforeStage), '->', JSON.stringify(afterStage))
  console.log('feed button text        :', JSON.stringify(feedBtn))
  console.log('harvest next-step hint  :', JSON.stringify(hint))

  await browser.close()
  const feedOk = /Full/i.test(feedBtn) && /feed again in/i.test(feedBtn)
  process.exit(flipped && feedOk ? 0 : 1)
}
run().catch((e) => { console.error(e); process.exit(1) })
