// test_mutdata.cpp — native harness for the NFT mutable-data merge.
//
// The bug this guards: atomicassets::setassetdata REPLACES the whole mutable
// map, so evolve/setname/equipcosmetic used to delete every attribute they did
// not personally rebuild — a player's `name` vanished on the first evolve.
//
// Runs aa_mutdata.hpp (the exact header the contract compiles) against REAL
// mutable_serialized_data pulled off wax-testnet, and re-serializes with a local
// mirror of atomicassets' encoder so a decode→edit→encode round trip can be
// byte-compared.
//
//   g++ -std=c++17 -I.. -o test_mutdata test_mutdata.cpp && ./test_mutdata

#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

// aa_mutdata.hpp calls check() unqualified — eosio::check in the contract, this
// shim here. Must be declared BEFORE the include.
inline void check(bool pred, const std::string& msg) {
    if (!pred) throw std::runtime_error(msg);
}

#include "aa_mutdata.hpp"

// ── atomicassets' encoder, mirrored (contract never encodes; the test does, so
//    it can prove a decode→encode round trip is byte-identical) ──────────────

static void write_varuint(std::vector<uint8_t>& out, uint64_t v) {
    do {
        uint8_t byte = v & 0x7F;
        v >>= 7;
        if (v) byte |= 0x80;
        out.push_back(byte);
    } while (v);
}

static std::vector<uint8_t> aa_encode_map(const ATTR_MAP& m, const AA_FORMAT& format) {
    std::vector<uint8_t> out;
    for (const auto& kv : m) {
        size_t idx = format.size();
        for (size_t i = 0; i < format.size(); ++i) if (format[i].first == kv.first) { idx = i; break; }
        check(idx < format.size(), "attribute not in schema: " + kv.first);
        write_varuint(out, idx + AA_RESERVED_IDS);
        const std::string& type = format[idx].second;
        if (type == "string" || type == "image") {
            const std::string& s = std::get<std::string>(kv.second);
            write_varuint(out, s.size());
            out.insert(out.end(), s.begin(), s.end());
        } else if (type == "uint64") write_varuint(out, std::get<uint64_t>(kv.second));
        else if   (type == "uint32") write_varuint(out, std::get<uint32_t>(kv.second));
        else if   (type == "uint16") write_varuint(out, std::get<uint16_t>(kv.second));
        else if   (type == "uint8")  write_varuint(out, std::get<uint8_t>(kv.second));
        else check(false, "unsupported type in test encoder: " + type);
    }
    return out;
}

// ── Fixtures: live wax-testnet reads (2026-07-19) ───────────────────────────

// phgamecreatr / schema `creatures`
static const AA_FORMAT FORMAT = {
    {"genetics", "string"}, {"stage", "uint32"}, {"growth", "uint64"},
    {"name", "string"},     {"rarity", "uint64"}, {"cosmetic", "uint64"},
};

// asset 1099603751834, owner officewax123 — renamed "Ember Queen"
static const std::vector<uint8_t> ASSET_EMBER =
    {5, 1, 6, 244, 228, 143, 131, 3, 7, 11, 69, 109, 98, 101, 114, 32, 81, 117, 101, 101, 110};
// asset 1099603752017 — renamed "Sparkplug"
static const std::vector<uint8_t> ASSET_SPARK =
    {5, 1, 6, 156, 134, 226, 11, 7, 9, 83, 112, 97, 114, 107, 112, 108, 117, 103};

// ── Tiny assert harness ─────────────────────────────────────────────────────

static int failures = 0, ran = 0;

static void ok(bool cond, const std::string& what) {
    ++ran;
    if (cond) printf("  PASS  %s\n", what.c_str());
    else { ++failures; printf("  FAIL  %s\n", what.c_str()); }
}

static std::string get_str(const ATTR_MAP& m, const std::string& key) {
    for (const auto& kv : m) if (kv.first == key) return std::get<std::string>(kv.second);
    return "<absent>";
}
static uint64_t get_u64(const ATTR_MAP& m, const std::string& key) {
    for (const auto& kv : m) if (kv.first == key) return std::get<uint64_t>(kv.second);
    return UINT64_MAX;
}
static bool has(const ATTR_MAP& m, const std::string& key) {
    for (const auto& kv : m) if (kv.first == key) return true;
    return false;
}

int main() {
    printf("\n1. decode real on-chain bytes\n");
    ATTR_MAP ember = aa_decode_map(ASSET_EMBER, FORMAT);
    ok(get_str(ember, "name") == "Ember Queen", "asset 1099603751834 name == \"Ember Queen\"");
    ok(std::get<uint32_t>(ember[0].second) == 1, "stage decodes as uint32 1");
    ok(get_u64(ember, "growth") == 811856500, "growth decodes as uint64 811856500");
    ok(get_str(aa_decode_map(ASSET_SPARK, FORMAT), "name") == "Sparkplug",
       "asset 1099603752017 name == \"Sparkplug\"");

    printf("\n2. decode -> encode is byte-identical (decoder loses nothing)\n");
    ok(aa_encode_map(ember, FORMAT) == ASSET_EMBER, "Ember Queen round trip");
    ok(aa_encode_map(aa_decode_map(ASSET_SPARK, FORMAT), FORMAT) == ASSET_SPARK, "Sparkplug round trip");

    printf("\n3. evolve() keeps the player's name (the reported bug)\n");
    {
        ATTR_MAP m = aa_decode_map(ASSET_EMBER, FORMAT);
        aa_set_attr(m, "stage",  ATOM_ATTR((uint32_t)2));
        aa_set_attr(m, "growth", ATOM_ATTR((uint64_t)999000));
        ATTR_MAP after = aa_decode_map(aa_encode_map(m, FORMAT), FORMAT);
        ok(get_str(after, "name") == "Ember Queen", "name survives evolve");
        ok(std::get<uint32_t>(after[0].second) == 2, "stage advanced to 2");
        ok(get_u64(after, "growth") == 999000, "growth written");
    }
    {
        // What the old code did, for contrast: a fresh {stage,growth} map.
        ATTR_MAP rebuilt = {{"stage", ATOM_ATTR((uint32_t)2)}, {"growth", ATOM_ATTR((uint64_t)999000)}};
        ok(!has(aa_decode_map(aa_encode_map(rebuilt, FORMAT), FORMAT), "name"),
           "regression witness: rebuilding the map DOES drop the name");
    }

    printf("\n4. setname() keeps a bought cosmetic\n");
    {
        ATTR_MAP m = aa_decode_map(ASSET_EMBER, FORMAT);
        aa_set_attr(m, "cosmetic", ATOM_ATTR((uint64_t)77));       // player equips a hat
        aa_set_attr(m, "name",     ATOM_ATTR(std::string("Blaze"))); // then renames
        ATTR_MAP after = aa_decode_map(aa_encode_map(m, FORMAT), FORMAT);
        ok(get_u64(after, "cosmetic") == 77, "cosmetic survives rename");
        ok(get_str(after, "name") == "Blaze", "new name written");
    }

    printf("\n5. equipcosmetic() keeps the name\n");
    {
        ATTR_MAP m = aa_decode_map(ASSET_EMBER, FORMAT);
        aa_set_attr(m, "cosmetic", ATOM_ATTR((uint64_t)5));
        ATTR_MAP after = aa_decode_map(aa_encode_map(m, FORMAT), FORMAT);
        ok(get_str(after, "name") == "Ember Queen", "name survives equipcosmetic");
        ok(get_u64(after, "cosmetic") == 5, "cosmetic written");
    }

    printf("\n6. setname('') clears the name and nothing else\n");
    {
        ATTR_MAP m = aa_decode_map(ASSET_EMBER, FORMAT);
        aa_set_attr(m, "cosmetic", ATOM_ATTR((uint64_t)9));
        aa_erase_attr(m, "name");
        ATTR_MAP after = aa_decode_map(aa_encode_map(m, FORMAT), FORMAT);
        ok(!has(after, "name"), "name attribute removed");
        ok(get_u64(after, "cosmetic") == 9, "cosmetic untouched");
        ok(get_u64(after, "growth") == 811856500, "growth untouched");
    }

    printf("\n7. UTF-8 names survive the byte stream (32-BYTE cap, not 32 chars)\n");
    {
        const std::string thai = "\xe0\xb9\x80\xe0\xb8\x88\xe0\xb9\x89\xe0\xb8\xb2\xe0\xb9\x84\xe0\xb8\x9f"; // เจ้าไฟ
        ATTR_MAP m = aa_decode_map(ASSET_EMBER, FORMAT);
        aa_set_attr(m, "name", ATOM_ATTR(thai));
        ok(get_str(aa_decode_map(aa_encode_map(m, FORMAT), FORMAT), "name") == thai,
           "Thai name round trips byte-exact");
        ok(thai.size() == 18, "เจ้าไฟ is 6 chars but 18 bytes — why the UI must cap bytes");
    }

    printf("\n8. malformed input is rejected, never half-decoded\n");
    {
        bool threw = false;
        try { aa_decode_map({7, 40, 65}, FORMAT); } catch (const std::exception&) { threw = true; }
        ok(threw, "truncated string attribute throws");

        threw = false;
        try { aa_decode_map({99, 1}, FORMAT); } catch (const std::exception&) { threw = true; }
        ok(threw, "attribute id outside the schema format throws");
    }

    printf("\n%d/%d passed\n", ran - failures, ran);
    return failures ? 1 : 0;
}
