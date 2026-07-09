# Root cause — template `662889` bricks ~22 creatures (feed/evolve/breed/harvest)

> **Author:** Kevin · **Date:** 2026-07-09 · read-only, chain-verified. No signing.
> Evidence = live `get_table_rows` on `phgamecreatr` + AtomicAssets API
> (`test.wax.api.atomicassets.io`), head `2026-07-09T09:14:31Z`.

---

## TL;DR

`662889` (and `662906`) are **blank early-test AtomicAssets templates**. The game's
`speciescfg` table is keyed by `template_id` and only carries the **final Fire species**
(`662976/662977/662978`). Every creature minted onto the old placeholder templates has
**no `speciescfg` row**, so the contract's `sps.find(template_id)` misses and the
species-gated actions revert or no-op:

| action | code site | behaviour when species missing |
|---|---|---|
| `feed` | `pockethatch.cpp:395` `check(sp_it!=end,"species not found")` | **REVERT** |
| `evolve` | `:454` same check | **REVERT** |
| `breed` | `:688` `check(spA&&spB,"species not found")` | **REVERT** |
| `harvest` | `:559` `if(sp_it==end) continue;` | **silently earns 0** |
| `burncreature` | `:854` `egg_type = end ? 0 : …` | works (defaults common) |

Result: the ~22 creatures on `662889`/`662906` are **bricked for the core loop**;
only burn works.

---

## Evidence (live chain)

### 1. `speciescfg` has NO row for 662889 / 662906
Live `speciescfg` keys: **`660000` (Test), `662976` (Emberling/common), `662977`
(Blazetail/uncommon), `662978` (Drakember/rare)**. No `662889`, no `662906`.

### 2. Creature rows are concentrated on the broken templates
`creatures` table = **25 rows**, by `template_id`:

| template_id | # creatures | in speciescfg? |
|---|---|---|
| **662889** | **20** | ❌ no → bricked |
| **662906** | **2** | ❌ no → bricked |
| 662977 | 3 | ✅ yes → healthy |

### 3. The template itself is an empty placeholder
AtomicAssets templates for collection `phgamecreatr` (schema `creatures`):

```
tmpl 662889  issued=25  immutable_data = {}      ← blank placeholder (no name/family/rarity)
tmpl 662906  issued=2   immutable_data = {}      ← blank placeholder
tmpl 662907..662966     issued 0/1  {}           ← more blanks from early testing
tmpl 662976  issued=0   {"name":"Emberling","rarity":"1"}   ← final species
tmpl 662977  issued=3   {"name":"Blazetail"}                ← final species
tmpl 662978  issued=0   {"name":"Drakember"}                ← final species
```

A stranded asset still has valid genetics — only its **template** is blank:
```
asset 1099603751703 (tmpl 662889):
  immutable_data = {"genetics":"dbc06bec…b34148"}   ← real genes, fine
  mutable_data   = {"stage":0,"growth":"0"}
  template.immutable_data = {}                        ← no species identity
```

### 4. How some 662889 creatures reached stage 3–4 despite the revert
Rows like `751654`/`751670`/`751674` sit at **stage 4** on `662889`. They were fed/
evolved **earlier**, while `speciescfg` still had a matching row (or was keyed to the
placeholder set). A later **`clearspecies` + `setspecies`** re-pointed the game's species
rows onto the final `662976/662977/662978` templates **without migrating the existing
creatures** → they were stranded mid-game. This is a **config/data drift bug, not a
contract-logic bug** (the checks are correct; the data behind them moved).

---

## Root cause (one line)

**Species-config re-key / template drift:** creatures were minted+grown against
placeholder templates (`662889`/`662906`); `speciescfg` was later re-keyed to the final
Fire templates and the old creatures were never migrated, so every species lookup for
them misses.

There is **no on-chain link** that would auto-fix this: a minted AtomicAssets asset's
`template_id` is **immutable**, and the `creatures` row has **no admin action to change
`template_id`** (no `settemplate`/`retemplate` exists). So migration must go through one
of the options below.

---

## Migration options (boss decides — I do NOT guess)

### ✅ Option A — add `speciescfg` for the stranded templates (RECOMMENDED)
Give `662889` + `662906` a species row so lookups hit. **Non-destructive, no deploy,
admin-only, reversible.** Un-bricks all 22 creatures instantly.

- Set **`egg_weight = 0`** on these rows → the row is found by feed/evolve/harvest/breed
  (they use `sps.find(template_id)` directly), but `pick_template` (which sums
  `egg_weight`) will **never mint a NEW creature onto the placeholder** — so we heal the
  old ones without spawning more.
- Assign a rarity/curve. Sensible default: treat `662889` as **common** (copy the
  `662976` curve) and `662906` as **uncommon** (copy `662977`).

Ready-to-fire (ADMIN, `phgamecreatr@active`) — **do not fire until boss approves the
rarity assignment**:
```json
// 662889 → common curve, weight 0 (heal-only, never re-minted)
{"cmd":"pushaction","contract":"phgamecreatr","action":"setspecies","from":"phgamecreatr",
 "data":{"sp":{"template_id":662889,"growth_rate":1000,
   "thresh_1":1000,"thresh_2":5000,"thresh_3":20000,"thresh_4":100000,"thresh_5":200000,
   "yield_0":100,"yield_1":300,"yield_2":600,"yield_3":1200,"yield_4":2400,"yield_5":4800,
   "max_stage":5,"egg_weight":0,"egg_type":0,"family":"Legacy"}}}
```
```json
// 662906 → uncommon curve, weight 0
{"cmd":"pushaction","contract":"phgamecreatr","action":"setspecies","from":"phgamecreatr",
 "data":{"sp":{"template_id":662906,"growth_rate":1000,
   "thresh_1":1000,"thresh_2":5000,"thresh_3":20000,"thresh_4":100000,"thresh_5":200000,
   "yield_0":110,"yield_1":330,"yield_2":660,"yield_3":1320,"yield_4":2640,"yield_5":5280,
   "max_stage":5,"egg_weight":0,"egg_type":1,"family":"Legacy"}}}
```
- **Cost:** 2 admin txs, 0 deploy, 0 downtime. **Risk: LOW** (additive; reversible via
  `rmspecies`).
- **Trade-off:** these creatures keep blank template art/name (genetics still render on
  the card). Cosmetic only — mechanics fully restored.

### Option B — burn + re-mint (destructive, last resort)
`burncreature` each stranded creature (refunds EGG + pays HATCH from pool), then
`hatch`/`firsthatch` fresh ones on a good template.
- **Loses** stage, growth, genetics, and the original NFTs. High effort, poor UX. Only if
  the boss wants zero placeholder rows and doesn't care about existing creature history.

### Option C — contract action `settemplate(asset_id,new_template)` (needs a deploy)
Add an admin action to repoint a `creatures` row's `template_id` to `662977` so game logic
finds species. **But the underlying NFT stays `662889`** (AA template is immutable) →
creates a permanent creature-row ↔ NFT template mismatch (the same class of desync we
already fight elsewhere). Requires a contract compile + `setcode`/`setabi` (**blocked this
round — wallet locked**). Not worth it vs Option A.

---

## Recommendation

**Option A**, with `egg_weight = 0`. One reversible admin step, no deploy, heals all 22
creatures, and structurally prevents new mints onto the placeholders. The only real
decision for the boss is the **rarity/curve** to assign `662889`/`662906` (defaults above:
common / uncommon). If the boss later wants clean species art, follow up with a
case-by-case Option B at leisure — Option A already unblocks play today.

*Every figure verified live 2026-07-09. Template blank-state confirmed via AtomicAssets
`immutable_data = {}`; `speciescfg` absence confirmed via `get_table_rows`.*
