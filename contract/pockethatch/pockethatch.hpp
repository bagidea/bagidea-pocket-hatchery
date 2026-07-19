#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <eosio/crypto.hpp>
#include <string>
#include <vector>

using namespace eosio;

// ─── Minimal AtomicAssets types for inline actions ──────────────────────

// ATOM_ATTR / ATTR_MAP + the mutable-data decoder live here so the decode path
// can also be compiled and tested natively (see test/test_mutdata.cpp). Include
// after `using namespace eosio;` — the header calls check() unqualified.
#include "aa_mutdata.hpp"

// The anti-cheat predicates (satiety gate, cosmetic id range, burn quote) — pure
// arithmetic, kept out of the actions so test/test_anticheat.cpp can pin them
// down exactly. See ph_rules.hpp.
#include "ph_rules.hpp"

// ─── AtomicAssets table row (for reading asset_id after mint) ───────────
// MUST match the on-chain atomicassets `assets_s` row EXACTLY. Live-verified
// against the deployed atomicassets ABI (WAX testnet): the last two fields are
// stored as OPAQUE serialized byte blobs (immutable_serialized_data /
// mutable_serialized_data : uint8[]), NOT decoded ATTR_MAPs. Declaring them
// ATTR_MAP made resolve_new_asset() deserialize raw bytes as a variant map →
// "datastream read past end" on every firsthatch/hatch → tx reverted → mint
// rolled back → creatures table stayed empty. We never decode these fields
// (resolve_new_asset only reads collection_name + asset_id), so raw bytes are
// both correct and sufficient.
struct aa_asset_row {
    uint64_t    asset_id;
    name        collection_name;
    name        schema_name;
    int32_t     template_id;
    name        ram_payer;
    std::vector<asset> backed_tokens;
    std::vector<uint8_t> immutable_serialized_data;
    std::vector<uint8_t> mutable_serialized_data;

    uint64_t primary_key() const { return asset_id; }
};
typedef multi_index<"assets"_n, aa_asset_row> aa_assets_t;

// ─── AtomicAssets global config singleton (for predicting the next asset_id) ──
// atomicassets `config` (scope=atomicassets) — live-verified struct order against
// the deployed ABI: asset_counter, template_counter, offer_counter, then two
// vectors we never read. mintasset assigns the NEW asset its id = the CURRENT
// asset_counter value, then increments the counter. So the id of the asset a
// mintasset we are about to dispatch will receive == asset_counter read
// immediately BEFORE dispatch. We only need asset_counter, but the whole struct
// must match for the singleton to deserialize.
struct aa_config_row {
    uint64_t             asset_counter;
    int32_t              template_counter;
    uint64_t             offer_counter;
    // collection_format + supported_tokens follow on chain; we never read them,
    // but singleton deserializes the full row, so keep placeholders matching the
    // ABI (FORMAT[] = pair<string,string>[]; extended_symbol[]).
    std::vector<std::pair<std::string, std::string>> collection_format;
    std::vector<extended_symbol>                     supported_tokens;
};
typedef singleton<"config"_n, aa_config_row> aa_config_t;

// ─── AtomicAssets schema row (for MERGING mutable data instead of clobbering it) ──
// `setassetdata` REPLACES the whole mutable map — it is not a patch. To keep the
// attributes an action doesn't own (a player's `name`, a bought `cosmetic`) we
// have to read the asset's current mutable_serialized_data back and re-emit it.
// Those bytes carry no type tags: each attribute is [varuint id][value], and the
// value's encoding is only knowable from the collection's schema `format`, which
// lives here (scope = collection_name). FORMAT on chain is {string name; string
// type;} — wire-identical to pair<string,string>, same trick as collection_format.
struct aa_schema_row {
    name      schema_name;
    AA_FORMAT format;

    uint64_t primary_key() const { return schema_name.value; }
};
typedef multi_index<"schemas"_n, aa_schema_row> aa_schemas_t;

// ─── AtomicAssets template row (anti-cheat: cosmetic whitelist) ─────────
// `equipcosmetic` used to trust whatever uint64 the player sent, so anyone
// could wear a costume that does not exist in the game. We now look the
// template up in atomicassets `templates` (scope = collection) and require it
// to live in the cosmetic schema. Live-verified against the deployed
// atomicassets ABI: template_id is **int32**, and the trailing immutable blob
// is opaque bytes (never an ATTR_MAP — see aa_asset_row for why that matters).
struct aa_template_row {
    int32_t              template_id;
    name                 schema_name;
    bool                 transferable;
    bool                 burnable;
    uint32_t             max_supply;
    uint32_t             issued_supply;
    std::vector<uint8_t> immutable_serialized_data;

    // Same cast atomicassets itself uses — the key must match byte-for-byte
    // or find() silently misses.
    uint64_t primary_key() const { return (uint64_t)template_id; }
};
typedef multi_index<"templates"_n, aa_template_row> aa_templates_t;

// ─── Inline action wrappers ─────────────────────────────────────────────

struct aa_mint {
    name          authorized_minter;
    name          collection_name;
    name          schema_name;
    int32_t       template_id;
    name          new_asset_owner;
    ATTR_MAP      immutable_data;
    ATTR_MAP      mutable_data;
    std::vector<asset> tokens_to_back;
};

struct aa_setdata {
    name          authorized_editor;
    name          asset_owner;
    uint64_t      asset_id;
    ATTR_MAP      new_mutable_data;
};

struct aa_burn {
    name          asset_owner;
    uint64_t      asset_id;
};

struct token_transfer {
    name          from;
    name          to;
    asset         quantity;
    std::string   memo;
};

struct token_retire {
    asset         quantity;
    std::string   memo;
};

struct token_issue {
    name          to;
    asset         quantity;
    std::string   memo;
};

struct token_create {
    name          issuer;
    asset         maximum_supply;
};

struct token_account {
    asset    balance;
    uint64_t primary_key() const { return balance.symbol.code().raw(); }
};

// ─── Tables ─────────────────────────────────────────────────────────────

struct [[eosio::table("configv3")]] config_row {
    name        token_contract   = "hatchtokens1"_n;
    name        collection       = "phgamecreatr"_n;
    name        schema_name      = "creatures"_n;
    name        fee_account      = "hatchtokens1"_n;
    bool        paused           = false;

    uint64_t    hatch_cost       = 150;     // EGG
    uint64_t    evolve_cost      = 300;     // EGG (× stage+1 in action)
    asset       breed_cost       = asset(50000, symbol("HATCH", 4));  // 5.0000 HATCH
    uint64_t    feed_cost        = 0;       // EGG per feed (v2: free feeding, CEO locked)
    uint64_t    slot_cost        = 500;     // EGG — 4th slot unlock
    uint64_t    cosmetic_cost    = 100;     // EGG — cosmetic reroll
    // Slot-unlock staircase (EGG). slot 7+ = slot_cost_6 × 2^(index-6).
    // ⚠️ ตำแหน่งนี้จงใจ: เดิมเป็น `asset name_cost` (16 B) ซึ่งถูกถอดออก
    // (CEO ล็อก: rename ฟรี) — วาง uint64 สองตัวทับที่เดิมพอดี 8+8=16 B
    // ทุกฟิลด์ตั้งแต่ install_cap_bonus ลงไปจึงมี offset เท่าเดิม แถว configv3
    // เก่าอ่านด้วย struct ใหม่จะเพี้ยนแค่ 2 ฟิลด์นี้ ไม่ลามทั้งแถว
    uint64_t    slot_cost_5      = 1200;    // EGG — 5th slot unlock
    uint64_t    slot_cost_6      = 2500;    // EGG — 6th slot unlock
    uint64_t    install_cap_bonus = 72;     // +72 EGG cap after install

    uint32_t    feed_cd          = 21600;       // 6h cooldown per creature (v2)
    uint32_t    harvest_cd       = 3600;        // 1h cooldown per player
    uint32_t    breed_cd         = 86400;       // 24h cooldown per parent

    uint32_t    feed_daily_cap   = 3;           // feeds/creature/day (v2)
    uint64_t    daily_egg_cap    = 240;         // net EGG/player/day
    uint32_t    offline_cap_h    = 8;           // max offline EGG accrual hours
    uint64_t    tap_egg_cap      = 60;

    uint64_t    feed_boost       = 100;         // growth per feed

    uint16_t    season_index     = 0;
    uint32_t    season_started   = 0;

    name        rng_oracle       = ""_n;        // "" = block entropy (testnet)

    // ── Rarity distribution (auto-roll on hatch) ──
    // Boss-locked testnet tier distribution (weights, NOT %). roll_egg_type()
    // picks the tier by these; species.egg_weight only spreads species WITHIN a
    // tier (uniform → does not change tier odds). 700/250/50 → 70% / 25% / 5%.
    uint16_t    rarity_w_common   = 700;          // common
    uint16_t    rarity_w_uncommon = 250;          // uncommon
    uint16_t    rarity_w_rare     = 50;           // rare
    uint16_t    rarity_w_epic     = 250;          // epic
    uint16_t    rarity_w_legendary= 45;           // legendary
    uint16_t    rarity_w_mythic   = 5;            // mythic

    // ── Burn-creature HATCH payout ──
    asset       burn_base_hatch  = asset(100000, symbol("HATCH", 4));  // 10.0000 HATCH base × stage+rarity multipliers

    // ── Feed economy v2 (satiety / "food timer") ──────────────────────
    // A creature earns EGG only while it is still "fed": one feed grants
    // fed_dur_<rarity> seconds of food. fed_until = creature.last_fed +
    // fed_dur(rarity). satiety% = clamp((fed_until - now)/fed_dur, 0, 1).
    // Rarer creatures stay fed longer AND earn more per fed-hour.
    uint32_t    fed_dur_common   = 172800;     // 48h
    uint32_t    fed_dur_uncommon = 259200;     // 72h
    uint32_t    fed_dur_rare     = 432000;     // 120h (5d)
    uint32_t    fed_dur_epic     = 604800;     // 168h (7d)
    uint32_t    fed_dur_legendary= 864000;     // 240h (10d)
    uint32_t    fed_dur_mythic   = 1209600;    // 336h (14d)
    uint16_t    earn_mult_common    = 10000;   // ×1.00 harvest yield (basis points)
    uint16_t    earn_mult_uncommon  = 11000;   // ×1.10
    uint16_t    earn_mult_rare      = 14000;   // ×1.40
    uint16_t    earn_mult_epic      = 18000;   // ×1.80
    uint16_t    earn_mult_legendary = 24000;   // ×2.40
    uint16_t    earn_mult_mythic    = 33000;   // ×3.30
    uint8_t     cap_scales_rarity  = 1;         // 1 = daily EGG cap ×earn_mult(best owned rarity); 0 = flat cap

    // ── Awaken timer (v2, CEO locked §1.2) ──
    uint32_t    awaken_dur_common    = 3600;     // 1h
    uint32_t    awaken_dur_uncommon  = 5400;     // 1.5h
    uint32_t    awaken_dur_rare      = 7200;     // 2h
    uint32_t    awaken_dur_epic      = 9000;     // 2.5h
    uint32_t    awaken_dur_legendary = 10800;    // 3h
    uint32_t    awaken_dur_mythic    = 10800;    // 3h

    // ── WAX wake (v2, CEO locked §2.2) ──
    name        wax_contract         = "eosio.token"_n;
    asset       wake_cost_common     = asset(300000000, symbol("WAX", 8));     // 3 WAX
    asset       wake_cost_uncommon   = asset(500000000, symbol("WAX", 8));     // 5 WAX
    asset       wake_cost_rare       = asset(1000000000, symbol("WAX", 8));    // 10 WAX
    asset       wake_cost_epic       = asset(2000000000, symbol("WAX", 8));    // 20 WAX
    asset       wake_cost_legendary  = asset(4000000000, symbol("WAX", 8));    // 40 WAX
    asset       wake_cost_mythic     = asset(8000000000, symbol("WAX", 8));    // 80 WAX

    // ── Burn EGG refund — flat per rarity (v2, CEO locked §6.1) ──
    uint64_t    burn_egg_common     = 8;
    uint64_t    burn_egg_uncommon   = 12;
    uint64_t    burn_egg_rare       = 16;
    uint64_t    burn_egg_epic       = 21;
    uint64_t    burn_egg_legendary  = 26;
    uint64_t    burn_egg_mythic     = 30;
};
typedef singleton<"configv3"_n, config_row> config_t;

struct [[eosio::table("spccfgv2")]] species_row {
    uint64_t    template_id;
    uint64_t    growth_rate;                    // growth-per-second
    uint64_t    thresh_1;                       // G threshold for stage 1
    uint64_t    thresh_2;                       // G threshold for stage 2
    uint64_t    thresh_3;                       // G threshold for stage 3
    uint64_t    thresh_4;                       // G threshold for stage 4
    uint64_t    thresh_5;                       // G threshold for stage 5
    uint64_t    yield_0;                        // EGG/hr gross ×10^4 for stage 0 (Hatchling)
    uint64_t    yield_1;                        // EGG/hr gross ×10^4 for stage 1 (Juvenile)
    uint64_t    yield_2;                        // EGG/hr gross ×10^4 for stage 2 (Adult)
    uint64_t    yield_3;                        // EGG/hr gross ×10^4 for stage 3 (Evolved)
    uint64_t    yield_4;                        // EGG/hr gross ×10^4 for stage 4 (Elder)
    uint64_t    yield_5;                        // EGG/hr gross ×10^4 for stage 5 (Final)
    uint8_t     max_stage;                      // terminal stage (1..6)
    uint16_t    egg_weight;                     // rarity weight in the hatch pool
    uint64_t    egg_type;                       // 0=common,1=uncommon,2=rare,3=epic,4=legendary,5=mythic
    std::string family;

    uint64_t primary_key() const { return template_id; }
    uint64_t by_eggtype() const { return egg_type; }

    uint64_t threshold_for(uint8_t stage) const {
        switch (stage) {
            case 0: return thresh_1;
            case 1: return thresh_2;
            case 2: return thresh_3;
            case 3: return thresh_4;
            case 4: return thresh_5;
            default: return 0;
        }
    }
    uint64_t yield_for(uint8_t idx) const {
        switch (idx) {
            case 0: return yield_0;
            case 1: return yield_1;
            case 2: return yield_2;
            case 3: return yield_3;
            case 4: return yield_4;
            case 5: return yield_5;
            default: return 0;
        }
    }
};
typedef multi_index<
    "spccfgv2"_n, species_row,
    indexed_by<"byeggtype"_n, const_mem_fun<species_row, uint64_t, &species_row::by_eggtype>>
> species_t;

struct [[eosio::table("players")]] player_row {
    name        account;
    uint32_t    created_at;

    uint64_t    egg_balance;                    // EGG internal balance (NOT a token)
    uint32_t    last_harvest;
    uint32_t    harvest_day;
    uint64_t    egg_harvested_today;

    uint32_t    feeds_today;
    uint32_t    feed_day;

    uint64_t    total_egg_farmed;
    uint64_t    total_hatch_burned;

    uint64_t primary_key() const { return account.value; }
};
typedef multi_index<"players"_n, player_row> players_t;

// Per-player claim reward state (separate table to avoid player_row migration)
struct [[eosio::table("claims")]] claim_row {
    name        account;
    uint32_t    last_claimed   = 0;
    uint16_t    claimed_season = 0;
    uint64_t primary_key() const { return account.value; }
};
typedef multi_index<"claims"_n, claim_row> claims_t;

struct [[eosio::table("creatrsv2")]] creature_row {
    uint64_t    asset_id;
    name        owner;
    uint64_t    template_id;
    uint8_t     stage;
    uint64_t    growth_base;
    uint64_t    fed_growth;
    uint32_t    born_at;
    uint32_t    last_sync;
    uint32_t    last_fed;
    uint32_t    last_bred;
    checksum256 genetics;

    uint64_t primary_key() const { return asset_id; }
    uint64_t by_owner() const { return owner.value; }
};
typedef multi_index<
    "creatrsv2"_n, creature_row,
    indexed_by<"byowner"_n, const_mem_fun<creature_row, uint64_t, &creature_row::by_owner>>
> creatures_t;

struct [[eosio::table("lastmint")]] last_mint_row {
    uint64_t asset_id = 0;
    name     owner;
};
typedef singleton<"lastmint"_n, last_mint_row> last_mint_t;

struct [[eosio::table("rewardpool")]] rewardpool_row {
    asset       balance;                        // HATCH currently available for payouts
    asset       bootstrap_total;                // fixed bootstrap allocation
    uint64_t    bootstrap_released;
    uint32_t    last_release;
    asset       lifetime_funded;
    asset       lifetime_paid;
};
typedef singleton<"rewardpool"_n, rewardpool_row> rewardpool_t;

// ─── Contract class ─────────────────────────────────────────────────────

class [[eosio::contract("pockethatch")]] pockethatch : public contract {
public:
    using contract::contract;

    // ── Gameplay actions (player-auth) ──────────────────────────

    [[eosio::action]] void initplayer(name owner);
    [[eosio::action]] void hatch(name owner, uint64_t egg_type);
    [[eosio::action]] void feed(name owner, uint64_t asset_id);
    [[eosio::action]] void evolve(name owner, uint64_t asset_id);
    [[eosio::action]] void harvest(name owner);
    [[eosio::action]] void claimreward(name owner);
    [[eosio::action]] void breed(name owner, uint64_t parent_a, uint64_t parent_b);
    [[eosio::action]] void accelerate(name owner, uint64_t asset_id, asset amount);
    [[eosio::action]] void setname(name owner, uint64_t asset_id, const std::string& new_name);
    [[eosio::action]] void firsthatch(name owner, uint64_t egg_type);
    [[eosio::action]] void unlockslot(name owner, uint8_t slot_index);
    [[eosio::action]] void equipcosmetic(name owner, uint64_t asset_id, uint64_t cosmetic_tmpl);
    [[eosio::action]] void burncreature(name owner, uint64_t asset_id);

    // ── Admin actions (contract-auth) ───────────────────────────

    [[eosio::action]] void setconfig(const config_row& cfg);
    [[eosio::action]] void setspecies(const species_row& sp);
    [[eosio::action]] void rmspecies(uint64_t template_id);
    [[eosio::action]] void setpaused(bool paused);
    [[eosio::action]] void clearconfig();
    [[eosio::action]] void clearpool();
    [[eosio::action]] void clearspecies();
    [[eosio::action]] void newseason(asset bootstrap_release);
    [[eosio::action]] void fundpool(asset amount, const std::string& source);
    [[eosio::action]] void withdraw(name token_contract, asset quantity, name to, const std::string& memo);

    // ── Notification ────────────────────────────────────────────

    [[eosio::on_notify("atomicassets::logmint")]]
    void on_logmint(
        uint64_t asset_id,
        name authorized_minter,
        name collection_name,
        name schema_name,
        int32_t template_id,
        name new_asset_owner,
        ATTR_MAP immutable_data,
        ATTR_MAP mutable_data,
        std::vector<asset> backed_tokens);

    [[eosio::on_notify("atomicassets::transfer")]]
    void on_assets_transfer(
        name from,
        name to,
        std::vector<uint64_t> asset_ids,
        const std::string& memo);

    [[eosio::on_notify("eosio.token::transfer")]]
    void on_wax_transfer(name from, name to, asset quantity, std::string memo);

private:
    void ensure_player(name owner);
    void reset_daily_if_new_day(player_row& p, uint32_t now);
    void sync(creature_row& c, const species_row& sp, uint32_t now);
    uint64_t current_growth(const creature_row& c, const species_row& sp, uint32_t now) const;
    uint8_t stage_for_growth(uint64_t g, const species_row& sp) const;
    // ── Feed economy v2 helpers ──
    uint32_t fed_duration_for(const config_row& cfg, uint64_t egg_type) const;  // seconds a feed lasts, by rarity
    uint16_t earn_mult_for(const config_row& cfg, uint64_t egg_type) const;     // harvest yield multiplier (bp), by rarity
    uint32_t awaken_duration_for(const config_row& cfg, uint64_t egg_type) const; // awaken timer (s), by rarity
    asset    wake_cost_for(const config_row& cfg, uint64_t egg_type) const;       // WAX wake cost, by rarity
    uint64_t burn_egg_for(const config_row& cfg, uint64_t egg_type) const;        // flat EGG refund on burn, by rarity
    void burn_hatch(name from, const asset& amount, const std::string& memo);
    void fund_pool(const asset& amount, const std::string& source);
    uint64_t make_seed() const;
    checksum256 make_genetics(uint64_t seed) const;
    uint64_t pick_template(uint64_t egg_type) const;
    uint64_t roll_egg_type() const;
    uint64_t resolve_new_asset(name owner) const;
    uint64_t predict_asset_id() const;
    uint64_t mint_creature(name owner, uint64_t template_id, const checksum256& genetics, uint32_t born_at);
    bool nft_exists(name collection, name owner, uint64_t asset_id) const;
    // Current mutable map of an asset, ready to edit + hand back to setassetdata
    // (see aa_mutdata.hpp for why every write has to merge).
    ATTR_MAP read_mutable_data(name collection, name owner, uint64_t asset_id) const;
    asset sweepableHatch() const;

    config_row _cfg() const;
    rewardpool_row _pool() const;
};
