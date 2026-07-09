// Screenshot the direction mockup to a PNG (headless chromium).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'web', 'node_modules', 'playwright'));

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    const url = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // let webfonts + keyframes reach a nice frame; fonts have fallbacks if CDN is blocked
    await page.waitForTimeout(1600);
    await page.screenshot({
      path: path.join(__dirname, 'preview.png'),
      fullPage: true,
    });
    console.log('OK -> mockup/preview.png');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('SHOT FAIL', e); process.exit(1); });
