// Real-mode verification that PROVES the web client reads live chain state.
// NO proxying, NO mocking, NO route interception — the page must fetch the
// contract tables from a real wax-testnet RPC node itself, exactly like a user.
//
// Pass: EGG shows the LIVE value (150, not the 0 null-default), no "Chain read
// error", and the whole read resolves in well under the old ~17s hang.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
mkdirSync(outDir, { recursive: true })

// Dev server is expected to be running (vite HMR picks up the chain.ts fix).
const URL = 'http://127.0.0.1:5173/?preview=waxwingsuper'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } })
const page = await ctx.newPage()

const consoleErrors = []
const pageErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => pageErrors.push(e.message))

const started = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded' })

// Wait until loading resolves: either live data lands or the error line shows.
let text = ''
let attempt = 0
for (; attempt < 25; attempt++) {
  await page.waitForTimeout(400)
  text = await page.evaluate(() => document.body.innerText)
  if (/Chain read error/i.test(text)) break // errored fast — stop waiting
  if (!/Loading on-chain state/i.test(text) && /waxwingsuper/i.test(text)) break
}
const elapsedMs = Date.now() - started

// Which RPC host the client actually hit (confirms eosphere, not waxsweden).
const rpcHosts = await page.evaluate(() => window.performance?.getEntriesByType?.('resource')
  ?.map((e) => { try { return new URL(e.name).host } catch { return '' } })
  ?.filter((h) => h && /wax|eosphere|sweden|pink/.test(h)) || [])

const result = {
  elapsedMs,
  attempts: attempt,
  hasError: /Chain read error/i.test(text),
  errorSnippet: (text.match(/Chain read error.*/i) || [''])[0].slice(0, 120),
  showsAccount: /waxwingsuper/i.test(text),
  bodyExcerpt: text.replace(/\s+/g, ' ').slice(0, 400),
  rpcHosts: [...new Set(rpcHosts)],
  consoleErrors,
  pageErrors,
}
// The decisive live-data check: EGG must show the real on-chain balance (150),
// proving we read the actual players row, not the 0 null-default.
result.eggIsLive = /\b150\b/.test(text) && !result.hasError
result.fastFail = elapsedMs < 10000

await page.screenshot({ path: join(outDir, 'real-preview-live.png'), fullPage: true })

await browser.close()

const PASS = result.eggIsLive && !result.hasError && result.fastFail
console.log(JSON.stringify({ PASS, ...result }, null, 2))
process.exit(PASS ? 0 : 1)
