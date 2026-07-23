/**
 * Snapshot Foxling + Flicker for before/after comparison.
 * Run from web/ directory: node screenshot-r3.mjs [before|after]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, '..');

const tag = process.argv[2] || 'before';

const foxSVG   = readFileSync(resolve(__dirname, 'public/assets/creatures/foxling.svg'), 'utf8');
const flickSVG = readFileSync(resolve(__dirname, 'public/assets/creatures/flicker.svg'), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  padding: 36px 48px;
  background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 50%, #EFF6FF 100%);
  display: flex;
  gap: 48px;
  align-items: flex-start;
  font-family: -apple-system, system-ui, sans-serif;
}
.col { display: flex; flex-direction: column; gap: 10px; }
.artbox {
  width: 200px;
  height: 250px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,0.88);
  border-radius: 22px;
  overflow: hidden;
  position: relative;
}
.artbox svg { width: 185px; height: 220px; }
.common-b { border: 2.5px solid #22C55E; box-shadow: 0 0 18px rgba(34,197,94,0.14), 0 6px 24px rgba(0,0,0,0.08); }
.rare-b   { border: 2.5px solid #3B82F6; box-shadow: 0 0 18px rgba(59,130,246,0.14), 0 6px 24px rgba(0,0,0,0.08); }
.label {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.common-txt { color: #15803D; }
.rare-txt   { color: #1D4ED8; }
.tag {
  position: absolute;
  top: 8px; left: 8px;
  font-size: 9px; font-weight: 800; letter-spacing: 1px;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.85);
  color: #6B7280;
}
</style>
</head>
<body>
<div class="col">
  <div class="artbox common-b">
    <span class="tag">Common</span>
    ${foxSVG}
  </div>
  <div class="label common-txt">Foxling</div>
</div>
<div class="col">
  <div class="artbox rare-b">
    <span class="tag">Rare</span>
    ${flickSVG}
  </div>
  <div class="label rare-txt">Flicker</div>
</div>
</body>
</html>`;

const outPath = resolve(BASE, `${tag}-upgrade-r3.png`);

const browser = await chromium.launch();
const page    = await browser.newPage();
await page.setViewportSize({ width: 600, height: 370 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800); // let SVG animations settle
await page.screenshot({ path: outPath });
console.log('Saved:', outPath);
await browser.close();
