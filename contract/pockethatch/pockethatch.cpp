#include "pockethatch.hpp"
#include <eosio/action.hpp>
#include <eosio/transaction.hpp>

#define DAY_SEC   86400
#define MAX_GROWTH (UINT64_MAX / 2)
#define HATCH_SYM  symbol("HATCH", 4)

// Schema inside cfg.collection that holds wearable cosmetics. Hardcoded on
// purpose: putting it in config_row would grow the row, and the configv3 byte
// layout was just proven field-by-field against the live chain — not worth the
// risk for one name. Move it into config the next time the row changes anyway.
#define COSMETIC_SCHEMA "cosmetics"_n

// ─── Internal helpers ───────────────────────────────────────────────────

static std::string attr_hex(const checksum256& cs) {
    auto d = cs.extract_as_byte_array();
    const char* hex = "0123456789abcdef";
    std::string s(64, '0');
    for (int i = 0; i < 32; ++i) {
        s[i*2]     = hex[(d[i] >> 4) & 0xF];
        s[i*2 + 1] = hex[d[i] & 0xF];
    }
    return s;
}

config_row pockethatch::_cfg() const {
    config_t ct(get_self(), get_self().value);
    return ct.get_or_default();
}

rewardpool_row pockethatch::_pool() const {
    rewardpool_t pt(get_self(), get_self().value);
    auto p = pt.get_or_default();
    if (p.balance.symbol != HATCH_SYM)          p.balance          = asset(0, HATCH_SYM);
    if (p.bootstrap_total.symbol != HATCH_SYM)  p.bootstrap_total  = asset(0, HATCH_SYM);
    if (p.lifetime_funded.symbol != HATCH_SYM)  p.lifetime_funded  = asset(0, HATCH_SYM);
    if (p.lifetime_paid.symbol != HATCH_SYM)    p.lifetime_paid    = asset(0, HATCH_SYM);
    return p;
}

void pockethatch::ensure_player(name owner) {
    players_t ps(get_self(), get_self().value);
    auto it = ps.find(owner.value);
    if (it == ps.end()) {
        ps.emplace(owner, [&](auto& r) {
            r.account              = owner;
            r.created_at           = current_time_point().sec_since_epoch();
            r.egg_balance          = 200;  // starter EGG for first hatch (bypass firsthatch crash)
            r.last_harvest         = current_time_point().sec_since_epoch();
            r.harvest_day          = current_time_point().sec_since_epoch() / DAY_SEC;
            r.egg_harvested_today  = 0;
            r.feeds_today          = 0;
            r.feed_day             = current_time_point().sec_since_epoch() / DAY_SEC;
            r.total_egg_farmed     = 0;
            r.total_hatch_burned   = 0;
            // r.last_claimed = 0; // moved to claims table
            // r.claimed_season = 0; // moved to claims table
        });
    }
}

void pockethatch::reset_daily_if_new_day(player_row& p, uint32_t now) {
    uint32_t today = now / DAY_SEC;
    if (today != p.harvest_day) {
        p.egg_harvested_today = 0;
        p.harvest_day = today;
    }
    if (today != p.feed_day) {
        p.feeds_today = 0;
        p.feed_day = today;
    }
}

void pockethatch::sync(creature_row& c, const species_row& sp, uint32_t now) {
    check(now >= c.last_sync, "time went backwards");
    uint32_t dt = now - c.last_sync;
    if (dt == 0) return;
    uint64_t delta = (uint64_t)dt * sp.growth_rate;
    check(c.growth_base <= MAX_GROWTH - delta, "growth overflow");
    c.growth_base += delta;
    c.last_sync = now;
}

uint64_t pockethatch::current_growth(const creature_row& c, const species_row& sp, uint32_t now) const {
    if (now <= c.last_sync) return c.growth_base + c.fed_growth;
    uint32_t dt = now - c.last_sync;
    return c.growth_base + c.fed_growth + (uint64_t)dt * sp.growth_rate;
}

uint8_t pockethatch::stage_for_growth(uint64_t g, const species_row& sp) const {
    for (uint8_t i = sp.max_stage; i >= 1; --i) {
        if (i <= 5 && g >= sp.threshold_for(static_cast<uint8_t>(i - 1))) return i;
    }
    return 0;
}

// ── Feed economy v2 — how long one feed keeps a creature fed (by rarity) ──
uint32_t pockethatch::fed_duration_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.fed_dur_uncommon;
        case 2:  return cfg.fed_dur_rare;
        case 3:  return cfg.fed_dur_epic;
        case 4:  return cfg.fed_dur_legendary;
        case 5:  return cfg.fed_dur_mythic;
        default: return cfg.fed_dur_common;   // 0 = common
    }
}

// ── Feed economy v2 — harvest yield multiplier (basis points) by rarity ──
uint16_t pockethatch::earn_mult_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.earn_mult_uncommon;
        case 2:  return cfg.earn_mult_rare;
        case 3:  return cfg.earn_mult_epic;
        case 4:  return cfg.earn_mult_legendary;
        case 5:  return cfg.earn_mult_mythic;
        default: return cfg.earn_mult_common; // 0 = common
    }
}

// ── Awaken v2 — how long a creature must sleep before auto-awakening (by rarity) ──
uint32_t pockethatch::awaken_duration_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.awaken_dur_uncommon;
        case 2:  return cfg.awaken_dur_rare;
        case 3:  return cfg.awaken_dur_epic;
        case 4:  return cfg.awaken_dur_legendary;
        case 5:  return cfg.awaken_dur_mythic;
        default: return cfg.awaken_dur_common;
    }
}

// ── WAX wake v2 — WAX cost to skip awaken timer (by rarity) ──
asset pockethatch::wake_cost_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.wake_cost_uncommon;
        case 2:  return cfg.wake_cost_rare;
        case 3:  return cfg.wake_cost_epic;
        case 4:  return cfg.wake_cost_legendary;
        case 5:  return cfg.wake_cost_mythic;
        default: return cfg.wake_cost_common;
    }
}

// ── Burn EGG v2 — flat EGG refund on burn (by rarity, CEO locked §6.1) ──
uint64_t pockethatch::burn_egg_for(const config_row& cfg, uint64_t egg_type) const {
    switch (egg_type) {
        case 1:  return cfg.burn_egg_uncommon;
        case 2:  return cfg.burn_egg_rare;
        case 3:  return cfg.burn_egg_epic;
        case 4:  return cfg.burn_egg_legendary;
        case 5:  return cfg.burn_egg_mythic;
        default: return cfg.burn_egg_common;
    }
}

void pockethatch::burn_hatch(name from, const asset& amount, const std::string& memo) {
    if (amount.amount == 0) return;
    config_row cfg = _cfg();

    // Inline transfer: player → this contract
    action(
        permission_level{from, "active"_n},
        cfg.token_contract,
        "transfer"_n,
        token_transfer{from, get_self(), amount, memo}
    ).send();

    // HATCH stays in contract as locked escrow (issuer != this contract,
    // so retire not available; HATCH is effectively burnt by being
    // permanently removed from circulation and guarded behind the
    // reward-pool invariant in withdraw/claimreward).
    fund_pool(amount, memo);

    // Track lifetime burn stat
    players_t ps(get_self(), get_self().value);
    auto pit = ps.find(from.value);
    if (pit != ps.end()) {
        ps.modify(pit, same_payer, [&](auto& r) {
            r.total_hatch_burned += (uint64_t)amount.amount;
        });
    }
}

void pockethatch::fund_pool(const asset& amount, const std::string& source) {
    if (amount.amount == 0) return;
    rewardpool_t pt(get_self(), get_self().value);
    auto pool = _pool();
    pool.balance += amount;
    pool.lifetime_funded += amount;
    pt.set(pool, get_self());
}

uint64_t pockethatch::make_seed() const {
    uint64_t now = current_time_point().sec_since_epoch();
    uint64_t prefix = tapos_block_prefix();
    uint64_t num   = tapos_block_num();

    // Mix with transaction hash
    auto size = transaction_size();
    char tx_buf[size];
    read_transaction(tx_buf, size);
    checksum256 tx_hash = sha256(tx_buf, size);
    auto* words = (const uint64_t*)tx_hash.extract_as_byte_array().data();

    return words[0] ^ words[1] ^ words[2] ^ words[3]
         ^ prefix ^ num ^ now;
}

checksum256 pockethatch::make_genetics(uint64_t seed) const {
    // xorshift64* mixer
    uint64_t x = seed ^ 0xdeadbeefcafebabeULL;
    x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
    uint64_t y = x * 0x2545F4914F6CDD1DULL;
    y ^= y >> 33; y *= 0xFF51AFD7ED558CCDULL; y ^= y >> 33;

    checksum256 g;
    auto arr = g.extract_as_byte_array();
    uint64_t* w = (uint64_t*)arr.data();

    w[0] = seed;
    w[1] = y;
    w[2] = seed ^ y ^ 0x5F1A3B2C9D4E6F08ULL;
    w[3] = y ^ 0x7A3B1C4D5E6F7089ULL;

    // pack back into checksum256
    return checksum256(arr);
}

uint64_t pockethatch::pick_template(uint64_t egg_type) const {
    species_t sps(get_self(), get_self().value);
    auto idx = sps.get_index<"byeggtype"_n>();

    uint64_t total_weight = 0;
    for (auto it = idx.lower_bound(egg_type); it != idx.end() && it->egg_type == egg_type; ++it) {
        total_weight += it->egg_weight;
    }
    check(total_weight > 0, "no species for this egg type");

    uint64_t roll = make_seed() % total_weight;
    uint64_t cumulative = 0;
    for (auto it = idx.lower_bound(egg_type); it != idx.end() && it->egg_type == egg_type; ++it) {
        cumulative += it->egg_weight;
        if (roll < cumulative) return it->template_id;
    }

    auto first = idx.lower_bound(egg_type);
    check(first != idx.end() && first->egg_type == egg_type, "no species found");
    return first->template_id;
}

uint64_t pockethatch::roll_egg_type() const {
    config_row cfg = _cfg();
    uint64_t total = (uint64_t)cfg.rarity_w_common
                   + (uint64_t)cfg.rarity_w_uncommon
                   + (uint64_t)cfg.rarity_w_rare
                   + (uint64_t)cfg.rarity_w_epic
                   + (uint64_t)cfg.rarity_w_legendary
                   + (uint64_t)cfg.rarity_w_mythic;
    if (total == 0) return 0; // safety: common-only if all weights zero
    uint64_t roll = make_seed() % total;
    uint64_t acc = 0;
    acc += cfg.rarity_w_common;       if (roll < acc) return 0;
    acc += cfg.rarity_w_uncommon;     if (roll < acc) return 1;
    acc += cfg.rarity_w_rare;         if (roll < acc) return 2;
    acc += cfg.rarity_w_epic;         if (roll < acc) return 3;
    acc += cfg.rarity_w_legendary;    if (roll < acc) return 4;
    return 5; // mythic
}

uint64_t pockethatch::resolve_new_asset(name owner) const {
    // After minting via inline AtomicAssets::mintasset, read the latest asset for this owner.
    // The newly minted asset has the highest asset_id among this owner's assets.
    config_row cfg = _cfg();
    aa_assets_t aa("atomicassets"_n, owner.value);
    uint64_t newest = 0;
    for (auto it = aa.begin(); it != aa.end(); ++it) {
        if (it->collection_name == cfg.collection && it->asset_id > newest) {
            newest = it->asset_id;
        }
    }
    check(newest > 0, "failed to resolve minted asset_id");
    return newest;
}

uint64_t pockethatch::predict_asset_id() const {
    // The reliable way to know the asset_id an inline mintasset WILL receive:
    // atomicassets assigns each new asset id = the CURRENT global asset_counter,
    // then increments. Read it immediately BEFORE dispatching mintasset and the
    // mint will land on exactly this value.
    //
    // Why not read it back after .send()? An inline action queued with .send()
    // executes AFTER the dispatching action returns — so neither iterating the
    // owner's assets (resolve_new_asset) nor reading the lastmint singleton
    // (fed by the logmint notification) can see THIS mint yet: they return the
    // PREVIOUS mint's id → orphaned NFTs + creatures rows bound to the wrong
    // asset. Prediction is the only correct, single-action approach.
    aa_config_t cfgt("atomicassets"_n, "atomicassets"_n.value);
    check(cfgt.exists(), "atomicassets config not found");
    return cfgt.get().asset_counter;
}

bool pockethatch::nft_exists(name collection, name owner, uint64_t asset_id) const {
    // Verify the NFT asset actually exists on-chain AND still belongs to our collection.
    // Used by evolve/setname/equipcosmetic/burncreature to resiliently skip setassetdata
    // or burnasset when a player's NFT has already been transferred, burned, or lost.
    aa_assets_t aa("atomicassets"_n, owner.value);
    auto it = aa.find(asset_id);
    return (it != aa.end() && it->collection_name == collection);
}

// Read an asset's current mutable map so an action can edit ONE attribute and
// hand the rest straight back (aa_mutdata.hpp explains why that is mandatory).
// The schema lookup is what makes the tagless byte stream readable at all.
ATTR_MAP pockethatch::read_mutable_data(name collection, name owner, uint64_t asset_id) const {
    aa_assets_t aa("atomicassets"_n, owner.value);
    auto a_it = aa.find(asset_id);
    check(a_it != aa.end(), "NFT not found");

    aa_schemas_t schemas("atomicassets"_n, collection.value);
    auto s_it = schemas.find(a_it->schema_name.value);
    check(s_it != schemas.end(), "NFT schema not found");

    return aa_decode_map(a_it->mutable_serialized_data, s_it->format);
}

uint64_t pockethatch::mint_creature(name owner, uint64_t template_id,
                                    const checksum256& genetics, uint32_t born_at)
{
    config_row cfg = _cfg();

    ATTR_MAP immut = {
        {"genetics", ATOM_ATTR(attr_hex(genetics))}
    };
    ATTR_MAP mut = {
        {"stage",  ATOM_ATTR((uint32_t)0)},
        {"growth", ATOM_ATTR((uint64_t)0)}
    };

    // Predict the asset_id BEFORE dispatching the inline mint (see
    // predict_asset_id): the queued mintasset runs after this action, so it can
    // only be known ahead of time, never read back. Prevents orphaned NFTs.
    uint64_t asset_id = predict_asset_id();

    action(
        permission_level{get_self(), "active"_n},
        "atomicassets"_n,
        "mintasset"_n,
        aa_mint{
            get_self(), cfg.collection, cfg.schema_name,
            (int32_t)template_id, owner,
            immut, mut, {}
        }
    ).send();

    creatures_t crs(get_self(), get_self().value);
    crs.emplace(owner, [&](auto& r) {
        r.asset_id    = asset_id;
        r.owner       = owner;
        r.template_id = template_id;
        r.stage       = 0;
        r.growth_base = 0;
        r.fed_growth  = 0;
        r.born_at     = born_at;
        r.last_sync   = born_at;
        r.last_fed    = born_at;   // Feed v2: newborn starts fully fed (fed_until = born_at + fed_dur)
        r.last_bred   = 0;
        r.genetics    = genetics;
    });

    return asset_id;
}

// ─── Gameplay actions ───────────────────────────────────────────────────

void pockethatch::initplayer(name owner) {
    require_auth(owner);
    ensure_player(owner);
}

void pockethatch::hatch(name owner, uint64_t egg_type) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");
    ensure_player(owner);

    // ── RNG: auto-roll rarity tier, then pick species within that tier ──
    // (egg_type parameter from caller is ignored — contract rolls rarity server-side)
    uint64_t rolled_egg_type = roll_egg_type();
    uint64_t template_id = pick_template(rolled_egg_type);
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(template_id);
    check(sp_it != sps.end(), "species not found");

    // ── Deduct EGG cost from player (flat rate — rarity multiplier removed) ──
    uint64_t hatch_egg_cost = cfg.hatch_cost;
    {
        players_t ps(get_self(), get_self().value);
        auto p_it = ps.find(owner.value);
        check(p_it != ps.end(), "player not initialized");
        check(p_it->egg_balance >= hatch_egg_cost, "insufficient EGG to hatch");
        ps.modify(p_it, same_payer, [&](auto& r) {
            r.egg_balance -= hatch_egg_cost;
        });
    }

    // ── Generate genetics with rarity seed ──
    uint64_t seed = make_seed();
    checksum256 genetics = make_genetics(seed);

    // ── Mint via shared helper (no HATCH burn) ──
    uint32_t now = current_time_point().sec_since_epoch();
    mint_creature(owner, template_id, genetics, now);
}

void pockethatch::firsthatch(name owner, uint64_t egg_type) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");
    check(cfg.season_index > 0, "no active season");

    ensure_player(owner);

    // ── Gate: only players with zero creatures ──
    creatures_t crs(get_self(), get_self().value);
    auto idx = crs.get_index<"byowner"_n>();
    auto it = idx.lower_bound(owner.value);
    bool has_creature = (it != idx.end() && it->owner == owner);
    check(!has_creature, "already have a creature — use regular hatch");

    // ── RNG: auto-roll rarity tier, then pick species ──
    uint64_t rolled_egg_type = roll_egg_type();
    uint64_t template_id = pick_template(rolled_egg_type);
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(template_id);
    check(sp_it != sps.end(), "species not found");

    // ── firsthatch is always FREE (zero EGG, zero HATCH) ──

    // ── Generate genetics ──
    uint64_t seed = make_seed();
    checksum256 genetics = make_genetics(seed);

    // ── Mint via shared helper — ZERO cost ──
    uint32_t now = current_time_point().sec_since_epoch();
    mint_creature(owner, template_id, genetics, now);
}

void pockethatch::feed(name owner, uint64_t asset_id) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end(), "creature not found");
    check(c_it->owner == owner, "not your creature");

    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(c_it->template_id);
    check(sp_it != sps.end(), "species not found");

    uint32_t now = current_time_point().sec_since_epoch();

    // ⏱ cooldown guard
    check(now >= c_it->last_fed + cfg.feed_cd, "feed on cooldown");

    // ⏱ daily cap per creature
    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");

    auto p = *p_it;
    reset_daily_if_new_day(p, now);
    ps.modify(p_it, same_payer, [&](auto& r) {
        r.feed_day    = p.feed_day;
        r.feeds_today = p.feeds_today;
    });
    check(p.feeds_today < cfg.feed_daily_cap, "feed daily cap reached");

    // 🔥 deduct feed_cost EGG (0 in v1)
    if (cfg.feed_cost > 0) {
        check(p_it->egg_balance >= cfg.feed_cost, "insufficient EGG to feed");
        ps.modify(p_it, same_payer, [&](auto& r) {
            r.egg_balance -= cfg.feed_cost;
        });
    }

    // Sync growth + apply boost
    auto c = *c_it;
    sync(c, *sp_it, now);
    c.fed_growth += cfg.feed_boost;

    crs.modify(c_it, same_payer, [&](auto& r) {
        r.growth_base = c.growth_base;
        r.last_sync   = c.last_sync;
        r.fed_growth  = c.fed_growth;
        r.last_fed    = now;   // Feed v2: refills satiety to full (fed_until = now + fed_dur(rarity))
    });

    // Increment feed counter
    ps.modify(ps.find(owner.value), same_payer, [&](auto& r) {
        r.feeds_today += 1;
    });
}

void pockethatch::evolve(name owner, uint64_t asset_id) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end(), "creature not found");
    check(c_it->owner == owner, "not your creature");

    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(c_it->template_id);
    check(sp_it != sps.end(), "species not found");

    uint32_t now = current_time_point().sec_since_epoch();

    // ── Feed v2: a hungry creature can't evolve (satiety gate) ──
    check(ph_rules::is_sated(now, c_it->last_fed, fed_duration_for(cfg, sp_it->egg_type)),
          "creature is hungry — feed before evolving");

    // Sync
    auto c = *c_it;
    sync(c, *sp_it, now);
    uint64_t g = c.growth_base + c.fed_growth;
    // 🔧 Use the STORED stage, not stage_for_growth(g). By construction
    // stage_for_growth(g) returns the highest k with g >= threshold_for(k-1),
    // which always satisfies g < threshold_for(k) — so the evolve threshold
    // check `g >= threshold_for(cur_stage)` below would ALWAYS fail and evolve
    // would revert forever (creature stuck on stage 0). The stored stage is the
    // authoritative current stage; growth determines whether we're *ready* to
    // advance, not what stage we're already on.
    uint8_t cur_stage = c.stage;

    // Guard: must have a next stage
    check(cur_stage < sp_it->max_stage, "already max stage");

    // Threshold for stage cur_stage+1 is thresholds[cur_stage]
    uint64_t threshold = sp_it->threshold_for(cur_stage);
    check(g >= threshold, "insufficient growth to evolve");

    // 🔥 Deduct EGG cost × (stage+1)
    uint64_t cost_amount = cfg.evolve_cost * (uint64_t)(cur_stage + 1);
    {
        players_t ps(get_self(), get_self().value);
        auto p_it = ps.find(owner.value);
        check(p_it != ps.end(), "player not initialized");
        check(p_it->egg_balance >= cost_amount, "insufficient EGG to evolve");
        ps.modify(p_it, same_payer, [&](auto& r) {
            r.egg_balance -= cost_amount;
        });
    }

    // Advance stage
    uint8_t new_stage = cur_stage + 1;

    // Update creature row
    crs.modify(c_it, same_payer, [&](auto& r) {
        r.growth_base = c.growth_base;
        r.last_sync   = c.last_sync;
        r.stage       = new_stage;
    });

    // Mirror to NFT (NFT required — reject if not found)
    check(nft_exists(cfg.collection, owner, asset_id), "evolve requires the NFT to be held by player");
    {
        // Merge, never rebuild: setassetdata replaces the whole map, so a fresh
        // {stage,growth} would wipe the player's `name` and their bought
        // `cosmetic` on every evolve.
        ATTR_MAP new_mut = read_mutable_data(cfg.collection, owner, asset_id);
        aa_set_attr(new_mut, "stage",  ATOM_ATTR((uint32_t)new_stage));
        aa_set_attr(new_mut, "growth", ATOM_ATTR(g));
        action(
            permission_level{get_self(), "active"_n},
            "atomicassets"_n,
            "setassetdata"_n,
            aa_setdata{get_self(), owner, asset_id, new_mut}
        ).send();
    }
}

void pockethatch::harvest(name owner) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized — call initplayer first");

    uint32_t now = current_time_point().sec_since_epoch();
    auto p = *p_it;
    reset_daily_if_new_day(p, now);

    // ⏱ harvest cooldown
    check(now >= p.last_harvest + cfg.harvest_cd, "harvest on cooldown");

    // ── Feed v2: earn = time-fed × avg satiety, un-gameable ──────────────
    // Each creature earns only over the sub-window it was ACTUALLY fed AND that
    // falls inside the offline cap:
    //     ws = max(last_harvest, last_fed, now - offline_cap)   we = min(now, fed_until)
    // Starting at max(…, last_fed) means a feed only pays for time AFTER it, so
    // feeding right before harvest yields ZERO retroactive credit (kills the
    // feed-then-harvest exploit). Starting at max(…, now-offline_cap) means food
    // that ran out earlier than the cap window pays nothing (neglect → 0, even
    // though fed_dur ≫ offline_cap). Earn is then scaled by the AVERAGE satiety
    // over [ws,we] (linear 100%→0% across fed_dur) so a hungrier creature earns
    // proportionally less. rarity earn multiplier applied on top.
    creatures_t crs(get_self(), get_self().value);
    auto idx = crs.get_index<"byowner"_n>();
    species_t sps(get_self(), get_self().value);
    uint32_t cap_start = (now > cfg.offline_cap_h * 3600u) ? (now - cfg.offline_cap_h * 3600u) : 0;
    uint64_t gross     = 0;                       // EGG, already rarity + satiety scaled
    uint16_t best_mult = cfg.earn_mult_common;    // richest rarity that actually earned

    // ── Awaken v2: collect ready-to-awaken asset_ids first (avoid modifying
    //    during secondary-index iteration — CDT multi_index spec) ──
    std::vector<uint64_t> awaken_ids;
    for (auto it = idx.lower_bound(owner.value); it != idx.end() && it->owner == owner; ++it) {
        if (it->stage != 0) continue;
        auto sp_it = sps.find(it->template_id);
        if (sp_it == sps.end()) continue;
        uint32_t awaken_dur = awaken_duration_for(cfg, sp_it->egg_type);
        if (now >= it->born_at + awaken_dur) {
            awaken_ids.push_back(it->asset_id);
        }
    }
    for (uint64_t aid : awaken_ids) {
        auto primary = crs.find(aid);
        if (primary != crs.end()) {
            crs.modify(primary, same_payer, [&](auto& r) { r.stage = 1; });
        }
    }

    for (auto it = idx.lower_bound(owner.value); it != idx.end() && it->owner == owner; ++it) {
        auto sp_it = sps.find(it->template_id);
        if (sp_it == sps.end()) continue;

        if (it->stage == 0) continue; // still sleeping (timer not elapsed)
        uint8_t idx_yield = it->stage - 1;        // stage 1→yield[0], etc.
        if (idx_yield >= 6) continue;

        uint32_t fed_dur   = fed_duration_for(cfg, sp_it->egg_type);
        if (fed_dur == 0) continue;
        uint32_t fed_until = it->last_fed + fed_dur;
        uint32_t ws = std::max(std::max(p.last_harvest, it->last_fed), cap_start);
        uint32_t we = std::min(now, fed_until);
        if (we <= ws) continue;                   // out of food across the whole cap window → 0
        uint64_t fed_h = (uint64_t)(we - ws) / 3600ULL;
        if (fed_h == 0) continue;

        // avg satiety over [ws,we] in basis points (100%→0% linearly across fed_dur)
        uint64_t sat_ws = (uint64_t)(fed_until - ws) * 10000ULL / fed_dur;
        uint64_t sat_we = (uint64_t)(fed_until - we) * 10000ULL / fed_dur;
        uint64_t avg_sat = (sat_ws + sat_we) / 2;

        uint16_t mult = earn_mult_for(cfg, sp_it->egg_type);
        if (mult > best_mult) best_mult = mult;
        gross += sp_it->yield_for(idx_yield) * fed_h
               * (uint64_t)mult / 10000ULL
               * avg_sat / 10000ULL;
    }

    // Daily cap guard — optionally scaled by the best owned rarity so the earn
    // multiplier shows through the ceiling (config flag: cap_scales_rarity).
    uint64_t cap = cfg.daily_egg_cap;
    if (cfg.cap_scales_rarity) cap = cap * (uint64_t)best_mult / 10000ULL;
    uint64_t remaining = (p.egg_harvested_today < cap) ? cap - p.egg_harvested_today : 0;
    uint64_t yield = std::min(gross, remaining);

    // Credit EGG internally (NO token transfer — αυτό είναι εσωτερικό balance)
    ps.modify(p_it, owner, [&](auto& r) {
        r.egg_balance         += yield;
        r.last_harvest         = now;
        r.harvest_day          = p.harvest_day;
        r.egg_harvested_today  = p.egg_harvested_today + yield;
        r.total_egg_farmed    += yield;
    });
}

void pockethatch::claimreward(name owner) {
    require_auth(owner);

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    ensure_player(owner);

    uint32_t now = current_time_point().sec_since_epoch();
    check(cfg.season_index > 0, "no active season");

    // ── RULE #1: one claim per season (hard gate) ──
    claims_t cs(get_self(), get_self().value);
    auto c_it = cs.find(owner.value);
    if (c_it == cs.end()) {
        cs.emplace(owner, [&](auto& r) { r.account = owner; });
        c_it = cs.find(owner.value);
    }
    check(c_it->claimed_season < cfg.season_index, "already claimed this season");

    // ── RULE #2: cooldown between claims (defense in depth) ──
    check(now >= c_it->last_claimed + cfg.harvest_cd, "claim on cooldown");

    // Qualification: player must own at least 1 creature stage ≥ 2 (Juvenile)
    //                AND at least 1 creature must be fed (satiety gate, v2 §5.2.2)
    creatures_t crs(get_self(), get_self().value);
    auto idx = crs.get_index<"byowner"_n>();
    species_t sps(get_self(), get_self().value);
    uint8_t highest_stage = 0;
    bool has_fed_creature = false;
    for (auto it = idx.lower_bound(owner.value); it != idx.end() && it->owner == owner; ++it) {
        if (it->stage > highest_stage) highest_stage = it->stage;
        auto sp_it = sps.find(it->template_id);
        if (!has_fed_creature && sp_it != sps.end()) {
            uint32_t fed_dur = fed_duration_for(cfg, sp_it->egg_type);
            if (now < it->last_fed + fed_dur) has_fed_creature = true;
        }
    }
    check(highest_stage >= 2, "not qualified — need at least a Juvenile");
    check(has_fed_creature, "no fed creature — feed before claiming");

    // Payout scales with highest stage (v2 revised, CEO locked §5.2.1)
    // Stage 2 = 15 HATCH, 3 = 25, 4 = 45, 5 = 85 (×10^4 precision)
    uint64_t base[] = {0, 0, 15, 25, 45, 85};
    uint64_t idx_pay = std::min((int)highest_stage, 5);
    uint64_t payout_amt = base[idx_pay] * 10000ULL; // ×10^4
    asset payout = asset(payout_amt, HATCH_SYM);

    // ── RULE #3: payout ≤ rewardpool.balance (hard on-chain check) ──
    rewardpool_t pt(get_self(), get_self().value);
    auto pool = _pool();
    check(pool.balance >= payout, "reward pool empty — try again later");

    // Mark claimed BEFORE pool update (CEI: prevents re-entrancy via token notify)
    cs.modify(c_it, owner, [&](auto& r) {
        r.last_claimed   = now;
        r.claimed_season = cfg.season_index;
    });

    pool.balance -= payout;
    pool.lifetime_paid += payout;
    pt.set(pool, get_self());

    // Transfer HATCH from contract (where pool is held) → owner
    action(
        permission_level{get_self(), "active"_n},
        cfg.token_contract,
        "transfer"_n,
        token_transfer{get_self(), owner, payout, "season reward"}
    ).send();
}

void pockethatch::breed(name owner, uint64_t parent_a, uint64_t parent_b) {
    require_auth(owner);
    check(parent_a != parent_b, "cannot breed with self");

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    creatures_t crs(get_self(), get_self().value);
    auto a_it = crs.find(parent_a);
    auto b_it = crs.find(parent_b);
    check(a_it != crs.end() && b_it != crs.end(), "parent not found");
    check(a_it->owner == owner && b_it->owner == owner, "not your creature");

    uint32_t now = current_time_point().sec_since_epoch();

    // ⏱ breed cooldown on both parents
    check(a_it->last_bred == 0 || now >= a_it->last_bred + cfg.breed_cd, "parent A on breed cooldown");
    check(b_it->last_bred == 0 || now >= b_it->last_bred + cfg.breed_cd, "parent B on breed cooldown");

    // Sync both parents before breeding
    species_t sps(get_self(), get_self().value);
    auto spA = sps.find(a_it->template_id);
    auto spB = sps.find(b_it->template_id);
    check(spA != sps.end() && spB != sps.end(), "species not found");

    auto ca = *a_it; sync(ca, *spA, now);
    auto cb = *b_it; sync(cb, *spB, now);

    // 🔥 burn breed_cost — 40% burn, 60% → reward pool
    asset breed_amt = cfg.breed_cost;
    uint64_t burn_portion = breed_amt.amount * 40 / 100;
    uint64_t pool_portion = breed_amt.amount - burn_portion;

    if (burn_portion > 0) {
        burn_hatch(owner, asset(burn_portion, HATCH_SYM), "breed burn");
    }

    // Fund reward pool with the 60% portion
    if (pool_portion > 0) {
        action(
            permission_level{owner, "active"_n},
            cfg.token_contract,
            "transfer"_n,
            token_transfer{owner, get_self(), asset(pool_portion, HATCH_SYM), "breed→pool"}
        ).send();
        fund_pool(asset(pool_portion, HATCH_SYM), "breed");
    }

    // Blend genetics from both parents
    uint64_t seed = make_seed();
    checksum256 genetics = make_genetics(seed);

    auto ga = ca.genetics.extract_as_byte_array();
    auto gb = cb.genetics.extract_as_byte_array();
    std::array<uint8_t, 32> gblend;
    for (int i = 0; i < 32; i++) {
        gblend[i] = (seed & (1ULL << (i % 64))) ? ga[i] : gb[i];
    }
    auto gpacked = sha256(reinterpret_cast<const char*>(checksum256(gblend).data()), 32);

    // Pick offspring template — same as parent A for v1 (can be blended later)
    uint64_t off_template = ca.template_id;

    // Inline mint offspring NFT
    ATTR_MAP immut = {
        {"genetics", ATOM_ATTR(attr_hex(gpacked))}
    };
    ATTR_MAP mut = {
        {"stage",  ATOM_ATTR((uint32_t)0)},
        {"growth", ATOM_ATTR((uint64_t)0)}
    };
    // Predict asset_id before dispatch (same reason as mint_creature).
    uint64_t asset_id = predict_asset_id();
    action(
        permission_level{get_self(), "active"_n},
        "atomicassets"_n,
        "mintasset"_n,
        aa_mint{
            get_self(), cfg.collection, cfg.schema_name,
            (int32_t)off_template, owner,
            immut, mut, {}
        }
    ).send();

    // Write offspring
    crs.emplace(owner, [&](auto& r) {
        r.asset_id    = asset_id;
        r.owner       = owner;
        r.template_id = off_template;
        r.stage       = 0;
        r.growth_base = 0;
        r.fed_growth  = 0;
        r.born_at     = now;
        r.last_sync   = now;
        r.last_fed    = now;   // Feed v2: newborn starts fully fed (match mint_creature)
        r.last_bred   = 0;
        r.genetics    = gpacked;
    });

    // Update parent cooldowns
    crs.modify(a_it, same_payer, [&](auto& r) {
        r.growth_base = ca.growth_base;
        r.last_sync   = ca.last_sync;
        r.last_bred   = now;
    });
    crs.modify(b_it, same_payer, [&](auto& r) {
        r.growth_base = cb.growth_base;
        r.last_sync   = cb.last_sync;
        r.last_bred   = now;
    });
}

void pockethatch::accelerate(name owner, uint64_t asset_id, asset amount) {
    require_auth(owner);
    check(amount.symbol == HATCH_SYM, "must pay in HATCH");
    check(amount.amount > 0, "amount must be positive");

    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end(), "creature not found");
    check(c_it->owner == owner, "not your creature");

    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(c_it->template_id);
    check(sp_it != sps.end(), "species not found");

    uint32_t now = current_time_point().sec_since_epoch();

    // ── Feed v2: a hungry creature can't be accelerated either ──
    // Same gate as evolve. Without it, paying HATCH was a way to buy growth
    // straight past the satiety economy — the one thing feeding is meant to
    // pace.
    check(ph_rules::is_sated(now, c_it->last_fed, fed_duration_for(cfg, sp_it->egg_type)),
          "creature is hungry — feed before accelerating");

    auto c = *c_it;
    sync(c, *sp_it, now);

    // 🔥 burn the entire amount
    burn_hatch(owner, amount, "accelerate");

    // Convert HATCH → growth (1 HATCH = 100 growth points)
    uint64_t accel = (uint64_t)amount.amount * 100ULL;
    check(c.growth_base <= MAX_GROWTH - accel, "growth overflow");
    c.growth_base += accel;

    crs.modify(c_it, same_payer, [&](auto& r) {
        r.growth_base = c.growth_base;
        r.last_sync   = c.last_sync;
    });
}

void pockethatch::setname(name owner, uint64_t asset_id, const std::string& new_name) {
    require_auth(owner);
    check(new_name.size() <= 32, "name too long (max 32 bytes)");

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end(), "creature not found");
    check(c_it->owner == owner, "not your creature");

    config_row cfg = _cfg();

    // Mirror to NFT (NFT required — reject if not found)
    check(nft_exists(cfg.collection, owner, asset_id), "setname requires the NFT to be held by player");
    {
        // Merge (see evolve): rebuilding the map here dropped `cosmetic`.
        // stage/growth are still re-stated from the creature row — that row is
        // the source of truth for both and the NFT is only a mirror.
        ATTR_MAP new_mut = read_mutable_data(cfg.collection, owner, asset_id);
        aa_set_attr(new_mut, "stage",  ATOM_ATTR((uint32_t)c_it->stage));
        aa_set_attr(new_mut, "growth", ATOM_ATTR(c_it->growth_base + c_it->fed_growth));
        if (new_name.empty()) aa_erase_attr(new_mut, "name");
        else                  aa_set_attr(new_mut, "name", ATOM_ATTR(new_name));
        action(
            permission_level{get_self(), "active"_n},
            "atomicassets"_n,
            "setassetdata"_n,
            aa_setdata{get_self(), owner, asset_id, new_mut}
        ).send();
    }
}

void pockethatch::burncreature(name owner, uint64_t asset_id) {
    require_auth(owner);

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end(), "creature not found");
    check(c_it->owner == owner, "not your creature");

    config_row cfg = _cfg();
    uint8_t stage = c_it->stage;

    // ── Look up species rarity ──
    species_t sps(get_self(), get_self().value);
    auto sp_it = sps.find(c_it->template_id);
    uint64_t egg_type = (sp_it != sps.end()) ? sp_it->egg_type : 0;

    // ── HATCH payout from reward pool ──
    // formula: base × stage_mult × rarity_mult
    //   stage_mult:   0→0.2, 1→0.5, 2→1, 3→2, 4→5, 5→10
    //   rarity_mult:  common×1, uncommon×3, rare×10, epic×25, legendary×60, mythic×150
    asset payout = asset(
        ph_rules::burn_payout_raw((uint64_t)cfg.burn_base_hatch.amount, stage, egg_type),
        HATCH_SYM);

    // ── Fail closed: price the payout BEFORE destroying anything ──
    // The old order burned the NFT first and only paid `if (pool.balance >=
    // payout)`. An empty pool therefore ate the creature and paid nothing, with
    // no way back. Now a pool that can't cover the quote reverts the whole
    // action — the player keeps the NFT and can burn it later.
    rewardpool_t pt(get_self(), get_self().value);
    auto pool = _pool();
    check(pool.balance >= payout, "reward pool too low to buy back this creature — try later");

    // ── Resilient burn: skip burnasset if NFT is already gone ──
    if (nft_exists(cfg.collection, owner, asset_id)) {
        action(
            permission_level{owner, "active"_n},
            "atomicassets"_n,
            "burnasset"_n,
            aa_burn{owner, asset_id}
        ).send();
    }

    // Pay from reward pool (same pattern as claimreward)
    if (payout.amount > 0) {
        pool.balance -= payout;
        pool.lifetime_paid += payout;
        pt.set(pool, get_self());

        action(
            permission_level{get_self(), "active"_n},
            cfg.token_contract,
            "transfer"_n,
            token_transfer{get_self(), owner, payout, "burn creature"}
        ).send();
    }

    // ── EGG refund — flat per rarity (v2, CEO locked §6.1) ──
    uint64_t refund = burn_egg_for(cfg, egg_type);

    if (refund > 0) {
        players_t ps(get_self(), get_self().value);
        auto p_it = ps.find(owner.value);
        if (p_it != ps.end()) {
            ps.modify(p_it, same_payer, [&](auto& r) {
                r.egg_balance += refund;
            });
        }
    }

    crs.erase(c_it);
}

void pockethatch::unlockslot(name owner, uint8_t slot_index) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    players_t ps(get_self(), get_self().value);
    auto p_it = ps.find(owner.value);
    check(p_it != ps.end(), "player not initialized");

    // Range first — slot 7+ shifts by (slot_index - 6), so a stray low index
    // must never reach the shift below.
    check(slot_index >= 4 && slot_index <= 20, "invalid slot index");

    // Cost staircase from config (defaults 4=500, 5=1200, 6=2500)
    uint64_t slot_cost;
    if      (slot_index == 4) slot_cost = cfg.slot_cost;
    else if (slot_index == 5) slot_cost = cfg.slot_cost_5;
    else if (slot_index == 6) slot_cost = cfg.slot_cost_6;
    else                      slot_cost = cfg.slot_cost_6 * (1ULL << (slot_index - 6));

    check(p_it->egg_balance >= slot_cost, "insufficient EGG to unlock slot");

    ps.modify(p_it, same_payer, [&](auto& r) {
        r.egg_balance -= slot_cost;
    });
}

void pockethatch::equipcosmetic(name owner, uint64_t asset_id, uint64_t cosmetic_tmpl) {
    require_auth(owner);
    config_row cfg = _cfg();
    check(!cfg.paused, "game paused");

    creatures_t crs(get_self(), get_self().value);
    auto c_it = crs.find(asset_id);
    check(c_it != crs.end() && c_it->owner == owner, "not your creature");

    // ── Anti-cheat: only real, in-game cosmetics can be worn ──
    // Without this the action trusted the caller's uint64 outright, so a player
    // could push equipcosmetic with any number and end up wearing a costume the
    // game never minted. Taking one off (tmpl 0) stays open and free — it can
    // only ever remove an attribute, and charging to undo is hostile anyway.
    if (cosmetic_tmpl != 0) {
        check(ph_rules::cosmetic_tmpl_in_range(cosmetic_tmpl), "invalid cosmetic template");
        aa_templates_t tmpls(name("atomicassets"), cfg.collection.value);
        auto t_it = tmpls.find(cosmetic_tmpl);
        check(t_it != tmpls.end(), "cosmetic template not found in collection");
        check(t_it->schema_name == COSMETIC_SCHEMA, "template is not a cosmetic");

        players_t ps(get_self(), get_self().value);
        auto p_it = ps.find(owner.value);
        check(p_it != ps.end(), "player not initialized");
        check(p_it->egg_balance >= cfg.cosmetic_cost, "insufficient EGG for cosmetic");

        ps.modify(p_it, same_payer, [&](auto& r) {
            r.egg_balance -= cfg.cosmetic_cost;
        });
    }

    // Mirror to NFT (NFT required — reject if not found)
    check(nft_exists(cfg.collection, owner, asset_id), "equipcosmetic requires the NFT to be held by player");
    {
        // Merge (see evolve): rebuilding the map here dropped the player's `name`.
        ATTR_MAP new_mut = read_mutable_data(cfg.collection, owner, asset_id);
        aa_set_attr(new_mut, "stage",    ATOM_ATTR((uint32_t)c_it->stage));
        aa_set_attr(new_mut, "growth",   ATOM_ATTR(c_it->growth_base + c_it->fed_growth));
        // tmpl 0 = unequip: drop the key entirely, don't leave a written `0`
        if (cosmetic_tmpl == 0) aa_erase_attr(new_mut, "cosmetic");
        else                    aa_set_attr(new_mut, "cosmetic", ATOM_ATTR((uint64_t)cosmetic_tmpl));
        action(
            permission_level{get_self(), "active"_n},
            "atomicassets"_n,
            "setassetdata"_n,
            aa_setdata{get_self(), owner, asset_id, new_mut}
        ).send();
    }
}

// ─── Admin actions ──────────────────────────────────────────────────────

void pockethatch::clearconfig() {
    require_auth(get_self());
    // Use low-level db API to skip binary deserialization of stale config.
    // Use lowerbound with key=0 to find ANY row regardless of primary key value.
    using namespace eosio::internal_use_do_not_use;
    uint64_t scope = get_self().value;
    uint64_t tbl = "configv3"_n.value;
    int itr = db_lowerbound_i64(get_self().value, scope, tbl, 0);
    if (itr >= 0) db_remove_i64(itr);
}

void pockethatch::clearpool() {
    require_auth(get_self());
    rewardpool_t pt(get_self(), get_self().value);
    pt.remove();
}

void pockethatch::clearspecies() {
    require_auth(get_self());
    species_t sps(get_self(), get_self().value);
    auto it = sps.begin();
    while (it != sps.end()) {
        it = sps.erase(it);
    }
}

void pockethatch::setconfig(const config_row& cfg) {
    require_auth(get_self());
    config_t ct(get_self(), get_self().value);
    ct.set(cfg, get_self());
}

void pockethatch::setspecies(const species_row& sp) {
    require_auth(get_self());
    species_t sps(get_self(), get_self().value);
    auto it = sps.find(sp.template_id);
    if (it == sps.end()) {
        sps.emplace(get_self(), [&](auto& r) { r = sp; });
    } else {
        sps.modify(it, same_payer, [&](auto& r) { r = sp; });
    }
}

void pockethatch::rmspecies(uint64_t template_id) {
    require_auth(get_self());
    species_t sps(get_self(), get_self().value);
    auto it = sps.find(template_id);
    check(it != sps.end(), "species not found");
    sps.erase(it);
}

void pockethatch::setpaused(bool paused) {
    require_auth(get_self());
    config_t ct(get_self(), get_self().value);
    auto cfg = ct.get_or_default();
    cfg.paused = paused;
    ct.set(cfg, get_self());
}

void pockethatch::newseason(asset bootstrap_release) {
    require_auth(get_self());
    check(bootstrap_release.symbol == HATCH_SYM, "must be HATCH");

    config_t ct(get_self(), get_self().value);
    auto cfg = ct.get_or_default();
    cfg.season_index += 1;
    cfg.season_started = current_time_point().sec_since_epoch();
    ct.set(cfg, get_self());

    // ── Bootstrap release: fund reward pool from contract's HATCH balance ──
    if (bootstrap_release.amount > 0) {
        fund_pool(bootstrap_release, "bootstrap S" + std::to_string(cfg.season_index));

        rewardpool_t pt(get_self(), get_self().value);
        auto pool = _pool();
        pool.bootstrap_released += (uint64_t)bootstrap_release.amount;
        pool.last_release = current_time_point().sec_since_epoch();
        pt.set(pool, get_self());
    }
}

void pockethatch::fundpool(asset amount, const std::string& source) {
    require_auth(get_self());
    check(amount.symbol == HATCH_SYM, "must be HATCH");
    fund_pool(amount, source);
}

asset pockethatch::sweepableHatch() const {
    config_row cfg = _cfg();
    auto pool = _pool();

    // Read actual HATCH balance from token contract
    multi_index<"accounts"_n, token_account> accts(cfg.token_contract, get_self().value);
    auto it = accts.find(HATCH_SYM.code().raw());
    asset contract_balance = (it != accts.end()) ? it->balance : asset(0, HATCH_SYM);

    asset escrowed = pool.balance;
    if (contract_balance <= escrowed) return asset(0, HATCH_SYM);
    return contract_balance - escrowed;
}

void pockethatch::withdraw(name token_contract, asset quantity, name to, const std::string& memo) {
    require_auth(get_self());

    // ── RULE: only withdrawable surplus = contract_balance − escrowed pools ──
    config_row cfg = _cfg();
    if (token_contract == cfg.token_contract && quantity.symbol == HATCH_SYM) {
        asset sweepable = sweepableHatch();
        check(sweepable >= quantity, "withdraw would drain escrow");
    }

    action(
        permission_level{get_self(), "active"_n},
        token_contract,
        "transfer"_n,
        token_transfer{get_self(), to, quantity, memo}
    ).send();
}

// ─── Notification ───────────────────────────────────────────────────────

void pockethatch::on_logmint(
    uint64_t asset_id,
    name authorized_minter,
    name collection_name,
    name schema_name,
    int32_t template_id,
    name new_asset_owner,
    ATTR_MAP immutable_data,
    ATTR_MAP mutable_data,
    std::vector<asset> backed_tokens)
{
    config_row cfg = _cfg();
    if (collection_name == cfg.collection) {
        last_mint_t lm(get_self(), get_self().value);
        lm.set(last_mint_row{asset_id, new_asset_owner}, get_self());
    }
}

void pockethatch::on_assets_transfer(
    name from,
    name to,
    std::vector<uint64_t> asset_ids,
    const std::string& memo)
{
    // Ignore our own mints (from == get_self() means we just minted)
    if (from == get_self()) return;

    creatures_t crs(get_self(), get_self().value);
    for (auto id : asset_ids) {
        auto it = crs.find(id);
        if (it != crs.end()) {
            crs.modify(it, same_payer, [&](auto& r) {
                r.owner = to;
            });
        }
    }
}

// ─── WAX wake notification (v2) ───────────────────────────────────────────
// Player sends WAX to this contract via eosio.token::transfer with memo "wake:<asset_id>".
// Contract validates, wakes the creature (stage 0→1), and forwards WAX to fee_account.

void pockethatch::on_wax_transfer(name from, name to, asset quantity, std::string memo) {
    // 1. Ignore outgoing transfers and non-WAX tokens
    if (to != get_self()) return;
    check(quantity.symbol == symbol("WAX", 8), "only WAX accepted");

    // 2. Parse memo — expect "wake:<asset_id>"
    if (memo.rfind("wake:", 0) != 0) {
        check(false, "unknown memo — use wake:<asset_id>");
    }
    uint64_t asset_id = std::stoull(memo.substr(5));

    // 3. Validate creature
    config_row cfg = _cfg();
    creatures_t crs(get_self(), get_self().value);
    auto it = crs.find(asset_id);
    check(it != crs.end(), "creature not found");
    check(it->owner == from, "not your creature");
    check(it->stage == 0, "already awake");

    // 4. Look up species + rarity
    species_t sps(get_self(), get_self().value);
    auto sp = sps.find(it->template_id);
    check(sp != sps.end(), "species not found");
    uint64_t egg_type = sp->egg_type;

    // 5. Validate WAX amount (excess WAX accepted as donation)
    //    (timer gate removed — WAX wake is always available during stage 0;
    //     player may also wait for free auto-awaken via harvest)
    asset required = wake_cost_for(cfg, egg_type);
    check(quantity >= required, "insufficient WAX for wake");

    // 6. Wake! stage 0 → 1
    crs.modify(it, same_payer, [&](auto& r) { r.stage = 1; });

    // 7. Forward WAX to fee_account — ONLY when it is a distinct account.
    //    CEO decision 2026-07-15: WAX wake fees stay in the game contract itself.
    //    Live config sets fee_account = get_self(); forwarding to self reverts
    //    eosio.token with "cannot transfer to self" (the awaken bug). The inbound
    //    transfer already deposited the WAX here, so skipping the forward simply
    //    lets the fee accrue in-contract — the intended treasury behaviour.
    if (quantity.amount > 0 && cfg.fee_account != get_self()) {
        action(permission_level{get_self(), "active"_n},
               cfg.wax_contract, "transfer"_n,
               token_transfer{get_self(), cfg.fee_account, quantity, "wake:" + std::to_string(asset_id)}
        ).send();
    }
}
