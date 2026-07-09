import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
})

async function snap(name, url) {
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const path = join(outDir, name)
  await page.screenshot({ path, fullPage: true })
  console.log(`screenshot: ${path}`)
  await page.close()
}

try {
  await snap('01-landing-connect.png', 'http://127.0.0.1:5173/')
  await snap('02-dashboard-demo.png', 'http://127.0.0.1:5173/?demo=1')
  await snap('03-dashboard-preview-chain.png', 'http://127.0.0.1:5173/?preview=waxwingsuper')
} finally {
  await browser.close()
}
