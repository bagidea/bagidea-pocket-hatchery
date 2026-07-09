import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Track network requests for font files
const fontReqs = [];
page.on('request', req => {
  if (req.url().includes('baloo') || req.url().includes('woff2') || req.url().includes('fontsource') || req.url().includes('nunito')) {
    fontReqs.push({ url: req.url().substring(0, 100), type: 'request' });
  }
});
page.on('response', res => {
  if (res.url().includes('baloo') || res.url().includes('woff2') || res.url().includes('fontsource') || res.url().includes('nunito')) {
    fontReqs.push({ url: res.url().substring(0, 100), status: res.status(), type: 'response' });
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

console.log('📡 Network — font requests:');
for (const r of fontReqs) {
  console.log(`  ${r.type}: ${r.status || '-'} ${r.url}`);
}

// Full-page screenshot
await page.screenshot({ path: 'verify-full.png', fullPage: true });
console.log('\n✅ verify-full.png saved');

// Hero section check
const hero = await page.evaluate(() => {
  const el = document.querySelector('[class*="heroImg"]');
  if (!el) return { found: false };
  const cs = getComputedStyle(el);
  return {
    found: true,
    width: cs.width,
    height: cs.height,
    animation: cs.animation,
    filter: cs.filter,
    transform: cs.transform,
  };
});
console.log('\n🦸 Hero image:', JSON.stringify(hero, null, 2));

// Check if any element renders with fallback font
const fontCheck = await page.evaluate(() => {
  const testEl = document.querySelector('[class*="heroTitle"], [class*="landingTitle"], [class*="title"]');
  if (!testEl) return 'no title element found';
  // Use a canvas measure to detect actual rendered font
  const cs = getComputedStyle(testEl);
  return {
    fontFamily: cs.fontFamily,
    webkitTextFillColor: cs.webkitTextFillColor,
    backgroundClip: cs.backgroundClip,
  };
});
console.log('\n🔤 Title font check:', JSON.stringify(fontCheck, null, 2));

await browser.close();
