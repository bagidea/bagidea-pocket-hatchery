/* Capture before/after comparison of CreatureCard dark-vs-light */
const path = require('path');

const pwPath = path.resolve(__dirname, '../../web/node_modules/playwright');
const { chromium } = require(pwPath);

const HTML = path.join(__dirname, 'demo-light-compare.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000)); // let SVGs in <object> tags load

  // Full-page comparison
  await page.screenshot({
    path: path.join(__dirname, 'creaturecard-dark-vs-light.png'),
    fullPage: true,
  });
  console.log('✓ Full comparison saved');

  // Close-up: first dark card
  const darkCard = await page.$('.dark .wrap');
  if (darkCard) {
    await darkCard.screenshot({ path: path.join(__dirname, 'creaturecard-dark-closeup.png') });
    console.log('✓ Dark card close-up saved');
  }

  // Close-up: first light card
  const lightCard = await page.$('.light .wrap');
  if (lightCard) {
    await lightCard.screenshot({ path: path.join(__dirname, 'creaturecard-light-closeup.png') });
    console.log('✓ Light card close-up saved');
  }

  await browser.close();
  console.log('✓ Done');
})();
