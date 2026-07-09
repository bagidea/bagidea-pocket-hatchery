/**
 * Pocket Hatchery — Gene Rendering Engine (canonical 64-bit)
 *
 * Decodes a 16-char hex gene (64-bit, per GENE-SPEC.md §2)
 * into CSS filter variables + slot/mutation visibility map
 * that drive Monanisa's canonical SVGs in art/species/svg/species/.
 *
 * Architecture:
 *   species_id (bits 0–3)   → picks SVG + species config
 *   body_hue    (bits 4–11)  → --gene-hue-shift (0–360°)
 *   saturation  (bits 32–35) → --gene-sat-mult (0.85–1.20)
 *   brightness  (bits 36–39) → --gene-light-mult (0.81–1.11)
 *   trait_A/B/C (bits 48–59) → slot-{id}-{variant} visibility
 *   mutations   (bits 60–63) → mut-{shiny|giant|prismatic|ethereal} visibility
 *
 * Usage:
 *   const engine = require('./engine.js');
 *   const { css, vis } = engine.decodeFull('3A4F8CD4E82755F1', 'foxling');
 *   // Inject css into SVG's <style>, toggle vis groups via page.evaluate()
 */

const GENE_MAP = require('./gene-map.json');

// ── 64-bit Gene Decoder (matches GENE-SPEC.md §2 & slot-engine.js) ──

function decodeBits(geneHex) {
  const gene = BigInt(geneHex.startsWith('0x') ? geneHex : '0x' + geneHex);
  return {
    speciesId:   Number(gene & 0xFn),
    bodyHue:     Number((gene >> 4n)  & 0xFFn),
    accentHue:   Number((gene >> 12n) & 0xFFn),
    patternType: Number((gene >> 20n) & 0xFn),
    patternHue:  Number((gene >> 24n) & 0xFFn),
    saturation:  Number((gene >> 32n) & 0xFn),
    brightness:  Number((gene >> 36n) & 0xFn),
    eyeColor:    Number((gene >> 40n) & 0xFn),
    patOpacity:  Number((gene >> 44n) & 0xFn),
    traitA:      Number((gene >> 48n) & 0xFn),
    traitB:      Number((gene >> 52n) & 0xFn),
    traitC:      Number((gene >> 56n) & 0xFn),
    mutations:   Number((gene >> 60n) & 0xFn),
  };
}

/**
 * Decode a 16-char hex gene into the full rendering payload for a species.
 * @param {string} geneHex — 16 hex chars (64-bit), with or without '0x' prefix
 * @param {string} speciesId — species key in gene-map.json (e.g. 'foxling')
 * @returns {{ css: string, vis: object, gene: object, species: object, rarity: number }}
 */
function decodeFull(geneHex, speciesId) {
  const species = GENE_MAP.species[speciesId];
  if (!species) {
    throw new Error(`Unknown species: ${speciesId}. Options: ${Object.keys(GENE_MAP.species).join(', ')}`);
  }

  const g = decodeBits(geneHex);

  // ── CSS filter variables for SVG .gene-tint ──
  // bodyHue 0–255 → hue-rotate 0°–360°
  const hueDeg = Math.round((g.bodyHue / 255) * 360);

  // saturation 0–15 → 0.85–1.20 (filter saturate) — baseline near 1.0 so an
  // average gene stays close to the original SVG color; only the extremes diverge.
  const sat = (85 + (g.saturation / 15) * 35) / 100;

  // brightness 0–15 → ~0.81–1.11 around 95% center
  const brit = (95 + ((g.brightness - 7) / 15) * 30) / 100;

  const css = [
    `  --gene-hue-shift: ${hueDeg}deg;`,
    `  --gene-sat-mult: ${sat.toFixed(2)};`,
    `  --gene-light-mult: ${brit.toFixed(2)};`,
  ].join('\n');

  // ── Slot visibility map ──
  const traitValues = [g.traitA, g.traitB, g.traitC];
  const vis = { body: true };

  (species.slots || []).forEach((slotId, i) => {
    const activeVariant = traitValues[i] % 4;
    for (let v = 0; v < 4; v++) {
      vis[`slot-${slotId}-${v}`] = (v === activeVariant);
    }
  });

  // ── Mutation visibility ──
  vis['mut-shiny']     = !!(g.mutations & 0x1);
  vis['mut-giant']     = !!(g.mutations & 0x2);
  vis['mut-prismatic'] = !!(g.mutations & 0x4);
  vis['mut-ethereal']  = !!(g.mutations & 0x8);

  // ── Rarity overlays (heuristic — actual rarity assigned at mint) ──
  const rarity = rarityFromBits(g);
  vis['rare-iridescent'] = (rarity >= 3);
  vis['legendary-aura']  = (rarity >= 4);

  return {
    css: `:root {\n${css}\n}`,
    vis,
    gene: g,
    species,
    rarity,
  };
}

/**
 * Convenience: decode gene + return just the CSS string.
 */
function decodeCSS(geneHex, speciesId) {
  return decodeFull(geneHex, speciesId).css;
}

/**
 * Backward-compatible decode() — matches old engine API shape for render-creature.mjs.
 * Returns { css, vars, species, vis, rarity }
 */
function decode(geneHex, species) {
  const speciesId = typeof species === 'string' ? species : species.id;
  const result = decodeFull(geneHex, speciesId);
  return {
    css: result.css,
    vars: result.gene,
    species: result.species.id,
    vis: result.vis,
    rarity: result.rarity,
  };
}

/**
 * Generate a random 16-char hex gene.
 * @param {string|null} speciesId
 * @returns {string} 16-char hex (no 0x prefix)
 */
function randomGene(speciesId) {
  const randByte = () => Math.floor(Math.random() * 256);
  const randNibble = () => Math.floor(Math.random() * 16);

  let gene = BigInt(0);

  if (speciesId && GENE_MAP.species[speciesId]) {
    gene |= BigInt(GENE_MAP.species[speciesId].index & 0xF) << 0n;
  } else {
    gene |= BigInt(randNibble() & 0xF) << 0n;
  }

  gene |= BigInt(randByte() & 0xFF) << 4n;   // body_hue
  gene |= BigInt(randByte() & 0xFF) << 12n;  // accent_hue
  gene |= BigInt(randNibble() & 0xF) << 20n; // pattern_type
  gene |= BigInt(randByte() & 0xFF) << 24n;  // pattern_hue
  gene |= BigInt(randNibble() & 0xF) << 32n; // sat_lvl
  gene |= BigInt(randNibble() & 0xF) << 36n; // bright_mod
  gene |= BigInt(randNibble() & 0xF) << 40n; // eye_var
  gene |= BigInt(randNibble() & 0xF) << 44n; // pat_opacity
  gene |= BigInt(randNibble() & 0x3) << 48n; // trait_1 (0–3 only)
  gene |= BigInt(randNibble() & 0x3) << 52n; // trait_2
  gene |= BigInt(randNibble() & 0x3) << 56n; // trait_3
  const mut = Math.random() < 0.1
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15][randNibble() % 15]
    : 0;
  gene |= BigInt(mut & 0xF) << 60n;

  return gene.toString(16).padStart(16, '0');
}

/**
 * Heuristic rarity from gene bits (proxy — actual rarity assigned at mint).
 */
function rarityFromBits(g) {
  if (g.mutations & 0x8) return 5; // ethereal → mythic
  if (g.mutations & 0x4) return 4; // prismatic → legendary
  if (g.saturation >= 12)  return 3; // epic
  if (g.saturation >= 8)   return 2; // rare
  if (g.brightness >= 8)   return 1; // uncommon
  return 0; // common
}

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

function rarityName(rarity) {
  return RARITY_NAMES[rarity] || 'Common';
}

module.exports = {
  decode,
  decodeFull,
  decodeCSS,
  decodeBits,
  randomGene,
  rarityFromBits,
  rarityName,
  GENE_MAP,
  SPECIES: GENE_MAP.species,
};
