/* Capture before-vs-after comparison screenshots for CreatureCard fixes */
const path = require('path');

const pwPath = path.resolve(__dirname, '../../web/node_modules/playwright');
const { chromium } = require(pwPath);

const HTML = path.join(__dirname, 'demo-fixes-compare.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  if (!require('fs').existsSync(CHROME)) {
    console.error('Chrome not found at', CHROME);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  console.log('Loading', url);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000)); // let fonts + animations settle

  // 1. Full-page comparison
  await page.screenshot({
    path: path.join(__dirname, 'creaturecard-fixes-compare.png'),
    fullPage: true,
  });
  console.log('✓ Full comparison saved');

  // 2. Close-up: before epic card
  const beforeEpic = await page.$('.before .epic .card');
  if (beforeEpic) {
    await beforeEpic.screenshot({
      path: path.join(__dirname, 'creaturecard-before-epic.png'),
    });
    console.log('✓ Before epic close-up saved');
  } else { console.log('✗ Before epic not found'); }

  // 3. Close-up: after epic card
  const afterEpic = await page.$('.after .epic .card');
  if (afterEpic) {
    await afterEpic.screenshot({
      path: path.join(__dirname, 'creaturecard-after-epic.png'),
    });
    console.log('✓ After epic close-up saved');
  } else { console.log('✗ After epic not found'); }

  // 4. Close-up: before legendary card
  const beforeLegendary = await page.$('.before .legendary .card');
  if (beforeLegendary) {
    await beforeLegendary.screenshot({
      path: path.join(__dirname, 'creaturecard-before-legendary.png'),
    });
    console.log('✓ Before legendary close-up saved');
  } else { console.log('✗ Before legendary not found'); }

  // 5. Close-up: after legendary card
  const afterLegendary = await page.$('.after .legendary .card');
  if (afterLegendary) {
    await afterLegendary.screenshot({
      path: path.join(__dirname, 'creaturecard-after-legendary.png'),
    });
    console.log('✓ After legendary close-up saved');
  } else { console.log('✗ After legendary not found'); }

  // 6. Close-up: contrast demo box
  const contrastDemo = await page.$('.contrast-demo');
  if (contrastDemo) {
    await contrastDemo.screenshot({
      path: path.join(__dirname, 'creaturecard-contrast-check.png'),
    });
    console.log('✓ Contrast check saved');
  } else { console.log('✗ Contrast demo not found'); }

  await browser.close();
  console.log('✓ All done');
})().catch(err => { console.error(err); process.exit(1); });
