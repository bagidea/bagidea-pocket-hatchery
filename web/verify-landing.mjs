import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

// Check landing card logo
const landing = await page.evaluate(() => {
  const logo = document.querySelector('[class*="landingLogo"]');
  const card = document.querySelector('[class*="landingCard"]');
  const title = document.querySelector('[class*="landingTitle"]');
  const sub = document.querySelector('[class*="landingSub"]');
  const btn = document.querySelector('[class*="hatchBtn"]');

  const result = {};

  if (logo) {
    const cs = getComputedStyle(logo);
    result.logo = {
      animation: cs.animation,
      filter: cs.filter,
      width: cs.width,
      height: cs.height,
    };
  }

  if (card) {
    const cs = getComputedStyle(card);
    result.card = {
      background: cs.background?.substring(0, 80),
      backdropFilter: cs.backdropFilter,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
    };
  }

  if (btn) {
    const cs = getComputedStyle(btn);
    result.button = {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      boxShadow: cs.boxShadow,
      background: cs.background?.substring(0, 100),
      borderRadius: cs.borderRadius,
    };
  }

  return result;
});

console.log('🎯 Landing page check:');
console.log(JSON.stringify(landing, null, 2));

// Check actual rendered font by measuring text width with canvas
const fontIdentity = await page.evaluate(() => {
  const el = document.querySelector('[class*="landingTitle"]');
  if (!el) return 'no landing title';
  const text = el.textContent;
  const cs = getComputedStyle(el);

  // Measure with canvas at both the declared font and Arial fallback
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const declaredFont = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily.split(',')[0].replace(/"/g, '');
  ctx.font = declaredFont;
  const declaredWidth = ctx.measureText(text).width;

  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' Arial';
  const arialWidth = ctx.measureText(text).width;

  return {
    text,
    declaredFont: declaredFont.substring(0, 60),
    declaredWidth,
    arialWidth,
    isBaloo: Math.abs(declaredWidth - arialWidth) > 5, // different widths = different font
  };
});

console.log('\n🔤 Font identity test:', JSON.stringify(fontIdentity, null, 2));

// Close-up screenshot of the card area
const btn = await page.$('[class*="hatchBtn"]');
if (btn) {
  await btn.screenshot({ path: 'verify-button.png' });
  console.log('\n✅ verify-button.png saved (button close-up)');
}

await browser.close();
