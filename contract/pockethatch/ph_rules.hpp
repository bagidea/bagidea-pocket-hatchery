#pragma once
// ph_rules.hpp — the anti-cheat decisions, as pure functions.
//
// These three rules are the whole point of the slotcfg deploy, and every one of
// them is an arithmetic predicate that a native test can pin down exactly. They
// live here (no eosio deps) so `test/test_anticheat.cpp` exercises THE SAME code
// the contract compiles — not a mirror of it, which is how a "tested" rule
// silently drifts from the deployed one.
//
//   g++ -std=c++17 -I. -o t test/test_anticheat.cpp && ./t

#include <cstdint>

namespace ph_rules {

// ── 1. Satiety gate (evolve + accelerate) ───────────────────────────────
// A feed lasts `fed_dur` seconds from `last_fed`. Growth-spending actions are
// only allowed while the creature is still sated; without this, paying HATCH to
// accelerate bought growth straight past the feeding economy.
// Boundary is deliberate: at exactly last_fed + fed_dur the feed HAS expired.
inline bool is_sated(uint32_t now, uint32_t last_fed, uint32_t fed_dur) {
    // 32-bit overflow guard: a config with an absurd fed_dur must not wrap the
    // deadline back below `now` and hand out a free pass.
    uint64_t fed_until = (uint64_t)last_fed + (uint64_t)fed_dur;
    return (uint64_t)now < fed_until;
}

// ── 2. Cosmetic template id range (equipcosmetic) ───────────────────────
// AtomicAssets stores template_id as int32 and keys the `templates` table on
// (uint64)template_id. Anything above INT32_MAX can never name a real row, so
// reject it before the table lookup rather than letting a 64-bit id land on a
// key that only looks plausible. 0 is not "invalid" — it is the unequip signal
// and the caller handles it before ever asking this.
inline bool cosmetic_tmpl_in_range(uint64_t tmpl) {
    return tmpl != 0 && tmpl <= (uint64_t)INT32_MAX;
}

// ── 3. Burn buy-back quote (burncreature) ───────────────────────────────
// base × stage_mult × rarity_mult, both multipliers held as tenths. Quoting is
// split out from paying so burncreature can price the payout BEFORE it destroys
// the NFT and fail closed when the pool can't cover it.
inline uint64_t burn_payout_raw(uint64_t base, uint8_t stage, uint64_t egg_type) {
    static const uint64_t stage_mul[]  = {2, 5, 10, 20, 50, 100};
    static const uint64_t rarity_mul[] = {10, 30, 100, 250, 600, 1500};
    const uint64_t s = stage    > 5 ? 5 : stage;
    const uint64_t r = egg_type > 5 ? 5 : egg_type;
    return base * stage_mul[s] / 10 * rarity_mul[r] / 10;
}

} // namespace ph_rules
