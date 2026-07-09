/**
 * Generate all 12 species SVG templates from silhouette definitions.
 * Each SVG is self-contained with CSS variable bridge for gene-driven traits.
 *
 * Usage: node render/gen-templates.js
 * Output: render/templates/*.svg (12 files)
 */

const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, 'templates');

// ══════════════════════════════════════════════════════════════
//  SHARED COMPONENTS — used by all silhouettes
// ══════════════════════════════════════════════════════════════

const SHARED_DEFS = `
    <radialGradient id="bodyGrad" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="45%" stop-color="rgba(255,255,255,0.06)"/>
      <stop offset="80%" stop-color="rgba(0,0,0,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.20)"/>
    </radialGradient>
    <radialGradient id="eggGrad" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="60%" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
    </radialGradient>
    <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="bodyClip">
      <ellipse cx="256" cy="310" rx="135" ry="130"/>
    </clipPath>
`;

const STYLE_BLOCK = (s) => `  <style>
    /* ═══ GENE-DRIVEN CSS BRIDGE ═══ */
    :root {
      --critter-base: ${s.base.body};
      --critter-base-dark: ${s.base.bodyDark};
      --critter-accent: ${s.base.accent};
      --critter-pattern: ${s.base.pattern};
      --critter-belly: ${s.base.belly};
      --critter-eye: ${s.base.eyeDark};
      --critter-eye-shine: #FFFFFF;
      --critter-nose: ${s.base.nose};
      --gene-pat-idx: 0;
      --gene-hue-shift: 0;
      --gene-sat-mult: 1;
      --gene-light-mult: 1;
      --gene-eye-scale: 1;
      --gene-body-w: 1;
      --gene-body-h: 1;
      --gene-accent-scale: 1;
      --gene-tail-scale: 1;
      --gene-pat-density: 1;
      --gene-shine: 0.25;
      --gene-sparkle: 4;
      --gene-eye-base: ${s.base.eyeDark};
      --gene-aura: hsla(0,0%,0%,0);
      --gene-aura-hue: 0;
      --critter-body-final: ${s.base.body};
      --critter-accent-final: ${s.base.accent};
      --critter-shadow-final: ${s.base.bodyDark};
      --critter-belly-final: ${s.base.belly};
      --disp-pat-0: inline;
      --disp-pat-1: none;
      --disp-pat-2: none;
      --disp-pat-3: none;
    }
    .body-shape  { fill: var(--critter-body-final); }
    .body-shadow { fill: var(--critter-shadow-final); }
    .accent-part { fill: var(--critter-accent-final); }
    .pattern-fill { fill: var(--critter-pattern); opacity: 0.55; }
    .belly-part  { fill: var(--critter-belly-final); }
    .eye-dark    { fill: var(--gene-eye-base); }
    .eye-shine   { fill: var(--critter-eye-shine); }
    .nose-part   { fill: var(--critter-nose); }
    .contact-shadow { fill: rgba(58,58,82,0.22); }
    .body-shine  { fill: rgba(255,255,255,var(--gene-shine)); pointer-events: none; }
    .aura-fill   { fill: var(--gene-aura); }
    /* Pattern visibility — driven by --disp-pat-N CSS vars (standalone SVG compatible) */
    .pat-stripes { display: var(--disp-pat-0); }
    .pat-spots   { display: var(--disp-pat-1); }
    .pat-hearts  { display: var(--disp-pat-2); }
    .pat-stars   { display: var(--disp-pat-3); }
    .gene-body   { transform-origin: 256px 310px; }
    .gene-accent { transform-origin: center; }
    .gene-tail   { transform-origin: right center; }
    .gene-eyes   { transform-origin: 256px 295px; }
    ${s.rarity === 'Legendary' ? '.label-rarity { fill: #FFD86B; filter: url(#softGlow); }' :
      s.rarity === 'Rare' ? '.label-rarity { fill: #B07BE8; }' :
      s.eggType === 1 ? '.label-rarity { fill: #5FB8E8; }' :
      '.label-rarity { fill: #8FD694; }'}
  </style>`;

const CONTACT_SHADOW = '  <ellipse cx="256" cy="540" rx="95" ry="17" class="contact-shadow"/>';

const BODY_GRAD_OVERLAY = '    <ellipse cx="256" cy="310" rx="135" ry="130" fill="url(#bodyGrad)"/>';
const BODY_SHINE_OVERLAY = '    <ellipse cx="256" cy="310" rx="135" ry="130" class="body-shine"/>';
const BODY_SHADOW_OVERLAY = '    <ellipse cx="256" cy="380" rx="100" ry="48" class="body-shadow" opacity="0.35"/>';

const PATTERN_STRIPES = `      <g class="pat-stripes" style="transform:scale(var(--gene-pat-density))">
        <ellipse cx="185" cy="235" rx="42" ry="11" transform="rotate(-18 185 235)" class="pattern-fill"/>
        <ellipse cx="215" cy="258" rx="46" ry="11" transform="rotate(-12 215 258)" class="pattern-fill"/>
        <ellipse cx="248" cy="280" rx="48" ry="11" transform="rotate(-6 248 280)" class="pattern-fill"/>
        <ellipse cx="280" cy="262" rx="46" ry="11" transform="rotate(2 280 262)" class="pattern-fill"/>
        <ellipse cx="312" cy="244" rx="42" ry="11" transform="rotate(8 312 244)" class="pattern-fill"/>
        <ellipse cx="340" cy="228" rx="38" ry="11" transform="rotate(14 340 228)" class="pattern-fill"/>
        <ellipse cx="256" cy="208" rx="20" ry="14" class="pattern-fill"/>
      </g>`;

const PATTERN_SPOTS = `      <g class="pat-spots" style="transform:scale(var(--gene-pat-density))">
        <circle cx="200" cy="230" r="13" class="pattern-fill"/><circle cx="280" cy="218" r="15" class="pattern-fill"/>
        <circle cx="170" cy="285" r="11" class="pattern-fill"/><circle cx="320" cy="278" r="14" class="pattern-fill"/>
        <circle cx="225" cy="340" r="12" class="pattern-fill"/><circle cx="290" cy="350" r="10" class="pattern-fill"/>
        <circle cx="190" cy="380" r="11" class="pattern-fill"/><circle cx="330" cy="378" r="10" class="pattern-fill"/>
        <circle cx="256" cy="208" r="17" class="pattern-fill"/>
      </g>`;

const PATTERN_HEARTS = `      <g class="pat-hearts" style="transform:scale(var(--gene-pat-density))">
        <path d="M208,215 Q202,208 208,202 Q214,208 208,215Z" transform="translate(-50,-40) scale(1.3)" class="pattern-fill"/>
        <path d="M270,220 Q264,213 270,207 Q276,213 270,220Z" transform="translate(-20,-25) scale(1.1)" class="pattern-fill"/>
        <path d="M190,265 Q184,258 190,252 Q196,258 190,265Z" class="pattern-fill"/>
        <path d="M310,270 Q304,263 310,257 Q316,263 310,270Z" transform="translate(-25,-5) scale(1.1)" class="pattern-fill"/>
        <path d="M240,320 Q234,313 240,307 Q246,313 240,320Z" transform="translate(30,40) scale(0.9)" class="pattern-fill"/>
        <path d="M290,325 Q284,318 290,312 Q296,318 290,325Z" transform="translate(40,40) scale(0.9)" class="pattern-fill"/>
        <circle cx="256" cy="208" r="17" class="pattern-fill"/>
      </g>`;

const PATTERN_STARS = `      <g class="pat-stars" style="transform:scale(var(--gene-pat-density))">
        <polygon points="205,210 209,222 222,222 211,230 215,242 205,234 195,242 199,230 188,222 201,222" class="pattern-fill"/>
        <polygon points="275,198 278,208 288,208 280,214 283,224 275,218 267,224 270,214 262,208 272,208" class="pattern-fill"/>
        <polygon points="182,278 185,286 193,286 187,292 190,300 182,294 174,300 177,292 171,286 179,286" class="pattern-fill"/>
        <polygon points="322,275 325,283 333,283 327,289 330,297 322,291 314,297 317,289 311,283 319,283" class="pattern-fill"/>
        <polygon points="240,340 243,348 251,348 245,354 248,362 240,356 232,362 235,354 229,348 237,348" class="pattern-fill"/>
        <polygon points="298,346 301,354 309,354 303,360 306,368 298,362 290,368 293,360 287,354 295,354" class="pattern-fill"/>
        <circle cx="256" cy="208" r="15" class="pattern-fill"/>
      </g>`;

const PATTERNS = `    <!-- ═══ PATTERNS ═══ -->
    <g clip-path="url(#bodyClip)">
${PATTERN_STRIPES}
${PATTERN_SPOTS}
${PATTERN_HEARTS}
${PATTERN_STARS}
    </g>
`;

const BELLY = `    <!-- ═══ BELLY ═══ -->
    <ellipse cx="256" cy="350" rx="72" ry="58" class="belly-part" opacity="0.85"/>
`;

const EYES = `  <!-- ═══ FACE ═══ -->
  <g class="gene-eyes" style="transform:scale(var(--gene-eye-scale))">
    <ellipse cx="218" cy="290" rx="19" ry="23" class="eye-dark"/>
    <circle cx="211" cy="281" r="8" class="eye-shine"/>
    <circle cx="224" cy="295" r="3.5" class="eye-shine"/>
    <ellipse cx="294" cy="290" rx="19" ry="23" class="eye-dark"/>
    <circle cx="287" cy="281" r="8" class="eye-shine"/>
    <circle cx="300" cy="295" r="3.5" class="eye-shine"/>
    <ellipse cx="256" cy="318" rx="8" ry="5" class="nose-part"/>
    <path d="M248,326 Q256,334 264,326" fill="none" stroke="#3A3A52" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
    <circle cx="195" cy="313" r="15" class="pattern-fill" opacity="0.2"/>
    <circle cx="317" cy="313" r="15" class="pattern-fill" opacity="0.2"/>
  </g>`;

const SPARKLES = `  <!-- ═══ SPARKLES ═══ -->
  <g class="sparkles">
    <circle cx="130" cy="170" r="3" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="390" cy="195" r="2.5" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="155" cy="430" r="2" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="375" cy="450" r="3" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="100" cy="300" r="2" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="420" cy="310" r="2.5" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="195" cy="115" r="2" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="325" cy="110" r="2.5" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="256" cy="85" r="3" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="140" cy="240" r="2" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="385" cy="255" r="2" fill="var(--critter-accent-final)" opacity="0.7"/>
    <circle cx="256" cy="490" r="2.5" fill="var(--critter-accent-final)" opacity="0.7"/>
  </g>`;

const AURA_GLOW = '  <ellipse cx="256" cy="300" rx="180" ry="200" class="aura-fill" filter="url(#softGlow)" opacity="0.55"/>';

// ══════════════════════════════════════════════════════════════
//  7 SILHOUETTES — body + accent features per silhouette type
// ══════════════════════════════════════════════════════════════

// FOX — round body, pointed ears, big fluffy tail (Emberling, Blazetail)
const SIL_FOX_BODY = `  <!-- ═══ FOX BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <ellipse cx="256" cy="310" rx="135" ry="130" class="body-shape"/>
${BODY_GRAD_OVERLAY}
${BODY_SHINE_OVERLAY}
${BODY_SHADOW_OVERLAY}
${PATTERNS}
${BELLY}
  </g>`;

const SIL_FOX_ACCENT = `  <!-- ═══ EARS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <ellipse cx="160" cy="170" rx="32" ry="58" transform="rotate(-22 160 170)" class="accent-part"/>
    <ellipse cx="158" cy="176" rx="17" ry="38" transform="rotate(-22 158 176)" class="belly-part"/>
    <ellipse cx="340" cy="165" rx="32" ry="62" transform="rotate(20 340 165)" class="accent-part"/>
    <ellipse cx="338" cy="171" rx="17" ry="40" transform="rotate(20 338 171)" class="belly-part"/>
  </g>`;

const SIL_FOX_TAIL = `  <!-- ═══ TAIL ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <ellipse cx="390" cy="395" rx="52" ry="36" transform="rotate(-22 390 395)" class="accent-part"/>
    <ellipse cx="410" cy="372" rx="38" ry="26" transform="rotate(-38 410 372)" class="accent-part"/>
    <circle cx="440" cy="358" r="17" class="accent-part"/>
    <circle cx="426" cy="342" r="12" class="accent-part"/>
  </g>`;

const SIL_FOX_PAWS = `  <!-- ═══ PAWS ═══ -->
  <ellipse cx="182" cy="432" rx="30" ry="19" class="body-shape"/>
  <ellipse cx="330" cy="432" rx="30" ry="19" class="body-shape"/>
  <circle cx="174" cy="428" r="5.5" class="belly-part" opacity="0.5"/><circle cx="190" cy="428" r="5.5" class="belly-part" opacity="0.5"/>
  <circle cx="322" cy="428" r="5.5" class="belly-part" opacity="0.5"/><circle cx="338" cy="428" r="5.5" class="belly-part" opacity="0.5"/>`;

// DRAGON — chubby body, horns, small wings, pointed tail (Drakember)
const SIL_DRAGON_BODY = SIL_FOX_BODY; // Same round body, different accent

const SIL_DRAGON_ACCENT = `  <!-- ═══ HORNS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <polygon points="170,195 148,120 180,170" class="accent-part"/>
    <polygon points="342,190 360,115 332,168" class="accent-part"/>
    <!-- Small wings -->
    <ellipse cx="155" cy="260" rx="48" ry="14" transform="rotate(-45 155 260)" class="accent-part" opacity="0.7"/>
    <ellipse cx="357" cy="260" rx="48" ry="14" transform="rotate(45 357 260)" class="accent-part" opacity="0.7"/>
  </g>`;

const SIL_DRAGON_TAIL = `  <!-- ═══ DRAGON TAIL ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <path d="M340,390 Q390,420 410,460 Q420,480 430,470" fill="none" stroke="var(--critter-accent-final)" stroke-width="22" stroke-linecap="round"/>
    <polygon points="430,470 455,460 445,480 465,490 445,495 450,510 430,485" class="accent-part"/>
  </g>`;

const SIL_DRAGON_PAWS = SIL_FOX_PAWS;

// DROP — teardrop body, flipper ears, water fin tail (Aquaring, Tidalfin)
const SIL_DROP_BODY = `  <!-- ═══ DROP BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <path d="M256,170 Q380,280 370,370 Q360,450 256,450 Q152,450 142,370 Q132,280 256,170Z" class="body-shape"/>
    <path d="M256,170 Q380,280 370,370 Q360,450 256,450 Q152,450 142,370 Q132,280 256,170Z" fill="url(#bodyGrad)"/>
    <path d="M256,170 Q380,280 370,370 Q360,450 256,450 Q152,450 142,370 Q132,280 256,170Z" class="body-shine"/>
${PATTERNS}
${BELLY}
  </g>`;

const SIL_DROP_ACCENT = `  <!-- ═══ FINS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <ellipse cx="150" cy="220" rx="20" ry="45" transform="rotate(-30 150 220)" class="accent-part"/>
    <ellipse cx="362" cy="220" rx="20" ry="45" transform="rotate(30 362 220)" class="accent-part"/>
    <!-- Head fin -->
    <ellipse cx="256" cy="168" rx="22" ry="12" class="accent-part"/>
  </g>`;

const SIL_DROP_TAIL = `  <!-- ═══ TAIL FIN ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <ellipse cx="256" cy="460" rx="35" ry="22" class="accent-part"/>
    <path d="M240,445 Q220,470 210,490" fill="none" stroke="var(--critter-accent-final)" stroke-width="14" stroke-linecap="round" opacity="0.5"/>
    <path d="M272,445 Q292,470 302,490" fill="none" stroke="var(--critter-accent-final)" stroke-width="14" stroke-linecap="round" opacity="0.5"/>
  </g>`;

const SIL_DROP_PAWS = `  <!-- ═══ FLIPPERS (feet) ═══ -->
  <ellipse cx="210" cy="440" rx="20" ry="12" class="body-shape"/>
  <ellipse cx="302" cy="440" rx="20" ry="12" class="body-shape"/>`;

// SERPENT — long serpentine body, horns, water swirls (Leviathorn)
const SIL_SERPENT_BODY = `  <!-- ═══ SERPENT BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <path d="M256,180 Q180,240 200,310 Q220,380 256,400 Q320,380 340,310 Q360,240 256,180Z" class="body-shape"/>
    <path d="M256,180 Q180,240 200,310 Q220,380 256,400 Q320,380 340,310 Q360,240 256,180Z" fill="url(#bodyGrad)"/>
    <path d="M256,180 Q180,240 200,310 Q220,380 256,400 Q320,380 340,310 Q360,240 256,180Z" class="body-shine"/>
    <!-- Serpent coils below -->
    <path d="M210,380 Q140,430 180,480 Q220,520 256,500 Q290,480 310,460" fill="none" stroke="var(--critter-body-final)" stroke-width="45" stroke-linecap="round" opacity="0.6"/>
    <path d="M210,380 Q140,430 180,480 Q220,520 256,500 Q290,480 310,460" fill="none" stroke="url(#bodyGrad)" stroke-width="45" stroke-linecap="round" opacity="0.3"/>
${PATTERNS}
    <ellipse cx="256" cy="340" rx="55" ry="45" class="belly-part" opacity="0.75"/>
  </g>`;

const SIL_SERPENT_ACCENT = `  <!-- ═══ HORNS + WHISKERS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <path d="M230,195 Q210,140 195,120" fill="none" stroke="var(--critter-accent-final)" stroke-width="10" stroke-linecap="round"/>
    <path d="M282,195 Q302,140 317,120" fill="none" stroke="var(--critter-accent-final)" stroke-width="10" stroke-linecap="round"/>
    <!-- Whiskers -->
    <path d="M200,270 Q160,280 140,310" fill="none" stroke="var(--critter-accent-final)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    <path d="M312,270 Q352,280 372,310" fill="none" stroke="var(--critter-accent-final)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
  </g>`;

const SIL_SERPENT_TAIL = `  <!-- ═══ SERPENT TAIL ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <path d="M310,460 Q360,430 380,460 Q400,490 420,470" fill="none" stroke="var(--critter-accent-final)" stroke-width="18" stroke-linecap="round"/>
    <ellipse cx="420" cy="470" rx="18" ry="10" transform="rotate(15 420 470)" class="accent-part"/>
  </g>`;

const SIL_SERPENT_PAWS = `  <!-- ═══ MINI FINS ═══ -->
  <ellipse cx="165" cy="350" rx="18" ry="10" transform="rotate(-40 165 350)" class="accent-part"/>
  <ellipse cx="347" cy="350" rx="18" ry="10" transform="rotate(40 347 350)" class="accent-part"/>`;

// ROCK — irregular chunky body, moss tufts, stubby legs (Terrabud, Mossback)
const SIL_ROCK_BODY = `  <!-- ═══ ROCK BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <path d="M256,190 Q200,195 185,260 Q170,330 200,380 Q230,420 256,430 Q282,420 312,380 Q342,330 327,260 Q312,195 256,190Z" class="body-shape"/>
    <path d="M256,190 Q200,195 185,260 Q170,330 200,380 Q230,420 256,430 Q282,420 312,380 Q342,330 327,260 Q312,195 256,190Z" fill="url(#bodyGrad)"/>
    <path d="M256,190 Q200,195 185,260 Q170,330 200,380 Q230,420 256,430 Q282,420 312,380 Q342,330 327,260 Q312,195 256,190Z" class="body-shine"/>
    <!-- Rocky surface facets -->
    <path d="M195,280 L240,240 L250,290 L210,330Z" fill="var(--critter-body-final)" opacity="0.3"/>
    <path d="M270,240 L320,280 L300,330 L250,290Z" fill="var(--critter-shadow-final)" opacity="0.3"/>
${PATTERNS}
    <ellipse cx="256" cy="345" rx="60" ry="50" class="belly-part" opacity="0.8"/>
  </g>`;

const SIL_ROCK_ACCENT = `  <!-- ═══ CRYSTALS / MOSS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <polygon points="220,180 215,145 230,165 240,140 245,175" class="accent-part"/>
    <polygon points="275,178 280,150 290,170 300,148 295,180" class="accent-part"/>
    <polygon points="248,175 245,155 255,170" class="accent-part"/>
  </g>`;

const SIL_ROCK_TAIL = `  <!-- ═══ ROCK TAIL (stub) ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <ellipse cx="340" cy="390" rx="22" ry="16" class="accent-part"/>
    <circle cx="356" cy="385" r="10" class="accent-part"/>
  </g>`;

const SIL_ROCK_PAWS = `  <!-- ═══ STUBBY LEGS ═══ -->
  <ellipse cx="200" cy="425" rx="18" ry="24" class="body-shape"/>
  <ellipse cx="312" cy="425" rx="18" ry="24" class="body-shape"/>
  <ellipse cx="240" cy="435" rx="16" ry="20" class="body-shape" opacity="0.6"/>
  <ellipse cx="272" cy="435" rx="16" ry="20" class="body-shape" opacity="0.6"/>`;

// BIRD — round body, feathered crest, wings (Zephyrling, Stormwing)
const SIL_BIRD_BODY = `  <!-- ═══ BIRD BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <ellipse cx="256" cy="320" rx="115" ry="125" class="body-shape"/>
    <ellipse cx="256" cy="320" rx="115" ry="125" fill="url(#bodyGrad)"/>
    <ellipse cx="256" cy="320" rx="115" ry="125" class="body-shine"/>
${PATTERNS}
    <ellipse cx="256" cy="365" rx="68" ry="55" class="belly-part" opacity="0.85"/>
  </g>`;

const SIL_BIRD_ACCENT = `  <!-- ═══ CREST + WINGS ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <!-- Crest feathers -->
    <ellipse cx="256" cy="185" rx="14" ry="30" class="accent-part"/>
    <ellipse cx="238" cy="190" rx="10" ry="25" transform="rotate(-15 238 190)" class="accent-part"/>
    <ellipse cx="274" cy="190" rx="10" ry="25" transform="rotate(15 274 190)" class="accent-part"/>
    <!-- Wings -->
    <ellipse cx="155" cy="280" rx="55" ry="22" transform="rotate(-25 155 280)" class="accent-part"/>
    <ellipse cx="357" cy="280" rx="55" ry="22" transform="rotate(25 357 280)" class="accent-part"/>
  </g>`;

const SIL_BIRD_TAIL = `  <!-- ═══ TAIL FEATHERS ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <ellipse cx="370" cy="410" rx="18" ry="40" transform="rotate(20 370 410)" class="accent-part"/>
    <ellipse cx="385" cy="415" rx="15" ry="35" transform="rotate(30 385 415)" class="accent-part"/>
    <ellipse cx="360" cy="420" rx="14" ry="32" transform="rotate(10 360 420)" class="accent-part"/>
  </g>`;

const SIL_BIRD_PAWS = `  <!-- ═══ TALONS ═══ -->
  <ellipse cx="210" cy="430" rx="16" ry="10" class="accent-part"/>
  <ellipse cx="302" cy="430" rx="16" ry="10" class="accent-part"/>
  <path d="M202,432 L198,442 M210,432 L210,442 M218,432 L222,442" stroke="var(--critter-accent-final)" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M294,432 L290,442 M302,432 L302,442 M310,432 L314,442" stroke="var(--critter-accent-final)" stroke-width="2.5" stroke-linecap="round"/>`;

// WISP — floating ghost-like blob, aura, no solid legs (Wispember, Nyxling)
const SIL_WISP_BODY = `  <!-- ═══ WISP BODY ═══ -->
  <g class="gene-body" style="transform:scale(var(--gene-body-w),var(--gene-body-h))">
    <path d="M256,180 Q330,185 345,250 Q360,320 340,380 Q320,430 256,440 Q192,430 172,380 Q152,320 167,250 Q182,185 256,180Z" class="body-shape"/>
    <path d="M256,180 Q330,185 345,250 Q360,320 340,380 Q320,430 256,440 Q192,430 172,380 Q152,320 167,250 Q182,185 256,180Z" fill="url(#bodyGrad)"/>
    <path d="M256,180 Q330,185 345,250 Q360,320 340,380 Q320,430 256,440 Q192,430 172,380 Q152,320 167,250 Q182,185 256,180Z" class="body-shine"/>
    <!-- Wispy bottom -->
    <path d="M195,420 Q180,455 170,465 M210,430 Q200,460 195,475 M230,435 Q225,465 220,480 M256,440 Q256,470 256,485 M282,435 Q287,465 292,480 M302,430 Q312,460 317,475 M317,420 Q332,455 342,465" fill="none" stroke="var(--critter-body-final)" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
${PATTERNS}
    <ellipse cx="256" cy="350" rx="58" ry="52" class="belly-part" opacity="0.7"/>
  </g>`;

const SIL_WISP_ACCENT = `  <!-- ═══ AURA HALO ═══ -->
  <g class="gene-accent" style="transform:scale(var(--gene-accent-scale))">
    <ellipse cx="256" cy="195" rx="28" ry="10" class="accent-part" opacity="0.6"/>
    <ellipse cx="240" cy="180" rx="10" ry="18" transform="rotate(-25 240 180)" class="accent-part" opacity="0.7"/>
    <ellipse cx="272" cy="180" rx="10" ry="18" transform="rotate(25 272 180)" class="accent-part" opacity="0.7"/>
  </g>`;

const SIL_WISP_TAIL = `  <!-- ═══ WISP TRAIL ═══ -->
  <g class="gene-tail" style="transform:scale(var(--gene-tail-scale))">
    <path d="M340,380 Q370,400 375,430 Q380,450 370,460" fill="none" stroke="var(--critter-accent-final)" stroke-width="14" stroke-linecap="round" opacity="0.5"/>
    <circle cx="368" cy="462" r="8" class="accent-part" opacity="0.4"/>
  </g>`;

const SIL_WISP_PAWS = `  <!-- ═══ NO LEGS — floating creature ═══ -->`;

// ══════════════════════════════════════════════════════════════
//  SILHOUETTE → COMPONENT MAP
// ══════════════════════════════════════════════════════════════

const SILS = {
  fox:     { body: SIL_FOX_BODY,     accent: SIL_FOX_ACCENT,     tail: SIL_FOX_TAIL,     paws: SIL_FOX_PAWS },
  dragon:  { body: SIL_DRAGON_BODY,  accent: SIL_DRAGON_ACCENT,  tail: SIL_DRAGON_TAIL,  paws: SIL_DRAGON_PAWS },
  drop:    { body: SIL_DROP_BODY,    accent: SIL_DROP_ACCENT,    tail: SIL_DROP_TAIL,    paws: SIL_DROP_PAWS },
  serpent: { body: SIL_SERPENT_BODY, accent: SIL_SERPENT_ACCENT, tail: SIL_SERPENT_TAIL, paws: SIL_SERPENT_PAWS },
  rock:    { body: SIL_ROCK_BODY,    accent: SIL_ROCK_ACCENT,    tail: SIL_ROCK_TAIL,    paws: SIL_ROCK_PAWS },
  bird:    { body: SIL_BIRD_BODY,    accent: SIL_BIRD_ACCENT,    tail: SIL_BIRD_TAIL,    paws: SIL_BIRD_PAWS },
  wisp:    { body: SIL_WISP_BODY,    accent: SIL_WISP_ACCENT,    tail: SIL_WISP_TAIL,    paws: SIL_WISP_PAWS },
};

// ══════════════════════════════════════════════════════════════
//  ELEMENTAL FX PER FAMILY
// ══════════════════════════════════════════════════════════════

const ELEMENT_FX = {
  fire: `  <!-- 🔥 Fire wisps -->
  <g opacity="0.6">
    <circle cx="140" cy="160" r="4" fill="#FFCB6B"><animate attributeName="cy" values="160;140;160" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="380" cy="180" r="3" fill="#FF9E4A"><animate attributeName="cy" values="180;160;180" dur="2.5s" repeatCount="indefinite"/></circle>
    <circle cx="170" cy="400" r="3" fill="#FFCB6B"><animate attributeName="cy" values="400;385;400" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="360" cy="420" r="4" fill="#FF6B35"><animate attributeName="cy" values="420;400;420" dur="2.2s" repeatCount="indefinite"/></circle>
  </g>`,
  water: `  <!-- 💧 Water droplets -->
  <g opacity="0.6">
    <circle cx="145" cy="200" r="3" fill="#7FDBFF"><animate attributeName="cy" values="200;185;200" dur="2.5s" repeatCount="indefinite"/></circle>
    <circle cx="375" cy="220" r="2.5" fill="#B8F0FF"><animate attributeName="cy" values="220;205;220" dur="3s" repeatCount="indefinite"/></circle>
    <circle cx="160" cy="380" r="3" fill="#7FDBFF"><animate attributeName="cy" values="380;365;380" dur="2.2s" repeatCount="indefinite"/></circle>
    <circle cx="370" cy="400" r="2" fill="#A8E8FF"><animate attributeName="cy" values="400;388;400" dur="2.8s" repeatCount="indefinite"/></circle>
    <circle cx="256" cy="460" r="4" fill="#5CC8FF"><animate attributeName="cy" values="460;445;460" dur="2s" repeatCount="indefinite"/></circle>
  </g>`,
  earth: `  <!-- 🪨 Floating earth particles -->
  <g opacity="0.5">
    <circle cx="150" cy="180" r="2.5" fill="#8FD694"><animate attributeName="cy" values="180;165;180" dur="3s" repeatCount="indefinite"/></circle>
    <circle cx="380" cy="200" r="2" fill="#C4A86C"><animate attributeName="cy" values="200;188;200" dur="2.7s" repeatCount="indefinite"/></circle>
    <circle cx="175" cy="420" r="3" fill="#8FD694"><animate attributeName="cy" values="420;405;420" dur="3.2s" repeatCount="indefinite"/></circle>
    <circle cx="350" cy="410" r="2" fill="#D4C99E"><animate attributeName="cy" values="410;398;410" dur="2.4s" repeatCount="indefinite"/></circle>
  </g>`,
  air: `  <!-- 🌪️ Wind swirls -->
  <g opacity="0.5">
    <path d="M120,220 Q140,210 160,220 Q180,230 200,220" fill="none" stroke="#E8F8FF" stroke-width="2"><animate attributeName="d" values="M120,220 Q140,210 160,220 Q180,230 200,220;M120,215 Q140,225 160,215 Q180,205 200,215;M120,220 Q140,210 160,220 Q180,230 200,220" dur="3s" repeatCount="indefinite"/></path>
    <path d="M320,240 Q340,230 360,240 Q380,250 400,240" fill="none" stroke="#D4F1FF" stroke-width="2"><animate attributeName="d" values="M320,240 Q340,230 360,240 Q380,250 400,240;M320,235 Q340,245 360,235 Q380,225 400,235;M320,240 Q340,230 360,240 Q380,250 400,240" dur="3.5s" repeatCount="indefinite"/></path>
    <circle cx="150" cy="320" r="2" fill="#A8DCF0"><animate attributeName="cx" values="150;170;150" dur="4s" repeatCount="indefinite"/></circle>
    <circle cx="370" cy="350" r="2.5" fill="#A8DCF0"><animate attributeName="cx" values="370;350;370" dur="3.8s" repeatCount="indefinite"/></circle>
  </g>`,
  spirit: `  <!-- ✨ Spirit sparkles -->
  <g opacity="0.7">
    <circle cx="145" cy="150" r="3" fill="#E8D5FF"><animate attributeName="cy" values="150;130;150" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.5s" repeatCount="indefinite"/></circle>
    <circle cx="380" cy="170" r="2.5" fill="#C9A8FF"><animate attributeName="cy" values="170;150;170" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="160" cy="380" r="3" fill="#F0E8FF"><animate attributeName="cy" values="380;360;380" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="370" cy="400" r="2" fill="#E8D5FF"><animate attributeName="cy" values="400;385;400" dur="2.2s" repeatCount="indefinite"/></circle>
    <circle cx="256" cy="120" r="4" fill="#C9A8FF"><animate attributeName="cy" values="120;105;120" dur="1.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.2;1" dur="1.3s" repeatCount="indefinite"/></circle>
  </g>`,
  shadow: `  <!-- 🌑 Dark void wisps -->
  <g opacity="0.6">
    <circle cx="140" cy="145" r="4" fill="#7B5EA7"><animate attributeName="cy" values="145;125;145" dur="2s" repeatCount="indefinite"/><animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="385" cy="165" r="3" fill="#4A2A8E"><animate attributeName="cy" values="165;148;165" dur="2.5s" repeatCount="indefinite"/></circle>
    <circle cx="155" cy="390" r="3.5" fill="#7B5EA7"><animate attributeName="cy" values="390;372;390" dur="2.3s" repeatCount="indefinite"/></circle>
    <circle cx="375" cy="410" r="3" fill="#4A2A8E"><animate attributeName="cy" values="410;395;410" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="256" cy="110" r="5" fill="#7B5EA7"><animate attributeName="cy" values="110;92;110" dur="1.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.7s" repeatCount="indefinite"/></circle>
  </g>`,
};

// ══════════════════════════════════════════════════════════════
//  SPECIES FACTORY
// ══════════════════════════════════════════════════════════════

const EMOJI = {
  fire: '🔥', water: '💧', earth: '🪨', air: '🌪️', spirit: '✨', shadow: '🌑',
};

function buildSVG(s) {
  const sil = SILS[s.silhouette];
  if (!sil) throw new Error(`Unknown silhouette: ${s.silhouette}`);
  const fx = ELEMENT_FX[s.element] || '';
  const emoji = EMOJI[s.element] || '?';
  const hasAura = s.rarity === 'Rare' || s.rarity === 'Legendary';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 600" id="critter-${s.id}" class="critter" data-species="${s.id}" data-family="${s.element}" data-rarity="${s.rarity}">
  <defs>
${SHARED_DEFS}
${STYLE_BLOCK(s)}
  </defs>

${CONTACT_SHADOW}
${hasAura ? AURA_GLOW : ''}
${fx}
${sil.tail}
${sil.accent}
${sil.body}
${sil.paws}
${EYES}
${s.rarity === 'Legendary' ? SPARKLES : ''}

  <!-- ═══ LABEL ═══ -->
  <text x="256" y="580" text-anchor="middle" font-family="'Baloo 2','Nunito',sans-serif" font-size="13" font-weight="700" class="label-rarity">${emoji} ${s.name} · ${s.rarity}</text>
</svg>`;
}

// ══════════════════════════════════════════════════════════════
//  MAIN — read gene-map, generate all 12
// ══════════════════════════════════════════════════════════════

const geneMap = require('./gene-map.json');
const speciesMap = geneMap.species;

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let count = 0;
for (const [id, s] of Object.entries(speciesMap)) {
  const svg = buildSVG(s);
  const fname = path.join(OUT, `${id}.svg`);
  fs.writeFileSync(fname, svg, 'utf-8');
  console.log(`✓ ${id}.svg (${s.silhouette}, ${s.element}, ${s.rarity})`);
  count++;
}

console.log(`\n✨ ${count} SVG templates generated → ${OUT}`);
