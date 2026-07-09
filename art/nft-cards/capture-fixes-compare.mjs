/* Capture before-vs-after comparison screenshots for CreatureCard fixes */
import { chromium } from 'E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/web/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, 'demo-fixes-compare.html');
const OUT = __dirname;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  if (!fs.existsSync(CHROME)) {
    console.error('Chrome not found at', CHROME);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  console.log('Loading', url);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500)); // let fonts + animations settle

  // 1. Full-page comparison
  await page.screenshot({
    path: path.join(OUT, 'creaturecard-fixes-compare.png'),
    fullPage: true,
  });
  console.log('✓ Full comparison saved');

  // 2. Close-up: before epic card (contrast issue visible)
  const beforeEpic = await page.$('.before .epic .card');
  if (beforeEpic) {
    await beforeEpic.screenshot({
      path: path.join(OUT, 'creaturecard-before-epic.png'),
    });
    console.log('✓ Before epic close-up saved');
  }

  // 3. Close-up: after epic card (fixed contrast + sparkles)
  const afterEpic = await page.$('.after .epic .card');
  if (afterEpic) {
    await afterEpic.screenshot({
      path: path.join(OUT, 'creaturecard-after-epic.png'),
    });
    console.log('✓ After epic close-up saved');
  }

  // 4. Close-up: before legendary card
  const beforeLegendary = await page.$('.before .legendary .card');
  if (beforeLegendary) {
    await beforeLegendary.screenshot({
      path: path.join(OUT, 'creaturecard-before-legendary.png'),
    });
    console.log('✓ Before legendary close-up saved');
  }

  // 5. Close-up: after legendary card
  const afterLegendary = await page.$('.after .legendary .card');
  if (afterLegendary) {
    await afterLegendary.screenshot({
      path: path.join(OUT, 'creaturecard-after-legendary.png'),
    });
    console.log('✓ After legendary close-up saved');
  }

  // 6. Close-up: contrast demo section
  const contrastDemo = await page.$('.contrast-demo');
  if (contrastDemo) {
    await contrastDemo.screenshot({
      path: path.join(OUT, 'creaturecard-contrast-check.png'),
    });
    console.log('✓ Contrast check saved');
  }

  await browser.close();
  console.log('✓ All done');
})();
