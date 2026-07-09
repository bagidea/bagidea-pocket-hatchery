/**
 * Headless verification: engine.js decodes real on-chain gene data correctly.
 * Tests:
 *   1. Query chain for real creature genes → decode without error
 *   2. All 12 species decode correctly
 *   3. Gene trait values stay within bounds (100 random genes)
 *   4. All 12 SVG templates exist, XML-well-formed, have --disp-pat-N vars
 *   5. Pattern toggle: CSS --disp-pat-N output verified
 *   6. CSS validity (no undefined/NaN)
 *
 * Usage: node render/verify.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const engine = require('./engine.js');

const TEMPLATES_DIR = resolve(__dirname, 'templates');
const WAX_API = 'https://testnet.wax.eosrio.io/v1/chain/get_table_rows';
const PASS = '✅'; const FAIL = '❌';

let passed = 0, failed = 0;

function check(desc, ok, detail = '') {
  if (ok) { console.log(`${PASS} ${desc}`); passed++; }
  else    { console.log(`${FAIL} ${desc}${detail ? ' — ' + detail : ''}`); failed++; }
}

function randomGene() {
  const h='0123456789abcdef'; let s='';
  for(let i=0;i<64;i++) s+=h[Math.floor(Math.random()*16)];
  return s;
}

// ══════════════════════════════════════════════════════════════
//  HELPER: XML well-formedness check (no external deps)
// ══════════════════════════════════════════════════════════════

function isWellFormedXML(xml) {
  // Must start with <svg and end with </svg>
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) return false;
  // Must have xmlns namespace
  if (!trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) return false;
  // Quick tag-balance check: count open tags vs close tags
  const openTags = (trimmed.match(/<\w+/g) || []).length;
  const closeTags = (trimmed.match(/<\/\w+>/g) || []).length;
  const selfClose = (trimmed.match(/<[^>]+\/>/g) || []).length;
  // open = close + self-close
  if (openTags !== closeTags + selfClose) return false;
  // No unclosed strings (mismatched quotes)
  const dq = (trimmed.match(/"/g) || []).length;
  if (dq % 2 !== 0) return false;
  return true;
}

// ══════════════════════════════════════════════════════════════
//  TEST 1: Query on-chain creatures → decode real genes
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 1: On-chain gene provenance ──');

let realGenes = [];
let chainOk = false;
try {
  const resp = await fetch(WAX_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ json: true, code: 'phgamecreatr', scope: 'phgamecreatr', table: 'creatures', limit: 5 }),
  });
  const data = await resp.json();
  check('Chain query succeeded', resp.ok && Array.isArray(data.rows), `status=${resp.status}`);
  if (data.rows && data.rows.length > 0) {
    chainOk = true;
    realGenes = data.rows.map(r => r.genetics).filter(Boolean);
    check(`Fetched ${realGenes.length} creatures from chain`, realGenes.length > 0);
    // Verify hex format
    for (const g of realGenes) {
      check(`Gene is 64-char hex: ${g.substring(0,16)}…`, /^[0-9a-f]{64}$/.test(g), `got ${g.length} chars`);
    }
  } else {
    check('Chain returned rows', false, 'no creatures found — using snapshot fallback');
  }
} catch (e) {
  check(`Chain query error: ${e.message}`, false, 'network unreachable — using snapshot fallback');
}

// Fallback: use hardcoded snapshot (documented as "snapshot from phgamecreatr @ WAX testnet, 2026-07-03")
if (!chainOk) {
  console.log('  ⚠️  Chain unreachable — using verified snapshot genes from phgamecreatr WAX testnet (2026-07-03)');
  realGenes = [
    'fc199058c0aa59f8990793c602a703156d714d03ee3640b21077fc984fbb386f',
    '5a20a7415058c10b48371039c1c8c4211a78f9e5bdab1f75c1477f678cd4ff5b',
    '3e1fa66a9ed97a1822e11ec8fb89f6cf1491f63f496b9688ab917196b695cdb5',
    '10b6629e65cb8b761b480fd5326c3c4e039123d67b9cad679238608b7f700734',
    '5d1995f89dd76aaf346c2372baf55767611af8170b192797bd1c4c2cf7e96c1d',
  ];
}

check(`Genes available for decode: ${realGenes.length}`, realGenes.length > 0);

for (const gene of realGenes) {
  try {
    const r = engine.decode(gene, engine.GENE_MAP.species['emberling']);
    check(`  → css.length=${r.css.length}`, r.css.length > 100, `got ${r.css.length}`);
    check(`  → vars.patternIdx=${r.vars.patternIdx}`, r.vars.patternIdx >= 0 && r.vars.patternIdx <= 3);
    check(`  → vars.hueShift=${r.vars.hueShift}`, r.vars.hueShift >= -30 && r.vars.hueShift <= 30, `got ${r.vars.hueShift}`);
    check(`  → vars.bodyWidth=${r.vars.bodyWidth}`, r.vars.bodyWidth >= 0.88 && r.vars.bodyWidth <= 1.15, `got ${r.vars.bodyWidth}`);
    check(`  → vars.eyeSize=${r.vars.eyeSize}`, r.vars.eyeSize >= 0.8 && r.vars.eyeSize <= 1.3, `got ${r.vars.eyeSize}`);
    // NEW: verify --disp-pat-N in CSS
    const hasDisp = r.css.includes('--disp-pat-0') && r.css.includes('--disp-pat-1')
                 && r.css.includes('--disp-pat-2') && r.css.includes('--disp-pat-3');
    check(`  → has --disp-pat-N vars`, hasDisp, 'missing pattern display vars');
    // Exactly one disp-pat should be 'inline'
    const dispMatches = r.css.match(/--disp-pat-\d:\s*(inline|none)/g) || [];
    const inlineCount = dispMatches.filter(m => m.includes('inline')).length;
    check(`  → exactly 1 pattern inline`, inlineCount === 1, `got ${inlineCount}`);
  } catch (e) {
    check(`  → ERROR: ${e.message}`, false);
  }
}

// ══════════════════════════════════════════════════════════════
//  TEST 2: All 12 species decode correctly
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 2: All 12 species ──');

const gene = realGenes[0];
let speciesCount = 0;
for (const [id, sp] of Object.entries(engine.GENE_MAP.species)) {
  try {
    const r = engine.decode(gene, sp);
    check(`${id} (${sp.rarity})`, r.species === id, `got ${r.species}`);
    check(`  → has body color`, r.css.includes('--critter-body-final'), 'missing');
    check(`  → has --disp-pat-N`, r.css.includes('--disp-pat-0'), 'missing');
    speciesCount++;
  } catch (e) {
    check(`${id}: ${e.message}`, false);
  }
}
check(`Total species decoded: ${speciesCount}`, speciesCount === 12, `got ${speciesCount}`);

// ══════════════════════════════════════════════════════════════
//  TEST 3: Trait value bounds for 100 random genes
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 3: Trait bounds (100 random genes) ──');

const BOUNDS = {
  patternIdx: [0,3], hueShift: [-30,30], satMult: [0.6,1.0], lightMult: [0.85,1.15],
  eyeSize: [0.8,1.3], eyeTint: [0,60], bodyWidth: [0.88,1.15], bodyHeight: [0.88,1.15],
  accentSize: [0.85,1.2], tailSize: [0.8,1.3], patternDensity: [0.6,1.5],
  patternHue: [-20,20], shine: [0.1,0.55], sparkleCount: [0,12], auraHue: [0,360],
};

let boundViolations = 0;
for (let i = 0; i < 100; i++) {
  const g = randomGene();
  const r = engine.decode(g, engine.GENE_MAP.species['emberling']);
  for (const [trait, [min, max]] of Object.entries(BOUNDS)) {
    const v = r.vars[trait];
    if (typeof v === 'number' && (v < min || v > max)) {
      boundViolations++;
      if (boundViolations <= 3) console.log(`${FAIL} ${trait}=${v} out of [${min},${max}]`);
    }
  }
}
check(`No bound violations in 100 random genes`, boundViolations === 0, `${boundViolations} violations`);

// ══════════════════════════════════════════════════════════════
//  TEST 4: All 12 SVG templates — XML well-formedness + features
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 4: SVG template files ──');

const EXPECTED_SVGS = [
  'emberling','blazetail','drakember','aquaring','tidalfin','leviathorn',
  'terrabud','mossback','zephyrling','stormwing','wispember','nyxling',
];

let svgCount = 0;
for (const id of EXPECTED_SVGS) {
  const fpath = resolve(TEMPLATES_DIR, `${id}.svg`);
  const exists = existsSync(fpath);
  check(`${id}.svg exists`, exists);
  if (exists) {
    const content = readFileSync(fpath, 'utf-8');
    const wellFormed = isWellFormedXML(content);
    check(`  → XML well-formed`, wellFormed, `open/close tag mismatch or missing xmlns`);
    const hasStyle = content.includes('<style>') || content.includes('<style ');
    check(`  → has <style>`, hasStyle);
    // NEW: check for --disp-pat-N vars (standalone pattern toggle)
    const hasDispPat = content.includes('--disp-pat-0') && content.includes('--disp-pat-1')
                    && content.includes('--disp-pat-2') && content.includes('--disp-pat-3');
    check(`  → has --disp-pat-N vars`, hasDispPat, 'pattern toggle broken in standalone SVG');
    const hasBodyShape = content.includes('class="body-shape"');
    check(`  → has .body-shape`, hasBodyShape);
    const viewBox = content.match(/viewBox="([^"]+)"/);
    check(`  → has viewBox`, !!viewBox, viewBox ? viewBox[1] : 'missing');
    svgCount++;
  }
}
check(`Total SVGs: ${svgCount}`, svgCount === 12, `got ${svgCount}`);

// ══════════════════════════════════════════════════════════════
//  TEST 5: Pattern toggle — --disp-pat-N works standalone
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 5: Pattern toggle (standalone SVG) ──');

const patterns = new Set();
for (let i = 0; i < 50; i++) {
  const g = randomGene();
  const r = engine.decode(g, engine.GENE_MAP.species['emberling']);
  patterns.add(r.vars.patternIdx);
  // Verify CSS has correct disp-pat for this patternIdx
  const css = r.css;
  for (let p = 0; p < 4; p++) {
    const expected = p === r.vars.patternIdx ? 'inline' : 'none';
    if (!css.includes(`--disp-pat-${p}: ${expected}`)) {
      check(`  gene patIdx=${r.vars.patternIdx}: --disp-pat-${p}=${expected}`, false, 'mismatch');
    }
  }
}
check(`All 4 patterns seen in 50 random genes`, patterns.size === 4, `only ${patterns.size}: ${[...patterns]}`);

// Verify a specific known gene produces repeatable output
const fixedGene = 'fc199058c0aa59f8990793c602a703156d714d03ee3640b21077fc984fbb386f';
const r1 = engine.decode(fixedGene, engine.GENE_MAP.species['emberling']);
const r2 = engine.decode(fixedGene, engine.GENE_MAP.species['emberling']);
check('Same gene → same patternIdx', r1.vars.patternIdx === r2.vars.patternIdx);
check('Same gene → same css', r1.css === r2.css, 'non-deterministic output');

// ══════════════════════════════════════════════════════════════
//  TEST 6: CSS validity
// ══════════════════════════════════════════════════════════════
console.log('\n── TEST 6: CSS validity ──');

const css = engine.decodeCSS(gene, 'emberling');
check('CSS starts with :root', css.trim().startsWith(':root'), `starts with "${css.trim().substring(0,40)}..."`);
check('CSS contains --critter-body-final', css.includes('--critter-body-final'));
check('CSS contains hsl() values', css.includes('hsl('));
check('CSS contains --disp-pat-N', css.includes('--disp-pat-0') && css.includes('--disp-pat-3'));
check('No undefined in CSS', !css.includes('undefined'));
check('No NaN in CSS', !css.includes('NaN'));

// ══════════════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${PASS} ${passed} passed  ${FAIL} ${failed} failed  (${passed + failed} total)`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
else console.log('\n✨ All gene-to-CSS bridge tests passed!\n');
