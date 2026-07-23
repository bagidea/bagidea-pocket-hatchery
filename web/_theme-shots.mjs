// Full-page BEFORE/AFTER theme screenshots — renders the REAL deployed plugin
// bundle headlessly against a local static server so we can compare the light
// shell (backup bundle) vs the new dark shell (live plugin bundle) on the exact
// same wallet-free routes. Poppy · 2026-07-16.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const OFFICE = 'E:/Projects/bagidea-ai-agents-office'
const PLUGIN_ASSETS = path.join(OFFICE, 'plugins/pocket-hatchery/assets')   // shared png/svg/fonts
const BACKUP = path.join(OFFICE, process.argv[2] || '')                     // BEFORE bundle dir (index.js/css)
const OUT = path.join(process.cwd(), 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const INDEX_HTML = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Pocket Hatchery</title>
<script type="module" crossorigin src="/plugin/pocket-hatchery/static/assets/index.js"></script>
<link rel="stylesheet" crossorigin href="/plugin/pocket-hatchery/static/assets/index.css"></head>
<body><div id="root"></div></body></html>`

const MIME = { '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml',
  '.png':'image/png', '.woff':'font/woff', '.woff2':'font/woff2', '.json':'application/json' }

// bundleDir: where index.js/index.css come from (backup=BEFORE, plugin=AFTER)
function makeServer(bundleDir) {
  return http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0])
    const prefix = '/plugin/pocket-hatchery/static/assets/'
    if (url.startsWith(prefix)) {
      const rel = url.slice(prefix.length)
      // index.js/css from the chosen bundle; everything else (images/fonts/svg) shared
      const base = (rel === 'index.js' || rel === 'index.css') ? bundleDir : PLUGIN_ASSETS
      const f = path.join(base, rel)
      if (fs.existsSync(f)) {
        res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream')
        return res.end(fs.readFileSync(f))
      }
      res.statusCode = 404; return res.end('nf')
    }
    if (url === '/favicon.svg') { res.statusCode = 204; return res.end() }
    res.setHeader('content-type', 'text/html'); res.end(INDEX_HTML)  // SPA fallback
  })
}

const ROUTES = [
  { q: '?dash',     name: 'dashboard', wait: 1400 },  // header/chips/hero/odds/tabs/empty/quick-actions
  { q: '',          name: 'landing',   wait: 1000 },  // connect-wallet UI
  { q: '?feedlab',  name: 'feedlab',   wait: 1600 },  // card grid in the dark gallery
]

async function shoot(label, bundleDir) {
  const server = makeServer(bundleDir)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  for (const r of ROUTES) {
    await page.goto(`http://127.0.0.1:${port}/${r.q}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(r.wait)
    const file = path.join(OUT, `theme-${label}-${r.name}.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log(`  ${label}/${r.name} -> ${file}`)
  }
  if (errs.length) console.log(`  [${label}] pageerrors:`, errs.slice(0, 3))
  await browser.close()
  await new Promise((r) => server.close(r))
}

console.log('BEFORE bundle:', BACKUP)
await shoot('before', BACKUP)
console.log('AFTER bundle:', PLUGIN_ASSETS)
await shoot('after', PLUGIN_ASSETS)
console.log('done')
