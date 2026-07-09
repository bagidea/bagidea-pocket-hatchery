/*
 * Pocket Hatchery — "Foxling" mascot sprite generator (hand-authored SVG)
 * Art direction: ART.md — cozy-premium soft-3D, palette gold/mint/sky/lavender.
 * One species, three stages (egg → baby → adult), 3 idle frames each.
 * Soft-3D look in pure vector: userSpaceOnUse radial gradients = one continuous
 * golden-hour key light (top-left) across every part; fluffy silhouettes via
 * bump-circles; rim light + soft contact shadow so nothing floats.
 */

const W = 256, H = 256;
const PIVOT_X = 128, PIVOT_Y = 206; // squash/wobble about the feet so it stays grounded

// ---- palette (ART.md §3) ----
const C = {
  cream: '#FFF6E9', sky: '#A8DCF0', mint: '#8FD694', meadow: '#5BB572',
  gold: '#FFCB6B', coral: '#FF9EB5', lavender: '#C9A8FF', earth: '#C49A6C',
  navy: '#3A3A52',
};

// shared defs — gradients in userSpaceOnUse so light direction is unified
function defs() {
  return `<defs>
    <radialGradient id="mint" gradientUnits="userSpaceOnUse" cx="96" cy="86" r="168">
      <stop offset="0" stop-color="#EAF8E6"/>
      <stop offset="0.30" stop-color="#ADE2AC"/>
      <stop offset="0.66" stop-color="${C.mint}"/>
      <stop offset="1" stop-color="${C.meadow}"/>
    </radialGradient>
    <radialGradient id="cream" gradientUnits="userSpaceOnUse" cx="110" cy="120" r="140">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="${C.cream}"/>
      <stop offset="1" stop-color="#EFDFC4"/>
    </radialGradient>
    <radialGradient id="shell" gradientUnits="userSpaceOnUse" cx="104" cy="92" r="150">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.45" stop-color="${C.cream}"/>
      <stop offset="1" stop-color="#F0DBBE"/>
    </radialGradient>
    <radialGradient id="eggGlow" gradientUnits="userSpaceOnUse" cx="128" cy="152" r="74">
      <stop offset="0" stop-color="${C.gold}" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="${C.gold}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coralIn" gradientUnits="userSpaceOnUse" cx="118" cy="92" r="60">
      <stop offset="0" stop-color="#FFD2DE"/>
      <stop offset="1" stop-color="${C.coral}"/>
    </radialGradient>
    <radialGradient id="eye" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="20" gradientTransform="translate(0 0)">
      <stop offset="0" stop-color="#56566F"/>
      <stop offset="0.7" stop-color="#363650"/>
      <stop offset="1" stop-color="#2A2A40"/>
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
    <filter id="soft2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>`;
}

// fluffy lumpy blob: a core ellipse ringed with bump circles, all one fill (shared gradient)
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

// big sparkly eye + catchlights
function eye(cx, cy, rx, ry) {
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eye)"/>
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
  // own group — bake light; engine can split this layer per ART.md §9
  return `<ellipse class="shadow" cx="128" cy="214" rx="${rx}" ry="13" fill="${C.navy}" opacity="0.15" filter="url(#soft)"/>`;
}

// ---------- STAGE 1: EGG ----------
function drawEgg(f) {
  const glow = f === 1 ? 0.55 : f === 2 ? 0.8 : 1.0;
  // nest (straw) — warm earth + gold strands
  let nest = `<g>
    <ellipse cx="128" cy="196" rx="80" ry="24" fill="#A87B46"/>
    <ellipse cx="128" cy="190" rx="74" ry="20" fill="${C.earth}"/>`;
  for (let i = 0; i < 16; i++) {
    const t = i / 15, x = 56 + t * 144;
    const col = i % 2 ? C.gold : '#D7B074';
    nest += `<path d="M${x} 198 q ${(0.5 - t) * 26} -20 ${(0.5 - t) * 12} -30" stroke="${col}" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.92"/>`;
  }
  nest += `</g>`;

  const eggPath = `M128 72 C 160 72 176 112 176 142 C 176 178 154 204 128 204 C 102 204 80 178 80 142 C 80 112 96 72 128 72 Z`;

  // speckles on shell
  let speck = '<g opacity="0.85">';
  const dots = [[104, 110, 6, C.mint], [150, 122, 5, C.coral], [120, 100, 4, C.mint],
    [158, 150, 6, C.mint], [98, 142, 5, C.lavender], [138, 168, 5, C.coral],
    [110, 168, 4, C.mint], [146, 96, 3.5, C.lavender]];
  for (const [x, y, r, c] of dots) speck += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${c}"/>`;
  speck += '</g>';

  // crack hint on frame 3
  const crack = f === 3
    ? `<ellipse cx="120" cy="108" rx="16" ry="11" fill="${C.gold}" opacity="0.85" filter="url(#soft)"/>
       <path d="M100 100 l 10 9 l -7 8 l 12 9 l -6 8 l 11 7" stroke="${C.navy}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
       <path d="M101 99 l 10 9 l -7 8 l 12 9 l -6 8" stroke="#FFFFFF" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.6"/>` : '';

  // sparkles (more as it nears hatching)
  let sp = spark(70, 100, 8, C.gold) + spark(190, 130, 7, C.lavender, 0.9);
  if (f >= 2) sp += spark(196, 80, 6, C.gold, 0.9) + spark(60, 150, 5, C.coral, 0.85);
  if (f === 3) sp += spark(150, 64, 7, C.gold) + spark(86, 70, 5, C.lavender, 0.9);

  return `<g>
    ${contactShadow(74)}
    <ellipse cx="128" cy="152" rx="68" ry="80" fill="url(#eggGlow)" opacity="${glow}"/>
    ${nest}
    <path d="${eggPath}" fill="url(#shell)"/>
    <path d="${eggPath}" fill="url(#eggGlow)" opacity="${glow * 0.6}"/>
    ${speck}
    <path d="M96 92 C 108 80 124 78 132 80" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.55" filter="url(#soft)"/>
    ${crack}
    <path d="M128 76 C 164 76 182 116 182 144" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.4"/>
    ${sp}
  </g>`;
}

// ---------- STAGE 2: BABY (hatchling) ----------
function drawBaby() {
  const ear = (mx, dir) => `
    <path d="M${mx} 116 C ${mx - dir * 6} 92 ${mx + dir * 4} 70 ${mx + dir * 22} 78 C ${mx + dir * 26} 96 ${mx + dir * 20} 112 ${mx + dir * 14} 120 Z" fill="url(#mint)"/>
    <path d="M${mx + dir * 4} 110 C ${mx + dir * 2} 96 ${mx + dir * 8} 84 ${mx + dir * 16} 88 C ${mx + dir * 18} 98 ${mx + dir * 15} 106 ${mx + dir * 12} 112 Z" fill="url(#coralIn)"/>`;
  return `<g>
    ${contactShadow(60)}
    <!-- tail -->
    ${fluff(184, 172, 18, 16, 9, 9, 'url(#mint)')}
    <ellipse cx="194" cy="184" rx="13" ry="11" fill="url(#cream)"/>
    <!-- feet -->
    <ellipse cx="106" cy="200" rx="17" ry="11" fill="url(#cream)"/>
    <ellipse cx="150" cy="200" rx="17" ry="11" fill="url(#cream)"/>
    <!-- ears -->
    ${ear(104, -1)} ${ear(152, 1)}
    <!-- body (chibi: head = body) -->
    ${fluff(128, 150, 58, 54, 16, 13, 'url(#mint)')}
    <!-- belly -->
    <ellipse cx="128" cy="164" rx="35" ry="38" fill="url(#cream)"/>
    <!-- cheeks -->
    <ellipse cx="90" cy="164" rx="13" ry="9" fill="${C.coral}" opacity="0.5" filter="url(#soft)"/>
    <ellipse cx="166" cy="164" rx="13" ry="9" fill="${C.coral}" opacity="0.5" filter="url(#soft)"/>
    <!-- eyes -->
    ${eye(108, 146, 14, 17)} ${eye(148, 146, 14, 17)}
    <!-- nose + mouth -->
    <ellipse cx="128" cy="162" rx="5" ry="4" fill="${C.coral}"/>
    <circle cx="126" cy="160.5" r="1.4" fill="#FFFFFF" opacity="0.9"/>
    <path d="M128 166 q -6 6 -12 3 M128 166 q 6 6 12 3" stroke="${C.navy}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <!-- rim light -->
    <path d="M82 132 C 92 96 168 96 174 132" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
  </g>`;
}

// ---------- STAGE 3: ADULT (evolution) ----------
function drawAdult() {
  const ear = (mx, dir) => `
    <path d="M${mx} 104 C ${mx - dir * 8} 70 ${mx + dir * 2} 40 ${mx + dir * 26} 50 C ${mx + dir * 30} 76 ${mx + dir * 24} 96 ${mx + dir * 16} 110 Z" fill="url(#mint)"/>
    <path d="M${mx + dir * 5} 96 C ${mx + dir * 2} 70 ${mx + dir * 10} 54 ${mx + dir * 19} 60 C ${mx + dir * 21} 78 ${mx + dir * 17} 90 ${mx + dir * 13} 100 Z" fill="url(#coralIn)"/>
    <ellipse cx="${mx + dir * 22}" cy="54" rx="7" ry="9" fill="${C.lavender}" opacity="0.9"/>`;
  return `<g>
    ${contactShadow(66)}
    <!-- signature fluffy tail plume sweeping up the right, cream tip -->
    ${fluff(180, 178, 22, 26, 10, 12, 'url(#mint)')}
    ${fluff(198, 146, 18, 24, 9, 12, 'url(#mint)')}
    ${fluff(202, 118, 15, 18, 8, 11, 'url(#mint)')}
    ${fluff(203, 100, 12, 13, 7, 9, 'url(#cream)')}
    <!-- feet -->
    <ellipse cx="110" cy="208" rx="16" ry="11" fill="url(#cream)"/>
    <ellipse cx="146" cy="208" rx="16" ry="11" fill="url(#cream)"/>
    <!-- body (taller, grown proportions) -->
    ${fluff(126, 168, 46, 58, 15, 12, 'url(#mint)')}
    <ellipse cx="126" cy="178" rx="28" ry="42" fill="url(#cream)"/>
    <!-- tucked front paws -->
    <ellipse cx="112" cy="200" rx="13" ry="10" fill="url(#cream)"/>
    <ellipse cx="142" cy="200" rx="13" ry="10" fill="url(#cream)"/>
    <!-- ears -->
    ${ear(106, -1)} ${ear(150, 1)}
    <!-- head -->
    ${fluff(128, 108, 42, 38, 14, 11, 'url(#mint)')}
    <ellipse cx="128" cy="120" rx="24" ry="19" fill="url(#cream)"/>
    <!-- cheeks -->
    <ellipse cx="97" cy="120" rx="11" ry="8" fill="${C.coral}" opacity="0.5" filter="url(#soft)"/>
    <ellipse cx="159" cy="120" rx="11" ry="8" fill="${C.coral}" opacity="0.5" filter="url(#soft)"/>
    <!-- forehead spark (hint of the rare line) -->
    ${spark(128, 92, 7, C.lavender, 0.9)}
    <!-- eyes -->
    ${eye(113, 109, 12, 15)} ${eye(143, 109, 12, 15)}
    <!-- nose + mouth -->
    <ellipse cx="128" cy="123" rx="4.5" ry="3.6" fill="${C.coral}"/>
    <circle cx="126.5" cy="121.8" r="1.3" fill="#FFFFFF" opacity="0.9"/>
    <path d="M128 127 q -6 6 -11 3 M128 127 q 6 6 11 3" stroke="${C.navy}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.8"/>
    <!-- rim light -->
    <path d="M88 96 C 98 62 158 62 168 96" stroke="#FFFFFF" stroke-width="5.5" fill="none" stroke-linecap="round" opacity="0.45" filter="url(#soft)"/>
  </g>`;
}

// frame transform: egg wobbles, baby/adult breathe — both pivot at the feet
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

function drawStage(stage, f) {
  if (stage === 'egg') return drawEgg(f);
  if (stage === 'baby') return drawBaby(f);
  return drawAdult(f);
}

// full transparent svg for one frame
function frameSVG(stage, f) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}<g transform="${frameTransform(stage, f)}">${drawStage(stage, f)}</g></svg>`;
}

const STAGES = ['egg', 'baby', 'adult'];
const FRAMES = [1, 2, 3];

module.exports = { W, H, C, STAGES, FRAMES, frameSVG, defs, drawStage, frameTransform };
