/* ============================================================
   Pocket Hatchery — Definitive 4-Tier NFT Card renderer
   Tiers match Kevin's contract egg_type (deploy/SPECIES-DESIGN.md):
     0 Common · 1 Uncommon · 2 Rare · 3 Legendary
   Rarity color tokens from NFT-CARD-DESIGN.md §8 (the tiebreaker doc).
   Creature art = real per-species SVGs (art/species/svg/species/*).
   Card 300×432 (7:10). Front + Back + swatch board → PNG via headless Chrome.
   ============================================================ */
const fs = require('fs');
const path = require('path');

function resolvePuppeteer() {
  const candidates = [
    path.resolve(__dirname, '../../../../agents/pixel/waxshot/node_modules/puppeteer-core'),
    path.resolve(__dirname, '../../../web/node_modules/puppeteer-core'),
    'puppeteer', 'puppeteer-core',
  ];
  for (const c of candidates) { try { return require.resolve(c); } catch (_) {} }
  throw new Error('puppeteer-core not found');
}
const puppeteer = require(resolvePuppeteer());
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SPECIES_DIR = path.join(__dirname, '../species/svg/species');
const OUT = path.join(__dirname, 'tiers');

const readSvg = (id) => fs.readFileSync(path.join(SPECIES_DIR, id + '.svg'), 'utf8');

// ---- Rarity tokens (design.md §8) --------------------------------
const TIERS = {
  common: {
    label: 'Common', icon: 'C', code: 'egg_type 0', supply: 'Unlimited',
    frame: 'linear-gradient(160deg,#8FD694 0%,#5BB572 50%,#4A9E5E 100%)',
    glow: 'none',
    aura: 'rgba(143,214,148,0.25)', line: '#8FD694', name: '#8FD694',
    stats: { pow: 5, charm: 7 },
  },
  uncommon: {
    label: 'Uncommon', icon: 'U', code: 'egg_type 1', supply: 'Unlimited',
    frame: 'linear-gradient(160deg,#7ED6D4 0%,#5BC0BE 40%,#3DA5A3 100%)',
    glow: '0 0 22px rgba(91,192,190,0.30)',
    aura: 'rgba(91,192,190,0.28)', line: '#5BC0BE', name: '#5BC0BE',
    stats: { pow: 12, charm: 16 },
  },
  rare: {
    label: 'Rare', icon: 'R', code: 'egg_type 2', supply: 'Unlimited',
    frame: 'linear-gradient(160deg,#8FD0F4 0%,#5FB8E8 40%,#3D8FBF 100%)',
    glow: '0 0 32px rgba(95,184,232,0.35)',
    aura: 'rgba(95,184,232,0.30)', line: '#5FB8E8', name: '#5FB8E8',
    stats: { pow: 20, charm: 26 },
  },
  legendary: {
    label: 'Legendary', icon: 'L', code: 'egg_type 3', supply: '10,000 max',
    frame: 'linear-gradient(160deg,#FFE8A0 0%,#FFD86B 30%,#F0B830 60%,#FFD86B 100%)',
    glow: '0 0 46px rgba(255,216,107,0.55), 0 0 90px rgba(255,216,107,0.25)',
    aura: 'rgba(255,216,107,0.40)', line: '#FFD86B', name: '#FFD86B',
    stats: { pow: 44, charm: 52 }, legendary: true,
  },
};

// ---- Creature per tier (real species) ----------------------------
const PICK = {
  common:    { id:'sproutling', name:'Sproutling', sci:'Herba ambulans',  el:'🌿 Nature', geneHue:0,   sat:1,    id6:'0x1A0042' },
  uncommon:  { id:'droplet',    name:'Droplet',    sci:'Aqua vivens',     el:'💧 Water',  geneHue:0,   sat:1.05, id6:'0x2B0117' },
  rare:      { id:'owlet',      name:'Owlet',      sci:'Strigis rotundus',el:'🌬️ Air',   geneHue:0,   sat:1.1,  id6:'0x3C0289' },
  legendary: { id:'dracling',   name:'Dracling',   sci:'Draco parvus',    el:'🔥 Fire',   geneHue:0,   sat:1.15, id6:'0x4D0401' },
};

// gene dots — 6 tiny gene markers (decorative, seeded per creature)
const geneDots = (seed) => {
  const cols = ['#8FD694','#5BC0BE','#5FB8E8','#B07BE8','#FFD86B','#FF9EB5','#FFCB6B','#9EE6FF'];
  let out = '';
  for (let i=0;i<6;i++){ const c = cols[(seed*7 + i*3) % cols.length]; out += `<span class="gene-dot" style="background:${c}"></span>`; }
  return out;
};

// ---- egg brand logo (for back) -----------------------------------
const EGG_LOGO = (color) => `
<svg viewBox="0 0 64 76" width="60" height="72">
  <defs><radialGradient id="eg" cx="42%" cy="34%" r="70%">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
    <stop offset="45%" stop-color="${color}" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0.15"/>
  </radialGradient></defs>
  <path d="M32 4 C46 4 58 30 58 48 C58 64 46 72 32 72 C18 72 6 64 6 48 C6 30 18 4 32 4 Z"
        fill="url(#eg)" stroke="${color}" stroke-width="2" stroke-opacity="0.7"/>
  <path d="M18 44 L26 40 L30 48 L38 42 L44 50 L50 46" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <circle cx="24" cy="24" r="2" fill="#fff" opacity="0.9"/>
  <path d="M44 18 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" fill="${color}" opacity="0.9"/>
</svg>`;

// ---- one card (front + back) -------------------------------------
function cardHTML(tierKey, i) {
  const t = TIERS[tierKey], c = PICK[tierKey];
  const svg = readSvg(c.id);
  const tint = `filter:saturate(${c.sat});`;
  return `
<div class="card-wrap tier-${tierKey}">
  <div class="card-inner">
    <!-- ============ FRONT ============ -->
    <div class="card-face card-front">
      <div class="frame-glow" style="box-shadow:${t.glow}"></div>
      <div class="card-top-bar">
        <div class="rarity-icon">${t.icon}</div>
        <div class="card-id">#00${41+i}</div>
      </div>
      <div class="art-window">
        <div class="art-aura" style="background:radial-gradient(circle at 50% 46%, ${t.aura} 0%, transparent 68%)"></div>
        ${t.legendary ? '<div class="sparkles">'+'✦ '.repeat(6)+'</div>' : ''}
        <div class="creature" style="${tint}">${svg}</div>
      </div>
      <div class="info">
        <div class="stage-badge"><span class="dot"></span> Baby · Stage 1</div>
        <div class="creature-name">${c.name}</div>
        <div class="species-label">${c.sci} — ${c.el}</div>
        <div class="gene-strip"><span class="gene-ico">🧬</span>${geneDots(i+3)}</div>
        <div class="stats">
          <div class="stat"><span class="s-ico">⚔</span><b>${t.stats.pow}</b><span class="s-lab">POW</span></div>
          <div class="stat"><span class="s-ico">◆</span><b>${t.stats.charm}</b><span class="s-lab">CHARM</span></div>
          <div class="stat"><span class="s-ico">⏳</span><b>1d</b><span class="s-lab">AGE</span></div>
        </div>
      </div>
      <div class="footer">
        <div class="rarity-line"></div>
        <div class="rarity-name">${t.label}</div>
        <div class="rarity-line"></div>
      </div>
    </div>
    <!-- ============ BACK ============ -->
    <div class="card-face card-back">
      <span class="gem tl"></span><span class="gem tr"></span><span class="gem bl"></span><span class="gem br"></span>
      <div class="mandala">
        <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="ring r4"></span>
        <div class="brand">
          ${EGG_LOGO(t.line)}
          <div class="brand-name">POCKET HATCHERY</div>
          <div class="brand-sub">COLLECT · BREED · EVOLVE</div>
        </div>
      </div>
      <div class="back-info">
        <div class="bi-row"><span>Species</span><b>${c.name}</b></div>
        <div class="bi-row"><span>Element</span><b>${c.el}</b></div>
        <div class="bi-row"><span>Rarity</span><b style="color:${t.name}">${t.label}</b></div>
        <div class="bi-row"><span>Gene</span><b class="mono">${c.id6}…</b></div>
        <div class="bi-row"><span>Collection</span><b class="mono">phgamecreatr</b></div>
        <div class="bi-row"><span>Chain</span><b>WAX · AtomicAssets</b></div>
      </div>
      <div class="back-foot">${t.code} · ${t.supply}</div>
    </div>
  </div>
</div>`;
}

const CSS = `
:root{ --card-w:300px; --card-h:432px; --radius:24px;
  --bg:#0f1119; --back:#1a1d2e; --ink:#F5F0E8; --muted:#7C7A92; }
*{ box-sizing:border-box; margin:0; padding:0; }
body{ background:#0a0b12; font-family:'Nunito','Segoe UI',system-ui,sans-serif;
  padding:34px; color:var(--ink); }
.board{ display:flex; gap:26px; flex-wrap:wrap; }
.card-wrap{ width:var(--card-w); height:var(--card-h); }
.card-inner{ position:relative; width:100%; height:100%; }
.card-face{ position:absolute; inset:0; border-radius:var(--radius); overflow:hidden;
  backface-visibility:hidden; }
/* ---- FRONT ---- */
.card-front{ background:var(--bg); display:flex; flex-direction:column;
  border:3px solid transparent; }
.tier-common .card-front{ background:var(--bg) padding-box, ${TIERS.common.frame} border-box; }
.tier-uncommon .card-front{ background:var(--bg) padding-box, ${TIERS.uncommon.frame} border-box; }
.tier-rare .card-front{ background:var(--bg) padding-box, ${TIERS.rare.frame} border-box; }
.tier-legendary .card-front{ background:var(--bg) padding-box, ${TIERS.legendary.frame} border-box; }
.frame-glow{ position:absolute; inset:0; border-radius:var(--radius); pointer-events:none; }
.card-top-bar{ display:flex; justify-content:space-between; align-items:center;
  padding:13px 16px 6px; z-index:3; }
.rarity-icon{ width:26px; height:26px; border-radius:7px; display:flex;
  align-items:center; justify-content:center; font-weight:900; font-size:14px; color:#0f1119; }
.tier-common .rarity-icon{ background:${TIERS.common.line}; }
.tier-uncommon .rarity-icon{ background:${TIERS.uncommon.line}; }
.tier-rare .rarity-icon{ background:${TIERS.rare.line}; }
.tier-legendary .rarity-icon{ background:${TIERS.legendary.line}; }
.card-id{ font-weight:800; font-size:12px; color:var(--muted); letter-spacing:0.5px; }
.art-window{ position:relative; margin:2px 16px 0; height:174px; border-radius:18px;
  overflow:hidden; background:rgba(255,255,255,0.03);
  border:1px solid rgba(255,255,255,0.05); }
.art-aura{ position:absolute; inset:0; }
.creature{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
.creature svg{ width:78%; height:78%; }
.sparkles{ position:absolute; inset:0; color:#FFE8A0; font-size:12px; letter-spacing:34px;
  line-height:70px; text-align:center; opacity:0.55; text-shadow:0 0 8px rgba(255,216,107,0.9);
  pointer-events:none; }
.info{ padding:7px 16px 3px; }
.stage-badge{ display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:800;
  color:var(--ink); background:rgba(255,255,255,0.06); padding:3px 9px; border-radius:20px; }
.stage-badge .dot{ width:6px; height:6px; border-radius:50%; background:#8FD694; }
.creature-name{ font-family:'Baloo 2','Fredoka','Segoe UI',sans-serif; font-weight:800;
  font-size:21px; margin-top:5px; letter-spacing:0.3px; }
.species-label{ font-size:11px; font-weight:600; color:var(--muted); margin-top:1px; }
.gene-strip{ display:flex; align-items:center; gap:5px; margin-top:7px; }
.gene-ico{ font-size:11px; margin-right:1px; }
.gene-dot{ width:11px; height:11px; border-radius:50%; box-shadow:0 0 5px rgba(255,255,255,0.15) inset; }
.stats{ display:flex; gap:8px; margin-top:8px; }
.stat{ flex:1; display:flex; flex-direction:column; align-items:center; gap:1px;
  background:rgba(255,255,255,0.04); border-radius:11px; padding:6px 0 5px; }
.stat .s-ico{ font-size:12px; opacity:0.85; }
.stat b{ font-size:15px; font-variant-numeric:tabular-nums; }
.stat .s-lab{ font-size:8.5px; font-weight:800; letter-spacing:1px; color:var(--muted); }
.footer{ margin-top:auto; padding:0 16px 14px; display:flex; align-items:center; gap:9px; }
.rarity-line{ flex:1; height:2px; border-radius:2px; }
.tier-common .rarity-line{ background:linear-gradient(90deg,transparent,${TIERS.common.line}); }
.tier-common .rarity-line:last-child{ background:linear-gradient(90deg,${TIERS.common.line},transparent); }
.tier-uncommon .rarity-line{ background:linear-gradient(90deg,transparent,${TIERS.uncommon.line}); }
.tier-uncommon .rarity-line:last-child{ background:linear-gradient(90deg,${TIERS.uncommon.line},transparent); }
.tier-rare .rarity-line{ background:linear-gradient(90deg,transparent,${TIERS.rare.line}); }
.tier-rare .rarity-line:last-child{ background:linear-gradient(90deg,${TIERS.rare.line},transparent); }
.tier-legendary .rarity-line{ background:linear-gradient(90deg,transparent,${TIERS.legendary.line}); }
.tier-legendary .rarity-line:last-child{ background:linear-gradient(90deg,${TIERS.legendary.line},transparent); }
.rarity-name{ font-size:11px; font-weight:900; letter-spacing:2.5px; text-transform:uppercase; }
.tier-common .rarity-name{ color:${TIERS.common.name}; }
.tier-uncommon .rarity-name{ color:${TIERS.uncommon.name}; }
.tier-rare .rarity-name{ color:${TIERS.rare.name}; }
.tier-legendary .rarity-name{ color:${TIERS.legendary.name}; text-shadow:0 0 10px rgba(255,216,107,0.6); }
/* ---- BACK ---- */
.card-back{ background:var(--back); border:3px solid transparent; display:flex;
  flex-direction:column; align-items:center; }
.tier-common .card-back{ background:var(--back) padding-box, ${TIERS.common.frame} border-box; }
.tier-uncommon .card-back{ background:var(--back) padding-box, ${TIERS.uncommon.frame} border-box; }
.tier-rare .card-back{ background:var(--back) padding-box, ${TIERS.rare.frame} border-box; }
.tier-legendary .card-back{ background:var(--back) padding-box, ${TIERS.legendary.frame} border-box; }
.gem{ position:absolute; width:12px; height:12px; transform:rotate(45deg); opacity:0.4; border-radius:2px; }
.tier-common .gem{ background:${TIERS.common.line}; } .tier-uncommon .gem{ background:${TIERS.uncommon.line}; }
.tier-rare .gem{ background:${TIERS.rare.line}; } .tier-legendary .gem{ background:${TIERS.legendary.line}; }
.gem.tl{ top:14px; left:14px; } .gem.tr{ top:14px; right:14px; }
.gem.bl{ bottom:14px; left:14px; } .gem.br{ bottom:14px; right:14px; }
.mandala{ position:relative; width:200px; height:200px; margin-top:16px; display:flex;
  align-items:center; justify-content:center; }
.ring{ position:absolute; border-radius:50%; opacity:0.5; }
.tier-common .ring{ border-color:${TIERS.common.line}; } .tier-uncommon .ring{ border-color:${TIERS.uncommon.line}; }
.tier-rare .ring{ border-color:${TIERS.rare.line}; } .tier-legendary .ring{ border-color:${TIERS.legendary.line}; }
.ring.r1{ width:196px; height:196px; border:2px solid; opacity:0.22; }
.ring.r2{ width:158px; height:158px; border:2px dashed; opacity:0.3; }
.ring.r3{ width:122px; height:122px; border:2px solid; opacity:0.38; }
.ring.r4{ width:88px;  height:88px;  border:2px dotted; opacity:0.5; }
.brand{ display:flex; flex-direction:column; align-items:center; gap:6px; z-index:2; }
.brand-name{ font-family:'Baloo 2','Fredoka',sans-serif; font-weight:800; font-size:15px;
  letter-spacing:1px; margin-top:2px; }
.brand-sub{ font-size:8.5px; font-weight:700; letter-spacing:3px; color:var(--muted); }
.back-info{ width:236px; margin:12px auto 0; display:flex; flex-direction:column; gap:5px; }
.bi-row{ display:flex; justify-content:space-between; font-size:11px; border-bottom:1px solid rgba(255,255,255,0.05);
  padding-bottom:4px; }
.bi-row span{ color:var(--muted); font-weight:700; }
.bi-row b{ font-weight:800; }
.mono{ font-family:'Consolas',monospace; font-size:10px; }
.back-foot{ margin-top:auto; margin-bottom:15px; font-size:9px; font-weight:800; letter-spacing:2px;
  color:var(--muted); text-transform:uppercase; }
`;

function pageHTML(mode) {
  const keys = ['common','uncommon','rare','legendary'];
  const cards = keys.map((k,i)=>cardHTML(k,i)).join('\n');
  const flip = mode==='back'
    ? `.card-front{ display:none; } .card-back{ position:relative; }`
    : `.card-back{ display:none; } .card-front{ position:relative; }`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Fredoka:wght@600;700&family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}\n${flip}</style></head>
<body><div class="board">${cards}</div></body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox','--force-color-profile=srgb','--disable-gpu'],
  });
  const keys = ['common','uncommon','rare','legendary'];

  for (const mode of ['front','back']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1360, height: 560, deviceScaleFactor: 2 });
    await page.setContent(pageHTML(mode), { waitUntil:'networkidle0', timeout:30000 });
    await new Promise(r=>setTimeout(r,900));
    // whole board (swatch row)
    const board = await page.$('.board');
    await board.screenshot({ path: path.join(OUT, `tiers-board-${mode}.png`) });
    // each card individually
    const cards = await page.$$('.card-wrap');
    for (let i=0;i<cards.length;i++){
      await cards[i].screenshot({ path: path.join(OUT, `${keys[i]}-${mode}.png`) });
    }
    console.log('✓ '+mode+' board + 4 cards');
    await page.close();
  }
  await browser.close();
  console.log('\n✨ Done → '+OUT);
})().catch(e=>{ console.error(e); process.exit(1); });
