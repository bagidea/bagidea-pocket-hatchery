/* Render ALL 12 Pocket Hatchery species SVG frames → transparent PNGs + contact sheets, via headless Chrome.
 * Updated: 2026-07-03 — expanded from foxling-only to full 12-species roster.
 */
const fs = require('fs');
const path = require('path');

// Resolve puppeteer-core from the shared waxshot install (relative from _build),
// falling back to a project-local install or the full puppeteer package.
function resolvePuppeteer() {
  const candidates = [
    // Relative to waxshot (stable office dependency — same workspace)
    path.resolve(__dirname, '../../../../../agents/pixel/waxshot/node_modules/puppeteer-core'),
    // Project-local install
    path.resolve(__dirname, '../../../web/node_modules/puppeteer-core'),
    // Full puppeteer (includes puppeteer-core)
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

const { W, H, C, SPECIES, STAGES, FRAMES, frameSVG, drawStage, frameTransform, makeGradients } = require('./creatures.js');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve(__dirname, '..'); // art/sprites/

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

  const written = [];
  const allFrames = {}; // species → stage → frame → svg string (for contact sheets)

  // Phase 1: Render every frame for every species
  for (const species of SPECIES) {
    allFrames[species] = {};
    for (const stage of STAGES) {
      allFrames[species][stage] = {};
      for (const f of FRAMES) {
        const svg = frameSVG(species, stage, f);
        allFrames[species][stage][f] = svg;
        const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>${svg}`;
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const file = path.join(OUT, `creature_${species}_${stage}_idle_f${f}.png`);
        await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
        written.push(file);
      }
    }
    console.log(`  ✓ ${species} (9 frames)`);
  }

  // Phase 2: Per-species contact sheets (cream bg, 3 stages × 3 frames)
  console.log('\n  Generating per-species contact sheets...');
  const cell = 200, pad = 14, cols = 3, rows = 3;
  const sheetW = cols * cell + pad * 2, sheetH = rows * cell + pad * 2 + 36;

  for (const species of SPECIES) {
    let cells = '';
    STAGES.forEach((stage, r) => {
      FRAMES.forEach((f, c) => {
        const x = pad + c * cell, y = pad + 32 + r * cell;
        cells += `<g transform="translate(${x} ${y})">
          <rect width="${cell}" height="${cell}" rx="18" fill="#FFFFFF" opacity="0.55"/>
          <g transform="translate(${(cell - W * 0.7) / 2} ${(cell - H * 0.7) / 2}) scale(0.7)">${drawStage(species, stage, f)}</g>
          <text x="${cell / 2}" y="${cell - 10}" text-anchor="middle" font-family="Nunito,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${C.navy}" opacity="0.6">${stage} · f${f}</text>
        </g>`;
      });
    });
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}">
      ${makeGradients(require('./creatures.js').SP[species])}
      <rect width="${sheetW}" height="${sheetH}" fill="${C.cream}"/>
      <text x="${pad}" y="${pad + 16}" font-family="Baloo 2,Nunito,Segoe UI,sans-serif" font-size="18" font-weight="800" fill="${C.navy}">${species.charAt(0).toUpperCase() + species.slice(1)} — egg → baby → adult</text>
      ${cells}
    </svg>`;
    await page.setViewport({ width: sheetW, height: sheetH, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>${sheet}`, { waitUntil: 'domcontentloaded' });
    const sheetFile = path.join(OUT, `${species}_contact_sheet.png`);
    await page.screenshot({ path: sheetFile, clip: { x: 0, y: 0, width: sheetW, height: sheetH } });
    written.push(sheetFile);
  }

  // Phase 3: Master roster contact sheet — all 12 species adult stage (f1) for comparison
  console.log('\n  Generating master roster sheet...');
  const rosterCols = 6, rosterRows = 2;
  const rCell = 170, rPad = 12;
  const rW = rosterCols * rCell + rPad * 2, rH = rosterRows * rCell + rPad * 2 + 40;
  let rosterCells = '';
  SPECIES.forEach((species, i) => {
    const r = Math.floor(i / rosterCols), c = i % rosterCols;
    const x = rPad + c * rCell, y = rPad + 34 + r * rCell;
    const sp = require('./creatures.js').SP[species];
    rosterCells += `<g transform="translate(${x} ${y})">
      <rect width="${rCell}" height="${rCell}" rx="16" fill="${sp.base}" opacity="0.15"/>
      <rect width="${rCell}" height="${rCell}" rx="16" fill="none" stroke="${sp.base}" stroke-width="2" opacity="0.4"/>
      <g transform="translate(${(rCell - W * 0.64) / 2} ${(rCell - H * 0.64) / 2 + 4}) scale(0.64)">${drawStage(species, 'adult', 1)}</g>
      <text x="${rCell / 2}" y="14" text-anchor="middle" font-family="Baloo 2,Nunito,sans-serif" font-size="13" font-weight="800" fill="${C.navy}">${species.charAt(0).toUpperCase() + species.slice(1)}</text>
    </g>`;
  });
  const rosterSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${rW}" height="${rH}" viewBox="0 0 ${rW} ${rH}">
    <rect width="${rW}" height="${rH}" fill="${C.cream}"/>
    <text x="${rPad}" y="${rPad + 18}" font-family="Baloo 2,Nunito,Segoe UI,sans-serif" font-size="20" font-weight="800" fill="${C.navy}">Pocket Hatchery — Complete Species Roster (12 species, adult stage)</text>
    ${rosterCells}
  </svg>`;
  await page.setViewport({ width: rW, height: rH, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}</style>${rosterSVG}`, { waitUntil: 'domcontentloaded' });
  const rosterFile = path.join(OUT, 'species_roster_contact_sheet.png');
  await page.screenshot({ path: rosterFile, clip: { x: 0, y: 0, width: rW, height: rH } });
  written.push(rosterFile);

  await browser.close();
  console.log(`\n✨ ALL DONE — ${written.length} files written (108 sprites + 12 species sheets + 1 roster = 121 total)`);
  console.log('First 10:\n' + written.slice(0, 10).map(f => ' - ' + f).join('\n'));
  console.log('...');
  console.log('Last 5:\n' + written.slice(-5).map(f => ' - ' + f).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
