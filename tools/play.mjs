#!/usr/bin/env node
/**
 * Pocket Hatchery — Game Bot
 *
 * เล่น Pocket Hatchery ผ่าน waxwing pushaction บน Windows (ไม่ต้องใช้ cleos)
 *
 * Usage:
 *   node play.mjs status              — ดูสถานะผู้เล่น + creatures
 *   node play.mjs init                — initplayer (สร้าง player row; EGG grant ขึ้นกับ contract version)
 *   node play.mjs hatch [egg_type]    — firsthatch (ฟรีเฉพาะตัวแรก) หรือ hatch (ใช้ EGG)
 *   node play.mjs feed <asset_id>     — ป้อนอาหาร creature (+1000 growth)
 *   node play.mjs evolve <asset_id>   — evolve creature
 *   node play.mjs harvest             — เก็บ EGG
 *   node play.mjs reward              — claim HATCH reward
 *   node play.mjs loop                — เล่นทั้ง loop อัตโนมัติ
 *   node play.mjs help                — แสดงคำสั่งทั้งหมด
 *
 * Requires: unlocked waxwing wallet (boss ปลดล็อคก่อน)
 */

const DAEMON = "http://127.0.0.1:8787";
const WAXWING = `${DAEMON}/plugin/wax-wallet/cmd`;
const CONTRACT = "phgamecreatr";  // ATTR_MAP fix deployed; pockethatch1 still buggy (needs PH_CONTRACT_PRIV)
const PLAYER = "waxwingsuper";     // default player
const NETWORK = "wax-testnet";

const PLAYER2 = "officewax123";    // secondary player

const args = process.argv.slice(2);
const cmd = args[0] || "status";
const player = process.env.PH_PLAYER || PLAYER;

// ── helpers ──────────────────────────────────────────────────────────
async function wax(cmd, args = "") {
  const body = JSON.stringify({ cmd, args });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${cmd}: ${data.msg}`);
  return data;
}

/** call pushaction with JSON data */
async function push(contract, action, data = {}, opts = {}) {
  const from = opts.from || player;
  const net = opts.network || NETWORK;
  // pushaction uses --from for account, positional args for contract + action,
  // and --data for the JSON data object (passed as string in _raw)
  const argsStr = `--network ${net} --from ${from} --contract ${contract} --action ${action} --data ${JSON.stringify(JSON.stringify(data))}`;

  // Actually, pushaction reads data from a.data (object) or a._raw (JSON string).
  // The simplest way is to pass data as a JSON object via arg parsing.
  // Let's use the direct JSON format for args:
  const fullArgs = {
    network: net,
    from,
    contract,
    action,
    data,
  };

  const body = JSON.stringify({ cmd: "pushaction", args: JSON.stringify(fullArgs) });
  const res = await fetch(WAXWING, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data2 = await res.json();
  if (!data2.ok) throw new Error(`${action}: ${data2.msg}`);
  return data2;
}

/** read contract table */
async function table(code, scope, tbl, limit = 50) {
  return wax("table", `${code} ${scope} ${tbl} --limit ${limit}`);
}

/** check wallet status */
async function walletStatus() {
  return wax("status");
}

// ── game state ───────────────────────────────────────────────────────
async function gameState() {
  const [cfg, creatures, players, ws] = await Promise.all([
    table(CONTRACT, CONTRACT, "configv2"),
    table(CONTRACT, CONTRACT, "creatures", 100),
    table(CONTRACT, CONTRACT, "players", 100),
    walletStatus(),
  ]);

  const myPlayer = (players.rows || []).find(p => p.account === player);
  const myCreatures = (creatures.rows || []).filter(c => c.owner === player);

  return {
    paused: cfg.rows[0]?.paused || 0,
    config: cfg.rows[0] || null,
    player: myPlayer || null,
    creatures: myCreatures,
    totalCreatures: (creatures.rows || []).length,
    wallet: ws.status,
  };
}

// ── actions ──────────────────────────────────────────────────────────
async function initPlayer() {
  console.log(`🎮 initplayer for ${player}...`);
  return push(CONTRACT, "initplayer", { owner: player });
}

async function firstHatch(eggType = 0) {
  console.log(`🥚 firsthatch (free, egg_type=${eggType}) for ${player}...`);
  return push(CONTRACT, "firsthatch", { owner: player, egg_type: eggType });
}

async function hatch(eggType = 0) {
  console.log(`🥚 hatch (costs EGG, egg_type=${eggType}) for ${player}...`);
  return push(CONTRACT, "hatch", { owner: player, egg_type: eggType });
}

async function feedCreature(assetId) {
  console.log(`🍖 feed creature #${assetId}...`);
  return push(CONTRACT, "feed", { owner: player, asset_id: parseInt(assetId) });
}

async function evolveCreature(assetId) {
  console.log(`⚡ evolve creature #${assetId}...`);
  return push(CONTRACT, "evolve", { owner: player, asset_id: parseInt(assetId) });
}

async function harvestEggs() {
  console.log(`🌾 harvest EGG for ${player}...`);
  return push(CONTRACT, "harvest", { owner: player });
}

async function claimReward() {
  console.log(`💰 claim HATCH reward for ${player}...`);
  return push(CONTRACT, "claimreward", { owner: player });
}

// ── main loop ────────────────────────────────────────────────────────
async function fullLoop() {
  console.log("═".repeat(60));
  console.log("  Pocket Hatchery — Full Game Loop");
  console.log("═".repeat(60));

  // Step 0: Check status
  console.log("\n📊 Checking game state...");
  let state = await gameState();
  console.log(`   Wallet: ${state.wallet.unlocked ? "🔓 unlocked" : "🔒 LOCKED"}`);
  if (!state.wallet.unlocked) {
    console.log("\n❌ Wallet is locked! Unlock first:");
    console.log(`   curl -X POST ${WAXWING} -H "content-type: application/json" -d '{"cmd":"unlock","args":"<PASSWORD>"}'`);
    return;
  }
  console.log(`   Player: ${player}`);
  console.log(`   EGG: ${state.player?.egg_balance || 0}`);
  console.log(`   Creatures: ${state.creatures.length}`);
  console.log(`   Paused: ${state.paused ? "⏸ YES" : "▶ NO"}`);

  if (state.paused) {
    console.log("\n⚠️  Contract is PAUSED! Ask admin to unpause.");
    return;
  }

  // Step 1: Init player if needed
  if (!state.player) {
    console.log("\n🎮 Step 1: initplayer...");
    try {
      await initPlayer();
      console.log("   ✅ Player initialized! +200 EGG");
      state = await gameState();
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }
  } else {
    console.log("   ✅ Already initialized");
  }

  // Step 2: Harvest (free EGG from passive)
  if (state.creatures.length > 0) {
    console.log("\n🌾 Step 2: Harvest EGG...");
    try {
      const r = await harvestEggs();
      console.log(`   ✅ Harvested! tx: ${r.txId?.slice(0,12)}...`);
      state = await gameState();
      console.log(`   EGG now: ${state.player?.egg_balance || 0}`);
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }
  }

  // Step 3: Hatch first creature (free!)
  if (state.creatures.length === 0) {
    console.log("\n🥚 Step 3: firsthatch (FREE first creature)...");
    try {
      const r = await firstHatch(0);
      console.log(`   ✅ Creature hatched! tx: ${r.txId?.slice(0,12)}...`);
      console.log(`   🔗 ${r.explorer || ""}`);
      state = await gameState();
      console.log(`   Creatures now: ${state.creatures.length}`);
    } catch (e) {
      console.log(`   ❌ firsthatch FAILED: ${e.message}`);
      console.log("   ⚠️  This is expected if contract not fixed yet (ATTR_MAP bug)");
      console.log("   → Need to deploy fixed contract first");
      return;
    }
  }

  // Step 4: Feed to boost growth
  if (state.creatures.length > 0) {
    console.log("\n🍖 Step 4: Feed creature...");
    const c = state.creatures[0];
    console.log(`   Creature #${c.asset_id} (stage ${c.stage}, growth: ${(c.growth_base||0)+(c.fed_growth||0)})`);

    try {
      const r = await feedCreature(c.asset_id);
      console.log(`   ✅ Fed! +1000 growth. tx: ${r.txId?.slice(0,12)}...`);
      state = await gameState();
      const c2 = state.creatures[0];
      if (c2) console.log(`   Growth now: ${(c2.growth_base||0)+(c2.fed_growth||0)}`);
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
    }
  }

  // Step 5: Evolve (if enough growth)
  if (state.creatures.length > 0) {
    const c = state.creatures[0];
    const growth = (c.growth_base || 0) + (c.fed_growth || 0);
    const cfg = state.config || {};
    const thresh = [1000, 5000, 20000, 100000];
    const nextThresh = thresh[c.stage] || 999999999;
    const evolveCost = (cfg.evolve_cost || 50) * (c.stage + 1);
    const eggBal = state.player?.egg_balance || 0;

    console.log(`\n⚡ Step 5: Evolve check...`);
    console.log(`   Stage: ${c.stage}/${5}, Growth: ${growth}/${nextThresh}, Cost: ${evolveCost} EGG, Balance: ${eggBal} EGG`);

    if (growth >= nextThresh && eggBal >= evolveCost && c.stage < 5) {
      try {
        const r = await evolveCreature(c.asset_id);
        console.log(`   ✅ Evolved! tx: ${r.txId?.slice(0,12)}...`);
        state = await gameState();
        const c2 = state.creatures[0];
        if (c2) console.log(`   Now stage ${c2.stage}!`);
      } catch (e) {
        console.log(`   ❌ Evolve failed: ${e.message}`);
      }
    } else {
      console.log(`   ⏳ Not ready yet (growth ${growth}/${nextThresh}, cost ${evolveCost}/${eggBal})`);

      if (growth < nextThresh) {
        const needed = nextThresh - growth;
        const feedsNeeded = Math.ceil(needed / (cfg.feed_boost || 1000));
        console.log(`   → Need ${needed} more growth (~${feedsNeeded} more feeds)`);
      }
    }
  }

  // Step 6: Claim reward (if stage >= 2)
  if (state.creatures.length > 0) {
    const c = state.creatures[0];
    if (c.stage >= 2) {
      console.log("\n💰 Step 6: Claim HATCH reward...");
      try {
        const r = await claimReward();
        console.log(`   ✅ Claimed! tx: ${r.txId?.slice(0,12)}...`);
      } catch (e) {
        console.log(`   ⚠️  ${e.message}`);
      }
    } else {
      console.log(`\n💰 Step 6: Claim reward — need stage >= 2 (currently ${c.stage})`);
    }
  }

  // Summary
  state = await gameState();
  console.log("\n" + "═".repeat(60));
  console.log("  FINAL STATE");
  console.log("═".repeat(60));
  console.log(`  EGG:    ${state.player?.egg_balance || 0}`);
  console.log(`  Creatures: ${state.creatures.length}`);
  for (const c of state.creatures) {
    const g = (c.growth_base || 0) + (c.fed_growth || 0);
    console.log(`    #${c.asset_id}: stage ${c.stage} | growth ${g} | name "${c.name || "unnamed"}"`);
  }
  console.log("═".repeat(60));
}

// ── status display ───────────────────────────────────────────────────
async function showStatus() {
  const state = await gameState();

  console.log("═".repeat(50));
  console.log("  Pocket Hatchery — Game State");
  console.log("═".repeat(50));
  console.log(`  Contract:  ${CONTRACT}`);
  console.log(`  Network:   ${state.wallet.network?.name || NETWORK}`);
  console.log(`  Wallet:    ${state.wallet.unlocked ? "🔓 unlocked" : "🔒 locked"}`);
  console.log(`  Player:    ${player}`);
  console.log(`  Paused:    ${state.paused ? "⏸ YES" : "▶ NO"}`);
  console.log("─".repeat(50));

  if (state.player) {
    console.log(`  EGG:       ${state.player.egg_balance}`);
    console.log(`  Farmed:    ${state.player.total_egg_farmed}`);
    console.log(`  Feeds:     ${state.player.feeds_today}/${state.config?.feed_daily_cap || 100}`);
    console.log(`  Harvested: ${state.player.egg_harvested_today}/${state.config?.daily_egg_cap || 240}`);
  } else {
    console.log("  ⚠️  Not initialized — run: node play.mjs init");
  }

  console.log("─".repeat(50));
  console.log(`  Creatures: ${state.creatures.length} (total on chain: ${state.totalCreatures})`);
  for (const c of state.creatures) {
    const g = (c.growth_base || 0) + (c.fed_growth || 0);
    const thresh = [0, 1000, 5000, 20000, 100000];
    const curThresh = thresh[c.stage] || 0;
    const nextThresh = thresh[Math.min(c.stage + 1, 4)] || 999999999;
    const pct = nextThresh > curThresh ? Math.round(((g - curThresh) / (nextThresh - curThresh)) * 100) : 100;
    console.log(`    #${c.asset_id}: Stage ${c.stage} | Growth ${g} (${pct}% to next) | "${c.name || "unnamed"}"`);
  }

  if (state.config) {
    console.log("─".repeat(50));
    console.log("  Config:");
    console.log(`    hatch_cost:    ${state.config.hatch_cost} EGG`);
    console.log(`    evolve_cost:   ${state.config.evolve_cost} EGG`);
    console.log(`    feed_cost:     ${state.config.feed_cost} EGG`);
    console.log(`    feed_boost:    ${state.config.feed_boost}`);
    console.log(`    feed_cd:       ${state.config.feed_cd}s`);
    console.log(`    breed_cost:    ${state.config.breed_cost}`);
    console.log(`    season:        ${state.config.season_index}`);
  }
  console.log("═".repeat(50));
}

// ── CLI router ───────────────────────────────────────────────────────
async function main() {
  try {
    switch (cmd) {
      case "status":
      case "s":
        await showStatus();
        break;

      case "init":
        await initPlayer();
        console.log("✅ Done! Run 'node play.mjs status' to check");
        break;

      case "hatch":
        {
          const eggType = parseInt(args[1]) || 0;
          // Auto-detect: use firsthatch if 0 creatures
          const state = await gameState();
          if (state.creatures.length === 0) {
            console.log("💡 No creatures yet — using firsthatch (FREE)");
            await firstHatch(eggType);
          } else {
            await hatch(eggType);
          }
        }
        break;

      case "feed":
        {
          const assetId = args[1];
          if (!assetId) { console.log("Usage: node play.mjs feed <asset_id>"); return; }
          await feedCreature(assetId);
        }
        break;

      case "evolve":
        {
          const assetId = args[1];
          if (!assetId) { console.log("Usage: node play.mjs evolve <asset_id>"); return; }
          await evolveCreature(assetId);
        }
        break;

      case "harvest":
        await harvestEggs();
        break;

      case "reward":
        await claimReward();
        break;

      case "loop":
        await fullLoop();
        break;

      case "help":
      default:
        console.log(`
🐣 Pocket Hatchery Game Bot
   เล่นผ่าน waxwing pushaction — ไม่ต้องใช้ cleos!

Commands:
  node play.mjs status              ดูสถานะเกม
  node play.mjs init                initplayer (รับ 200 EGG)
  node play.mjs hatch [egg_type]    hatch/firsthatch creature
  node play.mjs feed <asset_id>     ป้อนอาหาร (+1000 growth)
  node play.mjs evolve <asset_id>   evolve creature
  node play.mjs harvest             เก็บ EGG
  node play.mjs reward              claim HATCH reward
  node play.mjs loop                เล่นทั้ง loop อัตโนมัติ

Env:
  PH_PLAYER=account   default: waxwingsuper (ใช้ officewax123 สำหรับ account ที่2)

Setup:
  1. ปลดล็อค waxwing ก่อน:
     curl -X POST ${WAXWING} -d '{"cmd":"unlock","args":"<PASSWORD>"}'
  2. รันคำสั่งที่ต้องการ
        `.trim());
        break;
    }
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}`);
    if (e.message.includes("locked")) {
      console.log(`\n💡 Unlock waxwing first:`);
      console.log(`   curl -s -X POST ${WAXWING} -H "content-type: application/json" -d '{"cmd":"unlock","args":"<PASSWORD>"}'`);
    }
    process.exit(1);
  }
}

main();
