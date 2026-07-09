/* ============================================================
   Pocket Hatchery — Feed v2 "ความอิ่ม" (Satiety) UX design board
   Flamingo (Designer) · 2026-07-09 · DESIGN ONLY (no contract / no deploy)

   Builds ON the live v0.2.0 panel:
     web/src/components/SatietyMeter.tsx  (3-state bar: full/hungry/starving)
     web/src/satiety.ts                   (satiety% = (last_fed+fed_dur-now)/fed_dur)
     web/src/styles/tokens.css            (--ph-* tokens; rarity green/cyan/blue)
   Ground truth: docs/FEED-ECONOMY-V2.md (Kevin) + satiety.ts verified ratios.

   Renders two PNGs via headless Chrome (real species SVGs, no AI mockup):
     board-states.png   — the 3 satiety states, one card each
     board-rarity.png   — the rarity feed-cadence / earn trade-off
   ============================================================ */
const fs = require('fs');
const path = require('path');

function resolvePlaywright() {
  const candidates = [
    path.resolve(__dirname, '../../web/node_modules/playwright'),
    path.resolve(__dirname, '../../web/node_modules/playwright-core'),
    'playwright', 'playwright-core',
  ];
  for (const c of candidates) { try { return require(c); } catch (_) {} }
  throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SPECIES_DIR = path.join(__dirname, '../species/svg/species');
const OUT = __dirname;
const svg = (id) => fs.readFileSync(path.join(SPECIES_DIR, id + '.svg'), 'utf8');

// ── Real on-chain rarities (CreatureCard.tsx Rarity + satiety.ts) ────────────
const RARITY = {
  common:   { label: 'Common',   icon: 'C', grad: 'linear-gradient(135deg,#22C55E,#16A34A)', aura: 'rgba(34,197,94,.28)',  mult: 1.0, fedH: 48,  cadence: 'เติม ~ทุกวัน' },
  uncommon: { label: 'Uncommon', icon: 'U', grad: 'linear-gradient(135deg,#06B6D4,#0891B2)', aura: 'rgba(6,182,212,.28)',  mult: 1.1, fedH: 72,  cadence: 'เติม ~ทุก 3 วัน' },
  rare:     { label: 'Rare',     icon: 'R', grad: 'linear-gradient(135deg,#3B82F6,#2563EB)', aura: 'rgba(59,130,246,.30)', mult: 1.4, fedH: 120, cadence: 'เติม ~ทุก 5 วัน' },
};

// stage yield curve (satiety.ts BASE_EARN_BY_STAGE) — stage 3 = Adult → 600 base
const BASE_EARN_STAGE3 = 600;

// ── One creature card with the Feed-v2 satiety block ─────────────────────────
// state: 'full' | 'hungry' | 'starving'  · pct = satiety %
function card({ rarity, species, name, sci, stage, state, pct, earnFactor, deadline, cost }) {
  const R = RARITY[rarity];
  const stateMeta = {
    full:     { chip: '😋 Full',     tone: '#16a34a', bg: 'rgba(34,197,94,.12)',  bd: 'rgba(34,197,94,.30)',  fill: 'linear-gradient(90deg,#22c55e,#16a34a)', btn: 'linear-gradient(135deg,#22c55e,#16a34a)' },
    hungry:   { chip: '😕 Hungry',   tone: '#d97706', bg: 'rgba(245,158,11,.14)', bd: 'rgba(245,158,11,.35)', fill: 'linear-gradient(90deg,#fbbf24,#f59e0b)', btn: 'linear-gradient(135deg,#f59e0b,#d97706)' },
    starving: { chip: '😖 Starving', tone: '#dc2626', bg: 'rgba(239,68,68,.14)',  bd: 'rgba(239,68,68,.40)',  fill: 'linear-gradient(90deg,#f87171,#ef4444)', btn: 'linear-gradient(135deg,#ef4444,#dc2626)' },
  }[state];
  const earn = (BASE_EARN_STAGE3 * R.mult * earnFactor);
  const base = (BASE_EARN_STAGE3 * R.mult);
  const growthNote = state === 'full'
    ? `<span class="gn ok">🌱 โตปกติ</span>`
    : state === 'hungry'
      ? `<span class="gn warn">🐢 โตช้าลง (earn ${Math.round(earnFactor*100)}%)</span>`
      : `<span class="gn stop">⏸ โตหยุด · evolve ล็อก</span>`;

  return `
  <div class="card ${rarity} ${state}">
    <div class="rborder"></div>
    <div class="cbody">
      <div class="topbar">
        <span class="ricon" style="background:${R.grad}">${R.icon}</span>
        <span class="aid">#106523${stage}</span>
      </div>
      <div class="art">
        <div class="aura" style="background:radial-gradient(circle at 50% 42%, ${R.aura}, transparent 68%)"></div>
        <div class="critter">${svg(species)}</div>
        <span class="stage">✨ Adult</span>
      </div>
      <div class="meta">
        <div class="name">${name}</div>
        <div class="sci">${sci} · ${R.label}</div>
      </div>

      <!-- ── Feed v2 satiety block ── -->
      <div class="sat">
        <div class="sh">
          <span class="sl">🍽️ Satiety</span>
          <span class="chip" style="color:${stateMeta.tone};background:${stateMeta.bg};border-color:${stateMeta.bd}">${stateMeta.chip}</span>
          <span class="pct">${pct}%</span>
        </div>
        <div class="track"><div class="fill" style="width:${pct}%;background:${stateMeta.fill}"></div></div>
        <div class="deadline ${state}">${deadline}</div>
        <div class="earnrow">
          <span class="er-r">${R.label} ×${R.mult.toFixed(2)}</span>
          <span class="er-v" style="color:${stateMeta.tone}">${earn.toFixed(0)}<span class="u">EGG/hr</span>${state!=='full'?`<span class="eb">(full ${base.toFixed(0)})</span>`:''}</span>
        </div>
        ${growthNote}
        <button class="feed" style="background:${stateMeta.btn}">
          ${state==='starving' ? '🍎 เติมด่วน!' : '🍎 Feed'} · ${cost} EGG
        </button>
      </div>
    </div>
  </div>`;
}

// ── Rarity trade-off column ──────────────────────────────────────────────────
function rarCol(rarity) {
  const R = RARITY[rarity];
  // feed-frequency gauge: shorter fed_dur = feed MORE often (common highest need)
  const freqPct = Math.round((48 / R.fedH) * 100);       // common 100, unc 67, rare 40
  const earnPct = Math.round((R.mult / 1.4) * 100);       // rare 100, unc 79, common 71
  return `
  <div class="rcol ${rarity}">
    <div class="rtop">
      <span class="ricon" style="background:${R.grad}">${R.icon}</span>
      <span class="rname">${R.label}</span>
    </div>
    <div class="rstat"><span class="k">อิ่มนาน (fed_dur)</span><span class="v">${R.fedH}h</span></div>
    <div class="cadence" style="border-color:${R.aura}">${R.cadence}</div>
    <div class="gauge"><span class="gk">ต้องเติมบ่อย</span><div class="gt"><div class="gf freq" style="width:${freqPct}%"></div></div></div>
    <div class="gauge"><span class="gk">Earn rate</span><div class="gt"><div class="gf earn" style="width:${earnPct}%;background:${R.grad}"></div></div></div>
    <div class="rmult">×${R.mult.toFixed(2)} <span>EGG/hr</span></div>
  </div>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@600;700;800&family=Mali:wght@600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Nunito','Mali',system-ui,sans-serif; color:#1E1B4B;
    background:linear-gradient(160deg,#FEFCF6 0%,#F4F9FF 55%,#EEF6FF 100%); }
  .page { padding:34px 40px 42px; }
  .htitle { font-family:'Baloo 2',sans-serif; font-weight:800; font-size:26px; color:#1E1B4B; }
  .hsub { font-size:13px; color:#5B6B7D; font-weight:700; margin-top:2px; }
  .sec { font-family:'Baloo 2',sans-serif; font-weight:800; font-size:16px; color:#334155;
    margin:26px 0 4px; display:flex; align-items:center; gap:8px; }
  .sec .tag { font-size:10px; font-weight:800; letter-spacing:.04em; padding:3px 9px; border-radius:999px;
    background:rgba(59,130,246,.12); color:#2563EB; }
  .secnote { font-size:12px; color:#64748b; font-weight:700; margin-bottom:14px; }

  /* ── card ── */
  .cards { display:flex; gap:22px; }
  .card { position:relative; width:290px; border-radius:24px; background:#fff;
    box-shadow:0 14px 32px rgba(30,27,75,.14); padding:2px; }
  .rborder { position:absolute; inset:0; border-radius:24px; padding:2px; z-index:0; }
  .common .rborder { background:linear-gradient(135deg,#22C55E,#16A34A); }
  .uncommon .rborder { background:linear-gradient(135deg,#06B6D4,#0891B2); }
  .rare .rborder { background:linear-gradient(135deg,#3B82F6,#2563EB); }
  .rborder { -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
  .cbody { position:relative; z-index:1; background:#fff; border-radius:22px; padding:14px 0 0; overflow:hidden; }
  .topbar { display:flex; align-items:center; padding:0 16px 10px; }
  .ricon { width:28px; height:28px; border-radius:7px; color:#fff; font-weight:800; font-size:14px;
    display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.15); }
  .aid { margin-left:auto; font-size:11px; font-weight:800; color:#94a3b8; font-variant-numeric:tabular-nums; }
  .art { position:relative; margin:0 16px; height:172px; border-radius:18px;
    background:linear-gradient(160deg,#F8FAFF,#EFF4FF); border:1px solid rgba(255,255,255,.6);
    display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .aura { position:absolute; inset:0; }
  .critter { position:relative; width:74%; height:74%; display:flex; align-items:center; justify-content:center; }
  .critter svg { width:100%; height:100%; }
  .stage { position:absolute; left:10px; bottom:10px; font-size:11px; font-weight:800; color:#334155;
    background:rgba(255,255,255,.82); padding:3px 9px; border-radius:999px; backdrop-filter:blur(4px); }
  .meta { padding:12px 18px 6px; }
  .name { font-family:'Baloo 2',sans-serif; font-weight:800; font-size:20px; }
  .sci { font-size:12px; color:#64748b; font-weight:700; font-style:italic; }

  /* ── satiety block ── */
  .sat { display:flex; flex-direction:column; gap:8px; padding:6px 18px 18px; }
  .sh { display:flex; align-items:center; gap:8px; }
  .sl { font-size:12px; font-weight:800; color:#64748b; letter-spacing:.02em; }
  .chip { font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; border:1px solid; }
  .pct { margin-left:auto; font-size:12px; font-weight:800; color:#475569; font-variant-numeric:tabular-nums; }
  .track { height:9px; background:rgba(30,27,75,.07); border-radius:999px; overflow:hidden;
    box-shadow:inset 0 1px 2px rgba(0,0,0,.06); }
  .fill { height:100%; border-radius:999px; box-shadow:0 1px 0 rgba(255,255,255,.35) inset; }
  .deadline { font-size:11.5px; font-weight:800; padding:5px 10px; border-radius:9px; }
  .deadline.full { color:#0f766e; background:rgba(20,184,166,.1); }
  .deadline.hungry { color:#b45309; background:rgba(245,158,11,.12); }
  .deadline.starving { color:#b91c1c; background:rgba(239,68,68,.12); }
  .earnrow { display:flex; align-items:baseline; justify-content:space-between; }
  .er-r { font-size:11px; font-weight:800; color:#94a3b8; }
  .er-v { font-size:15px; font-weight:800; font-variant-numeric:tabular-nums; display:inline-flex; align-items:baseline; gap:4px; }
  .er-v .u { font-size:10px; font-weight:700; color:#cbb890; }
  .er-v .eb { font-size:10px; font-weight:700; color:#cbd5e1; }
  .gn { font-size:11px; font-weight:800; padding:4px 9px; border-radius:8px; align-self:flex-start; }
  .gn.ok { color:#16a34a; background:rgba(34,197,94,.1); }
  .gn.warn { color:#d97706; background:rgba(245,158,11,.12); }
  .gn.stop { color:#dc2626; background:rgba(239,68,68,.13); }
  .feed { width:100%; padding:11px 0; border:none; border-radius:12px; color:#fff;
    font-family:'Nunito'; font-size:13.5px; font-weight:800; box-shadow:0 3px 12px rgba(0,0,0,.14); }

  /* ── rarity trade-off ── */
  .rcols { display:flex; gap:20px; }
  .rcol { width:246px; background:#fff; border-radius:20px; padding:18px; box-shadow:0 10px 26px rgba(30,27,75,.1);
    display:flex; flex-direction:column; gap:11px; border:1px solid rgba(30,27,75,.05); }
  .rtop { display:flex; align-items:center; gap:9px; }
  .rname { font-family:'Baloo 2',sans-serif; font-weight:800; font-size:18px; }
  .rstat { display:flex; justify-content:space-between; align-items:baseline; }
  .rstat .k { font-size:12px; font-weight:700; color:#64748b; }
  .rstat .v { font-size:16px; font-weight:800; font-variant-numeric:tabular-nums; }
  .cadence { font-size:12.5px; font-weight:800; color:#334155; text-align:center; padding:7px;
    border-radius:10px; border:1.5px solid; background:rgba(255,255,255,.5); }
  .gauge { display:flex; flex-direction:column; gap:4px; }
  .gk { font-size:10.5px; font-weight:800; color:#94a3b8; letter-spacing:.02em; }
  .gt { height:8px; background:rgba(30,27,75,.06); border-radius:999px; overflow:hidden; }
  .gf { height:100%; border-radius:999px; }
  .gf.freq { background:linear-gradient(90deg,#fb923c,#f43f5e); }
  .rmult { font-family:'Baloo 2',sans-serif; font-weight:800; font-size:22px; color:#b45309; text-align:center; margin-top:2px; }
  .rmult span { font-size:11px; color:#cbb890; font-weight:700; }

  .flags { margin-top:26px; background:rgba(255,255,255,.72); border:1px solid rgba(59,130,246,.18);
    border-radius:16px; padding:16px 20px; }
  .flags h4 { font-family:'Baloo 2',sans-serif; font-size:14px; color:#b45309; margin-bottom:8px; }
  .flags li { font-size:12px; color:#475569; font-weight:700; margin:4px 0; list-style:none; padding-left:20px; position:relative; }
  .flags li::before { content:'⚑'; position:absolute; left:0; color:#f59e0b; }
`;

function statesBoard() {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${CSS}</style></head>
  <body><div class="page" style="width:1000px">
    <div class="htitle">🍽️ Feed v2 — ความอิ่ม (Satiety) · 3 States</div>
    <div class="hsub">การ์ดเดียวกัน (Foxling · Rare) ไล่จากอิ่ม → หิว → หิวจัด · แถบลดตามเวลา ผู้เล่นต้องแวะเติม</div>
    <div class="sec">สถานะความอิ่ม <span class="tag">SatietyMeter.tsx · live</span></div>
    <div class="secnote">satiety% = (last_fed + fed_dur − now) / fed_dur · เกณฑ์: อิ่ม ≥60% · เริ่มหิว 25–60% · หิวจัด &lt;25%</div>
    <div class="cards">
      ${card({rarity:'rare',species:'foxling',name:'Foxling',sci:'Vulpes magica',stage:3,state:'full',pct:88,earnFactor:1.0,cost:12,deadline:'🕒 เต็มถัง · เติมภายใน ~114 ชม. ก่อนหยุดโต'})}
      ${card({rarity:'rare',species:'foxling',name:'Foxling',sci:'Vulpes magica',stage:3,state:'hungry',pct:42,earnFactor:0.5,cost:12,deadline:'⏳ เริ่มหิว · อีก ~20 ชม. จะหิวจัด'})}
      ${card({rarity:'rare',species:'foxling',name:'Foxling',sci:'Vulpes magica',stage:3,state:'starving',pct:9,earnFactor:0.1,cost:12,deadline:'⏸ หิวจัด · โตหยุด — เติมด่วนภายใน ~11 ชม.'})}
    </div>
  </div></body></html>`;
}

function rarityBoard() {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${CSS}</style></head>
  <body><div class="page" style="width:820px">
    <div class="htitle">💎 Rarity Trade-off — ยิ่งหายาก ยิ่งสบาย + คุ้ม</div>
    <div class="hsub">การ์ดหายาก = อิ่มนานกว่า (เติมถี่น้อยลง) แต่ earn HATCH ต่อ ชม. มากกว่า</div>
    <div class="sec">Feed cadence × Earn rate ต่อ tier <span class="tag">configv3 · verified ratios</span></div>
    <div class="secnote">fed_dur ยิ่งยาว = decay ช้า เติมห่างได้ · earn_mult verified บน chain (×1.00 / 1.10 / 1.40)</div>
    <div class="rcols">
      ${rarCol('common')}
      ${rarCol('uncommon')}
      ${rarCol('rare')}
    </div>
    <div class="flags">
      <h4>⚑ รอ Kevin reconcile ก่อนผูกของจริง (design ยืดหยุ่นรับได้)</h4>
      <ul>
        <li><b>earn_mult</b>: board ใช้ค่า verified ×1.0/1.1/1.4 (satiety.ts 2026-07-09) — FEED-ECONOMY-V2 เขียน ×1.5/2.5 เป็น mock, รอ Kevin ยืนยันเลขสุดท้าย</li>
        <li><b>feed cost</b>: ปุ่มโชว์ 12 EGG (FEED-ECONOMY-V2) — build ปัจจุบันยังเขียน "Free" ต้อง sync เมื่อ economy v2 deploy</li>
        <li><b>จำนวน tier</b>: on-chain มี 3 rarity (common/uncommon/rare) — การ์ด NFT 4 tier (มี Legendary) ต้อง sync; layout รับ N tier ได้</li>
        <li><b>fed_dur</b>: 48/72/120h = spec default, ผูก configv3.fed_dur_* อัตโนมัติเมื่อ live</li>
      </ul>
    </div>
  </div></body></html>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  for (const [name, html] of [['board-states', statesBoard()], ['board-rarity', rarityBoard()]]) {
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600); // let webfonts settle
    const el = await page.$('.page');
    await el.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('✓', name + '.png');
    await page.close();
  }
  await browser.close();
})();
