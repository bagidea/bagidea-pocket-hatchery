// Pocket Hatchery — Species Registry (12 species × trait slots)
// Maps directly to SPECIES-DESIGN.md §1-12 and gene encoding §13
const SPECIES = [
  {
    id: 'foxling', name: 'Foxling', sciName: 'Vulpes magica', emoji: '🦊',
    element: '🔥 Fire', elementClass: 'el-fire',
    baseColor: '#10B981', accentColor: '#F43F5E',
    slots: [
      { id: 'ears', name: 'Ear Style', icon: '👂', variants: [
        { label: 'Pointed', emoji: '🔺', desc: 'Sharp triangular ears, alert and attentive' },
        { label: 'Floppy', emoji: '🐶', desc: 'Soft folded ears, puppy-like charm' },
        { label: 'Tufted', emoji: '🌿', desc: 'Ears with fluffy tufts at tips' },
        { label: 'Folded', emoji: '📐', desc: 'Neatly folded back, sleek look' }
      ]},
      { id: 'tail', name: 'Tail Plume', icon: '🪶', variants: [
        { label: 'Standard', emoji: '🦊', desc: 'Classic bushy fox tail' },
        { label: 'Extra Fluffy', emoji: '☁️', desc: 'Extra volume, cloud-like puff' },
        { label: 'Forked', emoji: '🔱', desc: 'Split into two tips' },
        { label: 'Crystal-Tipped', emoji: '💎', desc: 'Tail tip glows with crystal' }
      ]},
      { id: 'forehead', name: 'Forehead Mark', icon: '💠', variants: [
        { label: 'None', emoji: '○', desc: 'Plain forehead' },
        { label: 'Diamond', emoji: '💠', desc: 'Glowing diamond shape' },
        { label: 'Star', emoji: '⭐', desc: 'Bright star mark' },
        { label: 'Crescent', emoji: '🌙', desc: 'Moon crescent, mystical' }
      ]}
    ],
    baseStats: {
      common:{pow:5,charm:7}, uncommon:{pow:9,charm:13}, rare:{pow:16,charm:20},
      epic:{pow:24,charm:28}, legendary:{pow:38,charm:44}
    }
  },
  {
    id: 'owlet', name: 'Owlet', sciName: 'Strigis rotundus', emoji: '🦉',
    element: '🌬️ Air', elementClass: 'el-air',
    baseColor: '#0EA5E9', accentColor: '#FBBF24',
    slots: [
      { id: 'eyerings', name: 'Eye Rings', icon: '👁️', variants: [
        { label: 'Simple', emoji: '⭕', desc: 'Single ring around eyes' },
        { label: 'Double Ring', emoji: '◎', desc: 'Concentric double rings' },
        { label: 'Star-Shaped', emoji: '⭐', desc: 'Star pattern around eyes' },
        { label: 'Crescent', emoji: '🌙', desc: 'Moon-shaped eye markings' }
      ]},
      { id: 'wings', name: 'Wing Style', icon: '🪶', variants: [
        { label: 'Small', emoji: '🐣', desc: 'Tiny baby wings' },
        { label: 'Broad', emoji: '🦅', desc: 'Wide majestic wings' },
        { label: 'Pointed', emoji: '🔺', desc: 'Swift pointed wings' },
        { label: 'Ethereal', emoji: '✨', desc: 'Translucent starry wings' }
      ]},
      { id: 'crown', name: 'Crown', icon: '👑', variants: [
        { label: 'None', emoji: '○', desc: 'Smooth round head' },
        { label: 'Feather Tuft', emoji: '🪶', desc: 'Two cute feather tufts' },
        { label: 'Crystal', emoji: '💎', desc: 'Crystal on forehead' },
        { label: 'Star', emoji: '⭐', desc: 'Glowing star crown' }
      ]}
    ],
    baseStats: {
      common:{pow:4,charm:8}, uncommon:{pow:8,charm:15}, rare:{pow:14,charm:24},
      epic:{pow:22,charm:34}, legendary:{pow:36,charm:52}
    }
  },
  {
    id: 'droplet', name: 'Droplet', sciName: 'Aqua vivens', emoji: '💧',
    element: '💧 Water', elementClass: 'el-water',
    baseColor: '#06B6D4', accentColor: '#67E8F9',
    slots: [
      { id: 'core', name: 'Core Shape', icon: '💠', variants: [
        { label: 'Circle', emoji: '⭕', desc: 'Round glowing heart' },
        { label: 'Heart', emoji: '❤️', desc: 'Heart-shaped core' },
        { label: 'Star', emoji: '⭐', desc: 'Star-bright center' },
        { label: 'Diamond', emoji: '💎', desc: 'Faceted diamond core' }
      ]},
      { id: 'fins', name: 'Fin Style', icon: '🌊', variants: [
        { label: 'Simple', emoji: '〰️', desc: 'Clean ripple fins' },
        { label: 'Flowing', emoji: '🌊', desc: 'Long flowing fins' },
        { label: 'Wing-like', emoji: '🪽', desc: 'Broad wing-shaped fins' },
        { label: 'Crystal', emoji: '💎', desc: 'Crystal shard fins' }
      ]},
      { id: 'clarity', name: 'Transparency', icon: '🔮', variants: [
        { label: 'Clear', emoji: '💧', desc: 'Crystal clear water' },
        { label: 'Misty', emoji: '🌫️', desc: 'Soft misty body' },
        { label: 'Shimmer', emoji: '✨', desc: 'Shimmering surface' },
        { label: 'Prismatic', emoji: '🌈', desc: 'Rainbow prism body' }
      ]}
    ],
    baseStats: {
      common:{pow:3,charm:10}, uncommon:{pow:7,charm:18}, rare:{pow:12,charm:28},
      epic:{pow:20,charm:38}, legendary:{pow:32,charm:56}
    }
  },
  {
    id: 'pebblit', name: 'Pebblit', sciName: 'Lithos vivens', emoji: '🪨',
    element: '🏔️ Earth', elementClass: 'el-earth',
    baseColor: '#F97316', accentColor: '#A3E635',
    slots: [
      { id: 'stone', name: 'Stone Type', icon: '🪨', variants: [
        { label: 'Granite', emoji: '🪨', desc: 'Classic speckled stone' },
        { label: 'Obsidian', emoji: '⬛', desc: 'Dark volcanic glass' },
        { label: 'Marble', emoji: '🏛️', desc: 'White veined marble' },
        { label: 'Geode', emoji: '💎', desc: 'Crystal-lined geode' }
      ]},
      { id: 'moss', name: 'Moss Coverage', icon: '🌿', variants: [
        { label: 'Minimal', emoji: '🌱', desc: 'Just a few moss spots' },
        { label: 'Patchy', emoji: '🌿', desc: 'Scattered moss patches' },
        { label: 'Full Coat', emoji: '🌳', desc: 'Completely moss-covered' },
        { label: 'Flowering', emoji: '🌸', desc: 'Moss with tiny flowers' }
      ]},
      { id: 'crystals', name: 'Crystal Growth', icon: '💎', variants: [
        { label: 'None', emoji: '○', desc: 'No crystals' },
        { label: 'Small', emoji: '🔹', desc: 'Tiny crystal nubs' },
        { label: 'Cluster', emoji: '💠', desc: 'Crystal cluster' },
        { label: 'Crown', emoji: '👑', desc: 'Full crystal crown' }
      ]}
    ],
    baseStats: {
      common:{pow:10,charm:3}, uncommon:{pow:18,charm:5}, rare:{pow:28,charm:10},
      epic:{pow:40,charm:16}, legendary:{pow:60,charm:24}
    }
  },
  {
    id: 'sproutling', name: 'Sproutling', sciName: 'Herba ambulans', emoji: '🌱',
    element: '🌿 Nature', elementClass: 'el-nature',
    baseColor: '#22C55E', accentColor: '#F472B6',
    slots: [
      { id: 'headplant', name: 'Head Plant', icon: '🌿', variants: [
        { label: 'Single Leaf', emoji: '🍃', desc: 'One elegant leaf' },
        { label: 'Flower', emoji: '🌸', desc: 'Blooming flower' },
        { label: 'Fruit', emoji: '🍒', desc: 'Cute berry/fruit' },
        { label: 'Vine Crown', emoji: '🌿', desc: 'Woven vine crown' }
      ]},
      { id: 'roots', name: 'Root Style', icon: '🪴', variants: [
        { label: 'Simple', emoji: '〰️', desc: 'Two simple root legs' },
        { label: 'Spread', emoji: '🌿', desc: 'Wide spreading roots' },
        { label: 'Curly', emoji: '〰️', desc: 'Curly decorative roots' },
        { label: 'Glowing', emoji: '✨', desc: 'Bioluminescent roots' }
      ]},
      { id: 'season', name: 'Season Color', icon: '🌸', variants: [
        { label: 'Spring', emoji: '🌸', desc: 'Fresh green & pink' },
        { label: 'Summer', emoji: '☀️', desc: 'Golden warm tones' },
        { label: 'Autumn', emoji: '🍂', desc: 'Orange & red hues' },
        { label: 'Winter', emoji: '❄️', desc: 'White & icy blue' }
      ]}
    ],
    baseStats: {
      common:{pow:3,charm:9}, uncommon:{pow:6,charm:17}, rare:{pow:11,charm:26},
      epic:{pow:18,charm:36}, legendary:{pow:28,charm:54}
    }
  },
  {
    id: 'flicker', name: 'Flicker', sciName: 'Ignis animatus', emoji: '🔥',
    element: '🔥 Fire', elementClass: 'el-fire',
    baseColor: '#F59E0B', accentColor: '#FEF08A',
    slots: [
      { id: 'flamecolor', name: 'Flame Color', icon: '🔥', variants: [
        { label: 'Orange', emoji: '🟠', desc: 'Classic warm orange' },
        { label: 'Golden', emoji: '🟡', desc: 'Bright golden flame' },
        { label: 'Blue', emoji: '🔵', desc: 'Rare blue flame' },
        { label: 'Purple', emoji: '🟣', desc: 'Mystic purple fire' }
      ]},
      { id: 'flameshape', name: 'Flame Shape', icon: '🔥', variants: [
        { label: 'Teardrop', emoji: '💧', desc: 'Classic flame drop' },
        { label: 'Candle', emoji: '🕯️', desc: 'Tall steady flame' },
        { label: 'Torch', emoji: '🔦', desc: 'Wide blazing flame' },
        { label: 'Spiral', emoji: '🌀', desc: 'Swirling spiral fire' }
      ]},
      { id: 'sparks', name: 'Spark Level', icon: '✨', variants: [
        { label: 'Minimal', emoji: '✨', desc: 'Few tiny sparks' },
        { label: 'Moderate', emoji: '🌟', desc: 'Pleasant sparkle' },
        { label: 'Intense', emoji: '💫', desc: 'Active fire sparks' },
        { label: 'Constellation', emoji: '🌌', desc: 'Starry fire burst' }
      ]}
    ],
    baseStats: {
      common:{pow:7,charm:5}, uncommon:{pow:14,charm:9}, rare:{pow:22,charm:15},
      epic:{pow:32,charm:22}, legendary:{pow:50,charm:34}
    }
  },
  {
    id: 'glimmer', name: 'Glimmer', sciName: 'Crystallus vivens', emoji: '💎',
    element: '✨ Crystal', elementClass: 'el-crystal',
    baseColor: '#A855F7', accentColor: '#E0E7FF',
    slots: [
      { id: 'shape', name: 'Crystal Shape', icon: '💠', variants: [
        { label: 'Hexagon', emoji: '⬡', desc: 'Six-sided crystal' },
        { label: 'Diamond', emoji: '💎', desc: 'Classic diamond shape' },
        { label: 'Obelisk', emoji: '📐', desc: 'Tall obelisk form' },
        { label: 'Cluster', emoji: '💠', desc: 'Multi-crystal cluster' }
      ]},
      { id: 'innercore', name: 'Inner Core', icon: '🔮', variants: [
        { label: 'Solid', emoji: '💜', desc: 'Dense inner gem' },
        { label: 'Hollow', emoji: '⭕', desc: 'Hollow center ring' },
        { label: 'Swirling', emoji: '🌀', desc: 'Swirling energy' },
        { label: 'Nebula', emoji: '🌌', desc: 'Galaxy-like core' }
      ]},
      { id: 'refraction', name: 'Refraction', icon: '🌈', variants: [
        { label: 'Clear', emoji: '💎', desc: 'Pure clear crystal' },
        { label: 'Rainbow', emoji: '🌈', desc: 'Rainbow light splits' },
        { label: 'Aurora', emoji: '🌌', desc: 'Aurora borealis glow' },
        { label: 'Prismatic', emoji: '💫', desc: 'Full prismatic burst' }
      ]}
    ],
    baseStats: {
      common:{pow:6,charm:6}, uncommon:{pow:11,charm:11}, rare:{pow:18,charm:18},
      epic:{pow:28,charm:28}, legendary:{pow:42,charm:42}
    }
  },
  {
    id: 'wisp', name: 'Wisp', sciName: 'Umbra ludens', emoji: '👻',
    element: '🌙 Shadow', elementClass: 'el-shadow',
    baseColor: '#6366F1', accentColor: '#C084FC',
    slots: [
      { id: 'tailstyle', name: 'Tail Style', icon: '💨', variants: [
        { label: 'Short', emoji: '💨', desc: 'Cute short smoke tail' },
        { label: 'Long', emoji: '🌊', desc: 'Long flowing tail' },
        { label: 'Split', emoji: '🔱', desc: 'Twin smoke tails' },
        { label: 'Nebula', emoji: '🌌', desc: 'Starry nebula trail' }
      ]},
      { id: 'glow', name: 'Glow Color', icon: '💡', variants: [
        { label: 'Lavender', emoji: '🟣', desc: 'Soft purple glow' },
        { label: 'Cyan', emoji: '🔵', desc: 'Bright cyan light' },
        { label: 'Gold', emoji: '🟡', desc: 'Warm golden glow' },
        { label: 'Rainbow', emoji: '🌈', desc: 'Shifting rainbow light' }
      ]},
      { id: 'opacity', name: 'Opacity', icon: '👻', variants: [
        { label: 'Opaque', emoji: '⬛', desc: 'Solid visible form' },
        { label: 'Semi', emoji: '◼️', desc: 'Partially transparent' },
        { label: 'Ghostly', emoji: '👻', desc: 'Very transparent' },
        { label: 'Prism', emoji: '💫', desc: 'Prismatic transparency' }
      ]}
    ],
    baseStats: {
      common:{pow:2,charm:12}, uncommon:{pow:5,charm:22}, rare:{pow:9,charm:34},
      epic:{pow:15,charm:46}, legendary:{pow:24,charm:64}
    }
  },
  {
    id: 'fluffle', name: 'Fluffle', sciName: 'Nubes mollis', emoji: '☁️',
    element: '🌬️ Air', elementClass: 'el-air',
    baseColor: '#F472B6', accentColor: '#22D3EE',
    slots: [
      { id: 'fluff', name: 'Fluff Level', icon: '☁️', variants: [
        { label: 'Smooth', emoji: '○', desc: 'Clean sleek fur' },
        { label: 'Fluffy', emoji: '☁️', desc: 'Pleasantly fluffy' },
        { label: 'Extra Fluffy', emoji: '☁️', desc: 'Maximum fluff' },
        { label: 'Cloud-like', emoji: '🌥️', desc: 'Literally a cloud' }
      ]},
      { id: 'earlen', name: 'Ear Length', icon: '👂', variants: [
        { label: 'Short', emoji: '🐭', desc: 'Tiny cute ears' },
        { label: 'Medium', emoji: '🐰', desc: 'Moderate length' },
        { label: 'Long', emoji: '🐇', desc: 'Long droopy ears' },
        { label: 'Curled', emoji: '🌀', desc: 'Curled spiral ears' }
      ]},
      { id: 'earstyle', name: 'Ear Style', icon: '🎀', variants: [
        { label: 'Straight', emoji: '📏', desc: 'Simple straight ears' },
        { label: 'Floppy', emoji: '🐶', desc: 'Soft droopy ears' },
        { label: 'Curled', emoji: '🌀', desc: 'Elegant curl tips' },
        { label: 'Ribbon', emoji: '🎀', desc: 'Ribbon-like ears' }
      ]}
    ],
    baseStats: {
      common:{pow:3,charm:11}, uncommon:{pow:6,charm:20}, rare:{pow:10,charm:30},
      epic:{pow:17,charm:42}, legendary:{pow:26,charm:60}
    }
  },
  {
    id: 'shellby', name: 'Shellby', sciName: 'Cochlea margarita', emoji: '🐚',
    element: '💧 Water', elementClass: 'el-water',
    baseColor: '#FB7185', accentColor: '#FDE047',
    slots: [
      { id: 'shelltype', name: 'Shell Type', icon: '🐚', variants: [
        { label: 'Spiral', emoji: '🌀', desc: 'Classic spiral shell' },
        { label: 'Conch', emoji: '🐚', desc: 'Elegant conch shell' },
        { label: 'Nautilus', emoji: '🐙', desc: 'Chambered nautilus' },
        { label: 'Crown', emoji: '👑', desc: 'Crown-shaped shell' }
      ]},
      { id: 'shellcolor', name: 'Shell Color', icon: '🎨', variants: [
        { label: 'Pearl', emoji: '🤍', desc: 'Classic white pearl' },
        { label: 'Coral', emoji: '🪸', desc: 'Warm coral pink' },
        { label: 'Abalone', emoji: '🌈', desc: 'Iridescent abalone' },
        { label: 'Black Pearl', emoji: '🖤', desc: 'Rare black pearl' }
      ]},
      { id: 'antennae', name: 'Antennae', icon: '🐌', variants: [
        { label: 'Short', emoji: '🐌', desc: 'Cute short feelers' },
        { label: 'Feathered', emoji: '🪶', desc: 'Feather-tipped' },
        { label: 'Star-Tipped', emoji: '⭐', desc: 'Glowing star tips' },
        { label: 'Glowing', emoji: '✨', desc: 'Full glow antennae' }
      ]}
    ],
    baseStats: {
      common:{pow:8,charm:4}, uncommon:{pow:15,charm:7}, rare:{pow:24,charm:12},
      epic:{pow:34,charm:19}, legendary:{pow:52,charm:28}
    }
  },
  {
    id: 'dracling', name: 'Dracling', sciName: 'Draco parvus', emoji: '🐉',
    element: '🔥 Fire', elementClass: 'el-fire',
    baseColor: '#8B5CF6', accentColor: '#FB923C',
    slots: [
      { id: 'horns', name: 'Horn Style', icon: '🐉', variants: [
        { label: 'Nub', emoji: '🔸', desc: 'Baby horn nubs' },
        { label: 'Straight', emoji: '📐', desc: 'Straight pointed horns' },
        { label: 'Curved', emoji: '🌀', desc: 'Elegant curved horns' },
        { label: 'Crystal', emoji: '💎', desc: 'Gemstone horns' }
      ]},
      { id: 'wingsize', name: 'Wing Size', icon: '🪽', variants: [
        { label: 'Tiny', emoji: '🪶', desc: 'Comically small' },
        { label: 'Small', emoji: '🪽', desc: 'Cute small wings' },
        { label: 'Medium', emoji: '🦇', desc: 'Respectable wings' },
        { label: 'Majestic', emoji: '🦅', desc: 'Full majestic wings' }
      ]},
      { id: 'breath', name: 'Breath', icon: '💨', variants: [
        { label: 'None', emoji: '○', desc: 'No breath yet' },
        { label: 'Spark', emoji: '✨', desc: 'Tiny sparks' },
        { label: 'Flame', emoji: '🔥', desc: 'Small flame puff' },
        { label: 'Star-Fire', emoji: '⭐', desc: 'Starry fire breath' }
      ]}
    ],
    baseStats: {
      common:{pow:8,charm:6}, uncommon:{pow:16,charm:10}, rare:{pow:26,charm:17},
      epic:{pow:38,charm:26}, legendary:{pow:58,charm:38}
    }
  },
  {
    id: 'buzzle', name: 'Buzzle', sciName: 'Bombus rotundus', emoji: '🐝',
    element: '🌿 Nature', elementClass: 'el-nature',
    baseColor: '#EAB308', accentColor: '#F9A8D4',
    slots: [
      { id: 'stripes', name: 'Stripe Pattern', icon: '🦓', variants: [
        { label: '2-Stripe', emoji: '🟰', desc: 'Two bold stripes' },
        { label: '3-Stripe', emoji: '🟰', desc: 'Three neat stripes' },
        { label: 'Wavy', emoji: '〰️', desc: 'Wavy stripe pattern' },
        { label: 'Diamond', emoji: '💠', desc: 'Diamond stripe shapes' }
      ]},
      { id: 'wingstyle', name: 'Wing Style', icon: '🪰', variants: [
        { label: 'Round', emoji: '⭕', desc: 'Round delicate wings' },
        { label: 'Pointed', emoji: '🔺', desc: 'Swift pointed wings' },
        { label: 'Butterfly', emoji: '🦋', desc: 'Butterfly-shaped wings' },
        { label: 'Iridescent', emoji: '🌈', desc: 'Rainbow iridescent wings' }
      ]},
      { id: 'collar', name: 'Fluff Collar', icon: '🧣', variants: [
        { label: 'None', emoji: '○', desc: 'Sleek neck' },
        { label: 'Small', emoji: '☁️', desc: 'Light fluff ring' },
        { label: 'Fluffy', emoji: '☁️', desc: 'Full fluffy collar' },
        { label: 'Regal', emoji: '👑', desc: 'Royal fluff collar' }
      ]}
    ],
    baseStats: {
      common:{pow:5,charm:7}, uncommon:{pow:10,charm:14}, rare:{pow:17,charm:22},
      epic:{pow:26,charm:32}, legendary:{pow:40,charm:48}
    }
  }
];
