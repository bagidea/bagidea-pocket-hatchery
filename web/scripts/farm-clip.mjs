import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const URL = process.argv[2]
const DIR = process.argv[3] || 'scripts/clip'
mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1280,900'] })
const context = await browser.newContext({
  viewport: { width: 1200, height: 820 },
  recordVideo: { dir: DIR, size: { width: 1200, height: 820 } },
})
const page = await context.newPage()
await page.goto(URL, { waitUntil: 'load' })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="farm-agent"]').length >= 21, null, { timeout: 15000 })
await page.waitForTimeout(8000) // ~8s of the living farm
await context.close() // flushes the video file
await browser.close()
console.log('video saved under', DIR)
