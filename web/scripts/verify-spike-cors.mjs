// verify-spike-cors.mjs — DEFINITIVE browser-level proof of the CORS decision.
//
// The CEO SPIKE: the game runs on Vite :5173, waxwing lives on the daemon :8787.
// Can the browser call :8787/plugin/wax-wallet/cmd directly (CORS), or must we
// same-origin via a proxy? This script answers it in a REAL browser (chromium),
// not just by inspecting headers — so there is zero doubt about what the browser
// will actually do.
//
//   1. DIRECT cross-origin :5173 → :8787   → expect the browser to BLOCK it
//      (no Access-Control-Allow-Origin + OPTIONS preflight 404s on the daemon).
//   2. PROXY same-origin  :5173 → /office/* → expect the daemon to ANSWER.
//   3. NETWORK SWITCHER  ?network=wax-mainnet vs default wax-testnet → expect the
//      landing footer to reflect the active network (drives RPC/contract/wallet).
//
// Run with the Vite dev server already up on :5173:
//   node scripts/verify-spike-cors.mjs

import { chromium } from 'playwright'

const APP = 'http://127.0.0.1:5173'
const DAEMON_DIRECT = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd'
const PROXY = `${APP}/office/plugin/wax-wallet/cmd`
const BODY = JSON.stringify({ cmd: 'network', args: {} })

const pass = []
const fail = []
function check(name, cond, detail) {
  ;(cond ? pass : fail).push({ name, detail })
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// Land on the app first so the page origin is :5173 — relative `/office/*` then
// resolves same-origin, and the direct :8787 call is genuinely cross-origin.
await page.goto(APP, { waitUntil: 'networkidle' })

// ── 1. DIRECT cross-origin call (browser-enforced CORS) ─────────────────────
let directErr = null
let directOk = false
try {
  const res = await page.evaluate(
    async ({ url, body }) => {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })
        return { ok: true, status: r.status }
      } catch (e) {
        // A CORS failure throws a TypeError BEFORE the response can be read.
        return { ok: false, error: String(e) }
      }
    },
    { url: DAEMON_DIRECT, body: BODY },
  )
  directOk = res.ok
  directErr = res.error || null
} catch (e) {
  directErr = String(e)
}
check(
  'direct :5173→:8787 is BLOCKED by browser (CORS)',
  !directOk,
  directOk ? 'unexpectedly succeeded' : (directErr || '').split('\n')[0].slice(0, 90),
)

// ── 2. PROXY same-origin call ───────────────────────────────────────────────
const proxied = await page.evaluate(
  async ({ url, body }) => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      return { status: r.status, json: await r.json() }
    } catch (e) {
      return { status: 0, error: String(e) }
    }
  },
  { url: PROXY, body: BODY },
)
check(
  'proxy /office/* reaches the daemon',
  proxied.status === 200 && proxied.json?.ok && proxied.json?.network?.id === 'wax-testnet',
  `status=${proxied.status} network=${proxied.json?.network?.id ?? '?'}`,
)

// ── 3. NETWORK SWITCHER (URL param reflection) ──────────────────────────────
async function footerFor(query) {
  await page.goto(`${APP}/${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  // The landing footer reads "Free to play · <NETWORK.label>". Pull the whole
  // visible body text so we are robust against CSS-module class hashing.
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim()
}

const testnetTxt = await footerFor('')
check(
  'default ?network= → WAX Testnet',
  testnetTxt.includes('WAX Testnet'),
  `footer contains "${testnetTxt.match(/Free to play · [^"]*/)?.[0] ?? '?'}"`,
)

const mainnetTxt = await footerFor('?network=wax-mainnet')
check(
  '?network=wax-mainnet → WAX Mainnet',
  mainnetTxt.includes('WAX Mainnet'),
  `footer contains "${mainnetTxt.match(/Free to play · [^"]*/)?.[0] ?? '?'}"`,
)

// Both connect buttons present on the landing (WCW + waxwing).
const landingTxt = mainnetTxt
check(
  'landing shows BOTH connect options (WCW + waxwing)',
  landingTxt.includes('WAX Cloud Wallet') && landingTxt.includes('waxwing'),
  `WCW=${landingTxt.includes('WAX Cloud Wallet')} waxwing=${landingTxt.includes('waxwing')}`,
)

await browser.close()

console.log(`\n${pass.length} passed, ${fail.length} failed`)
process.exit(fail.length === 0 ? 0 : 1)
