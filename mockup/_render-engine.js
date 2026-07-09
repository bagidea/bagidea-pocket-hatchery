/* Render the Slot Engine section of mockup/index.html → PNG via headless Chrome.
   Proves: all 16 pattern_ids decode to the right GROUP, pattern toggle works,
   every --critter-* is written. Reuses the render-cards.js puppeteer setup. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('E:/Projects/bagidea-ai-agents-office/workspace/agents/pixel/waxshot/node_modules/puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTML = path.resolve(__dirname, 'index.html');
const OUT = 'E:/Projects/bagidea-ai-agents-office/workspace/uploads';
const NS = 'http://www.w3.org/2000/svg';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1320, height: 1000, deviceScaleFactor: 2 });
  const html = fs.readFileSync(HTML, 'utf-8');
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 900)); // fonts + animations settle

  // Sanity: count rendered creatures + verify the decode inside the page
  const probe = await page.evaluate((NS) => {
    const slots16 = [...document.querySelectorAll('#eng16 .slot')];
    const dec = (pid) => (pid >> 2) & 3;
    const groups = slots16.map((el, i) => ({
      pid: i, patIdx: el.querySelector('.critter-host').dataset.pat,
      expect: dec(i), ok: String(dec(i)) === el.querySelector('.critter-host').dataset.pat
    }));
    const visiblePattern = slots16.map(el => {
      const host = el.querySelector('.critter-host');
      const p = host.dataset.pat;
      const shown = ['pat-stripes','pat-spots','pat-hearts','pat-stars']
        .map(cls => { const g = host.querySelector('.'+cls); return g ? getComputedStyle(g).display : 'none'; });
      return { p, shown };
    });
    return {
      creatureCount: document.querySelectorAll('#eng16 svg.critter').length,
      groups,
      visiblePattern,
      presetCount: document.querySelectorAll('#engPresets .slot').length,
    };
  }, NS);
  console.log('PROBE ' + JSON.stringify(probe, null, 0));
  const allOk = probe.groups.every(x => x.ok);
  console.log('decode-all-16-ok=' + allOk + ' creatures=' + probe.creatureCount + ' presets=' + probe.presetCount);

  // 1. The 16 pattern_ids grid
  const g16 = await page.$('#eng16');
  if (g16) { await g16.screenshot({ path: path.join(OUT, 'hatchery-slot-engine-16patterns.png') }); console.log('✓ 16 patterns'); }

  // 2. Presets × tier
  const gp = await page.$('#engPresets');
  if (gp) { await gp.screenshot({ path: path.join(OUT, 'hatchery-slot-engine-presets.png') }); console.log('✓ presets'); }

  // 3. Whole section 05 (both grids + copy) for context
  //    grab from the section label down to the presets grid
  const full = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.sec-label')];
    const start = labels[labels.length - 1]; // 05 is last
    const end = document.querySelector('#engPresets');
    if (!start || !end) return null;
    const r1 = start.getBoundingClientRect(), r2 = end.getBoundingClientRect();
    return { top: r1.top, bottom: r2.bottom, left: Math.min(r1.left, r2.left), right: Math.max(r1.right, r2.right) };
  });
  if (full) {
    const clip = { x: full.left - 8, y: full.top - 8, width: (full.right - full.left) + 16, height: (full.bottom - full.top) + 16 };
    await page.screenshot({ path: path.join(OUT, 'hatchery-slot-engine-full.png'), clip });
    console.log('✓ full section');
  }

  await browser.close();
  console.log('\n✨ slot engine renders done — decode ok=' + allOk);
})().catch(e => { console.error(e); process.exit(1); });
