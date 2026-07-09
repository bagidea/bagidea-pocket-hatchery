import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

// Wait for fonts to load
await page.evaluate(() => document.fonts.ready);

// Extra wait for any React renders
await page.waitForTimeout(1000);

// Screenshot
await page.screenshot({ path: 'verify-screenshot.png', fullPage: true });
console.log('✅ Screenshot saved: verify-screenshot.png');

// Check font loading
const fontStatus = await page.evaluate(() => {
  const fonts = [];
  for (const f of document.fonts) {
    fonts.push({ family: f.family, status: f.status });
  }
  return fonts;
});
console.log('\n📋 Loaded fonts:');
for (const f of fontStatus) {
  console.log(`  ${f.family}: ${f.status}`);
}

// Check Hatch button computed styles
const btnInfo = await page.evaluate(() => {
  const btn = document.querySelector('button');
  if (!btn) return { error: 'No button found' };
  const cs = getComputedStyle(btn);
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    boxShadow: cs.boxShadow,
    background: cs.background,
    borderRadius: cs.borderRadius,
    color: cs.color,
    textContent: btn.textContent?.substring(0, 60),
  };
});
console.log('\n📋 Hatch button computed styles:');
for (const [k, v] of Object.entries(btnInfo)) {
  console.log(`  ${k}: ${v}`);
}

// Check hero title
const heroInfo = await page.evaluate(() => {
  const h = document.querySelector('h1, h2');
  if (!h) return { error: 'No heading found' };
  const cs = getComputedStyle(h);
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    textContent: h.textContent?.substring(0, 60),
  };
});
console.log('\n📋 Heading computed styles:');
for (const [k, v] of Object.entries(heroInfo)) {
  console.log(`  ${k}: ${v}`);
}

// Check all text elements for Baloo 2
const allText = await page.evaluate(() => {
  const els = document.querySelectorAll('h1, h2, h3, button, [class*="heroTitle"], [class*="title"], [class*="landingTitle"], [class*="hatchBtn"]');
  return Array.from(els).map(el => ({
    tag: el.tagName,
    class: el.className?.substring(0, 50),
    fontFamily: getComputedStyle(el).fontFamily?.substring(0, 80),
    text: el.textContent?.substring(0, 40),
  }));
});
console.log('\n📋 All styled text elements:');
for (const t of allText) {
  console.log(`  ${t.tag} .${t.class}: font="${t.fontFamily}" text="${t.text}"`);
}

await browser.close();
