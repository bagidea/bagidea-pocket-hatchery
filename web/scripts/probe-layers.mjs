// Are the 21 creatures actually on their own compositor layers? If a walk repaints
// (not just re-composites), they are NOT — and that is the raster storm. This reads
// the real CDP LayerTree: how many compositing layers exist and whether the agent
// nodes each back one.  Usage: [FPS_CHANNEL=chrome] node probe-layers.mjs [baseUrl]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/static/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'
const CHANNEL = process.env.FPS_CHANNEL || ''

const browser = await chromium.launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.route('**/plugin/wax-wallet/cmd', async (route) => {
  let c = ''; try { c = JSON.parse(route.request().postData() || '{}').cmd } catch {}
  if (c !== 'status') return route.continue()
  const res = await route.fetch(); const b = await res.json()
  for (const a of b?.status?.accounts ?? []) a.selected = a.account === 'waxwingsuper' && a.permission === 'active'
  await route.fulfill({ response: res, body: JSON.stringify(b) })
})
await page.goto(PANEL, { waitUntil: 'networkidle' })
await page.click('button:has-text("Connect via waxwing")')
await page.waitForSelector('button:has-text("Farm")', { timeout: 20000 })
await page.click('button:has-text("Farm")')
await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
await page.$eval('[data-testid="farm-stage"]', (e) => e.scrollIntoView({ block: 'center' }))
await page.waitForTimeout(1500)

const client = await page.context().newCDPSession(page)
await client.send('DOM.enable')
await client.send('LayerTree.enable')
const layers = await new Promise((resolve) => {
  client.once('LayerTree.layerTreeDidChange', (e) => resolve(e.layers || []))
  setTimeout(() => resolve([]), 3000)
})
// Compositing reasons for a few nodes tell us WHY (or why not) they're promoted.
let agentLayerCount = 0, sample = null
for (const l of layers) {
  if (!l.backendNodeId) continue
  try {
    const { reasons } = await client.send('LayerTree.compositingReasons', { layerId: l.layerId })
    // Heuristic: agent layers are ~ the sprite box size.
    if (l.width > 60 && l.width < 320 && l.height > 60 && l.height < 320) {
      agentLayerCount++
      if (!sample) sample = { w: l.width, h: l.height, reasons }
    }
  } catch {}
}

const agentDomCount = await page.$$eval('[data-testid="farm-agent"]', (e) => e.length)
console.log(`\n══ Layer tree ══`)
console.log(`  total compositing layers: ${layers.length}`)
console.log(`  agent DOM nodes: ${agentDomCount}`)
console.log(`  layers sized like an agent box (60–320px): ${agentLayerCount}`)
console.log(`  sample agent-sized layer: ${sample ? `${Math.round(sample.w)}x${Math.round(sample.h)} · reasons: ${sample.reasons.join(', ') || '(none)'}` : 'NONE FOUND — creatures are NOT composited'}`)
console.log(`\n  all layer sizes: ${layers.map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`).join('  ')}`)

await page.close(); await browser.close()
