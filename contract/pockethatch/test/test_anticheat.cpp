// test_anticheat.cpp — native harness for the three slotcfg anti-cheat rules.
//
// Compiles ph_rules.hpp, the EXACT header pockethatch.cpp includes, so these
// assertions describe the deployed behaviour rather than a re-implementation.
// Numbers come from the live configv3 row on phgamecreatr (wax-testnet) so a
// config change that breaks a gate shows up here, not in production.
//
//   g++ -std=c++17 -I.. -o test_anticheat test_anticheat.cpp && ./test_anticheat

#include <cstdio>
#include <cstdint>

#include "ph_rules.hpp"

static int ran = 0, failures = 0;
static void ok(bool pred, const char* what) {
    ran++;
    if (pred) { printf("  PASS  %s\n", what); }
    else      { printf("  FAIL  %s\n", what); failures++; }
}

// Live configv3 fed_dur_* (seconds) — 48h/72h/120h/7d/10d/14d
static const uint32_t FED_DUR[6] = {172800, 259200, 432000, 604800, 864000, 1209600};

int main() {
    printf("1. satiety gate — evolve + accelerate refuse a hungry creature\n");
    {
        const uint32_t fed = 1000000;                 // last_fed
        const uint32_t dur = FED_DUR[0];              // common, 48h

        ok(ph_rules::is_sated(fed,             fed, dur), "just fed → sated");
        ok(ph_rules::is_sated(fed + dur - 1,   fed, dur), "one second before expiry → still sated");
        ok(!ph_rules::is_sated(fed + dur,      fed, dur), "exactly at last_fed+fed_dur → HUNGRY (boundary is closed)");
        ok(!ph_rules::is_sated(fed + dur + 1,  fed, dur), "one second past expiry → hungry");
        ok(!ph_rules::is_sated(fed + 999999,   fed, dur), "long past expiry → hungry");

        // A never-fed creature (last_fed 0) is hungry at any realistic clock.
        ok(!ph_rules::is_sated(1784060782u, 0, dur), "last_fed=0 → hungry");
    }

    printf("\n2. satiety gate — every rarity uses its own fed_dur\n");
    {
        const uint32_t fed = 2000000;
        for (int r = 0; r < 6; r++) {
            char msg[96];
            snprintf(msg, sizeof msg, "rarity %d sated at +%us, hungry at +%us", r, FED_DUR[r] - 1, FED_DUR[r]);
            ok(ph_rules::is_sated(fed + FED_DUR[r] - 1, fed, FED_DUR[r]) &&
               !ph_rules::is_sated(fed + FED_DUR[r],    fed, FED_DUR[r]), msg);
        }
        // Rarer creatures stay sated longer — the gate must not flatten them.
        ok(ph_rules::is_sated(fed + FED_DUR[0], fed, FED_DUR[5]),
           "mythic still sated at the moment common expires");
    }

    printf("\n3. satiety gate — a huge fed_dur must not wrap uint32 into a free pass\n");
    {
        const uint32_t fed = 4294000000u;             // near UINT32_MAX
        const uint32_t dur = 4000000u;                // fed + dur overflows uint32
        ok(ph_rules::is_sated(fed + 10, fed, dur), "no wrap: still sated just after feeding");
        ok(ph_rules::is_sated(4294967295u, fed, dur), "no wrap: sated at UINT32_MAX, not flipped to hungry");
    }

    printf("\n4. cosmetic template id range — equipcosmetic whitelist pre-check\n");
    {
        ok(!ph_rules::cosmetic_tmpl_in_range(0), "0 is NOT a valid id (unequip is handled before this)");
        ok(ph_rules::cosmetic_tmpl_in_range(1), "1 is in range");
        ok(ph_rules::cosmetic_tmpl_in_range(662976), "a real creatures template id is in range");
        ok(ph_rules::cosmetic_tmpl_in_range(2147483647ull), "INT32_MAX is in range (AA stores int32)");
        ok(!ph_rules::cosmetic_tmpl_in_range(2147483648ull), "INT32_MAX+1 rejected before the table lookup");
        ok(!ph_rules::cosmetic_tmpl_in_range(999999999999ull), "a garbage 64-bit id is rejected");
        ok(!ph_rules::cosmetic_tmpl_in_range(UINT64_MAX), "UINT64_MAX is rejected");
    }

    printf("\n5. burn quote — base x stage x rarity, priced before anything is destroyed\n");
    {
        const uint64_t base = 100000;                 // 10.0000 HATCH, live burn_base_hatch

        // stage 2 / common is the x1.0 x1.0 reference point.
        ok(ph_rules::burn_payout_raw(base, 2, 0) == base, "stage 2 common = base");
        ok(ph_rules::burn_payout_raw(base, 0, 0) == base / 5,  "stage 0 = x0.2");
        ok(ph_rules::burn_payout_raw(base, 1, 0) == base / 2,  "stage 1 = x0.5");
        ok(ph_rules::burn_payout_raw(base, 3, 0) == base * 2,  "stage 3 = x2");
        ok(ph_rules::burn_payout_raw(base, 4, 0) == base * 5,  "stage 4 = x5");
        ok(ph_rules::burn_payout_raw(base, 5, 0) == base * 10, "stage 5 = x10");

        ok(ph_rules::burn_payout_raw(base, 2, 1) == base * 3,   "uncommon = x3");
        ok(ph_rules::burn_payout_raw(base, 2, 2) == base * 10,  "rare = x10");
        ok(ph_rules::burn_payout_raw(base, 2, 3) == base * 25,  "epic = x25");
        ok(ph_rules::burn_payout_raw(base, 2, 4) == base * 60,  "legendary = x60");
        ok(ph_rules::burn_payout_raw(base, 2, 5) == base * 150, "mythic = x150");

        ok(ph_rules::burn_payout_raw(base, 5, 5) == base * 1500, "stage 5 mythic = x1500 (the pool-drainer case)");

        // Out-of-range indices clamp instead of reading past the tables — the
        // creature/species rows are chain data, not something we control.
        ok(ph_rules::burn_payout_raw(base, 200, 0) == ph_rules::burn_payout_raw(base, 5, 0),
           "stage above 5 clamps to 5 (no read past the table)");
        ok(ph_rules::burn_payout_raw(base, 2, 99) == ph_rules::burn_payout_raw(base, 2, 5),
           "egg_type above 5 clamps to 5");

        ok(ph_rules::burn_payout_raw(0, 5, 5) == 0, "base 0 quotes 0 — nothing to pay, nothing to fail on");
    }

    printf("\n%d/%d passed\n", ran - failures, ran);
    return failures ? 1 : 0;
}
