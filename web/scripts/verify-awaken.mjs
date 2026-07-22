// Awaken-v2 MODEL verification — proves the pure awaken.ts logic AND that its
// numbers are bound to LIVE configv3 on phgamecreatr (no hardcoded drift).
//
// It does two things:
//   1. MODEL — drives computeAwaken/awakenDurFor/waxWhole and asserts the sleep
//      timer math (sleeping → ready, countdown, progress %, WAX cost parsing).
//   2. CHAIN MATCH — reads configv3 off the live contract and asserts the model's
//      awaken_dur / wake_cost per rarity EQUAL the chain, and wax_contract is the
//      token the wake transfer targets. This is the "เทียบค่าเชน" proof: if Kevin
//      retunes a timer or cost on chain, this fails until the model follows.
//
// Run:  cd web && node scripts/verify-awaken.mjs
import {
  computeAwaken,
  awakenDurFor,
  waxWhole,
  AWAKEN_DUR_DEFAULT,
  WAKE_COST_WAX_DEFAULT,
} from '../src/awaken.ts'

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

const NOW = 1_800_000_000 // fixed clock — deterministic
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

console.log('① computeAwaken — a sleeping (stage 0) creature on a 1h (3600s) timer')
{
  const dur = 3600
  const justHatched = computeAwaken(0, NOW, NOW, dur)          // 0s in → full timer ahead
  const midSleep = computeAwaken(0, NOW - 1800, NOW, dur)      // 30m of 60m → 50%
  const elapsed = computeAwaken(0, NOW - 4000, NOW, dur)       // past timer → ready/auto
  const awake = computeAwaken(2, NOW - 10000, NOW, dur)        // stage > 0 → awake
  check('just hatched → sleeping, ~0% progress', justHatched.sleeping && Math.round(justHatched.progressPct) === 0, `${justHatched.progressPct}`)
  check('just hatched → full countdown ahead (~3600s)', Math.abs(justHatched.secondsToAwaken - 3600) <= 1, `${justHatched.secondsToAwaken}`)
  check('mid-sleep → 50% progress', Math.abs(midSleep.progressPct - 50) < 0.5, `${midSleep.progressPct}`)
  check('mid-sleep → ~1800s left, not auto', midSleep.secondsToAwaken === 1800 && !midSleep.canAutoAwaken, `${midSleep.secondsToAwaken}`)
  check('timer elapsed → canAutoAwaken (harvest wakes free)', elapsed.sleeping && elapsed.canAutoAwaken && elapsed.secondsToAwaken === 0)
  check('elapsed → progress pinned at 100%', elapsed.progressPct === 100, `${elapsed.progressPct}`)
  check('stage > 0 → awake (progress 100, not sleeping)', awake.state === 'awake' && !awake.sleeping && awake.progressPct === 100)
}

console.log('② awakenDurFor honors live chain value, else per-rarity default')
{
  check('uses live value when given', awakenDurFor('common', 9999) === 9999)
  check('falls back to rarity default', awakenDurFor('rare') === AWAKEN_DUR_DEFAULT.rare)
  check('rarer sleeps ≥ common', AWAKEN_DUR_DEFAULT.mythic >= AWAKEN_DUR_DEFAULT.common)
  check('exactly 6 rarities', Object.keys(AWAKEN_DUR_DEFAULT).length === 6, Object.keys(AWAKEN_DUR_DEFAULT).join(','))
}

console.log('③ waxWhole parses a WAX-8 asset string → whole units')
{
  check('"3.00000000 WAX" → 3', waxWhole('3.00000000 WAX') === 3)
  check('"80.00000000 WAX" → 80', waxWhole('80.00000000 WAX') === 80)
  check('undefined → 0', waxWhole(undefined) === 0)
}

console.log('④ CHAIN MATCH — model numbers equal LIVE configv3 on phgamecreatr')
{
  const RPC = ['https://wax-testnet.eosphere.io', 'https://testnet.waxsweden.org', 'https://waxtestnet.greymass.com']
  let cfg = null
  for (const base of RPC) {
    try {
      const res = await fetch(base + '/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'phgamecreatr', scope: 'phgamecreatr', table: 'configv3', json: true, limit: 1 }),
      })
      if (!res.ok) continue
      const d = await res.json()
      if (d.rows && d.rows[0]) { cfg = d.rows[0]; console.log(`  · read configv3 @ ${base}`); break }
    } catch { /* try next */ }
  }
  if (!cfg) {
    check('configv3 read (all endpoints)', false, 'could not read configv3 from any RPC')
  } else {
    // awaken_dur per rarity ⇔ AWAKEN_DUR_DEFAULT (which is what awakenDurFor falls back to)
    for (const r of RARITIES) {
      const chain = cfg[`awaken_dur_${r}`]
      check(`awaken_dur_${r} model=${AWAKEN_DUR_DEFAULT[r]} == chain=${chain}`, AWAKEN_DUR_DEFAULT[r] === chain, `${AWAKEN_DUR_DEFAULT[r]} vs ${chain}`)
    }
    // wake_cost per rarity ⇔ WAKE_COST_WAX_DEFAULT (whole WAX parsed from the asset)
    for (const r of RARITIES) {
      const chainWax = waxWhole(cfg[`wake_cost_${r}`])
      check(`wake_cost_${r} model=${WAKE_COST_WAX_DEFAULT[r]} WAX == chain=${chainWax} WAX (${cfg[`wake_cost_${r}`]})`, WAKE_COST_WAX_DEFAULT[r] === chainWax, `${WAKE_COST_WAX_DEFAULT[r]} vs ${chainWax}`)
    }
    check(`wax_contract = eosio.token (wake transfer target)`, cfg.wax_contract === 'eosio.token', cfg.wax_contract)
    // feed_cd is the live satiety cooldown bound in play.ts (Creature.feedCd)
    check(`feed_cd present (satiety cooldown = ${cfg.feed_cd}s)`, cfg.feed_cd > 0, `${cfg.feed_cd}`)

    // Drive computeAwaken with the REAL chain awaken_dur for a common (3600s):
    // 45m into the sleep → still sleeping, ~15m (900s) left.
    const dur = cfg.awaken_dur_common
    const live = computeAwaken(0, NOW - Math.round(dur * 0.75), NOW, dur)
    check(`live common (${dur}s): 75% in → sleeping, ~25% timer left`, live.sleeping && Math.abs(live.secondsToAwaken - dur * 0.25) <= 1, `${live.secondsToAwaken} vs ${dur * 0.25}`)
    check(`live common: 75% in → ~75% progress`, Math.abs(live.progressPct - 75) < 0.5, `${live.progressPct}`)
  }
}

console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
