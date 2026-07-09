/*
 * Pocket Hatchery — 12-Species Creature Template Engine
 * Hand-authored SVG vector art, one species per slot.
 * Follows ART.md (cozy-premium soft-3D, golden-hour key light, rim light,
 * fluffy silhouettes, sparkly catchlit eyes, contact shadow).
 *
 * Each species: 3 stages (egg → baby → adult), 3 idle frames each.
 * 12 species × 3 stages × 3 frames = 108 unique SVG compositions.
 *
 * Monanisa (Designer) · v1.0 · 2026-07-03
 * Ref: SPECIES-DESIGN.md · ART.md · foxling.js (original single-species engine)
 */

const W = 256, H = 256;
const PIVOT_X = 128, PIVOT_Y = 206; // squat/wobble anchor at the feet

// =========================================================================
// SHARED PALETTE (ART.md §3)
// =========================================================================
const C = {
  cream: '#FFF6E9', sky: '#A8DCF0', mint: '#8FD694', meadow: '#5BB572',
  gold: '#FFCB6B', coral: '#FF9EB5', lavender: '#C9A8FF', earth: '#C49A6C',
  navy: '#3A3A52', teal: '#5BC0BE', pearl: '#F5F0E8', white: '#FFFFFF',
  deepTeal: '#3DA5A3', deepEarth: '#A07848', deepLavender: '#8A4FD4',
  softMint: '#ADE2AC', softCoral: '#FFD2DE', softGold: '#FFE3A6',
  skyDeep: '#7EC8E0', creamDeep: '#F5E6CC', obsidian: '#1a1a2e',
  darkPurple: '#2D1B4E', bubblegum: '#FFB5C5',
};

// Species-specific palettes (keyed by species id string)
const SP = {
  foxling:    { base: C.mint,    baseDark: C.meadow,    accent: C.coral,    belly: C.cream,    eggBase: C.mint,    eggSpot: C.cream,    highlight: C.lavender },
  owlet:      { base: C.sky,     baseDark: C.skyDeep,   accent: C.gold,     belly: C.cream,    eggBase: C.white,    eggSpot: C.sky,       highlight: C.gold },
  droplet:    { base: C.teal,    baseDark: C.deepTeal,  accent: C.pearl,    belly: C.white,    eggBase: C.teal,     eggSpot: C.pearl,     highlight: C.white },
  pebblit:    { base: C.earth,   baseDark: C.deepEarth, accent: C.mint,     belly: '#D4B896',  eggBase: C.earth,    eggSpot: C.mint,      highlight: C.lavender },
  sproutling: { base: C.meadow,  baseDark: '#4A9E5E',   accent: C.coral,    belly: C.cream,    eggBase: C.meadow,   eggSpot: C.coral,     highlight: C.gold },
  flicker:    { base: C.gold,    baseDark: C.coral,     accent: C.cream,    belly: '#FFF0CC',  eggBase: C.obsidian, eggSpot: C.gold,      highlight: C.white },
  glimmer:    { base: C.lavender,baseDark: C.deepLavender,accent: C.white,   belly: '#E8DCF8',  eggBase: C.cream,    eggSpot: C.lavender,  highlight: C.white },
  wisp:       { base: C.navy,    baseDark: '#4A4A6A',   accent: C.lavender, belly: '#5C5C7A',  eggBase: C.darkPurple,eggSpot: C.lavender,  highlight: C.white },
  fluffle:    { base: C.cream,   baseDark: C.creamDeep, accent: C.mint,     belly: C.white,    eggBase: C.cream,    eggSpot: '#F0E0CC',   highlight: C.gold },
  shellby:    { base: C.pearl,   baseDark: '#E8D5F0',   accent: C.coral,    belly: '#FFD0D8',  eggBase: C.pearl,    eggSpot: C.coral,     highlight: C.gold },
  dracling:   { base: C.deepLavender,baseDark: '#6B3FA8',accent: '#FFD86B', belly: '#F0E0FF',  eggBase: C.deepLavender,eggSpot: '#FFD86B', highlight: C.gold },
  buzzle:     { base: C.gold,    baseDark: C.earth,      accent: C.cream,    belly: '#FFF5DC',  eggBase: C.gold,     eggSpot: C.earth,     highlight: C.white },
};

// =========================================================================
// SHARED SVG HELPERS
// =========================================================================

// Radial gradient defs — key light from top-left (golden-hour direction)
function makeGradients(sp) {
  return `<defs>
    <radialGradient id="bodyG" gradientUnits="userSpaceOnUse" cx="96" cy="86" r="168">
      <stop offset="0" stop-color="${sp.highlight}" stop-opacity="0.55"/>
      <stop offset="0.30" stop-color="${sp.base}"/>
      <stop offset="0.66" stop-color="${sp.base}"/>
      <stop offset="1" stop-color="${sp.baseDark}"/>
    </radialGradient>
    <radialGradient id="bellyG" gradientUnits="userSpaceOnUse" cx="110" cy="120" r="140">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="${sp.belly}"/>
      <stop offset="1" stop-color="${sp.baseDark}" stop-opacity="0.25"/>
    </radialGradient>
    <radialGradient id="shellG" gradientUnits="userSpaceOnUse" cx="104" cy="92" r="150">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.45" stop-color="${sp.eggBase}"/>
      <stop offset="1" stop-color="${sp.baseDark}"/>
    </radialGradient>
    <radialGradient id="eggGlow" gradientUnits="userSpaceOnUse" cx="128" cy="152" r="74">
      <stop offset="0" stop-color="${sp.accent}" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="${sp.accent}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${sp.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="accentG" gradientUnits="userSpaceOnUse" cx="118" cy="92" r="60">
      <stop offset="0" stop-color="${sp.accent}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${sp.accent}"/>
    </radialGradient>
    <radialGradient id="eyeG" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="20" gradientTransform="translate(0 0)">
      <stop offset="0" stop-color="#56566F"/>
      <stop offset="0.7" stop-color="#363650"/>
      <stop offset="1" stop-color="#2A2A40"/>
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
    <filter id="soft2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="soft4" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>`;
}

// Fluffy lumpy blob: core ellipse ringed with bump circles, shared gradient fill
function fluff(cx, cy, rx, ry, n, bump, fill) {
  let s = `<g><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    const r = bump * (0.78 + 0.34 * Math.abs(Math.sin(i * 1.7)));
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}"/>`;
  }
  return s + `</g>`;
}

// Big sparkly eye + catchlights — signature of the brand
function eye(cx, cy, rx, ry) {
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eyeG)"/>
    <ellipse cx="${cx}" cy="${cy + ry * 0.25}" rx="${rx * 0.7}" ry="${ry * 0.6}" fill="${C.lavender}" opacity="0.18"/>
    <circle cx="${cx - rx * 0.35}" cy="${cy - ry * 0.42}" r="${rx * 0.42}" fill="#FFFFFF"/>
    <circle cx="${cx + rx * 0.30}" cy="${cy + ry * 0.34}" r="${rx * 0.20}" fill="#FFFFFF" opacity="0.85"/>
  </g>`;
}

// 4-point sparkle star
function spark(cx, cy, s, fill, op = 1) {
  return `<path transform="translate(${cx} ${cy})" d="M0 ${-s} C ${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s} 0 C ${s * 0.18} ${s * 0.18} ${s * 0.18} ${s * 0.18} 0 ${s} C ${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s} 0 C ${-s * 0.18} ${-s * 0.18} ${-s * 0.18} ${-s * 0.18} 0 ${-s} Z" fill="${fill}" opacity="${op}"/>`;
}

function contactShadow(rx) {
  return `<ellipse class="shadow" cx="128" cy="214" rx="${rx}" ry="13" fill="${C.navy}" opacity="0.15" filter="url(#soft)"/>`;
}

// frame transform: egg wobbles, baby/adult breathe — pivot at the feet
function frameTransform(stage, f) {
  if (stage === 'egg') {
    const rot = f === 1 ? 0 : f === 2 ? -3 : 3;
    return `rotate(${rot} ${PIVOT_X} ${PIVOT_Y})`;
  }
  const sx = f === 1 ? 1 : f === 2 ? 0.985 : 1.015;
  const sy = f === 1 ? 1 : f === 2 ? 1.035 : 0.975;
  const ty = f === 1 ? 0 : f === 2 ? -5 : 2;
  return `translate(0 ${ty}) translate(${PIVOT_X} ${PIVOT_Y}) scale(${sx} ${sy}) translate(${-PIVOT_X} ${-PIVOT_Y})`;
}

// Simple circular fluff cluster (for cloud-like creatures)
function fluffCluster(cx, cy, rx, ry, rings, fill) {
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  for (let r = 0; r < rings; r++) {
    const rr = (r + 1) / rings;
    const n = Math.floor(6 + rr * 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = cx + Math.cos(a) * rx * rr;
      const py = cy + Math.sin(a) * ry * rr;
      const br = (rx * 0.22) * (1 - rr * 0.4);
      s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${br.toFixed(1)}" fill="${fill}"/>`;
    }
  }
  return `<g>${s}</g>`;
}

// Wing shape helper (for owlet, dracling, buzzle)
function wing(cx, cy, w, h, angle, fill) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${h}" transform="rotate(${angle} ${cx} ${cy})" fill="${fill}" opacity="0.85"/>`;
}

// =========================================================================
// EGG STAGE HELPERS (shared across species)
// =========================================================================

function drawEggGeneric(sp, f, eggPath, speckFn, crackFn, extraGlowFn) {
  const glow = f === 1 ? 0.55 : f === 2 ? 0.8 : 1.0;

  // nest base (straw)
  let nest = `<g>
    <ellipse cx="128" cy="196" rx="80" ry="24" fill="#A87B46"/>
    <ellipse cx="128" cy="190" rx="74" ry="20" fill="${C.earth}"/>`;
  for (let i = 0; i < 16; i++) {
    const t = i / 15, x = 56 + t * 144;
    const col = i % 2 ? C.gold : '#D7B074';
    nest += `<path d="M${x} 198 q ${(0.5 - t) * 26} -20 ${(0.5 - t) * 12} -30" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.92"/>`;
  }
  nest += `</g>`;

  const specks = speckFn ? speckFn() : '';
  const cracks = crackFn && f === 3 ? crackFn() : '';
  const extraGlow = extraGlowFn ? extraGlowFn(f) : '';

  return `<g>
    ${contactShadow(74)}
    <ellipse cx="128" cy="152" rx="68" ry="80" fill="url(#eggGlow)" opacity="${glow}"/>
    ${nest}
    <path d="${eggPath}" fill="url(#shellG)"/>
    <path d="${eggPath}" fill="url(#eggGlow)" opacity="${glow * 0.6}"/>
    ${specks}
    <path d="M96 92 C 108 80 124 78 132 80" stroke="${C.white}" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.55" filter="url(#soft)"/>
    ${cracks}
    ${extraGlow}
  </g>`;
}

// Standard egg shape
const EGG_PATH = `M128 72 C 160 72 176 112 176 142 C 176 178 154 204 128 204 C 102 204 80 178 80 142 C 80 112 96 72 128 72 Z`;

// =========================================================================
// SPECIES 1: FOXLING 🦊 — Fire / Forest (MASCOT)
// =========================================================================
function drawFoxlingEgg(f) {
  const sp = SP.foxling;
  const specks = () => {
    let s = '<g opacity="0.85">';
    const dots = [[104,110,6,C.mint],[150,122,5,C.coral],[120,100,4,C.mint],
      [158,150,6,C.mint],[98,142,5,C.lavender],[138,168,5,C.coral],
      [110,168,4,C.mint],[146,96,3.5,C.lavender]];
    for (const [x,y,r,c] of dots) s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*0.8}" fill="${c}"/>`;
    return s + '</g>';
  };
  const crack = () => `<ellipse cx="120" cy="108" rx="16" ry="11" fill="${C.gold}" opacity="0.85" filter="url(#soft)"/>
    <path d="M100 100 l 10 9 l -7 8 l 12 9 l -6 8 l 11 7" stroke="${C.navy}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <path d="M101 99 l 10 9 l -7 8 l 12 9 l -6 8" stroke="#FFFFFF" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.6"/>`;
  const extraGlow = (f) => {
    let s = spark(70,100,8,C.gold) + spark(190,130,7,C.lavender,0.9);
    if (f >= 2) s += spark(196,80,6,C.gold,0.9) + spark(60,150,5,C.coral,0.85);
    if (f === 3) s += spark(150,64,7,C.gold) + spark(86,70,5,C.lavender,0.9);
    return s;
  };
  return drawEggGeneric(sp, f, EGG_PATH, specks, crack, extraGlow);
}

function drawFoxlingBaby() {
  const sp = SP.foxling;
  const ear = (mx, dir) => `
    <path d="M${mx} 116 C ${mx - dir * 6} 92 ${mx + dir * 4} 70 ${mx + dir * 22} 78 C ${mx + dir * 26} 96 ${mx + dir * 20} 112 ${mx + dir * 14} 120 Z" fill="url(#bodyG)"/>
    <path d="M${mx + dir * 4} 110 C ${mx + dir * 2} 96 ${mx + dir * 8} 84 ${mx + dir * 16} 88 C ${mx + dir * 18} 98 ${mx + dir * 15} 106 ${mx + dir * 12} 112 Z" fill="url(#accentG)"/>`;
  return `<g>
    ${contactShadow(60)}
    ${fluff(184, 172, 18, 16, 9, 9, 'url(#bodyG)')}
    <ellipse cx="194" cy="184" rx="13" ry="11" fill="url(#bellyG)"/>
    <ellipse cx="106" cy="200" rx="17" ry="11" fill="url(#bellyG)"/>
    <ellipse cx="150" cy="200" rx="17" ry="11" fill="url(#bellyG)"/>
    ${ear(104, -1)} ${ear(152, 1)}
    ${fluff(128, 150, 58, 54, 16, 13, 'url(#bodyG)')}
    <ellipse cx="128" cy="164" rx="35" ry="38" fill="url(#bellyG)"/>
    <ellipse cx="90" cy="164" rx="13" ry="9" fill="${sp.accent}" opacity="0.5" filter="url(#soft)"/>
    <ellipse cx="166" cy="164" rx="13" ry="9" fill="${sp.accent}" opacity="0.5" filter="url(#soft)"/>
    ${eye(108, 146, 14, 17)} ${eye(148, 146, 14, 17)}
    <ellipse cx="128" cy="162" rx="5" ry="4" fill="${sp.accent}"/>
    <circle cx="126" cy="160.5" r="1.4" fill="#FFFFFF" opacity="0.9"/>
    <path d="M128 166 q -6 6 -12 3 M128 166 q 6 6 12 3" stroke="${C.navy}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M82 132 C 92 96 168 96 174 132" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
  </g>`;
}

function drawFoxlingAdult() {
  const sp = SP.foxling;
  const ear = (mx, dir) => `
    <path d="M${mx} 104 C ${mx - dir * 8} 70 ${mx + dir * 2} 40 ${mx + dir * 26} 50 C ${mx + dir * 30} 76 ${mx + dir * 24} 96 ${mx + dir * 16} 110 Z" fill="url(#bodyG)"/>
    <path d="M${mx + dir * 5} 96 C ${mx + dir * 2} 70 ${mx + dir * 10} 54 ${mx + dir * 19} 60 C ${mx + dir * 21} 78 ${mx + dir * 17} 90 ${mx + dir * 13} 100 Z" fill="url(#accentG)"/>
    <ellipse cx="${mx + dir * 22}" cy="54" rx="7" ry="9" fill="${sp.highlight}" opacity="0.9"/>`;
  return `<g>
    ${contactShadow(66)}
    ${fluff(180, 178, 22, 26, 10, 12, 'url(#bodyG)')}
    ${fluff(198, 146, 18, 24, 9, 12, 'url(#bodyG)')}
    ${fluff(202, 118, 15, 18, 8, 11, 'url(#bodyG)')}
    ${fluff(203, 100, 12, 13, 7, 9, 'url(#bellyG)')}
    <ellipse cx="110" cy="208" rx="16" ry="11" fill="url(#bellyG)"/>
    <ellipse cx="146" cy="208" rx="16" ry="11" fill="url(#bellyG)"/>
    ${fluff(126, 168, 46, 58, 15, 12, 'url(#bodyG)')}
    <ellipse cx="126" cy="178" rx="28" ry="42" fill="url(#bellyG)"/>
    <ellipse cx="112" cy="200" rx="13" ry="10" fill="url(#bellyG)"/>
    <ellipse cx="142" cy="200" rx="13" ry="10" fill="url(#bellyG)"/>
    ${ear(106, -1)} ${ear(150, 1)}
    ${fluff(128, 108, 42, 38, 14, 11, 'url(#bodyG)')}
    <ellipse cx="128" cy="120" rx="24" ry="19" fill="url(#bellyG)"/>
    <ellipse cx="97" cy="120" rx="11" ry="8" fill="${sp.accent}" opacity="0.5" filter="url(#soft)"/>
    <ellipse cx="159" cy="120" rx="11" ry="8" fill="${sp.accent}" opacity="0.5" filter="url(#soft)"/>
    ${spark(128, 92, 7, sp.highlight, 0.9)}
    ${eye(113, 109, 12, 15)} ${eye(143, 109, 12, 15)}
    <ellipse cx="128" cy="123" rx="4.5" ry="3.6" fill="${sp.accent}"/>
    <circle cx="126.5" cy="121.8" r="1.3" fill="#FFFFFF" opacity="0.9"/>
    <path d="M128 127 q -6 6 -11 3 M128 127 q 6 6 11 3" stroke="${C.navy}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M88 96 C 98 62 158 62 168 96" stroke="#FFFFFF" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 2: OWLET 🦉 — Air / Wisdom
// =========================================================================
function drawOwletEgg(f) {
  const sp = SP.owlet;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // concentric sky-blue circles
    for (let r = 0; r < 4; r++) {
      s += `<circle cx="128" cy="142" r="${10 + r * 14}" fill="none" stroke="${C.sky}" stroke-width="2.5" opacity="${0.5 - r * 0.1}"/>`;
    }
    const dots = [[100,110,4.5,C.gold],[156,118,5,C.gold],[120,170,4,C.sky],[140,92,3.5,C.gold]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M108 96 l 12 14 l -8 10 l 14 10" stroke="${C.navy}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
    <circle cx="112" cy="106" rx="10" ry="8" fill="${C.gold}" opacity="0.35" filter="url(#soft)"/>
    ${spark(112, 106, 6, C.gold, 0.9)}`;
  const extraGlow = (f) => {
    let s = spark(176,100,7,C.gold) + spark(78,140,6,C.sky,0.9);
    if (f >= 2) s += spark(188,140,5,C.gold,0.9);
    if (f === 3) s += spark(72,90,7,C.gold);
    return s;
  };
  return drawEggGeneric(sp, f, EGG_PATH, specks, crack, extraGlow);
}

function drawOwletBaby() {
  const sp = SP.owlet;
  return `<g>
    ${contactShadow(58)}
    <!-- tiny feet -->
    <ellipse cx="112" cy="202" rx="11" ry="7" fill="url(#bellyG)"/>
    <ellipse cx="144" cy="202" rx="11" ry="7" fill="url(#bellyG)"/>
    <!-- body = one big fluff ball (no neck!) -->
    ${fluff(128, 148, 52, 52, 18, 11, 'url(#bodyG)')}
    <ellipse cx="128" cy="160" rx="32" ry="34" fill="url(#bellyG)"/>
    <!-- tiny wings -->
    ${wing(80, 148, 14, 24, -15, 'url(#bodyG)')}
    ${wing(176, 148, 14, 24, 15, 'url(#bodyG)')}
    <!-- big round owl eyes -->
    ${eye(108, 136, 15, 17)} ${eye(148, 136, 15, 17)}
    <!-- concentric eye rings -->
    <circle cx="108" cy="136" r="20" fill="none" stroke="${sp.accent}" stroke-width="3" opacity="0.5"/>
    <circle cx="148" cy="136" r="20" fill="none" stroke="${sp.accent}" stroke-width="3" opacity="0.5"/>
    <!-- tiny beak -->
    <polygon points="124,156 128,162 132,156" fill="${sp.accent}"/>
    <!-- rim light -->
    <path d="M82 120 C 92 86 168 86 174 120" stroke="#FFFFFF" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.4" filter="url(#soft)"/>
  </g>`;
}

function drawOwletAdult() {
  const sp = SP.owlet;
  return `<g>
    ${contactShadow(62)}
    <!-- feet with talons -->
    <ellipse cx="114" cy="208" rx="12" ry="8" fill="url(#bellyG)"/>
    <ellipse cx="142" cy="208" rx="12" ry="8" fill="url(#bellyG)"/>
    <!-- broader wings -->
    ${wing(70, 150, 18, 36, -20, 'url(#bodyG)')}
    ${wing(186, 150, 18, 36, 20, 'url(#bodyG)')}
    <!-- body -->
    ${fluff(128, 148, 48, 56, 16, 10, 'url(#bodyG)')}
    <ellipse cx="128" cy="160" rx="28" ry="38" fill="url(#bellyG)"/>
    <!-- head with feather tufts -->
    ${fluff(128, 104, 38, 34, 14, 9, 'url(#bodyG)')}
    <ellipse cx="108" cy="80" rx="10" ry="14" fill="url(#bodyG)" transform="rotate(-15 108 80)"/>
    <ellipse cx="148" cy="80" rx="10" ry="14" fill="url(#bodyG)" transform="rotate(15 148 80)"/>
    <!-- face disk -->
    <ellipse cx="128" cy="112" rx="22" ry="18" fill="url(#bellyG)"/>
    <!-- eyes with wisdom rings -->
    ${eye(112, 104, 11, 14)} ${eye(144, 104, 11, 14)}
    <circle cx="112" cy="104" r="17" fill="none" stroke="${sp.accent}" stroke-width="2.5" opacity="0.45"/>
    <circle cx="144" cy="104" r="17" fill="none" stroke="${sp.accent}" stroke-width="2.5" opacity="0.45"/>
    <!-- brow feathers (wise look) -->
    <path d="M98 95 C 106 91 118 93 124 98" stroke="${C.navy}" stroke-width="2.8" fill="none" stroke-linecap="round" opacity="0.6"/>
    <path d="M158 95 C 150 91 138 93 132 98" stroke="${C.navy}" stroke-width="2.8" fill="none" stroke-linecap="round" opacity="0.6"/>
    <polygon points="124,118 128,124 132,118" fill="${sp.accent}"/>
    <!-- forehead star (wisdom mark) -->
    ${spark(128, 86, 6, sp.accent, 0.9)}
    <!-- rim light -->
    <path d="M92 98 C 102 66 154 66 164 98" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.4" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 3: DROPLET 💧 — Water / Flow
// =========================================================================
function drawDropletEgg(f) {
  const sp = SP.droplet;
  // egg is more teardrop-shaped for water species
  const tearPath = `M128 68 C 162 70 178 110 174 144 C 170 178 150 206 128 206 C 106 206 86 178 82 144 C 78 110 94 70 128 68 Z`;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // ripple rings
    for (let r = 0; r < 3; r++) {
      s += `<ellipse cx="128" cy="148" rx="${12 + r * 16}" ry="${6 + r * 8}" fill="none" stroke="${C.pearl}" stroke-width="2.5" opacity="${0.55 - r * 0.15}"/>`;
    }
    const dots = [[108,110,4,sp.belly],[148,118,5,sp.belly],[120,168,4,sp.accent],[138,90,3.5,sp.belly]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.7"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M110 98 l 8 12 l -5 10 l 10 8" stroke="${C.white}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
    <ellipse cx="112" cy="108" rx="9" ry="7" fill="${C.white}" opacity="0.3" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(170,100,6,sp.belly,0.9) + spark(82,144,5,sp.accent,0.85);
    if (f >= 2) s += spark(180,140,5,sp.belly,0.8);
    if (f === 3) s += spark(150,68,7,C.white) + spark(80,88,5,C.white,0.85);
    return s;
  };
  return drawEggGeneric(sp, f, tearPath, specks, crack, extraGlow);
}

function drawDropletBaby() {
  const sp = SP.droplet;
  return `<g>
    ${contactShadow(50)}
    <!-- teardrop body (胖上尖下) with translucent look -->
    <path d="M128 74 C 158 78 170 110 166 146 C 162 176 146 198 128 200 C 110 198 94 176 90 146 C 86 110 98 78 128 74 Z" fill="url(#bodyG)" opacity="0.75"/>
    <!-- inner core (visible through translucency) -->
    <circle cx="128" cy="144" r="22" fill="${sp.accent}" opacity="0.35"/>
    <circle cx="128" cy="144" r="14" fill="${sp.highlight}" opacity="0.5"/>
    <circle cx="128" cy="144" r="6" fill="${C.white}" opacity="0.8"/>
    <!-- tiny side fins -->
    <ellipse cx="86" cy="148" rx="18" ry="7" fill="url(#accentG)" opacity="0.55" transform="rotate(-25 86 148)"/>
    <ellipse cx="170" cy="148" rx="18" ry="7" fill="url(#accentG)" opacity="0.55" transform="rotate(25 170 148)"/>
    <!-- big glossy eyes on the body surface -->
    ${eye(112, 122, 12, 15)} ${eye(144, 122, 12, 15)}
    <!-- tiny mouth -->
    <path d="M128 148 q -4 5 -8 2 M128 148 q 4 5 8 2" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
    <!-- specular highlight -->
    <path d="M96 98 C 108 88 120 86 132 88" stroke="${C.white}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
    <!-- bubble sparkles -->
    ${spark(164, 88, 5, C.white, 0.8)} ${spark(178, 120, 4, sp.belly, 0.7)}
  </g>`;
}

function drawDropletAdult() {
  const sp = SP.droplet;
  return `<g>
    ${contactShadow(56)}
    <!-- teardrop body, larger -->
    <path d="M128 64 C 164 66 180 110 174 150 C 168 190 150 212 128 212 C 106 212 88 190 82 150 C 76 110 92 66 128 64 Z" fill="url(#bodyG)" opacity="0.78"/>
    <!-- inner core = heart-shaped -->
    <path d="M128 132 C 128 132 112 118 112 130 C 112 140 128 148 128 148 C 128 148 144 140 144 130 C 144 118 128 132 128 132 Z" fill="${C.coral}" opacity="0.5"/>
    <circle cx="128" cy="134" r="8" fill="${C.white}" opacity="0.7"/>
    <!-- flowing fins -->
    <path d="M80 148 C 60 140 52 160 70 168 C 80 172 88 164 82 154 Z" fill="url(#accentG)" opacity="0.5"/>
    <path d="M176 148 C 196 140 204 160 186 168 C 176 172 168 164 174 154 Z" fill="url(#accentG)" opacity="0.5"/>
    <!-- water aura particles -->
    ${spark(66, 148, 6, C.white, 0.55)} ${spark(190, 146, 5, sp.belly, 0.5)}
    ${spark(156, 80, 5, C.white, 0.6)} ${spark(100, 90, 4, sp.accent, 0.5)}
    <!-- eyes -->
    ${eye(114, 112, 10, 13)} ${eye(142, 112, 10, 13)}
    <!-- specular highlight -->
    <path d="M94 88 C 108 76 124 72 138 76" stroke="${C.white}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
    <path d="M128 66 C 132 72 132 76 128 78" stroke="${C.white}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
  </g>`;
}

// =========================================================================
// SPECIES 4: PEBBLIT 🪨 — Earth / Stability
// =========================================================================
function drawPebblitEgg(f) {
  const sp = SP.pebblit;
  // slightly irregular stone shape
  const stonePath = `M128 74 C 156 72 172 108 168 142 C 164 174 146 204 128 204 C 108 204 88 178 84 146 C 80 114 100 72 128 74 Z`;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // moss-like speckles
    const dots = [[106,112,6,sp.accent],[148,122,5,sp.accent],[122,150,7,sp.accent],
      [154,162,5,sp.accent],[98,150,5,C.gold],[138,100,4.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.7"/>`;
    // crack lines (stone texture)
    s += `<path d="M110 90 l 8 14 l -4 8" stroke="${sp.baseDark}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.5"/>`;
    s += `<path d="M140 86 l -6 12 l 10 10" stroke="${sp.baseDark}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.45"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M100 100 l 14 14 l -8 12 l 14 8" stroke="${sp.accent}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="112" cy="112" rx="12" ry="9" fill="${sp.accent}" opacity="0.4" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(70,106,6,C.gold) + spark(176,130,5,sp.accent,0.8);
    if (f >= 2) s += spark(184,90,5,C.gold,0.85);
    if (f === 3) s += spark(66,140,6,sp.accent,0.8) + spark(156,74,5,C.gold);
    return s;
  };
  return drawEggGeneric(sp, f, stonePath, specks, crack, extraGlow);
}

function drawPebblitBaby() {
  const sp = SP.pebblit;
  return `<g>
    ${contactShadow(52)}
    <!-- 4 stubby legs -->
    <ellipse cx="98" cy="196" rx="11" ry="8" fill="url(#bodyG)"/>
    <ellipse cx="118" cy="198" rx="10" ry="7" fill="url(#bodyG)"/>
    <ellipse cx="138" cy="198" rx="10" ry="7" fill="url(#bodyG)"/>
    <ellipse cx="158" cy="196" rx="11" ry="8" fill="url(#bodyG)"/>
    <!-- rocky body (irregular oval) -->
    ${fluff(128, 148, 46, 42, 14, 9, 'url(#bodyG)')}
    <!-- moss patch on top -->
    ${fluff(128, 110, 22, 12, 8, 7, sp.accent)}
    <ellipse cx="128" cy="110" rx="18" ry="9" fill="${sp.accent}" opacity="0.6"/>
    <!-- tiny crystals peeking out -->
    <polygon points="140,106 144,94 148,106" fill="${sp.highlight}" opacity="0.5"/>
    <!-- tiny eyes -->
    ${eye(116, 140, 9, 11)} ${eye(140, 140, 9, 11)}
    <!-- tiny mouth -->
    <path d="M128 152 q -4 4 -7 1 M128 152 q 4 4 7 1" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- rim light on rock edge -->
    <path d="M86 128 C 92 98 170 98 172 132" stroke="#FFFFFF" stroke-width="4.5" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
  </g>`;
}

function drawPebblitAdult() {
  const sp = SP.pebblit;
  return `<g>
    ${contactShadow(60)}
    <!-- 4 legs, slightly larger -->
    <ellipse cx="96" cy="204" rx="12" ry="9" fill="url(#bodyG)"/>
    <ellipse cx="116" cy="206" rx="11" ry="8" fill="url(#bodyG)"/>
    <ellipse cx="140" cy="206" rx="11" ry="8" fill="url(#bodyG)"/>
    <ellipse cx="160" cy="204" rx="12" ry="9" fill="url(#bodyG)"/>
    <!-- rocky body -->
    ${fluff(128, 152, 52, 48, 16, 11, 'url(#bodyG)')}
    <!-- full moss coat -->
    ${fluff(128, 106, 30, 16, 10, 8, sp.accent)}
    <ellipse cx="128" cy="106" rx="26" ry="12" fill="${sp.accent}" opacity="0.7"/>
    <!-- crystal cluster on top -->
    <polygon points="128,92 134,76 140,92" fill="${sp.highlight}" opacity="0.65"/>
    <polygon points="116,96 120,84 124,96" fill="${sp.highlight}" opacity="0.45"/>
    <polygon points="138,94 142,80 146,94" fill="${C.white}" opacity="0.4"/>
    <!-- eyes with warmth -->
    ${eye(114, 142, 10, 12)} ${eye(142, 142, 10, 12)}
    <!-- smile -->
    <path d="M122 156 q 6 6 12 0" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <!-- rim light -->
    <path d="M82 132 C 88 98 172 98 176 136" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.38" filter="url(#soft)"/>
    ${spark(168, 100, 5, sp.highlight, 0.7)}
  </g>`;
}

// =========================================================================
// SPECIES 5: SPROUTLING 🌱 — Nature / Growth
// =========================================================================
function drawSproutlingEgg(f) {
  const sp = SP.sproutling;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // vine swirl
    s += `<path d="M108 104 C 120 90 138 96 130 110 C 122 124 142 118 146 108" stroke="${C.meadow}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6"/>`;
    // leaf dots
    const dots = [[118,130,7,sp.accent],[140,150,6,sp.accent],[106,160,5,C.gold],[150,108,5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*0.6}" fill="${c}" opacity="0.7" transform="rotate(${(x-128)*0.3} ${x} ${y})"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M108 96 l 10 14 l -5 10" stroke="${C.meadow}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="112" cy="106" rx="10" ry="7" fill="${C.gold}" opacity="0.5" filter="url(#soft)"/>
    ${spark(115, 103, 5, C.gold, 0.8)}`;
  const extraGlow = (f) => {
    let s = spark(172,108,6,C.gold) + spark(76,138,5,sp.accent,0.8);
    if (f >= 2) s += spark(180,140,5,sp.accent,0.75);
    if (f === 3) s += spark(74,90,6,C.gold) + spark(158,70,5,C.gold,0.85);
    return s;
  };
  return drawEggGeneric(sp, f, EGG_PATH, specks, crack, extraGlow);
}

function drawSproutlingBaby() {
  const sp = SP.sproutling;
  return `<g>
    ${contactShadow(46)}
    <!-- root legs -->
    <path d="M118 196 C 112 204 108 210 104 214" stroke="${C.earth}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M138 196 C 144 204 148 210 152 214" stroke="${C.earth}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <!-- stem body (chubby cylinder) -->
    <rect x="118" y="110" width="20" height="88" rx="10" fill="url(#bodyG)"/>
    <!-- single leaf head -->
    <path d="M128 110 C 110 88 106 60 128 52 C 150 60 146 88 128 110 Z" fill="url(#bodyG)"/>
    <path d="M128 108 L 128 56" stroke="${sp.baseDark}" stroke-width="1.5" fill="none" opacity="0.35"/>
    <!-- tiny flower bud -->
    <circle cx="128" cy="56" r="5" fill="${sp.accent}"/>
    <!-- eyes -->
    ${eye(120, 142, 8, 10)} ${eye(136, 142, 8, 10)}
    <!-- tiny smile -->
    <path d="M128 152 q -3 3 -5 0 M128 152 q 3 3 5 0" stroke="${C.navy}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- sparkle -->
    ${spark(156, 70, 5, C.gold, 0.7)}
  </g>`;
}

function drawSproutlingAdult() {
  const sp = SP.sproutling;
  return `<g>
    ${contactShadow(50)}
    <!-- root legs, more spread -->
    <path d="M114 200 C 108 210 100 218 96 222" stroke="${C.earth}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M142 200 C 148 210 156 218 160 222" stroke="${C.earth}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <!-- stem body, thicker -->
    <rect x="114" y="108" width="28" height="94" rx="14" fill="url(#bodyG)"/>
    <!-- multi-leaf canopy -->
    <path d="M128 108 C 100 82 92 48 128 38 C 164 48 156 82 128 108 Z" fill="url(#bodyG)"/>
    <path d="M128 104 C 110 86 98 64 118 52 C 132 62 134 82 128 104 Z" fill="${C.meadow}" opacity="0.6"/>
    <path d="M128 104 C 146 86 158 64 138 52 C 124 62 122 82 128 104 Z" fill="${sp.baseDark}" opacity="0.4"/>
    <!-- flower bloom -->
    <circle cx="128" cy="44" r="10" fill="${sp.accent}"/>
    ${[...Array(5)].map((_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return `<ellipse cx="${(128 + Math.cos(a) * 7).toFixed(1)}" cy="${(44 + Math.sin(a) * 7).toFixed(1)}" rx="5" ry="8" fill="${C.coral}" opacity="0.8" transform="rotate(${a * 180 / Math.PI} ${(128 + Math.cos(a) * 7).toFixed(1)} ${(44 + Math.sin(a) * 7).toFixed(1)})"/>`;
    }).join('')}
    <circle cx="128" cy="44" r="4" fill="${C.gold}"/>
    <!-- eyes -->
    ${eye(121, 142, 9, 11)} ${eye(135, 142, 9, 11)}
    <!-- warm smile -->
    <path d="M124 154 q 4 5 8 0" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <!-- sparkles -->
    ${spark(160, 60, 6, C.gold, 0.8)} ${spark(94, 70, 4, sp.accent, 0.65)}
  </g>`;
}

// =========================================================================
// SPECIES 6: FLICKER 🔥 — Fire / Energy
// =========================================================================
function drawFlickerEgg(f) {
  const sp = SP.flicker;
  // flame-shaped egg
  const flamePath = `M128 68 C 150 66 164 106 160 142 C 156 174 144 204 128 204 C 112 204 100 174 96 142 C 92 106 106 66 128 68 Z`;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // flame patterns
    const flames = [[108,110,14,8,C.gold],[148,108,13,9,C.gold],[128,120,16,10,C.gold],
      [118,150,10,7,C.coral],[138,148,10,7,C.coral]];
    for (const [cx,cy,rx,ry,c] of flames) s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="0.5" filter="url(#soft)"/>`;
    const dots = [[128,96,4,C.white],[108,130,3.5,C.white],[148,128,3.5,C.white]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.6"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M108 96 l 8 16 l -6 10 l 14 10" stroke="${C.gold}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <ellipse cx="110" cy="108" rx="12" ry="9" fill="${C.coral}" opacity="0.4" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(170,96,7,C.gold) + spark(72,130,6,C.coral,0.85);
    if (f >= 2) s += spark(178,136,5,C.gold,0.8) + spark(66,88,5,C.white,0.7);
    if (f === 3) s += spark(156,64,8,C.gold) + spark(86,72,6,C.coral,0.8);
    return s;
  };
  return drawEggGeneric(sp, f, flamePath, specks, crack, extraGlow);
}

function drawFlickerBaby() {
  const sp = SP.flicker;
  return `<g>
    ${contactShadow(48)}
    <!-- flame body (胖底尖顶 — wide bottom, pointed top) -->
    <path d="M128 68 C 146 70 156 104 154 138 C 152 168 140 196 128 198 C 116 196 104 168 102 138 C 100 104 110 70 128 68 Z" fill="url(#bodyG)" opacity="0.8"/>
    <!-- inner glow core -->
    <ellipse cx="128" cy="148" rx="22" ry="30" fill="${C.white}" opacity="0.2" filter="url(#soft)"/>
    <!-- small flame arms -->
    <path d="M102 148 C 90 138 82 144 88 150 C 94 156 100 152 100 150 Z" fill="url(#bodyG)" opacity="0.6"/>
    <path d="M154 148 C 166 138 174 144 168 150 C 162 156 156 152 156 150 Z" fill="url(#bodyG)" opacity="0.6"/>
    <!-- big round eyes -->
    ${eye(115, 124, 10, 13)} ${eye(141, 124, 10, 13)}
    <!-- tiny mouth -->
    <path d="M128 138 q -3 4 -5 1 M128 138 q 3 4 5 1" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- flame tip spark -->
    ${spark(128, 62, 6, C.gold, 0.9)}
    ${spark(160, 90, 4, C.white, 0.6)} ${spark(92, 96, 4, C.white, 0.5)}
  </g>`;
}

function drawFlickerAdult() {
  const sp = SP.flicker;
  return `<g>
    ${contactShadow(54)}
    <!-- flame body, taller and more dynamic -->
    <path d="M128 56 C 152 58 164 98 160 140 C 156 176 144 210 128 212 C 112 210 100 176 96 140 C 92 98 104 58 128 56 Z" fill="url(#bodyG)" opacity="0.82"/>
    <!-- inner fire layers -->
    <path d="M128 72 C 144 76 152 104 150 138 C 148 164 140 192 128 194 C 116 192 108 164 106 138 C 104 104 112 76 128 72 Z" fill="${C.gold}" opacity="0.4"/>
    <ellipse cx="128" cy="148" rx="20" ry="28" fill="${C.white}" opacity="0.25" filter="url(#soft)"/>
    <!-- flame arms, more prominent -->
    <path d="M98 150 C 80 138 68 148 78 158 C 88 166 98 160 98 156 Z" fill="url(#bodyG)" opacity="0.65"/>
    <path d="M158 150 C 176 138 188 148 178 158 C 168 166 158 160 158 156 Z" fill="url(#bodyG)" opacity="0.65"/>
    <!-- spark particles around -->
    ${spark(76, 130, 6, C.gold, 0.55)} ${spark(180, 128, 5, C.coral, 0.5)}
    ${spark(100, 80, 4, C.white, 0.5)} ${spark(158, 76, 5, C.gold, 0.55)}
    <!-- eyes -->
    ${eye(116, 120, 9, 12)} ${eye(140, 120, 9, 12)}
    <!-- smile -->
    <path d="M124 136 q 4 5 8 0" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <!-- tip spark + flame aura -->
    ${spark(128, 48, 8, C.gold, 0.95)}
    <path d="M94 70 C 100 50 158 50 162 70" stroke="${C.gold}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 7: GLIMMER 💎 — Crystal / Light
// =========================================================================
function drawGlimmerEgg(f) {
  const sp = SP.glimmer;
  // hexagonal gem-shaped egg
  const gemPath = `M128 66 L152 80 L160 112 L152 146 L128 160 L104 146 L96 112 L104 80 Z`;
  const specks = () => {
    let s = '<g opacity="0.8">';
    // facet lines
    s += `<path d="M128 66 L128 160" stroke="${sp.accent}" stroke-width="1.8" fill="none" opacity="0.4"/>`;
    s += `<path d="M104 80 L152 146" stroke="${sp.accent}" stroke-width="1.5" fill="none" opacity="0.3"/>`;
    s += `<path d="M152 80 L104 146" stroke="${sp.accent}" stroke-width="1.5" fill="none" opacity="0.3"/>`;
    s += `<path d="M128 66 L104 80 L96 112 L104 146 L128 160 L152 146 L160 112 L152 80 Z" stroke="${sp.accent}" stroke-width="2" fill="none" opacity="0.5"/>`;
    // facet sparkles
    const dots = [[128,100,3.5,sp.accent],[112,118,3,sp.accent],[144,118,3,sp.accent],[128,136,3.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.7"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M128 70 l 6 12 l 10 6 l -4 12 l 8 8" stroke="${sp.accent}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <ellipse cx="128" cy="88" rx="10" ry="7" fill="${C.white}" opacity="0.5" filter="url(#soft)"/>
    ${spark(128, 82, 6, C.white, 0.9)}`;
  const extraGlow = (f) => {
    let s = spark(162,88,6,sp.accent,0.8) + spark(92,130,5,sp.accent,0.7);
    if (f >= 2) s += spark(164,126,5,C.white,0.75);
    if (f === 3) s += spark(128,62,7,sp.accent) + spark(92,88,5,C.white,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, gemPath, specks, crack, extraGlow);
}

function drawGlimmerBaby() {
  const sp = SP.glimmer;
  return `<g>
    ${contactShadow(42)}
    <!-- small crystal body — hexagonal shape -->
    <polygon points="128,70 146,86 148,116 128,198 108,116 110,86" fill="url(#bodyG)"/>
    <!-- inner core glow -->
    <circle cx="128" cy="136" r="16" fill="${C.white}" opacity="0.25" filter="url(#soft)"/>
    <circle cx="128" cy="136" r="8" fill="${sp.accent}" opacity="0.5"/>
    <!-- facet reflections -->
    <polygon points="128,70 146,86 128,116 110,86" fill="${C.white}" opacity="0.2"/>
    <polygon points="128,198 148,116 128,136 108,116" fill="${sp.baseDark}" opacity="0.3"/>
    <!-- tiny eyes in the middle facet -->
    ${eye(118, 130, 8, 10)} ${eye(138, 130, 8, 10)}
    <!-- tiny sparkle -->
    ${spark(128, 96, 5, C.white, 0.8)}
    <!-- edge highlights -->
    <path d="M110 86 L128 70 L146 86" stroke="${C.white}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
    <path d="M146 86 L148 116" stroke="${C.white}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>
  </g>`;
}

function drawGlimmerAdult() {
  const sp = SP.glimmer;
  return `<g>
    ${contactShadow(50)}
    <!-- large crystal body — tall hexagon with gem cuts -->
    <polygon points="128,54 154,76 158,118 128,210 98,118 102,76" fill="url(#bodyG)"/>
    <!-- multifaceted inner geometry -->
    <polygon points="128,54 154,76 128,118 102,76" fill="${C.white}" opacity="0.18"/>
    <polygon points="128,210 158,118 128,140 98,118" fill="${sp.baseDark}" opacity="0.3"/>
    <polygon points="154,76 158,118 128,140 128,118" fill="${sp.accent}" opacity="0.25"/>
    <polygon points="102,76 98,118 128,140 128,118" fill="${sp.highlight}" opacity="0.2"/>
    <!-- swirling core -->
    <circle cx="128" cy="140" r="24" fill="${C.white}" opacity="0.2" filter="url(#soft)"/>
    <ellipse cx="128" cy="140" rx="10" ry="14" fill="${sp.accent}" opacity="0.45"/>
    <circle cx="128" cy="140" r="5" fill="${C.white}" opacity="0.8"/>
    <!-- prismatic refraction sparkles -->
    ${spark(162,86,5,C.white,0.6)} ${spark(92,128,4,sp.accent,0.55)}
    ${spark(160,140,6,C.white,0.5)} ${spark(96,88,4,C.white,0.5)}
    ${spark(128,48,7,sp.accent,0.8)}
    <!-- eyes in crystal -->
    ${eye(120, 126, 9, 11)} ${eye(136, 126, 9, 11)}
    <!-- crystal edge highlights -->
    <path d="M102 76 L128 54 L154 76" stroke="${C.white}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6" filter="url(#soft)"/>
    <path d="M154 76 L158 118" stroke="${C.white}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.4"/>
    <path d="M98 118 L102 76" stroke="${C.white}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.4"/>
    <!-- rainbow refraction hints -->
    <ellipse cx="120" cy="160" rx="14" ry="6" fill="${C.coral}" opacity="0.08" filter="url(#soft)"/>
    <ellipse cx="136" cy="170" rx="12" ry="5" fill="${C.sky}" opacity="0.07" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 8: WISP 👻 — Shadow / Playfulness
// =========================================================================
function drawWispEgg(f) {
  const sp = SP.wisp;
  const specks = () => {
    let s = '<g opacity="0.8">';
    // smoke swirls
    s += `<path d="M108 100 C 120 88 136 94 128 108 C 120 122 140 116 144 106" stroke="${sp.accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>`;
    s += `<path d="M100 140 C 110 130 118 146 110 152 C 104 156 100 150 100 148" stroke="${sp.accent}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>`;
    // star dots
    const dots = [[108,106,3.5,sp.accent],[148,120,4,sp.accent],[128,94,3,sp.accent],[136,150,3.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.6"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M104 100 l 10 12 l -6 10 l 12 8" stroke="${sp.accent}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <ellipse cx="108" cy="110" rx="11" ry="8" fill="${sp.accent}" opacity="0.35" filter="url(#soft)"/>
    ${spark(110, 106, 5, sp.accent, 0.8)}`;
  const extraGlow = (f) => {
    let s = spark(170,106,6,sp.accent,0.75) + spark(76,138,5,sp.accent,0.65);
    if (f >= 2) s += spark(178,140,5,sp.accent,0.7);
    if (f === 3) s += spark(70,90,6,sp.accent,0.8) + spark(156,70,5,sp.accent,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, EGG_PATH, specks, crack, extraGlow);
}

function drawWispBaby() {
  const sp = SP.wisp;
  return `<g>
    ${contactShadow(44)}
    <!-- ghost body — round top, smoke tail -->
    <path d="M128 78 C 156 78 168 110 164 142 C 160 170 150 190 128 198 C 106 190 96 170 92 142 C 88 110 100 78 128 78 Z" fill="url(#bodyG)" opacity="0.8"/>
    <!-- wavy smoke tail -->
    <path d="M110 190 C 100 200 88 196 92 206 C 96 214 108 210 106 218 C 104 224 96 220 98 228" stroke="url(#bodyG)" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.5"/>
    <path d="M146 190 C 156 200 168 196 164 206 C 160 214 148 210 150 218 C 152 224 160 220 158 228" stroke="url(#bodyG)" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- big glowing eyes (signature of wisp) -->
    <circle cx="112" cy="134" r="14" fill="${sp.accent}" opacity="0.35" filter="url(#soft)"/>
    <circle cx="144" cy="134" r="14" fill="${sp.accent}" opacity="0.35" filter="url(#soft)"/>
    ${eye(112, 132, 10, 12)} ${eye(144, 132, 10, 12)}
    <!-- tiny mouth -->
    <ellipse cx="128" cy="152" rx="4" ry="3" fill="${sp.accent}" opacity="0.4"/>
    <!-- lavender aura -->
    <ellipse cx="128" cy="140" rx="40" ry="44" fill="${sp.accent}" opacity="0.1" filter="url(#soft2)"/>
    <!-- sparkle -->
    ${spark(166, 96, 5, sp.accent, 0.7)}
  </g>`;
}

function drawWispAdult() {
  const sp = SP.wisp;
  return `<g>
    ${contactShadow(50)}
    <!-- ghost body, larger -->
    <path d="M128 66 C 162 66 176 104 172 142 C 168 176 154 198 128 206 C 102 198 88 176 84 142 C 80 104 94 66 128 66 Z" fill="url(#bodyG)" opacity="0.82"/>
    <!-- phantom arms -->
    <path d="M88 144 C 74 132 62 138 68 148 C 74 158 84 154 84 150 Z" fill="url(#bodyG)" opacity="0.45"/>
    <path d="M168 144 C 182 132 194 138 188 148 C 182 158 172 154 172 150 Z" fill="url(#bodyG)" opacity="0.45"/>
    <!-- flowing smoke tail -->
    <path d="M104 198 C 90 212 74 208 78 222 C 82 234 96 228 92 242 C 88 252 76 248 80 258" stroke="url(#bodyG)" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.55"/>
    <path d="M152 198 C 166 212 182 208 178 222 C 174 234 160 228 164 242 C 168 252 180 248 176 258" stroke="url(#bodyG)" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.55"/>
    <!-- constellation tail sparkles (rare hint) -->
    ${spark(74, 222, 4, sp.accent, 0.45)} ${spark(180, 226, 3.5, sp.accent, 0.4)}
    ${spark(86, 242, 4, sp.accent, 0.4)} ${spark(170, 244, 3.5, sp.accent, 0.38)}
    <!-- glowing eyes, wider -->
    <circle cx="110" cy="128" r="18" fill="${sp.accent}" opacity="0.3" filter="url(#soft2)"/>
    <circle cx="146" cy="128" r="18" fill="${sp.accent}" opacity="0.3" filter="url(#soft2)"/>
    ${eye(110, 126, 10, 13)} ${eye(146, 126, 10, 13)}
    <!-- cute wisp mouth -->
    <ellipse cx="128" cy="148" rx="5" ry="3.5" fill="${sp.accent}" opacity="0.45"/>
    <!-- aura glow -->
    <ellipse cx="128" cy="140" rx="48" ry="52" fill="${sp.accent}" opacity="0.12" filter="url(#soft2)"/>
    <!-- multi-sparkle -->
    ${spark(170, 90, 6, sp.accent, 0.65)} ${spark(82, 100, 5, sp.accent, 0.6)}
    ${spark(142, 72, 5, sp.accent, 0.7)}
    <!-- rim light -->
    <path d="M90 92 C 98 62 158 62 166 92" stroke="${sp.accent}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 9: FLUFFLE ☁️ — Air / Softness
// =========================================================================
function drawFluffleEgg(f) {
  const sp = SP.fluffle;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // fluffy swirl patterns
    s += `<path d="M108 106 C 120 94 134 100 126 112 C 118 124 140 118 144 108" stroke="${sp.baseDark}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>`;
    const dots = [[120,112,5,sp.baseDark],[138,122,4.5,sp.baseDark],[112,136,4,sp.accent],[146,140,4.5,sp.accent],[128,100,3.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.5"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M112 98 l 8 14 l -5 10" stroke="${sp.accent}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <circle cx="114" cy="108" rx="9" ry="6" fill="${sp.accent}" opacity="0.3" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(168,100,6,sp.accent,0.7) + spark(78,136,5,sp.accent,0.6);
    if (f >= 2) s += spark(174,138,5,sp.highlight,0.65);
    if (f === 3) s += spark(74,88,6,sp.accent,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, EGG_PATH, specks, crack, extraGlow);
}

function drawFluffleBaby() {
  const sp = SP.fluffle;
  return `<g>
    ${contactShadow(56)}
    <!-- SUPER fluffy ball body — fluffiest of all species -->
    ${fluffCluster(128, 148, 52, 48, 3, 'url(#bodyG)')}
    <!-- short droopy ears -->
    <ellipse cx="90" cy="122" rx="16" ry="24" fill="url(#bodyG)" transform="rotate(-20 90 122)"/>
    <ellipse cx="88" cy="128" rx="10" ry="16" fill="url(#accentG)" transform="rotate(-20 88 128)" opacity="0.5"/>
    <ellipse cx="166" cy="122" rx="16" ry="24" fill="url(#bodyG)" transform="rotate(20 166 122)"/>
    <ellipse cx="168" cy="128" rx="10" ry="16" fill="url(#accentG)" transform="rotate(20 168 128)" opacity="0.5"/>
    <!-- tiny feet -->
    <ellipse cx="108" cy="194" rx="12" ry="8" fill="url(#bellyG)"/>
    <ellipse cx="148" cy="194" rx="12" ry="8" fill="url(#bellyG)"/>
    <!-- belly (fuzzy) -->
    <ellipse cx="128" cy="160" rx="28" ry="26" fill="url(#bellyG)" opacity="0.8"/>
    <!-- big soft eyes -->
    ${eye(110, 140, 12, 15)} ${eye(146, 140, 12, 15)}
    <!-- tiny pink nose -->
    <ellipse cx="128" cy="158" rx="3.5" ry="3" fill="${sp.accent}" opacity="0.6"/>
    <!-- tiny smile -->
    <path d="M124 164 q 4 4 8 0" stroke="${C.navy}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- rim light on cloud top -->
    <path d="M82 126 C 90 88 170 88 174 128" stroke="${sp.highlight}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
    ${spark(170, 100, 5, sp.accent, 0.6)}
  </g>`;
}

function drawFluffleAdult() {
  const sp = SP.fluffle;
  return `<g>
    ${contactShadow(62)}
    <!-- Fluffy body, more volume -->
    ${fluffCluster(128, 152, 56, 54, 3, 'url(#bodyG)')}
    <!-- long droopy ears with curl at tip -->
    <path d="M80 118 C 64 130 60 170 72 180 C 80 186 88 176 84 166 C 80 156 72 150 76 138 Z" fill="url(#bodyG)"/>
    <path d="M176 118 C 192 130 196 170 184 180 C 176 186 168 176 172 166 C 176 156 184 150 180 138 Z" fill="url(#bodyG)"/>
    <!-- ear inner (accent mint) -->
    <ellipse cx="72" cy="148" rx="8" ry="20" fill="url(#accentG)" opacity="0.45" transform="rotate(-10 72 148)"/>
    <ellipse cx="184" cy="148" rx="8" ry="20" fill="url(#accentG)" opacity="0.45" transform="rotate(10 184 148)"/>
    <!-- feet -->
    <ellipse cx="108" cy="204" rx="14" ry="9" fill="url(#bellyG)"/>
    <ellipse cx="148" cy="204" rx="14" ry="9" fill="url(#bellyG)"/>
    <!-- fluffy tail -->
    ${fluff(184, 180, 20, 18, 10, 10, 'url(#bodyG)')}
    <!-- belly -->
    <ellipse cx="128" cy="166" rx="30" ry="30" fill="url(#bellyG)" opacity="0.85"/>
    <!-- eyes -->
    ${eye(110, 142, 11, 14)} ${eye(146, 142, 11, 14)}
    <!-- nose -->
    <ellipse cx="128" cy="162" rx="4" ry="3.2" fill="${sp.accent}" opacity="0.65"/>
    <!-- happy smile -->
    <path d="M122 168 q 6 6 12 0" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.6"/>
    <!-- cotton-candy fluff sparkles -->
    ${spark(174, 106, 6, sp.accent, 0.7)} ${spark(80, 110, 4, sp.highlight, 0.55)}
    ${spark(142, 80, 5, sp.accent, 0.65)}
    <!-- rim light -->
    <path d="M78 128 C 86 84 180 84 182 130" stroke="${sp.highlight}" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 10: SHELLBY 🐚 — Water / Pearl
// =========================================================================
function drawShellbyEgg(f) {
  const sp = SP.shellby;
  // spiral shell-shaped egg
  const shellPath = `M128 68 C 158 68 174 106 170 140 C 166 176 148 206 128 206 C 108 206 90 176 86 140 C 82 106 98 68 128 68 Z`;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // spiral pattern
    s += `<path d="M128 140 C 136 128 148 128 150 136 C 152 144 144 152 138 148 C 132 144 132 136 136 132" stroke="${sp.accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.55"/>`;
    const dots = [[108,114,4.5,sp.accent],[148,116,5,sp.accent],[120,156,4,sp.accent],[140,150,4,sp.highlight],[128,100,3.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.6"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M110 96 l 8 14 l -6 12 l 12 8" stroke="${sp.accent}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
    <circle cx="112" cy="108" rx="9" ry="7" fill="${C.gold}" opacity="0.35" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(168,98,6,sp.highlight,0.7) + spark(78,136,5,sp.accent,0.6);
    if (f >= 2) s += spark(174,136,5,sp.accent,0.6);
    if (f === 3) s += spark(76,90,6,sp.highlight,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, shellPath, specks, crack, extraGlow);
}

function drawShellbyBaby() {
  const sp = SP.shellby;
  return `<g>
    ${contactShadow(50)}
    <!-- soft slug body -->
    <ellipse cx="128" cy="184" rx="30" ry="20" fill="url(#accentG)" opacity="0.7"/>
    <path d="M102 184 C 98 178 104 172 108 176 C 112 180 108 184 108 184 Z" fill="url(#accentG)" opacity="0.6"/>
    <!-- small spiral shell on back -->
    <circle cx="128" cy="146" r="28" fill="url(#bodyG)"/>
    <path d="M128 146 C 138 134 150 138 148 148 C 146 156 136 154 132 150 C 130 148 130 144 132 142" stroke="${sp.baseDark}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- shell highlight -->
    <ellipse cx="120" cy="132" rx="12" ry="8" fill="${C.white}" opacity="0.3" transform="rotate(-25 120 132)"/>
    <!-- tiny antennae -->
    <path d="M108 172 C 102 158 98 150 94 148" stroke="${sp.accent}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="94" cy="146" r="3.5" fill="${sp.accent}"/>
    <path d="M148 172 C 154 158 158 150 162 148" stroke="${sp.accent}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="162" cy="146" r="3.5" fill="${sp.accent}"/>
    <!-- eyes on antennae tips (characteristic of shellby) -->
    ${eye(94, 144, 5, 6)} ${eye(162, 144, 5, 6)}
    <!-- tiny smile on body -->
    <path d="M124 182 q 4 4 8 0" stroke="${C.navy}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>
  </g>`;
}

function drawShellbyAdult() {
  const sp = SP.shellby;
  return `<g>
    ${contactShadow(58)}
    <!-- body, larger -->
    <ellipse cx="128" cy="190" rx="34" ry="22" fill="url(#accentG)" opacity="0.75"/>
    <!-- pearl shell on back, big and elegant -->
    ${fluff(128, 146, 36, 32, 14, 8, 'url(#bodyG)')}
    <!-- spiral detail -->
    <path d="M128 146 C 142 130 160 134 156 150 C 152 162 136 160 130 154 C 126 150 126 144 130 140 C 132 138 136 138 136 142" stroke="${sp.baseDark}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- pearl sheen -->
    <ellipse cx="118" cy="130" rx="14" ry="10" fill="${C.white}" opacity="0.35" transform="rotate(-20 118 130)"/>
    <ellipse cx="140" cy="156" rx="8" ry="5" fill="${C.white}" opacity="0.2" transform="rotate(15 140 156)"/>
    <!-- longer antennae -->
    <path d="M108 178 C 98 158 88 146 82 142" stroke="${sp.accent}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="82" cy="140" r="4.5" fill="${sp.accent}"/>
    <path d="M148 178 C 158 158 168 146 174 142" stroke="${sp.accent}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="174" cy="140" r="4.5" fill="${sp.accent}"/>
    <!-- eyes on tips -->
    ${eye(82, 138, 5, 7)} ${eye(174, 138, 5, 7)}
    <!-- happy body smile -->
    <path d="M120 192 q 8 6 16 0" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
    <!-- shell sparkles -->
    ${spark(152, 120, 5, sp.highlight, 0.65)} ${spark(104, 128, 4, C.white, 0.5)}
    <!-- rim light on shell -->
    <path d="M92 130 C 98 106 162 106 166 132" stroke="${C.white}" stroke-width="4.5" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// SPECIES 11: DRACLING 🐉 — Fire / Dragon
// =========================================================================
function drawDraclingEgg(f) {
  const sp = SP.dracling;
  // scale-textured egg
  const scalePath = `M128 68 C 160 66 174 106 170 142 C 166 178 150 206 128 206 C 106 206 90 178 86 142 C 82 106 96 66 128 68 Z`;
  const specks = () => {
    let s = '<g opacity="0.85">';
    // scale pattern — intersecting arcs
    for (let row = 0; row < 4; row++) {
      const y = 100 + row * 22;
      for (let col = 0; col < 3; col++) {
        const x = 104 + col * 24 + (row % 2) * 12;
        s += `<path d="M${x-8} ${y} C ${x-4} ${y-9} ${x+4} ${y-9} ${x+8} ${y}" stroke="${sp.accent}" stroke-width="1.2" fill="none" opacity="0.3"/>`;
      }
    }
    const dots = [[128,100,4,sp.accent],[110,130,3.5,sp.accent],[148,138,4,sp.accent],[118,160,3.5,sp.accent]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.5"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M108 96 l 10 14 l -6 10 l 12 10" stroke="${sp.accent}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <ellipse cx="110" cy="108" rx="11" ry="8" fill="${sp.accent}" opacity="0.45" filter="url(#soft)"/>
    ${spark(112, 104, 6, sp.accent, 0.8)}`;
  const extraGlow = (f) => {
    let s = spark(168,98,7,sp.accent) + spark(76,134,5,sp.accent,0.75);
    if (f >= 2) s += spark(172,138,5,sp.accent,0.7);
    if (f === 3) s += spark(72,88,6,sp.accent,0.8) + spark(158,70,5,sp.accent,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, scalePath, specks, crack, extraGlow);
}

function drawDraclingBaby() {
  const sp = SP.dracling;
  return `<g>
    ${contactShadow(54)}
    <!-- chubby dragon body -->
    ${fluff(128, 150, 48, 52, 16, 10, 'url(#bodyG)')}
    <ellipse cx="128" cy="164" rx="28" ry="36" fill="${sp.belly}"/>
    <!-- tiny wings -->
    <path d="M84 130 C 70 114 62 120 68 130 C 74 140 84 138 84 134 Z" fill="url(#bodyG)" opacity="0.75"/>
    <path d="M172 130 C 186 114 194 120 188 130 C 182 140 172 138 172 134 Z" fill="url(#bodyG)" opacity="0.75"/>
    <!-- tiny horns (nubs) -->
    <ellipse cx="112" cy="102" rx="5" ry="10" fill="url(#accentG)" transform="rotate(-15 112 102)"/>
    <ellipse cx="144" cy="102" rx="5" ry="10" fill="url(#accentG)" transform="rotate(15 144 102)"/>
    <!-- tail stub -->
    ${fluff(188, 180, 14, 10, 7, 7, 'url(#bodyG)')}
    <!-- eyes -->
    ${eye(110, 142, 12, 15)} ${eye(146, 142, 12, 15)}
    <!-- snout -->
    <ellipse cx="128" cy="160" rx="5" ry="3.5" fill="${sp.highlight}" opacity="0.6"/>
    <!-- tiny mouth -->
    <path d="M124 166 q 4 4 8 0" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.5"/>
    <!-- spark at horn tip -->
    ${spark(118, 94, 4, sp.accent, 0.7)}
    <!-- rim light -->
    <path d="M84 128 C 94 94 164 94 174 128" stroke="${sp.accent}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.3" filter="url(#soft)"/>
  </g>`;
}

function drawDraclingAdult() {
  const sp = SP.dracling;
  return `<g>
    ${contactShadow(62)}
    <!-- dragon body, chubbier -->
    ${fluff(128, 154, 52, 56, 17, 11, 'url(#bodyG)')}
    <ellipse cx="128" cy="170" rx="30" ry="40" fill="${sp.belly}"/>
    <!-- bigger wings (still comically small to fly) -->
    <path d="M80 126 C 58 104 46 114 56 130 C 64 146 80 142 78 132 Z" fill="url(#bodyG)" opacity="0.7"/>
    <path d="M78 130 C 60 138 52 148 60 154 C 68 158 76 150 76 142 Z" fill="${sp.baseDark}" opacity="0.4"/>
    <path d="M176 126 C 198 104 210 114 200 130 C 192 146 176 142 178 132 Z" fill="url(#bodyG)" opacity="0.7"/>
    <path d="M178 130 C 196 138 204 148 196 154 C 188 158 180 150 180 142 Z" fill="${sp.baseDark}" opacity="0.4"/>
    <!-- curved horns -->
    <path d="M110 98 C 104 74 100 60 108 54 C 114 50 118 64 118 74" stroke="url(#accentG)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M146 98 C 152 74 156 60 148 54 C 142 50 138 64 138 74" stroke="url(#accentG)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <!-- crystal horn tips -->
    <polygon points="108,56 104,48 110,54" fill="${C.white}" opacity="0.6"/>
    <polygon points="148,56 152,48 146,54" fill="${C.white}" opacity="0.6"/>
    <!-- tail with spade tip -->
    ${fluff(186, 180, 18, 14, 8, 9, 'url(#bodyG)')}
    <polygon points="204,178 218,170 212,180 218,190 204,182" fill="url(#accentG)" opacity="0.7"/>
    <!-- feet -->
    <ellipse cx="106" cy="204" rx="14" ry="10" fill="url(#bellyG)"/>
    <ellipse cx="150" cy="204" rx="14" ry="10" fill="url(#bellyG)"/>
    <!-- eyes -->
    ${eye(112, 144, 11, 14)} ${eye(144, 144, 11, 14)}
    <!-- snout + tiny flame breath hint -->
    <ellipse cx="128" cy="162" rx="5.5" ry="4" fill="${sp.highlight}" opacity="0.6"/>
    <path d="M124 168 q 4 5 8 0" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.55"/>
    <!-- tiny spark near mouth (flame breath tease) -->
    ${spark(142, 166, 3, sp.accent, 0.5)}
    <!-- forehead gem -->
    <polygon points="128,106 133,112 128,118 123,112" fill="${sp.accent}" opacity="0.7"/>
    <!-- rim light -->
    <path d="M82 130 C 90 92 172 92 178 132" stroke="${sp.accent}" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.35" filter="url(#soft)"/>
    ${spark(176, 104, 6, sp.accent, 0.65)}
  </g>`;
}

// =========================================================================
// SPECIES 12: BUZZLE 🐝 — Nature / Industry
// =========================================================================
function drawBuzzleEgg(f) {
  const sp = SP.buzzle;
  // hexagonal honeycomb egg
  const hexPath = `M128 66 L152 80 L160 112 L152 146 L128 160 L104 146 L96 112 L104 80 Z`;
  const specks = () => {
    let s = '<g opacity="0.8">';
    // hexagon grid (honeycomb)
    const h = 16;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < (row % 2 ? 3 : 4); col++) {
        const cx = 108 + col * (h * 2) - (row % 2) * h;
        const cy = 96 + row * h * 1.6;
        s += `<polygon points="${cx},${cy-h} ${cx+h*1.4},${cy-h/2} ${cx+h*1.4},${cy+h/2} ${cx},${cy+h} ${cx-h*1.4},${cy+h/2} ${cx-h*1.4},${cy-h/2}" fill="none" stroke="${sp.baseDark}" stroke-width="1.2" opacity="0.3"/>`;
      }
    }
    const dots = [[128,98,4,sp.baseDark],[112,128,3.5,sp.baseDark],[144,128,3.5,sp.baseDark],[128,148,4,sp.baseDark]];
    for (const [x,y,r,c] of dots) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.5"/>`;
    return s + '</g>';
  };
  const crack = () => `<path d="M108 96 l 10 14 l -6 10 l 14 10" stroke="${sp.baseDark}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <circle cx="110" cy="108" rx="9" ry="7" fill="${C.gold}" opacity="0.4" filter="url(#soft)"/>`;
  const extraGlow = (f) => {
    let s = spark(164,94,6,sp.accent,0.7) + spark(80,128,5,sp.accent,0.6);
    if (f >= 2) s += spark(168,130,5,C.gold,0.6);
    if (f === 3) s += spark(78,86,6,sp.accent,0.7);
    return s;
  };
  return drawEggGeneric(sp, f, hexPath, specks, crack, extraGlow);
}

function drawBuzzleBaby() {
  const sp = SP.buzzle;
  return `<g>
    ${contactShadow(48)}
    <!-- round bee body -->
    ${fluff(128, 150, 44, 48, 16, 10, 'url(#bodyG)')}
    <!-- stripes (bumblebee pattern on body) -->
    <ellipse cx="128" cy="130" rx="42" ry="10" fill="${sp.baseDark}" opacity="0.55"/>
    <ellipse cx="128" cy="150" rx="44" ry="10" fill="${sp.baseDark}" opacity="0.55"/>
    <ellipse cx="128" cy="170" rx="40" ry="9" fill="${sp.baseDark}" opacity="0.45"/>
    <!-- belly -->
    <ellipse cx="128" cy="162" rx="22" ry="28" fill="${sp.belly}" opacity="0.6"/>
    <!-- no wings yet (too young) -->
    <!-- tiny antennae -->
    <path d="M118 106 C 114 92 110 86 108 82" stroke="${sp.baseDark}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="108" cy="80" r="3.5" fill="${sp.baseDark}"/>
    <path d="M138 106 C 142 92 146 86 148 82" stroke="${sp.baseDark}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="148" cy="80" r="3.5" fill="${sp.baseDark}"/>
    <!-- tiny fluff collar -->
    ${fluff(128, 114, 36, 12, 12, 9, 'url(#accentG)')}
    <!-- eyes -->
    ${eye(113, 140, 10, 12)} ${eye(143, 140, 10, 12)}
    <!-- smile -->
    <path d="M124 152 q 4 4 8 0" stroke="${C.navy}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.6"/>
    <!-- sparkle -->
    ${spark(158, 104, 5, C.gold, 0.7)}
    <!-- rim light -->
    <path d="M88 132 C 96 98 164 98 170 132" stroke="${C.white}" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.4" filter="url(#soft)"/>
  </g>`;
}

function drawBuzzleAdult() {
  const sp = SP.buzzle;
  return `<g>
    ${contactShadow(54)}
    <!-- round bee body, chubbier -->
    ${fluff(128, 152, 48, 52, 16, 11, 'url(#bodyG)')}
    <!-- stripes more defined -->
    <ellipse cx="128" cy="130" rx="46" ry="12" fill="${sp.baseDark}" opacity="0.6"/>
    <ellipse cx="128" cy="152" rx="48" ry="12" fill="${sp.baseDark}" opacity="0.6"/>
    <ellipse cx="128" cy="174" rx="44" ry="10" fill="${sp.baseDark}" opacity="0.5"/>
    <!-- belly -->
    <ellipse cx="128" cy="164" rx="24" ry="32" fill="${sp.belly}" opacity="0.65"/>
    <!-- transparent wings (iridescent) -->
    <ellipse cx="96" cy="116" rx="20" ry="30" fill="${C.white}" opacity="0.25" transform="rotate(-25 96 116)"/>
    <ellipse cx="100" cy="120" rx="14" ry="22" fill="${C.sky}" opacity="0.12" transform="rotate(-25 100 120)"/>
    <path d="M96 116 L120 122" stroke="${C.white}" stroke-width="1.5" fill="none" opacity="0.3"/>
    <ellipse cx="160" cy="116" rx="20" ry="30" fill="${C.white}" opacity="0.25" transform="rotate(25 160 116)"/>
    <ellipse cx="156" cy="120" rx="14" ry="22" fill="${C.sky}" opacity="0.12" transform="rotate(25 156 120)"/>
    <path d="M160 116 L136 122" stroke="${C.white}" stroke-width="1.5" fill="none" opacity="0.3"/>
    <!-- antennae -->
    <path d="M118 106 C 112 88 106 82 102 78" stroke="${sp.baseDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="102" cy="76" r="4" fill="${sp.baseDark}"/>
    <path d="M138 106 C 144 88 150 82 154 78" stroke="${sp.baseDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="154" cy="76" r="4" fill="${sp.baseDark}"/>
    <!-- fluffy collar around neck -->
    ${fluff(128, 114, 40, 14, 14, 10, 'url(#accentG)')}
    <!-- eyes -->
    ${eye(114, 140, 10, 13)} ${eye(142, 140, 10, 13)}
    <!-- cute smile -->
    <path d="M122 154 q 6 6 12 0" stroke="${C.navy}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <!-- honey sparkles -->
    ${spark(160, 100, 6, C.gold, 0.75)} ${spark(92, 108, 4, C.gold, 0.6)}
    ${spark(172, 140, 5, sp.accent, 0.55)} ${spark(80, 144, 4, C.gold, 0.5)}
    <!-- rim light -->
    <path d="M86 132 C 94 96 168 96 174 134" stroke="${C.white}" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.4" filter="url(#soft)"/>
  </g>`;
}

// =========================================================================
// MASTER DISPATCH TABLE
// =========================================================================

const SPECIES = [
  'foxling', 'owlet', 'droplet', 'pebblit', 'sproutling', 'flicker',
  'glimmer', 'wisp', 'fluffle', 'shellby', 'dracling', 'buzzle',
];

const STAGES = ['egg', 'baby', 'adult'];
const FRAMES = [1, 2, 3];

const EGG_DRAWERS = {
  foxling: drawFoxlingEgg,
  owlet: drawOwletEgg,
  droplet: drawDropletEgg,
  pebblit: drawPebblitEgg,
  sproutling: drawSproutlingEgg,
  flicker: drawFlickerEgg,
  glimmer: drawGlimmerEgg,
  wisp: drawWispEgg,
  fluffle: drawFluffleEgg,
  shellby: drawShellbyEgg,
  dracling: drawDraclingEgg,
  buzzle: drawBuzzleEgg,
};

const BABY_DRAWERS = {
  foxling: drawFoxlingBaby,
  owlet: drawOwletBaby,
  droplet: drawDropletBaby,
  pebblit: drawPebblitBaby,
  sproutling: drawSproutlingBaby,
  flicker: drawFlickerBaby,
  glimmer: drawGlimmerBaby,
  wisp: drawWispBaby,
  fluffle: drawFluffleBaby,
  shellby: drawShellbyBaby,
  dracling: drawDraclingBaby,
  buzzle: drawBuzzleBaby,
};

const ADULT_DRAWERS = {
  foxling: drawFoxlingAdult,
  owlet: drawOwletAdult,
  droplet: drawDropletAdult,
  pebblit: drawPebblitAdult,
  sproutling: drawSproutlingAdult,
  flicker: drawFlickerAdult,
  glimmer: drawGlimmerAdult,
  wisp: drawWispAdult,
  fluffle: drawFluffleAdult,
  shellby: drawShellbyAdult,
  dracling: drawDraclingAdult,
  buzzle: drawBuzzleAdult,
};

function drawStage(species, stage, f) {
  const sp = SP[species];
  if (!sp) throw new Error(`Unknown species: ${species}`);
  if (stage === 'egg') return EGG_DRAWERS[species](f);
  if (stage === 'baby') return BABY_DRAWERS[species]();
  return ADULT_DRAWERS[species]();
}

// Full transparent SVG for one frame
function frameSVG(species, stage, f) {
  const sp = SP[species];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${makeGradients(sp)}<g transform="${frameTransform(stage, f)}">${drawStage(species, stage, f)}</g></svg>`;
}

module.exports = { W, H, C, SP, SPECIES, STAGES, FRAMES, frameSVG, makeGradients, drawStage, frameTransform };
