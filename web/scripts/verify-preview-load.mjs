/**
 * verify-preview-load.mjs — headless proof the BUILT app (npm run preview) loads
 * and renders both screens with every gameplay button present and no JS errors.
 *
 * Run AFTER `npm run build && npm run preview -- --port 4173` is up.
 *   node scripts/verify-preview-load.mjs
 *
 * Mirrors what the owner will actually click: the landing Connect buttons and the
 * dashboard Hatch/Harvest/Claim buttons. ?dash skips the landing straight into the
 * dashboard (connected=true), so we can assert the dashboard DOM without a wallet.
 *
 * NOTE: this proves the WEB LAYER only — buttons exist + no crash + correct labels.
 * It does NOT sign (signing needs a real wallet popup / unlocked daemon); that is
 * covered by firing the same {account,action,data} through the waxwing daemon in a
 * sibling check, which is byte-for-byte what the "Connect via waxwing" path sends.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

const BASE = process.env.BASE || 'http://127.0.0.1:4173'

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)

async function load(url, label, tag) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // let React mount + any read settle
  await page.screenshot({ path: join(outDir, `preview-${tag}.png`), fullPage: true })
  const text = () => page.evaluate(() => document.body.innerText)

  const result = { consoleErrors, pageErrors, text }
  console.log(`\n${label} (${url})`)
  return { page, browser, result, text, ok, bad }
}

// ── 1) Landing screen ─────────────────────────────────────────────────────────
const land = await load(BASE + '/', 'Landing', 'landing')
{
  const t = await land.text()
  if (/Pocket Hatchery/.test(t)) land.ok('title renders')
  else land.bad('title missing')
  if (/Connect WAX Cloud Wallet/.test(t)) land.ok('WCW connect button present')
  else land.bad('WCW connect button missing')
  if (/Connect via waxwing/.test(t)) land.ok('waxwing connect button present')
  else land.bad('waxwing connect button missing')
  if (/WAX Testnet/.test(t)) land.ok('shows active network = wax-testnet')
  else land.bad('network label missing')
  if (land.result.pageErrors.length === 0) land.ok('no JS crash')
  else land.bad('JS pageerror: ' + land.result.pageErrors.join(' | ').slice(0, 200))
}
await land.browser.close()

// ── 2) Dashboard (?dash skips landing) ────────────────────────────────────────
const dash = await load(BASE + '/?dash', 'Dashboard', 'dashboard')
{
  const t = await dash.text()
  if (/Hatch Egg/.test(t)) dash.ok('Hatch Egg button present')
  else dash.bad('Hatch Egg button missing')
  if (/Harvest EGG/.test(t)) dash.ok('Harvest button present')
  else dash.bad('Harvest button missing')
  if (/Claim Reward/.test(t)) dash.ok('Claim Reward button present')
  else dash.bad('Claim Reward button missing')
  // Resource chips always render (values are 0 until a wallet is connected, since
  // refresh() needs an actor) — the LABELS being present is what we assert.
  // Labels render UPPERCASE (CSS text-transform → innerText is uppercase).
  if (/EGG/i.test(t) && /ENERGY/i.test(t) && /\$HATCH/.test(t)) dash.ok('resource chips render')
  else dash.bad('resource chips missing')
  // Confirm the three buttons are real <button> elements (clickable), not just text.
  const btns = await dash.page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.textContent.trim()))
  for (const want of ['Hatch Egg', 'Harvest EGG', 'Claim Reward']) {
    if (btns.some((b) => b.includes(want))) dash.ok(`<button> "${want}" is a real element`)
    else dash.bad(`"${want}" is not a <button> element`)
  }
  if (dash.result.pageErrors.length === 0) dash.ok('no JS crash on dashboard')
  else dash.bad('JS pageerror: ' + dash.result.pageErrors.join(' | ').slice(0, 200))
  // Without a connected wallet refresh() is a no-op (no actor) → empty state is correct.
  if (/No creatures yet|Hatch your first egg/.test(t)) dash.ok('empty-state shown (expected: no wallet connected)')
}
await dash.browser.close()

console.log(failures === 0 ? '\n═══ PREVIEW LOAD PASS — both screens render, all buttons present, no JS crash. ═══\n'
  : `\n═══ ${failures} CHECK(S) FAILED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
