# 🌾 Farm / Habitat — Scene & Walkable-Zone Spec

> **Flamingo (Designer) · 2026-07-17 · v2**
> **Audience: Poppy** — this file is the coordination contract between the art and the
> movement system. I own the scene art; you own the system.
> **v2: I did touch `web/src/` — `FarmScene.tsx`, its CSS, and `farm.ts`.** The art had never
> actually reached the panel (see §8), so I connected the seam your own comment reserved for it
> and verified it against the live chain. The sim, the moods and the walk are untouched. Read §2
> and §8 first — both correct things I'd previously written wrong. Change anything you disagree
> with; you own that code, I was completing its stub, not claiming it.
> **Assets:** `web/public/assets/farm/*.svg` · **Spec data:** `web/public/assets/farm/scene.json`
> **Reference picture:** `web/screenshots/farm-live.png` — the **real panel**, real chain, 19 real
> creatures. Reproduce with `node web/scripts/verify-farm-scene.mjs http://127.0.0.1:8787/plugin/pocket-hatchery/`.
>
> There is deliberately **no art-side render harness any more.** `render-farm-scene.mjs` used to
> re-implement the engine's clamp/scale/sort so I could preview the scene without running the app.
> It drifted twice — first the clamp, then the contact shadows — and a picture that shows a scene
> the engine cannot produce is worse than no picture. It's deleted. **Check the art in the panel.**

---

## 1. Art direction — why it's dusk

The app shell is already a **dark navy world** (`--ph-shell-bg-top: #131836` → `--ph-shell-bg-bottom: #080A14`)
and the six tier glows are tuned against it. A bright daylight farm would fight that and force
a re-theme of the whole panel — so the scene is a **golden-hour / dusk farm** instead:

- The **top edge of the sky is literally `#131836`** — the exact shell navy. The scene fuses into
  the page chrome with no seam. Do not add a border or a background behind the stage.
- The warm horizon band is `--ph-color-golden` (`#F59E0B`). It's the only bright thing in frame,
  so it carries the eye to the middle ground where the creatures are.
- Sky auras reuse `--ph-aura-rare` / `--ph-aura-epic` hues, and two fireflies are tinted
  `--tier-rare` / `--tier-epic`, so the scene belongs to the same colour system as the cards.
- **No new tokens were introduced** — nothing was added to `web/src/styles/tokens.css`, and nothing
  in the scene needs to be. To be precise about what that does and doesn't mean: the scene's
  **anchor colours** are the tokens above (`#131836`, `#080A14`, `#F59E0B`, `#C084FC`, `#60A5FA`,
  `#FDE68A`) — they're what tie it to the panel. The **painted mid-tones** (`#4B5570` dusk hills,
  `#6B5238` barn wood, `#0A1A14`/`#0E2118` grass, `#8FD694` highlights, `#FFD98A` lamp cores,
  `#9BE7E4` water, `#2C3348` …) are the scene's own palette, hand-mixed to sit between those
  anchors. They live in the layer SVGs only. That's deliberate: a painted backdrop needs dozens of
  mid-tones, and promoting them to tokens would imply the UI may reuse them — it must not.

**Single light source: the sun at scene `(600, 430)`.** Everything is rim-lit from there. If you
add a prop, light it from centre-left or it will look pasted on.

---

## 2. Layers & z-order

All six layer SVGs share the **same `viewBox="0 0 1600 900"`**. Stack them absolutely at
`inset: 0` with `object-fit: cover` and they self-align — no per-layer offsets needed.

**Correction (2026-07-17, from wiring it for real):** an earlier revision of this table gave the
bands hand-picked z-indexes (`…899` / `900` / `950`). That was written from my head and it was
**wrong** — `transformFor()` hands creatures `z = depth * 1000`, so a front-edge creature scores
`1000` and would have climbed straight over a `900` foreground. Three flat numbers cannot be
picked safely against a formula. The shipped structure below uses **stacking contexts** instead,
so the two z-ranges can never meet:

| Band | DOM | Contents | z |
|---|---|---|---|
| **back** | `.band` (sibling, before) | `farm-sky` → `farm-hills` → `farm-ground` → `farm-backdrop` | paint order only |
| **cast** | `.layer` (scaled; a stacking context) | creatures + in-band props | `0…1000` from `depthFor()`, **sealed inside** |
| **front** | `.band` (sibling, after) | `farm-foreground` → `farm-fx` | paint order only |

The bands are **siblings in DOM order**, so plain paint order separates them and the creatures'
`z` is contained by `.layer`'s stacking context (`.layer` has a `transform`, which creates one).
**Never give a band a `z-index`** — that lifts it back into the same race this replaced.

**Why the outer bands need no sorting:** every prop in `farm-backdrop.svg` is rooted **above**
y=520 (the walkable back edge), and everything in `farm-foreground.svg` is rooted **below** y=830
(the front edge). Neither can overlap a creature's body incorrectly. Props that *do* sit inside
the band go in the cast layer — see §5.

Both bands carry `pointer-events: none` or they'd eat clicks on the creatures.

---

## 3. The walkable zone → **already wired via `scene.json`**

You built the seam (`loadFarmSpec()` → `public/assets/farm/scene.json`) and left it with
placeholder values. **I've filled it in with the real numbers — that file is now the source of
truth and it's mine to maintain.** It validates against your `parseFarmSpec()` (checked, accepts),
so this section should need **no code change from you**.

```json
"width": 1600, "height": 900,
"walkable": { "x": 300, "y": 520, "w": 1000, "h": 310 },
"spriteSize": 216, "depthScaleFar": 0.4833, "depthScaleNear": 1.0, "minSpacing": 152
```

### Rect, not trapezoid — **decided, not deferred** (CEO, 2026-07-17)

`FarmSpec.walkable` is an **axis-aligned rectangle**. The painted ground is a **trapezoid** —
perspective means the pen is wider at the front than at the back:

```
back  edge:  y = 520,  x from  300 → 1300
front edge:  y = 830,  x from   90 → 1510
```

The rect is the largest one fitting *entirely inside* that trapezoid: it takes the narrow back
edge's width and holds it forward. It is **narrower than the painted ground on every side**, so a
creature cannot leave the mown grass — the guarantee is structural, not a number anyone has to
keep re-checking.

**This is the final call, and the reason is drift, not effort.** A depth-aware clamp would buy the
two front corners back at the price of carrying *two* geometries — a rect in the engine and a
trapezoid in our heads — which is precisely how the art and the sim silently came apart before.
One geometry, in one file, is worth more than two corners.

**We buy the corners back in art instead.** The fence and the front bushes close off the front
left/right, so the rect reads as a pen we meant to build rather than one that got cut. If the pen
ever feels too narrow, the fix is a brushstroke, not a clamp.

> ⛔ Do not reintroduce `xMin(y) = 300 - (y-520)*0.677` / `xMax(y) = 1300 + (y-520)*0.677`.
> They are recorded here only so nobody re-derives them thinking they're missing.

> The pen art is deliberately overshot ~14px past these lines, so feet never touch a visibly hard
> edge. Trust the numbers, not the painted edge.

---

## 4. Creature size & depth scaling

Already expressed in `scene.json` in **your** `FarmSpec` terms (`spriteSize` = the **front** box,
per your field docs), so `transformFor()` should just work:

| Field | Value | Meaning |
|---|---:|---|
| `spriteSize` | `216` | box size in scene units at the **front** edge (y=830) |
| `depthScaleNear` | `1.0` | → 216 units at the front |
| `depthScaleFar` | `0.4833` | → **104** units at the back (y=520) |

A **2.07× depth range** — that's what makes walking toward the camera read as depth rather than
as a sticker scaling up. Species SVGs are `viewBox="0 0 200 200"` → draw into that square box.

### `minSpacing: 152` — measured off the art, not chosen by feel

An earlier revision shipped `150` and admitted in writing that it was a guess. It was. Here is the
number with the guess taken out — **run `node web/scripts/measure-sprite-body.mjs` to reproduce it**:

| | |
|---|---|
| sprite **box** | 216 units at the front edge |
| painted **body** / box | **55–70%** — the box is mostly padding |
| widest body | `sproutling` — 70% → **151.2 units** at the front |
| median body | 64% → 138 units |

So the box is the wrong ruler: two creatures 150 apart are *not* overlapping by 66px, because
neither one is 216 wide. **152** is the widest measured body rounded up — the two fattest species,
shoulder to shoulder, at the closest and largest point of the pen, just touch and never overlap.
Further back they cannot reach each other at all.

`separate()` applies `minSpacing` **flat at every depth**, so it must be sized on the front edge —
the only place bodies are full size. It also weights `dy` by 1.6, so the closest *raw* distance you
will measure is legitimately a little under 152 when the pair is separated in depth (live: 148.9).
That's the rule working, not a violation.

⚠️ **If the sprite box or any species' art changes, re-run the measure script — do not re-guess.**

**Anchor = the feet** (bottom-centre of the sprite box), not the centre:

```js
left = x - boxSize / 2
top  = baseY - boxSize
```

**Contact shadow — please don't skip this.** Without it creatures look like they're hovering.
An ellipse under the feet, scaled with the creature:

```css
width: calc(w * 0.6); height: calc(w * 0.16);
left: x - w*0.3; top: baseY - h*0.06;
background: radial-gradient(ellipse at center,
  rgba(6,14,10,.62) 0%, rgba(6,14,10,.30) 55%, transparent 78%);
```

Give the shadow `z-index = creatureZ - 1` so it never draws over the creature behind it.

**Sanity check vs the art:** the barn door is ~80 scene-px wide and a front-edge creature is
~216px. Yes — the creatures are deliberately oversized against the buildings. This is a
creature-collector, not an architecture sim; the cast reads first. Don't "fix" it.

---

## 5. Y-sorting (this is the whole depth illusion)

Put **creatures and in-band props into one list and sort by `baseY` ascending.** Smaller
`baseY` = further away = drawn first. There is no other z logic inside the band:

```js
const band = [...creatures, ...props].sort((a, b) => a.baseY - b.baseY)
band.forEach((e, i) => e.z = 41 + i * 2)   // *2 leaves the odd slots for contact shadows
```

Sort **every frame** a creature moves in y, or they'll clip through each other.

### In-band props (ship separately so you can sort them)

> **Done — they now live in `scene.json` under `props: [...]`,** parsed by `parseProps()` and
> rendered by `FarmScene.tsx` into the cast layer. The art owns their placement, so moving a bush
> is a data edit and never a code change. They're static: placed once from `depthFor(baseY)`, no
> sim, no per-frame cost. `parseProps` is deliberately lenient — a malformed prop drops itself and
> the scene still loads, because one missing hay bale is not worth falling back to a wrong pen.

Each has **anchor = bottom-centre** of its own viewBox, and depth-scales exactly like a creature.
Shipped placements — move them freely, they're art, not law:

| File | viewBox | Suggested `x` | Suggested `baseY` |
|---|---|---:|---:|
| `prop-trough.svg` | 120×80 | 470 | 648 |
| `prop-haybale.svg` | 120×90 | 1180 | 752 |
| `prop-bush.svg` | 110×70 | 250 | 760 |
| `prop-bush.svg` | 110×70 | 1420 | 700 |
| `prop-lantern-post.svg` | 90×200 | 792 | 790 |

Props draw their own contact shadows — don't add the creature shadow to them.

⚠️ **`prop-lantern-post.svg` is the only tall in-band prop.** A creature behind it must render
behind it — plain `baseY` sorting already gets this right, so **no special case is needed**. I'm
flagging it only so it doesn't look like a bug when a creature disappears behind the post.

⚠️ **Two props are coupled to the ground art.** The lantern post at `(792, 790)` and the fence
lanterns have their **warm light pools painted into `farm-ground.svg`** at `(330,640)`,
`(1268,620)`, `(792,784)`. If you move a lantern, tell me and I'll move its pool — otherwise
you get a glow on the grass with no lamp above it.

---

## 6. Mapping scene units → screen

Your "the view scales the whole layer by one factor" approach is exactly right — keep it. Two
things the art needs from that scaling:

1. **The stage must be locked to 16:9** (1600×900). Let it letterbox/centre if the panel is a
   different ratio — **do not stretch**. A non-uniform scale breaks the perspective: the pen
   stops agreeing with the horizon and the whole depth illusion dies.
2. **Layers are plain `<img>` at `inset:0; width:100%; height:100%; object-fit:cover`** inside the
   scaled world. All six share the 1600×900 viewBox, so they self-align — no per-layer offsets.

**Narrow viewports:** below ~900px stage width the back-edge creatures (104 units × scale) get
small. If that becomes a real problem, the cheap fix is raising the walkable `y` toward 560 to
shorten the depth range — but that's an **art change**: the mown pen in `farm-ground.svg` is drawn
from those exact coordinates. Ping me and I'll move the pen to match. Please don't edit
`scene.json`'s geometry alone, or the painted grass and the walkable zone silently drift apart.

---

## 7. Rules I'd ask you to hold

1. **Never re-tint the creature SVGs to match the scene.** They're gene-driven
   (`geneDecoder.ts` → `--critter-*`); tinting them would break the whole variation system and
   make two different genes look identical. The scene is lit to sit *behind* them, not to recolour them.
2. **Rarity stays on the frame/aura, never on the creature body** — same rule as
   `art/nft-cards/tiers/TIER-CARDS-SPEC.md`. If a mythic needs to pop in the pen, give it an
   aura ring using `--ph-rarity-mythic-aura`, not a colour shift.
3. **All UI strings in this page must be English.** This is a global game — no Thai in any
   user-visible label, tooltip, or empty state. (The art ships with zero baked-in text, so
   every string is yours.)
4. **`prefers-reduced-motion`:** `farm-fx.svg` already kills its own animation via an internal
   media query, matching `tokens.css`. Please gate creature walking the same way — a static,
   nicely-composed pen is a perfectly good reduced-motion fallback.
5. **Don't put readable UI in the bottom ~70px** — the foreground blades and vignette live there.

---

## 8. Status / what's not done

**Done & verified**

- ✅ **All 10 SVGs + `scene.json` load in the deployed panel** — 0 broken images, 0 page errors,
  through Chrome, on the surface the CEO actually plays.
- ✅ `scene.json` accepted by `parseFarmSpec()`; the rect sits inside the painted trapezoid across
  the full y range; front/back sprite sizes resolve to 216 / 104.4.
- ✅ **`minSpacing` measured, not guessed** — `measure-sprite-body.mjs`, every species, real bbox.
- ✅ **The picture is the product now, not a model of it.** The old harness is gone; the reference
  is `farm-live.png` straight out of the panel. Two drifts it had been hiding are recorded here
  rather than quietly patched: the invented z-index table (§2) and the missing contact shadows.

- ✅ **The scene runs in the real panel.** `verify-farm-scene.mjs` against the deployed
  `/plugin/pocket-hatchery/` — **13 passed, 0 failed** — with waxwingsuper's **19 real on-chain
  creatures** walking in the painted pen: `screenshots/farm-live.png`. That picture, not the
  harness one, is now the reference.

**Wired on 2026-07-17 — I did touch `web/src/` this time**

The gradient placeholder had a comment on it reading *"until the art lands"*. The art had not
landed: the deployed panel was still running that gradient with a **placeholder `scene.json`**
(1000×620, `minSpacing: 78`) and **none of the ten SVGs**. So the seam is now connected:

- `FarmScene.tsx` / `.module.css` — three bands (§2) + in-band props. The gradients stay
  underneath as the fallback, so a layer that fails to load leaves a dusk sky, not a hole.
- `farm.ts` — `FarmSpec.props` + a **lenient** `parseProps` (a bad prop drops itself; it must
  never send the whole spec back to the fallback the way bad *geometry* rightly does), and
  `depthFor()` extracted so props and creatures share **one** perspective rule. `transformFor()`
  now calls it and is otherwise unchanged.

**Honest gaps**

- 🔴 **Contact shadows (§4) are not implemented — creatures hover.** Look at `farm-live.png`: the
  creatures sit on the grass with nothing under their feet. §4 specifies them and the real panel
  has never had them, so the spec is ahead of the build here. It's the next thing I'd fix.
  Reported to the CEO rather than patched quietly, because §4 is a request to Poppy's
  presentation layer, not to the art.
- ⚠️ `farm-live.png` shows **19 creatures** and reads well. **1 creature** (sparse or lonely?) and
  **40+** are still unseen.
- ⚠️ **Not committed** (per CEO instruction).

**Deliberately skipped — say the word**

- 🔜 Day/night sky variant. The layer split supports it: swap `farm-sky.svg` and the ground's
  `sunSpill` gradient; hills/pen/props all still work unchanged.
- 🔜 Per-species idle props (nest / burrow / water for the aquatic species).
