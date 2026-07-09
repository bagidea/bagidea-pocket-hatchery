// Pocket Hatchery — SVG Slot Engine
// Composes creature SVGs from gene-encoded trait layers
// Maps 64-bit gene → visible trait layers with hue-shift filters
// v1.0 — Monanisa (Designer) · 2026-07-03

const SlotEngine = {
  // ── Gene Decoder ──
  // Decode a 64-bit gene into structured creature data
  decode(geneHex) {
    const gene = BigInt(geneHex.startsWith('0x') ? geneHex : '0x' + geneHex);
    return {
      speciesId: Number(gene & 0xFn),
      bodyHue:    Number((gene >> 4n) & 0xFFn),
      accentHue:  Number((gene >> 12n) & 0xFFn),
      patternType: Number((gene >> 20n) & 0xFn),
      patternHue: Number((gene >> 24n) & 0xFFn),
      saturation: Number((gene >> 32n) & 0xFn),
      brightness: Number((gene >> 36n) & 0xFn),
      eyeColor:   Number((gene >> 40n) & 0xFn),
      patOpacity: Number((gene >> 44n) & 0xFn),
      traitA:     Number((gene >> 48n) & 0xFn), // species-specific trait 1
      traitB:     Number((gene >> 52n) & 0xFn), // species-specific trait 2
      traitC:     Number((gene >> 56n) & 0xFn), // species-specific trait 3
      mutations:  Number((gene >> 60n) & 0xFn), // mutation flags (shiny/giant/prismatic/ethereal)
    };
  },

  // ── Gene Encoder ──
  encode({speciesId,bodyHue,accentHue,patternType,patternHue,saturation,brightness,eyeColor,patOpacity,traitA,traitB,traitC,mutations}) {
    let gene = BigInt(0);
    gene |= BigInt(speciesId   & 0xF)  << 0n;
    gene |= BigInt(bodyHue     & 0xFF) << 4n;
    gene |= BigInt(accentHue   & 0xFF) << 12n;
    gene |= BigInt(patternType & 0xF)  << 20n;
    gene |= BigInt(patternHue  & 0xFF) << 24n;
    gene |= BigInt(saturation  & 0xF)  << 32n;
    gene |= BigInt(brightness  & 0xF)  << 36n;
    gene |= BigInt(eyeColor    & 0xF)  << 40n;
    gene |= BigInt(patOpacity  & 0xF)  << 44n;
    gene |= BigInt(traitA      & 0xF)  << 48n;
    gene |= BigInt(traitB      & 0xF)  << 52n;
    gene |= BigInt(traitC      & 0xF)  << 56n;
    gene |= BigInt(mutations   & 0xF)  << 60n;
    return '0x' + gene.toString(16).padStart(16, '0').toUpperCase();
  },

  // ── Random Gene Generator ──
  random(speciesId = null) {
    const sid = speciesId !== null ? speciesId : Math.floor(Math.random() * 12);
    const sp = SPECIES[sid];
    return this.encode({
      speciesId: sid,
      bodyHue: Math.floor(Math.random() * 256),
      accentHue: Math.floor(Math.random() * 256),
      patternType: Math.floor(Math.random() * 16),
      patternHue: Math.floor(Math.random() * 256),
      saturation: Math.floor(Math.random() * 16),
      brightness: Math.floor(Math.random() * 16),
      eyeColor: Math.floor(Math.random() * 16),
      patOpacity: Math.floor(Math.random() * 16),
      traitA: Math.floor(Math.random() * 4),
      traitB: Math.floor(Math.random() * 4),
      traitC: Math.floor(Math.random() * 4),
      mutations: Math.random() < 0.1 ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15][Math.floor(Math.random()*15)] : 0,
    });
  },

  // ── Determine Rarity from Gene ──
  // Uses saturation + mutation bits as a proxy; actual rarity assigned at mint
  rarityFromGene(geneHex) {
    const g = this.decode(geneHex);
    if (g.mutations & 0x8) return 5; // ethereal → mythic
    if (g.mutations & 0x4) return 4; // prismatic → legendary
    if (g.saturation >= 12) return 3; // epic
    if (g.saturation >= 8) return 2; // rare
    if (g.brightness >= 8) return 1; // uncommon
    return 0; // common
  },

  // ── Visibility Map for Layers ──
  // Returns {layerId: true/false} for a given gene
  visibilityMap(geneHex) {
    const g = this.decode(geneHex);
    const sp = SPECIES[g.speciesId];
    if (!sp) return {};

    const visible = { body: true };

    // Map traits to slot IDs
    const slotMap = sp.slots.map((s, i) => {
      const values = [g.traitA, g.traitB, g.traitC];
      return { id: s.id, value: values[i] || 0 };
    });

    slotMap.forEach(slot => {
      for (let v = 0; v < 4; v++) {
        visible[`slot-${slot.id}-${v}`] = (slot.value === v);
      }
    });

    // Mutations
    visible['mut-shiny'] = !!(g.mutations & 0x1);
    visible['mut-giant'] = !!(g.mutations & 0x2);
    visible['mut-prismatic'] = !!(g.mutations & 0x4);
    visible['mut-ethereal'] = !!(g.mutations & 0x8);

    return visible;
  },

  // ── Compose SVG ──
  // Takes a species SVG source + gene → returns composed SVG string
  compose(speciesSVGSource, geneHex) {
    const vis = this.visibilityMap(geneHex);
    const parser = new DOMParser();
    const doc = parser.parseFromString(speciesSVGSource, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return '';

    // Show/hide layers based on visibility map
    const allGroups = svg.querySelectorAll('g[id]');
    allGroups.forEach(g => {
      const id = g.getAttribute('id');
      if (id && vis.hasOwnProperty(id)) {
        g.style.display = vis[id] ? '' : 'none';
      }
      // Hide all trait variants by default, show only active one
      if (id && id.startsWith('slot-')) {
        g.style.display = vis[id] ? '' : 'none';
      }
    });

    return new XMLSerializer().serializeToString(svg);
  },

  // ── Stats Calculator ──
  calcStats(speciesId, rarity) {
    const sp = SPECIES[speciesId];
    if (!sp) return { pow: 0, charm: 0 };
    const keys = ['common','uncommon','rare','epic','legendary'];
    const rk = keys[Math.min(rarity, 4)];
    return sp.baseStats[rk];
  },

  // ── Breed two genes → offspring gene ──
  breed(geneAHex, geneBHex) {
    const a = this.decode(geneAHex);
    const b = this.decode(geneBHex);

    // Species: 50/50 from either parent
    const speciesId = Math.random() < 0.5 ? a.speciesId : b.speciesId;

    // Traits: randomly inherit from each parent
    const pick = (va, vb) => Math.random() < 0.5 ? va : vb;

    // 10% chance of mutation on each trait
    const maybeMutate = (v) => Math.random() < 0.1 ? Math.floor(Math.random() * 4) : v;

    return this.encode({
      speciesId,
      bodyHue: Math.round((pick(a.bodyHue, b.bodyHue) + (Math.random() - 0.5) * 20)),
      accentHue: Math.round((pick(a.accentHue, b.accentHue) + (Math.random() - 0.5) * 20)),
      patternType: pick(a.patternType, b.patternType),
      patternHue: pick(a.patternHue, b.patternHue),
      saturation: Math.round((pick(a.saturation, b.saturation) + (Math.random() - 0.5) * 4)),
      brightness: Math.round((pick(a.brightness, b.brightness) + (Math.random() - 0.5) * 4)),
      eyeColor: pick(a.eyeColor, b.eyeColor),
      patOpacity: pick(a.patOpacity, b.patOpacity),
      traitA: maybeMutate(pick(a.traitA, b.traitA)),
      traitB: maybeMutate(pick(a.traitB, b.traitB)),
      traitC: maybeMutate(pick(a.traitC, b.traitC)),
      mutations: 0, // mutations from breeding are extremely rare
    }).replace('0x', '');
  },
};

// Export for Node.js / module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SlotEngine;
}
