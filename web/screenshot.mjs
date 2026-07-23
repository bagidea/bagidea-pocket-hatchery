import { chromium } from 'playwright'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function shot(label) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('http://localhost:5173/plugin/pocket-hatchery/static/?demo', {
    waitUntil: 'networkidle',
    timeout: 15000,
  })
  // Let animations settle
  await page.waitForTimeout(1800)
  const path = join(__dirname, `../${label}.png`)
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  console.log('saved:', path)
}

const label = process.argv[2] || 'screenshot'
shot(label).catch(e => { console.error(e); process.exit(1) })
