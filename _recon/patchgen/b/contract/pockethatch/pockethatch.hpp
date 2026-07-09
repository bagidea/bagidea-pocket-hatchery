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
    name        collection       = "pockethatch1"_n;
    name        schema_name      = "creatures"_n;
    name        fee_account      = "hatchtokens1"_n;
    bool        paused           = false;

    uint64_t    hatch_cost       = 150;     // EGG
    uint64_t    evolve_cost      = 300;     // EGG (× stage+1 in action)
    asset       breed_cost       = asset(50000, symbol("HATCH", 4));  // 5.0000 HATCH
    uint64_t    feed_cost        = 12;      // EGG per feed (v2 — feeding now matters)
    uint64_t    slot_cost        = 500;     // EGG — 4th slot unlock
    uint64_t    cosmetic_cost    = 100;     // EGG — cosmetic reroll
    asset       name_cost        = asset(10000, symbol("HATCH", 4));  // 1.0000 HATCH rename
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
    // tier (uniform → does not change tier odds). 100/65/22 → ~53.2% / 34.6% / 11.7%.
    uint16_t    rarity_w_common  = 100;          // common
    uint16_t    rarity_w_uncommon= 65;           // uncommon
    uint16_t    rarity_w_rare    = 22;           // rare

    // ── Burn-creature HATCH payout ──
    asset       burn_base_hatch  = asset(100000, symbol("HATCH", 4));  // 10.0000 HATCH base × stage+rarity multipliers

    // ── Feed economy v2 (satiety / "food timer") ──────────────────────
    // A creature earns EGG only while it is still "fed": one feed grants
    // fed_dur_<rarity> seconds of food. fed_until = creature.last_fed +
    // fed_dur(rarity). satiety% = clamp((fed_until - now)/fed_dur, 0, 1).
    // Rarer creatures stay fed longer AND earn more per fed-hour.
    uint32_t    fed_dur_common   = 172800;      // 48h  — full→empty decay window
    uint32_t    fed_dur_uncommon = 259200;      // 72h
    uint32_t    fed_dur_rare     = 432000;      // 120h — rare stays fed 2.5× longer
    uint16_t    earn_mult_common   = 10000;     // ×1.00 harvest yield (basis points)
    uint16_t    earn_mult_uncommon = 15000;     // ×1.50
    uint16_t    earn_mult_rare     = 25000;     // ×2.50
    uint8_t     cap_scales_rarity  = 1;         // 1 = daily EGG cap ×earn_mult(best owned rarity); 0 = flat cap
};
typedef singleton<"configv3"_n, config_row> config_t;

struct [[eosio::table("speciescfg")]] species_row {
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
    uint64_t    egg_type;                       // 0=common, 1=uncommon, 2=rare
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
    "speciescfg"_n, species_row,
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

struct [[eosio::table("creatures")]] creature_row {
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
    "creatures"_n, creature_row,
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
    // Admin owner reconcile: fix creatures.owner drift vs the real AtomicAssets
    // owner. AA `transfer` notifies only from/to, so user<->user P2P transfers
    // never reach this contract and creatures.owner goes stale; an off-chain
    // watcher (or a one-shot reconcile) calls this with AA-verified asset_ids.
    [[eosio::action]] void syncowner(std::vector<uint64_t> asset_ids, name new_owner);
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

private:
    void ensure_player(name owner);
    void reset_daily_if_new_day(player_row& p, uint32_t now);
    void sync(creature_row& c, const species_row& sp, uint32_t now);
    uint64_t current_growth(const creature_row& c, const species_row& sp, uint32_t now) const;
    uint8_t stage_for_growth(uint64_t g, const species_row& sp) const;
    // ── Feed economy v2 helpers ──
    uint32_t fed_duration_for(const config_row& cfg, uint64_t egg_type) const;  // seconds a feed lasts, by rarity
    uint16_t earn_mult_for(const config_row& cfg, uint64_t egg_type) const;     // harvest yield multiplier (bp), by rarity
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
    asset sweepableHatch() const;

    config_row _cfg() const;
    rewardpool_row _pool() const;
};
