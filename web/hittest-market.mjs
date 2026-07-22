import { chromium } from 'playwright'

// In-Game Marketplace hit-test against the DEPLOYED plugin (0.4.0) + the LIVE
// wax-testnet AtomicMarket indexer.
//   PART A — ?view spectator: the Market tab renders REAL listings (rarity
//            checked against the chain per asset) with ZERO buy/list/delist
//            controls anywhere.
//   PART B — normal dashboard (?dash): the same board shows its Buy controls,
//            and the listing detail page carries the real price/seller.
const BASE = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const VIEW_ACCT = 'waxwingsuper'
const API = 'https://test.wax.api.atomicassets.io'

const fail = []
const errors = []

// Ground truth straight from the indexer (same source the page reads).
const chainSales = (
  await (await fetch(`${API}/atomicmarket/v1/sales?state=1&collection_name=phgamecreatr&limit=50`)).json()
).data.map((s) => ({
  saleId: String(s.sale_id),
  assetId: String(s.assets[0].asset_id),
  seller: s.seller,
  rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'][Number(s.assets[0].data?.rarity ?? 0)],
  amount: Number(s.price.amount) / 10 ** Number(s.price.token_precision),
}))
if (chainSales.length === 0) {
  console.log('SETUP: no live sales on chain — seed a listing first')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

// ── PART A: spectator ?view — full board, zero sign-capable controls ─────────
await page.goto(`${BASE}?view=${VIEW_ACCT}`, { waitUntil: 'networkidle' })
await page.getByTestId('tab-market').click()
await page.waitForSelector('[data-testid="market-grid"]', { timeout: 25000 })
await page.waitForTimeout(1200)

const cardsA = await page.$$eval('[data-testid^="market-card-"]', (els) =>
  els.map((el) => ({
    assetId: el.getAttribute('data-testid').replace('market-card-', ''),
    rarity: el.getAttribute('data-rarity'),
    text: el.innerText.replace(/\n/g, ' ').slice(0, 80),
  })),
)
if (cardsA.length === 0) fail.push('A: no live listing cards rendered')
for (const c of cardsA) {
  const chain = chainSales.find((s) => s.assetId === c.assetId)
  if (!chain) fail.push(`A: card ${c.assetId} not on chain`)
  else if (chain.rarity !== c.rarity) fail.push(`A: card ${c.assetId} rarity ${c.rarity} ≠ chain ${chain.rarity}`)
}
const statsText = await page.locator('[data-testid="market-stats"]').innerText()
if (!/listings/.test(statsText) || !/Floor/.test(statsText)) fail.push(`A: stats bar broken: "${statsText.slice(0, 60)}"`)

// Spectator must see ZERO action controls.
for (const [label, sel] of [
  ['card buy', '[data-testid^="card-buy-"]'],
  ['card cancel', '[data-testid^="card-cancel-"]'],
  ['sell strip', '[data-testid="market-sell-strip"]'],
]) {
  const n = await page.locator(sel).count()
  if (n > 0) fail.push(`A: ${label} present (${n}×) in spectator view`)
}

// Detail view (spectator): live data, still zero controls.
await page.locator('[data-testid^="market-card-"]').first().click()
await page.waitForSelector('[data-testid="market-detail"]', { timeout: 15000 })
await page.waitForTimeout(2500) // meta/history/satiety loads
const detailPrice = await page.locator('[data-testid="detail-price"]').innerText()
const first = chainSales.find((s) => s.assetId === cardsA[0]?.assetId)
if (first && Number(detailPrice) !== first.amount)
  fail.push(`A: detail price ${detailPrice} ≠ chain ${first.amount}`)
const detailText = await page.locator('[data-testid="market-detail"]').innerText()
if (first && !detailText.includes(first.seller)) fail.push('A: detail missing the live seller name')
// secTitle renders text-transform:uppercase → innerText comes back uppercased.
if (!/Ownership History/i.test(detailText)) fail.push('A: detail missing history section')
for (const sel of ['[data-testid="buy-btn"]', '[data-testid="delist-btn"]', '[data-testid="edit-price-btn"]']) {
  if ((await page.locator(sel).count()) > 0) fail.push(`A: ${sel} present in spectator detail`)
}
await page.screenshot({ path: 'hittest-market-view.png', fullPage: true })

// ── PART B: normal dashboard (?dash) — controls exist for a player ───────────
await page.goto(`${BASE}?dash`, { waitUntil: 'networkidle' })
await page.getByTestId('tab-market').click()
await page.waitForSelector('[data-testid="market-grid"]', { timeout: 25000 })
await page.waitForTimeout(800)
const buyBtns = await page.locator('[data-testid^="card-buy-"]').count()
if (buyBtns === 0) fail.push('B: no Buy Now controls on the normal dashboard')
await page.locator('[data-testid^="market-card-"]').first().click()
await page.waitForSelector('[data-testid="market-detail"]', { timeout: 15000 })
const buyDetail = await page.locator('[data-testid="buy-btn"]').count()
if (buyDetail === 0) fail.push('B: detail Buy Now button missing')
const buyLabel = buyDetail ? await page.locator('[data-testid="buy-btn"]').innerText() : ''
await page.screenshot({ path: 'hittest-market-dash.png', fullPage: true })

await browser.close()

console.log('===== chain ground truth =====')
console.log(' ', JSON.stringify(chainSales))
console.log('===== PART A: ?view spectator =====')
console.log('  cards :', JSON.stringify(cardsA))
console.log('  stats :', statsText.replace(/\n/g, ' · '))
console.log('  detail:', detailPrice, 'WAX ·', first ? first.seller : '?')
console.log('===== PART B: ?dash =====')
console.log('  card Buy controls :', buyBtns)
console.log('  detail Buy button :', buyLabel.replace(/\n/g, ' '))
console.log('\n===== SUMMARY =====')
console.log('JS errors:', errors.length, errors.slice(0, 5))
console.log('FAILURES :', fail.length)
fail.forEach((f) => console.log('  -', f))
console.log(fail.length === 0 && errors.length === 0 ? '\nRESULT: PASS' : '\nRESULT: FAIL')
process.exit(fail.length === 0 && errors.length === 0 ? 0 : 1)
