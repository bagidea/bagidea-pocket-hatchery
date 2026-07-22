// On-chain rename verification — proves a creature's name comes from the NFT
// itself, and that the SAME name shows on the creature card AND in the farm.
//
// This is the bug the CEO reported: renaming a creature changed its card and left
// the farm (and the NFT) on the old name, because the name was a local preference
// stored plugin-side. It is now written on chain by `setname`
// (atomicassets::setassetdata → the NFT's mutable data) and read back off chain.
//
// NOTHING is intercepted here. The page connects as the daemon's selected account
// through the real "Connect via waxwing" path and reads the live chain, so the
// names asserted below are the bytes sitting in the NFTs' mutable data right now.
//
// Two names were set on wax-testnet by real setname transactions:
//   asset 1099603751834 → "Ember Queen"  tx 05bbea5e9d43458b669aec04ab658dc061d40f2e63eb2ce018d51fc6b75f3942
//   asset 1099603752017 → "Sparkplug"    tx 518b7cd5bbf8da7495eff82372037b823c7335a476b6115cf462c2de72a9ee02
//
// Usage: node verify-onchain-rename.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const BASE = process.argv[2] || 'http://127.0.0.1:8787/plugin/pocket-hatchery/'
const PANEL = BASE.replace(/\/$/, '') + '/panel.html'

// The names now living in NFT mutable data, and the assets they belong to.
const EXPECT = [
  { assetId: '1099603751834', name: 'Ember Queen' },
  { assetId: '1099603752017', name: 'Sparkplug' },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

try {
  console.log(`\n═══ On-chain rename — ${PANEL} ═══`)
  await page.goto(PANEL, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Connect via waxwing")')
  // Wait for the farm (the default tab) to place its agents from the live read.
  await page.waitForSelector('[data-testid="farm-agent"]', { timeout: 20000 })
  await page.waitForTimeout(2500)

  // ── ① FARM — the surface that used to keep showing the species name ──
  const farmTags = await page.$$eval('[data-testid="farm-agent"]', (els) =>
    els.map((e) => ({
      assetId: e.getAttribute('data-asset'),
      tag: e.querySelector('span:last-of-type')?.textContent?.trim() ?? '',
      title: e.getAttribute('title') ?? '',
    })),
  )
  console.log('① farm tags:', JSON.stringify(farmTags))
  for (const e of EXPECT) {
    const hit = farmTags.find((f) => f.assetId === e.assetId)
    check(
      `① farm shows the on-chain name "${e.name}" for ${e.assetId}`,
      !!hit && hit.tag === e.name && hit.title.startsWith(e.name),
      JSON.stringify(hit),
    )
  }
  await page.screenshot({ path: join(outDir, 'onchain-rename-farm.png'), fullPage: false })

  // ── ② CREATURE CARDS — the same string, from the same read ──
  await page.click('button:has-text("🐾 Creatures")')
  await page.waitForTimeout(1200)
  const cardNames = {}
  for (const e of EXPECT) {
    cardNames[e.assetId] = await page
      .$eval(`[data-testid="name-${e.assetId}"] span`, (el) => el.textContent.trim())
      .catch(() => null)
  }
  console.log('② card names:', JSON.stringify(cardNames))
  for (const e of EXPECT) {
    check(`② card shows the on-chain name "${e.name}" for ${e.assetId}`, cardNames[e.assetId] === e.name)
  }

  // ── ③ Card and farm agree — the actual regression under test ──
  for (const e of EXPECT) {
    const farm = farmTags.find((f) => f.assetId === e.assetId)?.tag
    check(`③ farm and card agree on ${e.assetId}`, farm === cardNames[e.assetId], `farm=${farm} card=${cardNames[e.assetId]}`)
  }

  // ── ④ Search matches the on-chain name (it feeds the collection filter) ──
  await page.fill('[data-testid="creature-search"]', 'Sparkplug')
  await page.waitForTimeout(500)
  const shown = await page.$$eval('[data-testid^="name-"]', (els) => els.map((e) => e.textContent.trim()))
  check('④ searching the on-chain name filters to that creature', shown.length === 1 && shown[0].startsWith('Sparkplug'), JSON.stringify(shown))
  await page.fill('[data-testid="creature-search"]', '')
  await page.waitForTimeout(400)

  await page.screenshot({ path: join(outDir, 'onchain-rename-cards.png'), fullPage: true })

  check('⑤ no runtime errors on the page', errors.length === 0, errors.join(' | '))
  console.log('  📸 onchain-rename-farm.png · onchain-rename-cards.png')
} catch (e) {
  fail++
  console.log(`  ❌ threw: ${e.message}`)
  await page.screenshot({ path: join(outDir, 'onchain-rename-ERR.png'), fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
