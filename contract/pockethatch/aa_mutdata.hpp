#pragma once

// ─── AtomicAssets mutable-data decode + merge ───────────────────────────
//
// `atomicassets::setassetdata` REPLACES an asset's whole mutable map — it is not
// a patch. So any action that touches one attribute must first read the rest
// back, or it silently deletes them (this is how `evolve` used to wipe a
// player's `name`, and how `setname` used to wipe a bought `cosmetic`).
//
// AtomicAssets stores that map as a tagless byte stream: attributes sit back to
// back as [varuint id][value], where id = schema format index + AA_RESERVED_IDS.
// Nothing is length-prefixed at the attribute level, so a value can only be read
// — or even skipped — once its type is known from the collection's schema.
//
// Header-only and free of eosio includes on purpose: the decode path is pure
// byte handling, so test/test_mutdata.cpp compiles it natively and runs it
// against real on-chain bytes. It calls `check()` unqualified, which resolves to
// eosio::check inside the contract and to the test's shim in the harness.
//
// Mirrors web/src/chain.ts decodeAssetName(), which reads the same bytes client
// side; keep the two in step.

#include <string>
#include <vector>
#include <variant>
#include <cstdint>
#include <cstddef>

// Must match AtomicAssets ATOMIC_ATTRIBUTE order EXACTLY (indices must align)
typedef std::variant<
    int8_t, int16_t, int32_t, int64_t,
    uint8_t, uint16_t, uint32_t, uint64_t,
    float, double, std::string,
    std::vector<int8_t>, std::vector<int16_t>,
    std::vector<int32_t>, std::vector<int64_t>,
    std::vector<uint8_t>, std::vector<uint16_t>,
    std::vector<uint32_t>, std::vector<uint64_t>,
    std::vector<float>, std::vector<double>,
    std::vector<std::string>
> ATOM_ATTR;

typedef std::vector<std::pair<std::string, ATOM_ATTR>> ATTR_MAP;

// AtomicAssets reserves attribute ids 0-3, so schema format index N is written
// on the wire as N + 4.
static constexpr uint64_t AA_RESERVED_IDS = 4;

inline uint64_t aa_read_varuint(const std::vector<uint8_t>& b, size_t& i) {
    uint64_t value = 0;
    uint8_t  shift = 0;
    for (;;) {
        check(i < b.size(), "truncated NFT attribute");
        uint8_t byte = b[i++];
        value |= (uint64_t)(byte & 0x7F) << shift;
        if ((byte & 0x80) == 0) return value;
        shift += 7;
        check(shift < 64, "malformed NFT attribute varint");
    }
}

// Decodes one value AND rebuilds it as the variant alternative the schema type
// declares. The alternative matters: atomicassets' serialize() picks the encoder
// from the schema type and std::get<>s that exact alternative back out, so
// handing it a uint64 where the schema says uint32 aborts the transaction.
inline ATOM_ATTR aa_read_value(const std::string& type,
                               const std::vector<uint8_t>& b, size_t& i)
{
    if (type == "string" || type == "image") {
        uint64_t len = aa_read_varuint(b, i);
        check(i + (size_t)len <= b.size(), "truncated NFT string attribute");
        std::string s((const char*)b.data() + i, (size_t)len);
        i += (size_t)len;
        return ATOM_ATTR(s);
    }
    if (type == "uint64") return ATOM_ATTR((uint64_t)aa_read_varuint(b, i));
    if (type == "uint32") return ATOM_ATTR((uint32_t)aa_read_varuint(b, i));
    if (type == "uint16") return ATOM_ATTR((uint16_t)aa_read_varuint(b, i));
    if (type == "uint8")  return ATOM_ATTR((uint8_t)aa_read_varuint(b, i));
    // Fail loud rather than silently dropping an attribute we can't re-emit —
    // dropping is exactly the data loss this file exists to prevent. Only our
    // own actions ever write mutable data on this collection, and they stay
    // inside the types above.
    check(false, "unsupported NFT attribute type: " + type);
    return ATOM_ATTR((uint64_t)0);
}

// FORMAT on chain is {string name; string type;} — wire-identical to a pair.
typedef std::vector<std::pair<std::string, std::string>> AA_FORMAT;

/** Decode a whole mutable_serialized_data blob into an editable ATTR_MAP. */
inline ATTR_MAP aa_decode_map(const std::vector<uint8_t>& bytes, const AA_FORMAT& format) {
    ATTR_MAP out;
    size_t i = 0;
    while (i < bytes.size()) {
        uint64_t id = aa_read_varuint(bytes, i);
        check(id >= AA_RESERVED_IDS && (id - AA_RESERVED_IDS) < format.size(),
              "NFT attribute id outside the schema format");
        const auto& field = format[id - AA_RESERVED_IDS];
        out.push_back({field.first, aa_read_value(field.second, bytes, i)});
    }
    return out;
}

/** Overwrite the attribute if present, otherwise append it. */
inline void aa_set_attr(ATTR_MAP& m, const std::string& key, const ATOM_ATTR& value) {
    for (auto& kv : m) {
        if (kv.first == key) { kv.second = value; return; }
    }
    m.push_back({key, value});
}

/** Drop the attribute entirely (how `setname ''` clears a name). */
inline void aa_erase_attr(ATTR_MAP& m, const std::string& key) {
    for (auto it = m.begin(); it != m.end(); ++it) {
        if (it->first == key) { m.erase(it); return; }
    }
}
