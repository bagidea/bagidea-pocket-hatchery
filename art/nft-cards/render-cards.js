/* Render the NFT card showcase → PNG screenshots via headless Chrome */
const fs = require('fs');
const path = require('path');

// Resolve puppeteer-core from the shared waxshot install,
// falling back to project-local or the full puppeteer package.
function resolvePuppeteer() {
  const candidates = [
    path.resolve(__dirname, '../../../../agents/pixel/waxshot/node_modules/puppeteer-core'),
    path.resolve(__dirname, '../../../web/node_modules/puppeteer-core'),
    'puppeteer',
    'puppeteer-core',
  ];
  for (const c of candidates) {
    try { return require.resolve(c); } catch (_) { /* try next */ }
  }
  throw new Error(
    'puppeteer-core not found. Install it:\n' +
    '  npm install puppeteer-core\n' +
    'Candidates tried: ' + candidates.slice(0, 2).join(', ')
  );
}
const puppeteer = require(resolvePuppeteer());

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = __dirname;
const HTML = path.join(OUT, 'showcase.html');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Load the showcase via file:// so relative SVG paths resolve
  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500)); // let fonts + animations settle

  // 1. Full-page screenshot
  const fullHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: 1440, height: Math.min(fullHeight, 6000), deviceScaleFactor: 2 });
  await page.screenshot({
    path: path.join(OUT, 'nft-card-showcase-full.png'),
    fullPage: true,
  });
  console.log('✓ Full showcase saved');

  // 2. Screenshot of the card grid
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  const cardsGrid = await page.$('.cards-grid');
  if (cardsGrid) {
    await cardsGrid.screenshot({
      path: path.join(OUT, 'nft-card-all-species-grid.png'),
    });
    console.log('✓ Card grid saved');
  }

  // 3. Individual card screenshots — capture each of the 12 species cards
  const cards = await page.$$('.card-wrap');
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    // Extract species name from the creature-name element
    const speciesName = await card.evaluate(el => {
      const nameEl = el.querySelector('.creature-name');
      return nameEl ? nameEl.textContent.trim().replace(/\s+/g,'-').toLowerCase() : `card-${i}`;
    });

    // Extract rarity for filename
    const rarityName = await card.evaluate(el => {
      const rEl = el.querySelector('.rarity-name');
      return rEl ? rEl.textContent.trim().toLowerCase() : 'unknown';
    });

    const label = `${i+1}-${speciesName}-${rarityName}`.replace(/[^a-z0-9-]/g, '-');

    // Capture front face
    await card.evaluate(el => {
      const inner = el.querySelector('.card-inner');
      if (inner) inner.style.transform = '';
    });
    await new Promise(r => setTimeout(r, 300));
    await card.screenshot({
      path: path.join(OUT, `card-${label}-front.png`),
    });

    // Capture back face
    await card.evaluate(el => {
      const inner = el.querySelector('.card-inner');
      if (inner) inner.style.transform = 'rotateY(180deg)';
    });
    await new Promise(r => setTimeout(r, 300));
    await card.screenshot({
      path: path.join(OUT, `card-${label}-back.png`),
    });

    console.log(`✓ ${label} (front + back)`);
  }

  await browser.close();
  console.log('\n✨ All card renders complete!');
})().catch(e => { console.error(e); process.exit(1); });
