import { chromium } from 'playwright'

// LIVE office daemon — the running plugin instance (0.3.1), not a dist preview.
const BASE = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

const errors = []
const fail = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1300 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

// ── PART A: card-back flip (all 6 tiers, ?feedlab) ───────────────────────────
// Proves every rarity's NFT card-back PNG actually loads (naturalWidth > 0) and
// is the file for that tier — not a CSS-only frame.
await page.goto(`${BASE}?feedlab`, { waitUntil: 'networkidle' })
await page.waitForSelector('article[data-rarity]', { timeout: 10000 })
await page.waitForTimeout(600)

const flipResults = []
for (const r of RARITIES) {
  const flipBtn = page.locator(`article[data-rarity="${r}"] [data-testid^="flip-"]`).first()
  if (await flipBtn.count() === 0) { fail.push(`A: no flip button for ${r}`); continue }
  await flipBtn.click()
  await page.waitForTimeout(250)
  // The card back is a sibling <button> inside the same flip container.
  const info = await page.evaluate((rarity) => {
    const art = document.querySelector(`article[data-rarity="${rarity}"]`)
    const inner = art?.parentElement // .flipInner
    const img = inner?.querySelector('[data-testid^="cardback-"] img')
    return img
      ? { src: img.getAttribute('src'), w: img.naturalWidth, h: img.naturalHeight }
      : { src: null, w: 0, h: 0 }
  }, r)
  const okFile = !!info.src && info.src.includes(`nft-back-${r}.png`)
  const okLoaded = info.w > 0 && info.h > 0
  if (!okFile) fail.push(`A: ${r} back src wrong: ${info.src}`)
  if (!okLoaded) fail.push(`A: ${r} back image did not load (naturalWidth=${info.w})`)
  flipResults.push({ rarity: r, src: info.src, w: info.w, h: info.h, okFile, okLoaded })
}
await page.waitForTimeout(400)
await page.screenshot({ path: 'hittest-cardbacks.png', fullPage: true })

// ── PART B: read-only spectator on REAL chain state (?view=waxwingsuper) ──────
// Renders whatever the account actually owns on wax-testnet — no mock, no wallet.
const VIEW_ACCT = 'waxwingsuper'
await page.goto(`${BASE}?view=${VIEW_ACCT}`, { waitUntil: 'networkidle' })
// The collection reads chain async after mount; give it room, then wait for cards.
await page.waitForSelector('article[data-rarity]', { timeout: 20000 })
await page.waitForTimeout(1500)

const liveCards = await page.$$eval('article[data-rarity]', (els) =>
  els.map((el) => {
    const txt = el.innerText
    return {
      rarity: el.getAttribute('data-rarity'),
      stage: el.getAttribute('data-stage'),
      asleep: el.getAttribute('data-asleep'),
      id: (el.querySelector('[class*="cardId"]')?.textContent || '').trim(),
      hasSleep: /💤\s*Sleep/.test(txt),
      hasSatiety: /🍽️\s*Satiety/.test(txt),
    }
  }),
)
await page.screenshot({ path: 'hittest-view-live.png', fullPage: true })

// Flip the first REAL card too, to prove the back art works off real chain data.
let liveFlip = null
const firstFlip = page.locator('article[data-rarity] [data-testid^="flip-"]').first()
if (await firstFlip.count() > 0) {
  const r0 = await page.locator('article[data-rarity]').first().getAttribute('data-rarity')
  await firstFlip.click()
  await page.waitForTimeout(400)
  liveFlip = await page.evaluate(() => {
    const img = document.querySelector('[data-testid^="cardback-"] img')
    return img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null
  })
  await page.screenshot({ path: 'hittest-view-live-back.png', fullPage: true })
  if (!liveFlip || liveFlip.w <= 0) fail.push(`B: real ${r0} card back did not load`)
}

await browser.close()

// ── Cross-check the rendered rarities against the raw chain table ────────────
const RPC = 'https://wax-testnet.eosphere.io'
const res = await fetch(`${RPC}/v1/chain/get_table_rows`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ json: true, code: 'phgamecreatr', scope: 'phgamecreatr', table: 'creatrsv2', limit: 100 }),
}).then((r) => r.json())
const RARITY_BY_EGG = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const chainOwned = (res.rows || []).filter((r) => r.owner === VIEW_ACCT)
const chainRarities = chainOwned.map((r) => RARITY_BY_EGG[r.egg_type]).sort()
const renderRarities = liveCards.map((c) => c.rarity).sort()

console.log('\n===== PART A: card-back flip (all 6 tiers) =====')
flipResults.forEach((f) => console.log(`  ${f.okFile && f.okLoaded ? 'PASS' : 'FAIL'}  ${f.rarity.padEnd(10)} ${f.src}  ${f.w}x${f.h}`))

console.log('\n===== PART B: real chain view (?view=' + VIEW_ACCT + ') =====')
console.log('  chain table egg_types →', chainOwned.map((r) => `${r.asset_id.slice(-4)}:eg${r.egg_type}(stage${r.stage})`).join(', '))
console.log('  chain rarities  :', JSON.stringify(chainRarities))
console.log('  rendered cards  :', liveCards.length)
liveCards.forEach((c) => console.log(`     ${c.id} rarity=${c.rarity} stage=${c.stage} asleep=${c.asleep} sleepBar=${c.hasSleep} satietyBar=${c.hasSatiety}`))
console.log('  rendered==chain :', JSON.stringify(renderRarities) === JSON.stringify(chainRarities))
console.log('  real-card flip  :', JSON.stringify(liveFlip))

// The real cards must match the chain rows exactly, and (all stage-0) must show
// the sleep/awaken bar, NOT the satiety bar.
if (JSON.stringify(renderRarities) !== JSON.stringify(chainRarities)) fail.push('B: rendered rarities != chain egg_types')
if (liveCards.length === 0) fail.push('B: no live cards rendered from chain')
if (liveCards.some((c) => c.stage === '0' && !c.hasSleep)) fail.push('B: a stage-0 card is missing the Sleep meter')

console.log('\n===== SUMMARY =====')
console.log('JS errors:', errors.length, errors.slice(0, 5))
console.log('FAILURES :', fail.length)
fail.forEach((f) => console.log('  -', f))
console.log(fail.length === 0 && errors.length === 0 ? '\nRESULT: PASS' : '\nRESULT: FAIL')
process.exit(fail.length === 0 && errors.length === 0 ? 0 : 1)
