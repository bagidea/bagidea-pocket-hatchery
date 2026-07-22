'use strict';
/* ============================================================
   Pocket Hatchery — NFT Card Renderer: creatrsv2 Templates
   Monanisa (Designer) · 2026-07-19
   Outputs 12 PNGs (6 front + 6 back) matching the 6 templates
   in deploy/args-aa-createtempl-creaturesv2.json:
     Emberling (r1) · Blazetail (r2) · Drakember (r3)
     Foxling·Leaf (r3) · Foxling·Leaf (r4) · Foxling·Leaf (r5)
   Format:  1080 × 1542 px (7:10 ratio, DPR 2)
   Tokens:  --tier-* from web/src/styles/tokens.css
   ============================================================ */
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Resolve puppeteer ────────────────────────────────────────────────────────
function resolvePuppeteer() {
  const cands = [
    path.resolve(__dirname, '../../../../agents/pixel/waxshot/node_modules/puppeteer-core'),
    path.resolve(__dirname, '../../../web/node_modules/puppeteer-core'),
    'puppeteer', 'puppeteer-core',
  ];
  for (const c of cands) { try { return require.resolve(c); } catch (_) {} }
  throw new Error('puppeteer-core not found');
}
const puppeteer = require(resolvePuppeteer());

// ── Config ───────────────────────────────────────────────────────────────────
const CHROME  = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SPECIES = path.join(__dirname, '../species/svg/species');
const OUT     = __dirname;
const DPR     = 2;
const W       = 540;   // CSS px → 1080 at DPR 2
const H       = 771;   // 540 × 10/7 ≈ 771 → 1542 at DPR 2
const TMP     = path.join(os.tmpdir(), 'ph-nft-creatrsv2.html');

// ── 6 Tier color tokens (from tokens.css --tier-*) ───────────────────────────
const TIERS = {
  r1: { id:0, name:'common',    label:'COMMON',    letter:'C',
        hex:'#4ADE80', rgb:'74,222,128',   badgeFG:'#0B0E16',
        aura:'rgba(74,222,128,0.26)',   glow:'none',
        backBg:'#090E0C', pattern:'dots' },
  r2: { id:1, name:'uncommon',  label:'UNCOMMON',  letter:'U',
        hex:'#2DD4BF', rgb:'45,212,191',   badgeFG:'#0B0E16',
        aura:'rgba(45,212,191,0.26)',   glow:'none',
        backBg:'#081210', pattern:'diamonds' },
  r3: { id:2, name:'rare',      label:'RARE',      letter:'R',
        hex:'#60A5FA', rgb:'96,165,250',   badgeFG:'#0B0E16',
        aura:'rgba(96,165,250,0.28)',
        glow:'0 0 32px rgba(96,165,250,0.14)',
        backBg:'#08101A', pattern:'hexagons' },
  r4: { id:3, name:'epic',      label:'EPIC',      letter:'E',
        hex:'#C084FC', rgb:'192,132,252',  badgeFG:'#0B0E16',
        aura:'rgba(192,132,252,0.28)',
        glow:'0 0 38px rgba(192,132,252,0.16)',
        backBg:'#0B0814', pattern:'starburst', pulse:true },
  r5: { id:4, name:'legendary', label:'LEGENDARY', letter:'L',
        hex:'#FBBF24', rgb:'251,191,36',   badgeFG:'#0B0E16',
        aura:'rgba(251,191,36,0.30)',
        glow:'0 0 46px rgba(251,191,36,0.22),0 0 90px rgba(251,191,36,0.08)',
        backBg:'#100D04', pattern:'mandala', pulse:true },
};

// ── 6 Templates matching deploy/args-aa-createtempl-creaturesv2.json ─────────
const TEMPLATES = [
  {
    outName: 'emberling',
    tier: TIERS.r1,
    pick: {
      id: 'dracling',
      name: 'Emberling', sci: 'Igniparvus nascens', elem: 'Fire',
      assetId: '#00101', pow: 5,  charm: 7,  age: '1d',
      stage: 'Hatchling · Stage 1',
      genes: ['#FB923C','#F97316','#EF4444','#FBBF24','#FED7AA','#FCA5A5'],
      svgFilter: 'hue-rotate(130deg) saturate(1.5)',
    }
  },
  {
    outName: 'blazetail',
    tier: TIERS.r2,
    pick: {
      id: 'dracling',
      name: 'Blazetail', sci: 'Igniparvus celeris', elem: 'Fire',
      assetId: '#00215', pow: 14, charm: 16, age: '2d',
      stage: 'Baby · Stage 1',
      genes: ['#F97316','#FB923C','#FBBF24','#FDE68A','#EF4444','#FCA5A5'],
      svgFilter: 'hue-rotate(150deg) saturate(1.6) brightness(1.05)',
    }
  },
  {
    outName: 'drakember',
    tier: TIERS.r3,
    pick: {
      id: 'dracling',
      name: 'Drakember', sci: 'Igniparvus ardentis', elem: 'Fire',
      assetId: '#00323', pow: 24, charm: 28, age: '3d',
      stage: 'Adult · Stage 2',
      genes: ['#EF4444','#DC2626','#F97316','#B91C1C','#FB923C','#FCA5A5'],
      svgFilter: 'hue-rotate(90deg) saturate(1.3)',
    }
  },
  {
    outName: 'foxling-r3',
    tier: TIERS.r3,
    pick: {
      id: 'foxling',
      name: 'Foxling', sci: 'Vulpes folium', elem: 'Leaf',
      assetId: '#00401', pow: 21, charm: 30, age: '3d',
      stage: 'Adult · Stage 2',
      genes: ['#4ADE80','#34D399','#86EFAC','#6EE7B7','#A3E635','#D9F99D'],
    }
  },
  {
    outName: 'foxling-r4',
    tier: TIERS.r4,
    pick: {
      id: 'foxling',
      name: 'Foxling', sci: 'Vulpes folium', elem: 'Leaf',
      assetId: '#00402', pow: 36, charm: 44, age: '5d',
      stage: 'Adult · Stage 2',
      genes: ['#C084FC','#A855F7','#4ADE80','#34D399','#D8B4FE','#86EFAC'],
    }
  },
  {
    outName: 'foxling-r5',
    tier: TIERS.r5,
    pick: {
      id: 'foxling',
      name: 'Foxling', sci: 'Vulpes folium', elem: 'Leaf',
      assetId: '#00403', pow: 50, charm: 62, age: '7d',
      stage: 'Elder · Stage 3',
      genes: ['#FBBF24','#F59E0B','#4ADE80','#34D399','#FDE68A','#86EFAC'],
    }
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function readSvg(id) {
  return fs.readFileSync(path.join(SPECIES, id + '.svg'), 'utf8');
}

function geneDots(colors) {
  return colors.map(c =>
    `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;` +
    `background:${c};border:1px solid rgba(255,255,255,0.15);` +
    `box-shadow:0 0 5px rgba(0,0,0,0.45);flex-shrink:0;"></span>`
  ).join('');
}

// ── Back pattern ──────────────────────────────────────────────────────────────
function backPattern(t) {
  const c = t.hex, r = t.rgb;
  switch (t.pattern) {
    case 'dots': return `
      <pattern id="pat" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
        <circle cx="22" cy="22" r="2.8" fill="${c}" opacity="0.10"/>
        <circle cx="0"  cy="0"  r="2"   fill="${c}" opacity="0.07"/>
        <circle cx="44" cy="0"  r="2"   fill="${c}" opacity="0.07"/>
        <circle cx="0"  cy="44" r="2"   fill="${c}" opacity="0.07"/>
        <circle cx="44" cy="44" r="2"   fill="${c}" opacity="0.07"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#pat)"/>`;
    case 'diamonds': return `
      <pattern id="pat" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
        <polygon points="25,4 46,25 25,46 4,25" fill="none" stroke="${c}" stroke-width="0.9" opacity="0.13"/>
        <polygon points="25,16 34,25 25,34 16,25" fill="none" stroke="${c}" stroke-width="0.5" opacity="0.08"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#pat)"/>`;
    case 'hexagons': return `
      <pattern id="pat" x="0" y="0" width="56" height="64" patternUnits="userSpaceOnUse">
        <polygon points="28,4 52,18 52,46 28,60 4,46 4,18" fill="none" stroke="${c}" stroke-width="0.9" opacity="0.11"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#pat)"/>`;
    case 'starburst':
      return Array.from({length:24}, (_,i) => {
        const a = (i/24)*Math.PI*2;
        const x2 = (W/2 + Math.cos(a)*700).toFixed(1);
        const y2 = (H*0.5 + Math.sin(a)*700).toFixed(1);
        const op = i%4===0 ? 0.13 : 0.06;
        const sw = i%6===0 ? 1 : 0.5;
        return `<line x1="${W/2}" y1="${H*0.5}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}" opacity="${op}"/>`;
      }).join('');
    case 'mandala': return `
      ${[90,145,205,270,345].map((r_,i) =>
        `<circle cx="${W/2}" cy="${H*0.46}" r="${r_}" fill="none" stroke="${c}" stroke-width="${0.9-i*0.1}" opacity="${0.14-i*0.02}"/>`
      ).join('')}
      ${Array.from({length:12}, (_,i) => {
        const a = (i/12)*Math.PI*2;
        const x = (W/2 + Math.cos(a)*205).toFixed(1);
        const y = (H*0.46 + Math.sin(a)*205).toFixed(1);
        return `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" opacity="0.20"/>`;
      }).join('')}`;
    default: return '';
  }
}

// ── Egg / PH logo ─────────────────────────────────────────────────────────────
function eggLogo(t) {
  return `<svg viewBox="0 0 64 76" width="68" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="eggRG${t.id}" cx="36%" cy="30%" r="70%">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.88"/>
      <stop offset="38%"  stop-color="${t.hex}" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="${t.hex}" stop-opacity="0.10"/>
    </radialGradient>
  </defs>
  <path d="M32 4 C46 4 58 30 58 48 C58 64 46 72 32 72 C18 72 6 64 6 48 C6 30 18 4 32 4Z"
    fill="url(#eggRG${t.id})" stroke="${t.hex}" stroke-width="1.5" stroke-opacity="0.68"/>
  <path d="M16 44 L24 38 L30 48 L38 40 L46 50 L52 45"
    fill="none" stroke="${t.hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.82"/>
  <circle cx="22" cy="22" r="2.8" fill="#FFFFFF" opacity="0.90"/>
  <circle cx="16" cy="34" r="1.6" fill="#FFFFFF" opacity="0.55"/>
  <path d="M46 13 l1.8 5 l5 1.8 l-5 1.8 l-1.8 5 l-1.8 -5 l-5 -1.8 l5 -1.8Z"
    fill="${t.hex}" opacity="0.92"/>
</svg>`;
}

// ── FRONT card HTML ───────────────────────────────────────────────────────────
function frontHTML(t, p) {
  const svg = readSvg(p.id);
  const shadow = t.glow !== 'none'
    ? `0 14px 34px rgba(0,0,0,0.55),${t.glow}`
    : '0 14px 34px rgba(0,0,0,0.55)';
  const border = '1.5px solid rgba(255,255,255,0.08)';
  const badge  = `background:${t.hex};color:${t.badgeFG};`;
  const rarityText = `color:${t.hex};`;
  const sparkles = t.id >= 2 ? `
    <div style="position:absolute;inset:8px;pointer-events:none;z-index:2;overflow:hidden;border-radius:18px;">
      ${[{t:'11%',l:'16%'},{t:'20%',l:'76%'},{t:'60%',l:'10%'},{t:'68%',l:'81%'},
         {t:'33%',l:'84%'},{t:'46%',l:'6%'},{t:'78%',l:'40%'},{t:'16%',l:'40%'}]
        .map(s=>`<div style="position:absolute;top:${s.t};left:${s.l};width:5px;height:5px;border-radius:50%;background:${t.hex};box-shadow:0 0 7px ${t.hex};opacity:0.65;"></div>`)
        .join('')}
    </div>` : '';
  const svgFilter = p.svgFilter ? `filter:${p.svgFilter};` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent}
body{width:${W}px;overflow:hidden;font-family:"Nunito","Segoe UI",system-ui,sans-serif}
.disp{font-family:"Baloo 2","Segoe UI Semibold",system-ui,sans-serif}
</style></head><body>

<div class="ph-card" style="
  width:${W}px;height:${H}px;border-radius:40px;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#1B1F2B 0%,#14171F 100%);
  border:${border};box-shadow:${shadow};
  display:flex;flex-direction:column;
">
  <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.06);z-index:10;border-radius:40px 40px 0 0;pointer-events:none;"></div>

  <!-- TOP BAR -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:22px 28px 8px;position:relative;z-index:3;">
    <div style="width:46px;height:46px;border-radius:13px;${badge}display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;box-shadow:0 3px 14px rgba(${t.rgb},0.48);">${t.letter}</div>
    <div style="font-size:14px;font-weight:700;color:#3E4A5C;letter-spacing:0.5px;">${p.assetId}</div>
  </div>

  <!-- ART WINDOW -->
  <div style="position:relative;margin:4px 18px 0;height:296px;border-radius:24px;overflow:hidden;background:rgba(9,12,22,0.60);display:grid;place-items:center;z-index:1;border:1px solid rgba(255,255,255,0.04);">
    <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 46%,${t.aura} 0%,transparent 62%);"></div>
    <div style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);width:170px;height:20px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,0.55) 0%,transparent 70%);"></div>
    ${sparkles}
    <div style="width:64%;height:82%;position:relative;z-index:1;${svgFilter}">${svg}</div>
  </div>

  <!-- INFO -->
  <div style="display:flex;flex-direction:column;gap:9px;padding:11px 24px 6px;position:relative;z-index:3;">
    <div style="display:inline-flex;align-items:center;gap:7px;width:fit-content;padding:5px 13px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:700;letter-spacing:0.7px;color:#9DAABB;text-transform:uppercase;">
      <span style="width:7px;height:7px;border-radius:50%;background:#F5B544;box-shadow:0 0 8px rgba(245,181,68,0.85);flex-shrink:0;"></span>
      ${p.stage}
    </div>
    <div class="disp" style="font-size:28px;font-weight:800;color:#F1F4F9;letter-spacing:-0.4px;line-height:1.1;margin-top:-2px;">${p.name}</div>
    <div style="font-size:13px;color:#5C6878;font-weight:600;margin-top:-4px;"><i>${p.sci}</i>&nbsp;·&nbsp;${p.elem}</div>
    <div style="display:flex;align-items:center;gap:9px;margin-top:-2px;">
      <span style="font-size:10px;font-weight:800;color:#3E4A5C;letter-spacing:1px;text-transform:uppercase;">DNA</span>
      <div style="display:inline-flex;gap:6px;">${geneDots(p.genes)}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:2px;">
      ${[{ic:'⚔',v:p.pow,lb:'POW'},{ic:'◆',v:p.charm,lb:'CHARM'},{ic:'⏳',v:p.age,lb:'AGE'}].map(s=>`
      <div style="display:flex;align-items:center;justify-content:center;gap:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:8px 4px;">
        <span style="font-size:12px;line-height:1;">${s.ic}</span>
        <b style="font-size:14px;font-weight:800;color:#E8EDF4;">${s.v}</b>
        <span style="font-size:9px;color:#3E4A5C;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${s.lb}</span>
      </div>`).join('')}
    </div>
  </div>

  <div style="flex:1;min-height:0;"></div>

  <!-- RARITY FOOTER -->
  <div style="display:flex;align-items:center;gap:13px;padding:5px 24px 9px;position:relative;z-index:3;">
    <div style="flex:1;height:1.5px;background:linear-gradient(90deg,transparent,${t.hex});opacity:0.55;"></div>
    <div class="disp" style="font-size:13px;font-weight:800;letter-spacing:4.5px;text-transform:uppercase;text-indent:4.5px;${rarityText}">${t.label}</div>
    <div style="flex:1;height:1.5px;background:linear-gradient(90deg,${t.hex},transparent);opacity:0.55;"></div>
  </div>

  <!-- BRAND -->
  <div style="margin:0 18px;border-top:1px solid rgba(255,255,255,0.04);padding:7px 0 16px;text-align:center;position:relative;z-index:3;">
    <div style="font-size:10px;font-weight:700;color:#252E3C;letter-spacing:1.5px;text-transform:uppercase;">POCKET HATCHERY &nbsp;·&nbsp; WAX · AtomicAssets</div>
  </div>
</div>
</body></html>`;
}

// ── BACK card HTML ────────────────────────────────────────────────────────────
function backHTML(t, p) {
  const shadow = t.glow !== 'none'
    ? `0 14px 34px rgba(0,0,0,0.60),${t.glow}`
    : '0 14px 34px rgba(0,0,0,0.55)';
  const border = '1.5px solid rgba(255,255,255,0.07)';
  const supplyMap = { 0:'Unlimited', 1:'Unlimited', 2:'Unlimited', 3:'50,000 max', 4:'10,000 max', 5:'1,000 max' };
  const supply = supplyMap[t.id] || 'Unlimited';
  const gemCol = t.hex;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent}
body{width:${W}px;overflow:hidden;font-family:"Nunito","Segoe UI",system-ui,sans-serif}
.disp{font-family:"Baloo 2","Segoe UI Semibold",system-ui,sans-serif}
</style></head><body>

<div class="ph-card" style="
  width:${W}px;height:${H}px;border-radius:40px;overflow:hidden;position:relative;
  background:${t.backBg};border:${border};box-shadow:${shadow};
  display:flex;flex-direction:column;align-items:center;
">
  <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
    ${backPattern(t)}
  </svg>

  ${[[{top:'22px',left:'22px'},{top:'22px',right:'22px'},{bottom:'22px',left:'22px'},{bottom:'22px',right:'22px'}]].flat().map(pos=>{
    const pStr = Object.entries(pos).map(([k,v])=>`${k}:${v}`).join(';');
    return `<div style="position:absolute;${pStr};width:14px;height:14px;border-radius:4px;background:${gemCol};opacity:0.55;box-shadow:0 0 12px ${gemCol};"></div>`;
  }).join('')}

  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-56%);width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(${t.rgb},0.09) 0%,transparent 68%);pointer-events:none;"></div>

  <svg style="position:absolute;top:50%;left:50%;transform:translate(-50%,-58%);pointer-events:none;" width="360" height="360" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
    <circle cx="180" cy="180" r="164" fill="none" stroke="${t.hex}" stroke-width="0.8" opacity="0.11"/>
    <circle cx="180" cy="180" r="138" fill="none" stroke="${t.hex}" stroke-width="1.0" opacity="0.10"/>
    <circle cx="180" cy="180" r="114" fill="none" stroke="${t.hex}" stroke-width="1.1" opacity="0.12"/>
    <circle cx="180" cy="180" r="90"  fill="none" stroke="${t.hex}" stroke-width="1.3" opacity="0.14"/>
    ${t.id>=3?`<circle cx="180" cy="180" r="66" fill="none" stroke="${t.hex}" stroke-width="1.5" opacity="0.16"/>`:'' }
    ${t.id>=4?`<circle cx="180" cy="180" r="44" fill="none" stroke="${t.hex}" stroke-width="1.7" opacity="0.19"/>`:'' }
  </svg>

  <div style="flex:1;min-height:110px;"></div>

  <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:14px;">
    ${eggLogo(t)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:5px;margin-top:4px;">
      <div class="disp" style="font-size:24px;font-weight:800;letter-spacing:3px;color:#EAF0F9;">POCKET HATCHERY</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:2.8px;text-transform:uppercase;color:${t.hex};">COLLECT · BREED · EVOLVE</div>
    </div>
  </div>

  <div style="width:290px;height:1px;background:linear-gradient(90deg,transparent,rgba(${t.rgb},0.28),transparent);margin:26px 0 18px;position:relative;z-index:2;"></div>

  <div style="width:290px;position:relative;z-index:2;display:flex;flex-direction:column;gap:9px;">
    ${[
      ['Species',    p.name,               null],
      ['Element',    p.elem,               null],
      ['Rarity',     t.label,              t.hex],
      ['Collection', 'phgamecreatr',       null],
      ['Chain',      'WAX · AtomicAssets', null],
      ['Supply',     supply,               null],
    ].map(([k,v,vc])=>`
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:#3E4A5C;font-weight:600;letter-spacing:0.3px;">${k}</span>
      <b style="font-size:13px;font-weight:800;${vc?`color:${vc};`:'color:#9DAABB;'}">${v}</b>
    </div>`).join('')}
  </div>

  <div style="flex:1;"></div>

  <div style="position:relative;z-index:2;font-size:10px;font-weight:700;color:#222A34;letter-spacing:1px;text-transform:uppercase;padding:0 0 20px;text-align:center;">
    RARITY ${t.id + 1} &nbsp;·&nbsp; WAX Blockchain
  </div>
</div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Launching Chrome…');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox','--force-color-profile=srgb','--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W + 60, height: H + 60, deviceScaleFactor: DPR });

  for (const tmpl of TEMPLATES) {
    const { tier: t, pick: p, outName } = tmpl;
    console.log(`\nRendering ${outName} (${t.label})…`);

    fs.writeFileSync(TMP, frontHTML(t, p), 'utf8');
    await page.goto('file:///' + TMP.replace(/\\/g,'/'), { waitUntil:'networkidle0', timeout:30000 });
    await new Promise(r => setTimeout(r, 900));
    const fe = await page.$('.ph-card');
    const fOut = path.join(OUT, `nft-front-${outName}.png`);
    await fe.screenshot({ path: fOut });
    console.log(`  ✓ front → ${fOut}`);

    fs.writeFileSync(TMP, backHTML(t, p), 'utf8');
    await page.goto('file:///' + TMP.replace(/\\/g,'/'), { waitUntil:'networkidle0', timeout:30000 });
    await new Promise(r => setTimeout(r, 900));
    const be = await page.$('.ph-card');
    const bOut = path.join(OUT, `nft-back-${outName}.png`);
    await be.screenshot({ path: bOut });
    console.log(`  ✓ back  → ${bOut}`);
  }

  await browser.close();
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  console.log('\n All 12 creatrsv2 NFT cards rendered at 1080x1542px.');
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
