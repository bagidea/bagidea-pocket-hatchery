/* Capture before/after comparison of CreatureCard dark-vs-light */
import { chromium } from 'E:/Projects/bagidea-ai-agents-office/workspace/projects/Pocket Hatchery/web/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, 'demo-light-compare.html');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000)); // let fonts + SVGs settle

  // Full-page screenshot
  await page.screenshot({
    path: path.join(__dirname, 'creaturecard-dark-vs-light.png'),
    fullPage: true,
  });
  console.log('✓ Full comparison saved');

  // Close-up: just the first light card
  const lightCard = await page.$('.light .wrap');
  if (lightCard) {
    await lightCard.screenshot({
      path: path.join(__dirname, 'creaturecard-light-closeup.png'),
    });
    console.log('✓ Light card close-up saved');
  }

  // Close-up: just the first dark card
  const darkCard = await page.$('.dark .wrap');
  if (darkCard) {
    await darkCard.screenshot({
      path: path.join(__dirname, 'creaturecard-dark-closeup.png'),
    });
    console.log('✓ Dark card close-up saved');
  }

  await browser.close();
  console.log('✓ Done');
})();
