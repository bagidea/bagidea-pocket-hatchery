import { chromium } from 'playwright'

// Security audit for the spectator URL (?view=<account>) on the DEPLOYED plugin
// (0.3.2): the page must be pure display — zero controls that could reach a
// wallet — while the live chain data still renders. Part B proves the same
// build still shows every action control for a normal (non-view) session.
const BASE = 'http://127.0.0.1:8787/plugin/pocket-hatchery/panel.html'
const VIEW_ACCT = 'waxwingsuper'

const errors = []
const fail = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } })
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

// ── PART A: ?view must be read-only ──────────────────────────────────────────
await page.goto(`${BASE}?view=${VIEW_ACCT}`, { waitUntil: 'networkidle' })
await page.waitForSelector('article[data-rarity]', { timeout: 20000 })
await page.waitForTimeout(1500)

// 1. The spectator badge announces the mode (and no wallet pill controls).
const pill = await page.locator('[data-testid="spectator-pill"]').count()
const pillText = pill ? await page.locator('[data-testid="spectator-pill"]').innerText() : ''
if (!pill) fail.push('A: spectator pill missing')
if (pill && !pillText.includes(VIEW_ACCT)) fail.push(`A: pill does not name the account: "${pillText}"`)
if (pill && !/read-only/i.test(pillText)) fail.push(`A: pill does not say read-only: "${pillText}"`)

// 2. Live chain cards still render with their meters (the view still WORKS).
const cards = await page.$$eval('article[data-rarity]', (els) =>
  els.map((el) => ({
    rarity: el.getAttribute('data-rarity'),
    stage: el.getAttribute('data-stage'),
    hasMeter: /💤\s*Sleep|🍽️\s*Satiety/.test(el.innerText),
  })),
)
if (cards.length === 0) fail.push('A: no chain cards rendered')
if (cards.some((c) => !c.hasMeter)) fail.push('A: a card lost its Sleep/Satiety meter')

// 3. ZERO sign-capable controls anywhere on the page.
const forbidden = [
  ['feed button', '[data-testid="feed-btn"]'],
  ['evolve button', '[data-testid^="evolve-"]:not([data-testid^="evolve-hint"])'],
  ['pin button', '[data-testid^="pin-"]'],
  ['rename button', '[data-testid^="rename-"]'],
  ['clear-name button', '[data-testid^="clear-name-"]'],
]
for (const [label, sel] of forbidden) {
  const n = await page.locator(sel).count()
  if (n > 0) fail.push(`A: ${label} present (${n}×) in spectator view`)
}
// BUTTONS only — informational copy legitimately says "burn fees" etc.
for (const text of ['Wake now', 'Hatch Egg', '🔥 Burn', 'Disconnect', '🔓']) {
  const n = await page.locator('button', { hasText: text }).count()
  if (n > 0) fail.push(`A: "${text}" button present (${n}×) in spectator view`)
}

// 4. Harvest / Claim quick actions render (live numbers) but are dead.
//    (The "🌾 Farm" TAB shares the emoji — it's navigation, not an action.)
const quick = await page.$$eval('button', (els) =>
  els
    .filter((b) => /🌾|🎁/.test(b.innerText) && b.innerText.trim() !== '🌾 Farm')
    .map((b) => ({ label: b.innerText.slice(0, 30).replace(/\n/g, ' '), disabled: b.disabled })),
)
if (quick.length === 0) fail.push('A: quick-action buttons missing entirely (info lost)')
quick.forEach((q) => { if (!q.disabled) fail.push(`A: quick action ENABLED in spectator view: ${q.label}`) })

// 5. Breeding tab: parent SELECTION stays clickable (pure UI state); the one
//    button that signs — "Breed Now" — must be disabled.
await page.getByText('🧬 Breeding').click()
await page.waitForTimeout(400)
// "Breed Now" only appears once a parent is picked — pick two, then assert.
const parentPicks = page.locator('button', { hasText: 'Ready to breed' })
if (await parentPicks.count() >= 2) {
  await parentPicks.nth(0).click()
  await parentPicks.nth(1).click()
  await page.waitForTimeout(300)
}
const breedBtns = await page.$$eval('button', (els) =>
  els.filter((b) => /breed now/i.test(b.innerText)).map((b) => ({ label: b.innerText.slice(0, 40), disabled: b.disabled })),
)
if (breedBtns.length === 0) fail.push('A: Breed Now button not found (breeding page broken?)')
breedBtns.forEach((b) => { if (!b.disabled) fail.push(`A: Breed Now ENABLED in spectator view`) })
await page.screenshot({ path: 'hittest-view-readonly.png', fullPage: true })

// ── PART B: normal (demo) cards still show their action controls ─────────────
// Proves the "hide when handler absent" change didn't strip buttons from real
// gameplay. ?feedlab passes onFeed (Feed buttons); ?demo passes onEvolve too.
await page.goto(`${BASE}?feedlab`, { waitUntil: 'networkidle' })
await page.waitForSelector('article[data-rarity]', { timeout: 10000 })
await page.waitForTimeout(600)
const feedBtns = await page.locator('[data-testid="feed-btn"]').count()
if (feedBtns === 0) fail.push('B: feedlab lost its Feed buttons')

await page.goto(`${BASE}?demo`, { waitUntil: 'networkidle' })
await page.waitForSelector('article[data-rarity]', { timeout: 10000 })
await page.waitForTimeout(600)
const evolveBtns = await page.locator('[data-testid^="evolve-"]:not([data-testid^="evolve-hint"])').count()
if (evolveBtns === 0) fail.push('B: demo dashboard lost its Evolve buttons')

await browser.close()

console.log('===== PART A: spectator ?view=' + VIEW_ACCT + ' =====')
console.log('  pill      :', pill ? `"${pillText.replace(/\n/g, ' ')}"` : 'MISSING')
console.log('  cards     :', cards.length, JSON.stringify(cards))
console.log('  quick     :', JSON.stringify(quick))
console.log('  breed     :', JSON.stringify(breedBtns))
console.log('===== PART B: feedlab controls =====')
console.log('  feed buttons  :', feedBtns)
console.log('  evolve buttons:', evolveBtns)
console.log('\n===== SUMMARY =====')
console.log('JS errors:', errors.length, errors.slice(0, 5))
console.log('FAILURES :', fail.length)
fail.forEach((f) => console.log('  -', f))
console.log(fail.length === 0 && errors.length === 0 ? '\nRESULT: PASS' : '\nRESULT: FAIL')
process.exit(fail.length === 0 && errors.length === 0 ? 0 : 1)
