// Demo-loop end-to-end verification (interactive `?demo` state machine).
// Drives the LIVE dev server (http://localhost:5173/?demo) through the full
// game loop — Harvest EGG → Hatch Egg → Feed → Evolve → Claim Reward — and
// captures a screenshot at each step plus asserts the state actually reacts.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
await mkdir(outDir, { recursive: true })

const URL = 'http://localhost:5173/?demo'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })

// Helper: read a resource value off the rendered ResourceBar by its label.
async function readResource(label) {
  const bars = await page.$$eval('[class*="bar"]', (els, lab) => {
    for (const el of els) {
      const txt = el.textContent || ''
      if (txt.includes(lab)) {
        // Bar textContent is like "🥚EGG180 / 240" — the value is the FIRST
        // digit run (icon + label precede it; the cap/max follows).
        const m = txt.match(/(\d+)/)
        return m ? m[1] : null
      }
    }
    return null
  }, label)
  return bars
}

async function lastLog() {
  const logs = await page.$$eval('[class*="status"]', (els) =>
    els.map((e) => e.textContent?.trim() || '').filter(Boolean),
  )
  return logs[0] || ''
}

async function creatureCount() {
  return page.$$eval('[class*="card"]', (els) => els.length)
}

async function creatureStages() {
  // Stage badge text inside each card's art area.
  return page.$$eval('[class*="badge"]', (els) => els.map((e) => e.textContent?.trim() || ''))
}

async function clickByText(tag, text) {
  await page.locator(`${tag}:has-text("${text}")`).first().click()
}

const report = {}

// ── Step 0: load ────────────────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
report.start = {
  egg: await readResource('EGG'),
  energy: await readResource('Energy'),
  hatch: await readResource('HATCH'),
  creatures: await creatureCount(),
  stages: await creatureStages(),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-00-start.png'), fullPage: true })

// ── Step 1: Harvest EGG (x3 to bank enough for Hatch) ───────────────────────
for (let i = 1; i <= 3; i++) {
  await clickByText('button', 'Harvest EGG')
  await page.waitForTimeout(200)
}
report.harvest = {
  egg: await readResource('EGG'),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-01-harvest.png'), fullPage: true })

// ── Step 2: Hatch Egg ───────────────────────────────────────────────────────
await clickByText('button', 'Hatch Egg')
await page.waitForTimeout(300)
report.hatch = {
  egg: await readResource('EGG'),
  creatures: await creatureCount(),
  stages: await creatureStages(),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-02-hatch.png'), fullPage: true })

// ── Step 3: Feed the starter Baby (stage 1, needs 3 feeds to reach 300) ─────
const firstEvolveBtn = page.locator('button:has-text("✨ Evolve")').first()
const beforeFeedEnergy = await readResource('Energy')
for (let i = 1; i <= 3; i++) {
  await page.locator('button:has-text("🍎 Feed")').first().click()
  await page.waitForTimeout(200)
}
report.feed = {
  energyBefore: beforeFeedEnergy,
  energyAfter: await readResource('Energy'),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-03-feed.png'), fullPage: true })

// ── Step 4: Evolve that Baby → Adult ────────────────────────────────────────
await firstEvolveBtn.click()
await page.waitForTimeout(300)
report.evolve = {
  stages: await creatureStages(),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-04-evolve.png'), fullPage: true })

// ── Step 4b: grow the freshly-hatched Egg → Baby (1 feed) ───────────────────
await page.locator('button:has-text("🍎 Feed")').last().click()
await page.waitForTimeout(200)
await page.locator('button:has-text("✨ Evolve")').last().click()
await page.waitForTimeout(300)
report.evolve2 = { stages: await creatureStages(), log: await lastLog() }

// ── Step 5: Claim Reward ────────────────────────────────────────────────────
const beforeHatch = await readResource('HATCH')
await clickByText('button', 'Claim Reward')
await page.waitForTimeout(300)
report.claim = {
  hatchBefore: beforeHatch,
  hatchAfter: await readResource('HATCH'),
  log: await lastLog(),
}
await page.screenshot({ path: join(outDir, 'demo-05-claim.png'), fullPage: true })

report.consoleErrors = errors

// ── Verdicts ────────────────────────────────────────────────────────────────
const v = {}
v.harvestRaisedEgg = Number(report.harvest.egg) > Number(report.start.egg)
v.hatchAddedCreature = report.hatch.creatures > report.start.creatures
v.feedBurnedEnergy = Number(report.feed.energyAfter) < Number(report.feed.energyBefore)
v.evolveToAdult = report.evolve.stages.includes('Adult')
v.claimRaisedHatch = Number(report.claim.hatchAfter) > Number(report.claim.hatchBefore)
v.noConsoleErrors = errors.length === 0
report.verdicts = v
report.loopClosed = Object.values(v).every(Boolean)

console.log(JSON.stringify(report, null, 2))

await browser.close()
process.exit(report.loopClosed ? 0 : 1)
