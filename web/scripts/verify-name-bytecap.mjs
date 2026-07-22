// Rename input caps by UTF-8 BYTES, not characters.
//
// setname() checks `new_name.size() <= 32` — std::string::size() is BYTES. The
// input used to cap with maxLength={32}, which counts UTF-16 units, so a Thai or
// emoji name could pass the UI and be bounced by the chain AFTER the player had
// already signed and paid CPU.
//
// Types real multi-byte names into the live panel's rename field and asserts
// what the field will actually submit. Nothing is signed: every waxwing
// buildaction is blocked, and each case ends with Escape (which discards the
// draft) rather than Enter.
//
// Usage: node verify-name-bytecap.mjs [baseUrl]
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const ASSET = '1099603751834' // "Ember Queen" on chain

const bytes = (s) => new TextEncoder().encode(s).length

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

// Belt and braces: this script must never be able to submit a rename.
await page.route('**/plugin/wax-wallet/cmd', async (route) => {
  let body = {}
  try { body = JSON.parse(route.request().postData() || '{}') } catch {}
  if (body.cmd === 'buildaction') return route.abort()
  await route.continue()
})

await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.click('button:has-text("Connect via waxwing")')
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 30_000 })
await page.click('button:has-text("🐾 Creatures")')
await page.waitForSelector(`[data-testid="name-${ASSET}"]`, { timeout: 30_000 })

const CASES = [
  // 12 Thai chars = 36 bytes. Under a 32-CHAR cap it sails through; over 32 bytes.
  { label: 'Thai', text: 'เจ้าไฟผู้ยิ่งใหญ่แห่งเปลวเพลิง' },
  // Emoji are surrogate pairs in UTF-16, 4 bytes each in UTF-8.
  { label: 'emoji', text: '🐉🔥🐉🔥🐉🔥🐉🔥🐉🔥' },
  // ASCII still caps at 32, unchanged behaviour.
  { label: 'ASCII', text: 'A'.repeat(50) },
]

for (const c of CASES) {
  await page.click(`[data-testid="name-${ASSET}"] button`)
  const input = page.locator(`[data-testid="name-input-${ASSET}"]`)
  await input.waitFor({ timeout: 10_000 })
  await input.fill('')
  await input.type(c.text)
  const value = await input.inputValue()

  check(`${c.label}: value is ≤ 32 bytes (got ${bytes(value)})`, bytes(value) <= 32, JSON.stringify(value))
  check(`${c.label}: value is a prefix of what was typed`, c.text.startsWith(value), JSON.stringify(value))
  check(`${c.label}: no broken/replacement character at the cut`,
        !/[�]/.test(value) && !/[\uD800-\uDBFF]$/.test(value))
  if (c.label !== 'ASCII') {
    check(`${c.label}: a 32-CHAR cap would have let this through (the old bug)`,
          bytes(c.text.slice(0, 32)) > 32, `${bytes(c.text.slice(0, 32))} bytes`)
  }

  await input.press('Escape')
}

await browser.close()
console.log(`\n${pass}/${pass + fail} passed`)
process.exit(fail ? 1 : 0)
