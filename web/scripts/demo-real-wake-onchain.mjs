/**
 * demo-real-wake-onchain.mjs — the REAL on-chain demo the task requires.
 *
 * Drives the ACTUAL deployed panel (served by the office daemon from
 * plugins/pocket-hatchery, the FIXED bundle) against the REAL wax-testnet chain
 * and the REAL waxwing daemon wallet — NO mocks, NO route intercepts.
 *
 * Flow:
 *   1. Open the deployed panel, Connect via waxwing (as waxwingsuper).
 *   2. Find the live SLEEPING stage-0 egg card (data-asleep=1) — seeded by a real
 *      on-chain `hatch` just before this run.
 *   3. Click "⚡ Wake now" → the panel builds a REAL sign-intent in the daemon.
 *   4. This script confirms that intent via the daemon (real WAX transfer broadcast
 *      with memo wake:<asset_id>) — exactly what tapping Sign in waxwing does.
 *   5. Assert the card SELF-REFRESHES from asleep→awake with NO page reload
 *      (that is the fix: play.ts run() → refreshUntilChanged polls the chain).
 *
 * Usage: node scripts/demo-real-wake-onchain.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

const DAEMON = 'http://127.0.0.1:8787'
const PANEL = `${DAEMON}/plugin/pocket-hatchery/static/panel.html`
const CMD = `${DAEMON}/plugin/wax-wallet/cmd`

let failures = 0
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }
const ok = (m) => console.log(`  ✅ ${m}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cmd(body) {
  const r = await fetch(CMD, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return r.json()
}

// Watch the daemon for the sign-intent the panel builds, then confirm (broadcast)
// it — this is the programmatic equivalent of the player tapping Sign in waxwing.
async function confirmPanelIntentWhenReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const s = await cmd({ cmd: 'status', args: '' })
    const pend = s?.status?.pendingIntents || []
    const wake = pend.find((i) => /wake/i.test(i.label || '') || /transfer/i.test(i.action || ''))
    if (wake) {
      console.log(`  → panel built intent ${wake.id} (${wake.label}) — confirming (real broadcast)…`)
      const res = await cmd({ cmd: 'confirm', args: wake.id })
      if (res?.ok) { console.log(`  → broadcast ok · txid ${String(res.txid || res.txId || '').slice(0, 12)}…`); return true }
      console.log(`  → confirm failed: ${res?.msg || res?.error || JSON.stringify(res)}`)
      return false
    }
    await sleep(400)
  }
  console.log('  → no pending wake intent appeared within timeout')
  return false
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } })
const errors = []
let navigations = 0
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++ })

try {
  console.log(`\n═══ REAL on-chain Wake demo — ${PANEL} ═══`)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Connect via waxwing/i }).click()

  // Real chain read → the live sleeping egg card must appear.
  await page.waitForSelector('article[data-asleep="1"]', { timeout: 20000 })
  await sleep(1200)

  const sleeper = page.locator('article[data-asleep="1"]').first()
  const idTag = (await sleeper.locator('text=/#\\d{4}/').first().textContent().catch(() => '')) || ''
  console.log(`① sleeping egg card rendered from LIVE chain (card id ${idTag.trim()})`)
  check('card is ASLEEP (data-asleep=1)', (await sleeper.getAttribute('data-asleep')) === '1')

  const wakeBtn = sleeper.getByRole('button', { name: /Wake now/i })
  check('② "⚡ Wake now · N WAX" button present on the sleeping card', (await wakeBtn.count()) > 0)

  // Marker to prove the page never reloads across the whole flow.
  await page.evaluate(() => { window.__demoNoReload = 'alive' })
  const navsBefore = navigations

  await page.screenshot({ path: join(outDir, 'real-wake-BEFORE.png'), fullPage: true })
  console.log('  📸 real-wake-BEFORE.png')

  // ── ACT: tap Wake, then confirm the real intent via the daemon in parallel ──
  console.log('③ clicking Wake now → panel builds a real sign-intent…')
  const confirmP = confirmPanelIntentWhenReady()
  await wakeBtn.first().click()
  const confirmed = await confirmP
  check('③ real WAX wake transfer broadcast on-chain', confirmed === true)

  // ── AFTER: the SAME card must flip asleep→awake on its own (refreshUntilChanged) ──
  console.log('④ waiting for the card to SELF-REFRESH to awake (no reload)…')
  const flipped = await page.waitForFunction(() => {
    // The formerly-sleeping card is now awake → data-asleep flips to 0 and the
    // sleeper (data-asleep=1) count for our egg drops. Simplest robust signal:
    // there is no longer a card stuck asleep that also shows a Wake button.
    const asleepCards = [...document.querySelectorAll('article[data-asleep="1"]')]
    const stillWakeable = asleepCards.some((c) => /Wake now/i.test(c.textContent || ''))
    return !stillWakeable
  }, { timeout: 30000 }).then(() => true).catch(() => false)

  await sleep(600)
  check('④ card SELF-REFRESHED asleep→awake with no manual reload', flipped === true)

  const alive = await page.evaluate(() => window.__demoNoReload)
  check('⑤ page never reloaded during the flow (in-place refresh)', alive === 'alive' && navigations === navsBefore,
    `marker=${alive} navs=${navigations - navsBefore}`)

  check('⑥ no runtime errors on the page', errors.length === 0, errors.join(' | '))

  await page.screenshot({ path: join(outDir, 'real-wake-AFTER.png'), fullPage: true })
  console.log('  📸 real-wake-AFTER.png')
} catch (e) {
  bad(`threw: ${e.message}`)
  await page.screenshot({ path: join(outDir, 'real-wake-ERR.png'), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

function check(name, cond, detail = '') {
  if (cond) ok(name); else bad(`${name}${detail ? ' — ' + detail : ''}`)
}

console.log(failures === 0
  ? '\n═══ REAL WAKE DEMO PASS — live egg woken on-chain, panel self-refreshed. ═══\n'
  : `\n═══ ${failures} CHECK(S) FLAGGED ═══\n`)
process.exit(failures === 0 ? 0 : 1)
