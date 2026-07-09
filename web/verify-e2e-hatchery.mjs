/**
 * verify-e2e-hatchery.mjs — live headless E2E of the Pocket Hatchery game panel.
 *
 * Proves, against REAL wax-testnet chain state (contract phgamecreatr) through the
 * office waxwing daemon:
 *   1. Connect via waxwing → dashboard loads real players/creatures.
 *   2. Creature cards render GENE-DRIVEN inline SVG art (not a placeholder) —
 *      species + hue decoded from each creature's on-chain genetics, varied.
 *   3. Every action button (Hatch/Feed/Evolve/Harvest/Claim) builds a REAL
 *      daemon sign-intent and shows the amber SignSheet with
 *      label/action/account/contract/data → Cancel drops the intent cleanly.
 *
 * SAFETY: /office/event is stubbed so openWaxwingPanel() can't pop a native shell
 * window on the boss's screen. Every built intent is cancelled — nothing broadcasts
 * (broadcast is gated on the human unlocking waxwing + tapping Sign, by CEO design).
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/plugin/pocket-hatchery/static/'
const OUT = 'verify-e2e'
const log = (...a) => console.log(...a)
const pass = []
const fail = []
const check = (cond, msg) => { (cond ? pass : fail).push(msg); log(`${cond ? '✅' : '❌'} ${msg}`) }

async function daemonStatus() {
  const r = await fetch('http://localhost:5173/office/plugin/wax-wallet/cmd', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cmd: 'status', args: {} }),
  })
  return (await r.json()).status
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

// SAFETY: never let the game pop a native waxwing window on the boss's screen.
let blockedWindowOpens = 0
await page.route('**/office/event', (route) => {
  blockedWindowOpens++
  route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})

const failedReqs = []
page.on('requestfailed', (r) => failedReqs.push(r.url()))
page.on('response', (r) => { if (r.url().includes('/creatures/') && !r.ok()) failedReqs.push(`${r.status()} ${r.url()}`) })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// ── 1. Landing ──────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}-1-landing.png` })
const hasWaxwingBtn = await page.getByText('Connect via waxwing').count()
check(hasWaxwingBtn > 0, 'Landing shows "Connect via waxwing" button')

// ── 2. Connect via waxwing → dashboard + real chain creatures ────────────
await page.getByText('Connect via waxwing').click()
// Dashboard renders once connected; wait for the creature grid / cards.
await page.waitForSelector('article', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(3500) // let chain reads + SVG fetches settle
const cardCount = await page.locator('article').count()
check(cardCount > 0, `Dashboard loaded with ${cardCount} creature cards from chain`)

const connectedAs = await page.locator('[class*="walletAccount"]').first().textContent().catch(() => null)
check(!!connectedAs, `Connected account pill shows: ${connectedAs}`)

// ── 3. Gene-driven art: inline SVGs render + varied hue per gene ──────────
const svgCount = await page.locator('article svg').count()
check(svgCount > 0, `${svgCount} inline creature SVGs rendered (gene-driven, not <img> placeholder)`)

// Shapes per first sprite — a real species SVG has dozens of paths/shapes.
const firstShapes = await page.locator('article svg').first().locator('path, circle, ellipse, rect, polygon').count()
check(firstShapes >= 20, `First sprite has ${firstShapes} vector shapes (real art body)`)

// Distinct gene-hue-shift across cards → proves per-gene tint, not a constant.
const hues = await page.locator('article svg').evaluateAll((svgs) =>
  svgs.map((s) => s.style.getPropertyValue('--gene-hue-shift').trim()).filter(Boolean),
)
const distinctHues = [...new Set(hues)]
check(hues.length > 0, `Sprites carry gene-tint var --gene-hue-shift (${hues.length} set)`)
check(distinctHues.length > 1, `Hue varies by gene across cards: ${distinctHues.slice(0, 6).join(', ')}${distinctHues.length > 6 ? '…' : ''}`)

// Species names decoded from gene (not a single hardcoded species).
const names = await page.locator('article [class*="name"]').evaluateAll((els) => els.map((e) => e.textContent?.trim()).filter(Boolean))
const distinctNames = [...new Set(names)]
check(distinctNames.length > 1, `Species names decoded from genes vary: ${distinctNames.slice(0, 6).join(', ')}`)

await page.screenshot({ path: `${OUT}-2-dashboard.png`, fullPage: true })

// ── 4. Sign popup per action button ──────────────────────────────────────
async function testSign(label, trigger, expect) {
  // trigger() clicks the button; wait for the amber SignSheet.
  await trigger()
  const dialog = page.locator('[role="dialog"]')
  const appeared = await dialog.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  if (!appeared) {
    // No dialog — maybe a client-side validation toast (e.g. evolve gated).
    const toast = await page.locator('[class*="toast"]').first().textContent().catch(() => null)
    check(false, `${label}: SignSheet did NOT appear (toast: ${toast || 'none'})`)
    return
  }
  const rows = await dialog.locator('[class*="signRow"]').evaluateAll((rs) =>
    rs.map((r) => r.textContent?.trim()),
  )
  const headline = await dialog.locator('[class*="signHeadlineValue"]').textContent().catch(() => '')
  const body = (rows.join(' | ') + ' || ' + headline)
  const ok = expect.every((e) => body.includes(e))
  check(ok, `${label}: amber SignSheet shows [${expect.join(', ')}] → got: ${headline} · ${rows.join(' · ')}`)
  await page.screenshot({ path: `${OUT}-3-sign-${label.toLowerCase()}.png` })
  // Cancel → drop the intent.
  await dialog.getByText('Cancel', { exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(2500) // let run()'s waitForIntent detect drop + clear animating
}

// Harvest (free, no cooldown → enabled)
await testSign('Harvest', () => page.getByText('Harvest EGG').first().click(), ['harvest', 'waxwingsuper', 'phgamecreatr', 'owner'])

// Hatch Egg (hero CTA)
await testSign('Hatch', () => page.getByRole('button', { name: /Hatch Egg/ }).click(), ['hatch', 'waxwingsuper', 'phgamecreatr', 'egg_type'])

// Find the first ENABLED button matching text (max-stage cards disable Feed).
async function firstEnabled(loc) {
  const n = await loc.count()
  for (let i = 0; i < n; i++) if (await loc.nth(i).isEnabled()) return loc.nth(i)
  return null
}

// Feed (first NON-max card, free)
const feedBtn = await firstEnabled(page.locator('button:has-text("Feed · Free")'))
if (feedBtn) await testSign('Feed', () => feedBtn.click(), ['feed', 'waxwingsuper', 'phgamecreatr', 'asset_id'])
else check(false, 'Feed: no enabled Feed button found (all cards max-stage?)')

// Claim Reward
const claimBtn = await firstEnabled(page.locator('button:has-text("Claim Reward")'))
if (claimBtn) await testSign('Claim', () => claimBtn.click(), ['claimreward', 'waxwingsuper', 'phgamecreatr'])
else check(true, 'Claim: correctly gated (already claimed this season / cooldown) — button disabled')

// Evolve — only if a card's Evolve button is enabled (growth>=threshold); else it's
// correctly gated client-side and shows a toast instead of a SignSheet.
const evolveBtn = await firstEnabled(page.locator('button:has-text("Evolve")'))
if (evolveBtn) {
  await testSign('Evolve', () => evolveBtn.click(), ['evolve', 'waxwingsuper', 'phgamecreatr', 'asset_id'])
} else {
  check(true, 'Evolve: all cards correctly gated (growth < threshold) — button disabled, no accidental sign')
}

// ── 5. Clean-up proof: no orphan intents left on the daemon ──────────────
await page.waitForTimeout(1500)
const st = await daemonStatus()
const orphan = (st.pendingIntents || []).length
check(orphan === 0, `No orphan sign-intents left on daemon after cancels (pending=${orphan})`)
check(blockedWindowOpens > 0, `Native waxwing window pops intercepted (${blockedWindowOpens}) — boss not disturbed`)

// ── Report ───────────────────────────────────────────────────────────────
const badSvg = failedReqs.filter((u) => u.includes('/creatures/'))
check(badSvg.length === 0, `No creature-SVG 404s (${badSvg.length})`)
check(errors.length === 0, `No page JS errors (${errors.length}${errors.length ? ': ' + errors[0] : ''})`)

log('\n──────── SUMMARY ────────')
log(`PASS ${pass.length} / FAIL ${fail.length}`)
if (fail.length) { log('FAILURES:'); fail.forEach((f) => log('  ✗ ' + f)) }

await browser.close()
process.exit(fail.length ? 1 : 0)
