/**
 * Pocket Hatchery — Gene-to-Sprite Renderer (canonical 64-bit)
 *
 * Takes a 16-char hex gene (64-bit, per GENE-SPEC.md) + species ID,
 * decodes gene traits via engine.js, injects CSS filter variables into
 * the canonical species SVG, toggles trait slot + mutation groups,
 * and screenshots a transparent PNG via headless Chrome.
 *
 * Usage:
 *   node tools/render-creature.mjs 3A4F8CD4E82755F1 foxling
 *   node tools/render-creature.mjs --random foxling
 *   node tools/render-creature.mjs --all
 *
 * Output: art/sprites/creature_{species}_{geneShort}.png
 */

import { createRequire } from 'module';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ═══ resolvePuppeteer() — same pattern as art/sprites/_build/render.js ═══
function resolvePuppeteer() {
  const candidates = [
    resolve(__dirname, '../../../agents/pixel/waxshot/node_modules/puppeteer-core'),
    resolve(__dirname, '../../web/node_modules/puppeteer-core'),
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

// ═══ Load engine ═══
const engine = require('../render/engine.js');
const SPECIES_MAP = engine.GENE_MAP.species;
const SPECIES_IDS = Object.keys(SPECIES_MAP);

const PROJ = resolve(__dirname, '..');
const SPECIES_SVG_DIR = resolve(PROJ, 'art', 'species', 'svg', 'species');
const OUT_DIR = resolve(PROJ, 'art', 'sprites');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ═══ Helpers ═══

function loadSpeciesSVG(speciesId) {
  const fpath = resolve(SPECIES_SVG_DIR, `${speciesId}.svg`);
  if (!existsSync(fpath)) throw new Error(`Species SVG not found: ${fpath}`);
  return readFileSync(fpath, 'utf-8');
}

/**
 * Inject gene CSS into the SVG's <style> block and build the HTML page.
 */
function buildHTML(geneHex, speciesId) {
  const species = SPECIES_MAP[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}. Options: ${SPECIES_IDS.join(', ')}`);

  const result = engine.decodeFull(geneHex, speciesId);
  let svg = loadSpeciesSVG(speciesId);

  // Inject :root CSS variables into the SVG's <style> block
  // The canonical SVGs have: <style> .gene-tint { filter: ... } </style>
  svg = svg.replace(
    /(<style[^>]*>)/,
    `$1\n    /* ═══ GENE-DRIVEN CSS (auto-injected by render-creature.mjs) ═══ */\n${result.css}\n`
  );

  return { html: `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; width: 200px; height: 200px; overflow: hidden; }
</style>
${svg}`, vis: result.vis, species, result };
}

async function renderOne(geneHex, speciesId, browser) {
  const species = SPECIES_MAP[speciesId];
  const shortGene = geneHex.substring(0, 8);
  const fname = `creature_${speciesId}_${shortGene}.png`;
  const outPath = resolve(OUT_DIR, fname);

  const { html, vis } = buildHTML(geneHex, speciesId);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 200, height: 200, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // Let SVG render settle
    await new Promise(r => setTimeout(r, 300));

    // Toggle slot groups + mutation groups via DOM
    await page.evaluate((visMap) => {
      // Slot groups: g[id^="slot-"]
      document.querySelectorAll('g[id^="slot-"]').forEach(g => {
        const id = g.getAttribute('id');
        if (visMap.hasOwnProperty(id)) {
          g.style.display = visMap[id] ? '' : 'none';
        }
      });
      // Mutation & rarity groups
      ['mut-shiny','mut-giant','mut-prismatic','mut-ethereal',
       'rare-iridescent','legendary-aura'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = visMap[id] ? '' : 'none';
      });
    }, vis);

    await page.screenshot({
      path: outPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: 200, height: 200 },
    });
    return { path: outPath, species };
  } finally {
    await page.close();
  }
}

// ═══ MAIN ═══

(async () => {
  const args = process.argv.slice(2);

  let geneHex, speciesId;
  let mode = 'single';

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node tools/render-creature.mjs [geneHex] [speciesId]');
    console.log('       node tools/render-creature.mjs --random [speciesId]');
    console.log('       node tools/render-creature.mjs --all');
    console.log(`\n  geneHex: 16 hex chars (64-bit, per GENE-SPEC.md)`);
    console.log(`  Species: ${SPECIES_IDS.join(', ')}`);
    process.exit(0);
  }

  if (args[0] === '--all') {
    mode = 'all';
  } else if (args[0] === '--random') {
    mode = 'random';
    speciesId = args[1];
    if (speciesId && !SPECIES_IDS.includes(speciesId)) {
      console.error(`Unknown species: ${speciesId}`);
      console.error(`Options: ${SPECIES_IDS.join(', ')}`);
      process.exit(1);
    }
  } else {
    geneHex = args[0];
    speciesId = args[1] || 'foxling';
  }

  // Validate gene hex
  if (mode === 'single') {
    const clean = geneHex.replace('0x', '');
    if (clean.length !== 16 || !/^[0-9a-fA-F]{16}$/.test(clean)) {
      console.error('geneHex must be 16 hex chars (64-bit), e.g. 3A4F8CD4E82755F1');
      process.exit(1);
    }
    if (!SPECIES_IDS.includes(speciesId)) {
      console.error(`Unknown species: ${speciesId}`);
      console.error(`Options: ${SPECIES_IDS.join(', ')}`);
      process.exit(1);
    }
  }

  // Launch browser
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });

  const written = [];
  try {
    if (mode === 'all') {
      console.log(`Rendering all ${SPECIES_IDS.length} canonical species with random genes...\n`);
      for (const id of SPECIES_IDS) {
        const g = engine.randomGene(id);
        const { path: p, species } = await renderOne(g, id, browser);
        console.log(`  ✓ ${species.name} → ${p.replace(PROJ, '').replace(/^[\\/]/, '')}`);
        written.push(p);
      }
    } else if (mode === 'random') {
      const sid = speciesId || SPECIES_IDS[Math.floor(Math.random() * SPECIES_IDS.length)];
      const g = engine.randomGene(sid);
      console.log(`Species: ${sid}  Gene: ${g}\n`);
      const { path: p, species } = await renderOne(g, sid, browser);
      console.log(`  ✓ ${species.name} → ${p.replace(PROJ, '').replace(/^[\\/]/, '')}`);
      written.push(p);
    } else {
      console.log(`Species: ${speciesId}  Gene: ${geneHex}\n`);
      const { path: p, species } = await renderOne(geneHex.replace('0x', ''), speciesId, browser);
      console.log(`  ✓ ${species.name} → ${p.replace(PROJ, '').replace(/^[\\/]/, '')}`);
      written.push(p);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✨ ${written.length} sprite(s) written → ${OUT_DIR}`);
})().catch(e => { console.error(e); process.exit(1); });
