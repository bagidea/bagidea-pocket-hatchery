// Headless blink capture: load a raw species SVG (SMIL intact), seek the
// animation clock to the blink peak, and screenshot the face. Proves the eye
// reads as a CLOSED EYE, not a "circle appearing in the middle of the eye".
//
// Usage: node scripts/shoot-blink.mjs <species> <peakSeconds> <outLabel>
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const species = process.argv[2] || 'foxling'
const peak = parseFloat(process.argv[3] || '4.0')
const label = process.argv[4] || species

const svg = readFileSync(join(__dir, `../public/assets/creatures/${species}.svg`), 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 440, deviceScaleFactor: 2 } })
await page.setContent(
  `<body style="margin:0;background:#0C1022;display:grid;place-items:center;height:100vh">
     <div id="host" style="width:400px;height:400px">${svg}</div>
   </body>`,
  { waitUntil: 'load' },
)

// Freeze the SMIL clock at the blink peak so the shot is deterministic.
await page.evaluate((t) => {
  const svg = document.querySelector('#host svg')
  svg.setAttribute('width', '400')
  svg.setAttribute('height', '400')
  svg.pauseAnimations()
  svg.setCurrentTime(t)
}, peak)
await page.waitForTimeout(120)

const out = join(__dir, `../screenshots/blink-${label}.png`)
await page.locator('#host').screenshot({ path: out })
console.log('wrote', out)
await browser.close()
