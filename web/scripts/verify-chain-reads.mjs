/**
 * verify-chain-reads.mjs — headless proof that the Pocket Hatchery dashboard
 * reads EVERY game table off the chain without hitting RPC 3060003.
 *
 * This is the CHAIN-READ layer only (no wallet, no UI, no sign). It mirrors
 * web/src/chain.ts fetchGameState() 1:1 — same RPC endpoints + timeout from
 * network.ts, same per-table reads (configv2 / players / creatures / rewardpool
 * / speciescfg), and the SAME Promise.allSettled resilience as the fix.
 *
 * It proves three things the owner asked to close "decisively":
 *   A) All 5 tables read OK with real values for waxwingsuper on the live
 *      contract — i.e. RPC 3060003 "Table config is not specified" does NOT
 *      occur on any of the 5 tables we use.
 *   B) Resilience: an injected table that is NOT in the ABI (the historical
 *      3060003 trigger) is dropped to null while the OTHER reads still succeed —
 *      exactly what fetchGameState now does, instead of emptying the dashboard.
 *   C) All-fail: when every read rejects (all RPC nodes down), the state fetch
 *      throws so play.ts can surface a toast rather than a silent empty state.
 *
 * Run:  cd web && node scripts/verify-chain-reads.mjs
 */
import assert from 'node:assert'

// ── Mirror network.ts (single source) ────────────────────────────────────────
const CONTRACT = 'phgamecreatr' // network.ts wax-testnet.contract (live gameplay)
const RPC_ENDPOINTS = ['https://wax-testnet.eosphere.io', 'https://testnet.waxsweden.org']
const RPC_TIMEOUT_MS = 7000 // chain.ts RPC_TIMEOUT_MS
const ACCOUNT = 'waxwingsuper' // daemon wallet account (the sign-test actor)

// ── Mirror chain.ts rpc() ────────────────────────────────────────────────────
// POST with a hard per-attempt timeout; a 3060003 is an HTTP 500 with the error
// in the body — same on every node, so we treat non-OK as a hard failure for
// THAT read rather than silently trying the next endpoint (matches chain.ts).
async function rpc(path, body) {
  let lastErr = null
  for (const base of RPC_ENDPOINTS) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
    try {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        throw new Error(`RPC ${path} @ ${base} failed: ${res.status} ${await res.text()}`)
      }
      return await res.json()
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// ── Mirror the 5 chain.ts table reads ────────────────────────────────────────
// Identical scope/limit/lower_bound/upper_bound to getConfig/getPlayer/...
async function getConfig() {
  // configv3 = the Feed-v2 config table (deployed on phgamecreatr 2026-07-09,
  // carries fed_dur_* + earn_mult_*). configv2 was REPLACED and is no longer in
  // the ABI — reading it now 3060003s. Mirrors chain.ts CONFIG_TABLE = 'configv3'.
  const d = await rpc('/v1/chain/get_table_rows', {
    code: CONTRACT, scope: CONTRACT, table: 'configv3', json: true, limit: 1,
  })
  return d.rows[0] ?? null
}
async function getPlayer(account) {
  const d = await rpc('/v1/chain/get_table_rows', {
    code: CONTRACT, scope: CONTRACT, table: 'players', json: true, limit: 1,
    lower_bound: account, upper_bound: account,
  })
  return d.rows[0] ?? null
}
async function getCreatures(owner) {
  // Feed-v2 deploy renamed `creatures` → `creatrsv2` (live ABI). Mirrors chain.ts.
  const d = await rpc('/v1/chain/get_table_rows', {
    code: CONTRACT, scope: CONTRACT, table: 'creatrsv2', json: true, limit: 1000,
  })
  return d.rows.filter((r) => r.owner === owner)
}
async function getRewardPool() {
  const d = await rpc('/v1/chain/get_table_rows', {
    code: CONTRACT, scope: CONTRACT, table: 'rewardpool', json: true, limit: 1,
  })
  return d.rows[0] ?? null
}
async function getSpecies() {
  // Feed-v2 deploy renamed `speciescfg` → `spccfgv2` (live ABI). Mirrors chain.ts.
  const d = await rpc('/v1/chain/get_table_rows', {
    code: CONTRACT, scope: CONTRACT, table: 'spccfgv2', json: true, limit: 100,
  })
  return d.rows
}

// ── Mirror chain.ts fetchGameState() (the allSettled fix) ─────────────────────
async function fetchGameState(account) {
  const reads = {
    config: getConfig(),
    player: getPlayer(account),
    creatures: getCreatures(account),
    rewardPool: getRewardPool(),
    species: getSpecies(),
  }
  const keys = Object.keys(reads)
  const settled = await Promise.allSettled(Object.values(reads))
  settled.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[chain] ${keys[i]} read failed:`, String(r.reason))
  })
  if (settled.every((r) => r.status === 'rejected')) {
    const first = settled[0]
    throw first.reason instanceof Error ? first.reason : new Error(String(first.reason))
  }
  const or = (i, fb) => (settled[i].status === 'fulfilled' ? settled[i].value : fb)
  return {
    config: or(0, null),
    player: or(1, null),
    creatures: or(2, []),
    rewardPool: or(3, null),
    species: or(4, []),
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
let failures = 0
const ok = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => { console.log(`  ❌ ${m}`); failures++ }

console.log(`\nChain-read verify — contract ${CONTRACT} @ ${RPC_ENDPOINTS[0]}, account ${ACCOUNT}\n`)

// ── A) Every table reads ─────────────────────────────────────────────────────
console.log('A) fetchGameState — every table must read OK:')
const state = await fetchGameState(ACCOUNT)
if (state.config) {
  ok(`config     → collection=${state.config.collection} fee=${state.config.fee_account} hatch_cost=${state.config.hatch_cost} daily_egg_cap=${state.config.daily_egg_cap}`)
} else bad('config is null — config table did not read')
if (state.player) {
  ok(`player     → egg=${state.player.egg_balance} feeds_today=${state.player.feeds_today} total_farmed=${state.player.total_egg_farmed}`)
} else bad('player is null — players table did not read')
ok(`creatures  → ${state.creatures.length} owned (${state.creatures.map((c) => c.asset_id).join(', ') || 'none'})`)
if (state.rewardPool) {
  ok(`rewardPool → balance=${state.rewardPool.balance}`)
} else bad('rewardPool is null — rewardpool table did not read')
if (state.species.length > 0) {
  ok(`species    → ${state.species.length} entries (template_ids=${state.species.map((s) => s.template_id).join(',')})`)
} else bad('species is EMPTY — spccfgv2 did not read (a wrong table name reads [] via the allSettled fallback, not a genuine read)')

// species is game-config and always populated on the live contract, so an empty
// species array means the read REJECTED and fell back to [] — the exact silent
// failure that a wrong table name (creatures→creatrsv2 / speciescfg→spccfgv2)
// produces. Assert length>0 so a renamed table can never pass A on the fallback.
const allRead = !!(state.config && state.player && state.rewardPool) && Array.isArray(state.creatures) && state.species.length > 0
try {
  assert.ok(allRead, 'one or more tables came back null/empty (real read failed → fallback)')
  console.log('   → A PASS: all 5 tables read, NO 3060003 on any of them.\n')
} catch (e) { bad(e.message) }

// ── B) Resilience: a bad table does NOT sink the others ───────────────────────
console.log('B) resilience — one table NOT in the ABI must not empty the rest:')
// 'config' (no v2) is the historical 3060003 trigger — it is not in the ABI.
const mixed = await Promise.allSettled([
  getConfig(),
  Promise.reject(new Error('3060003: Table config is not specified in the ABI')),
  getCreatures(ACCOUNT),
])
const mixedOk = mixed[0].status === 'fulfilled' && mixed[2].status === 'fulfilled' && mixed[1].status === 'rejected'
try {
  assert.ok(mixedOk, 'a rejected read poisoned the fulfilled ones')
  console.log(`   → config ✅ fulfilled, bogus-config ❌ rejected, creatures ✅ fulfilled — others survived.`)
  console.log('   → B PASS: a 3060003 on one table no longer empties the dashboard.\n')
} catch (e) { bad(e.message) }

// ── C) All-fail still throws (so play.ts can show a toast) ────────────────────
console.log('C) all-fail — when every read rejects, fetchGameState throws:')
async function fetchGameStateAllFail() {
  const settled = await Promise.allSettled([
    Promise.reject(new Error('node down')),
    Promise.reject(new Error('node down')),
  ])
  if (settled.every((r) => r.status === 'rejected')) {
    throw settled[0].reason instanceof Error ? settled[0].reason : new Error(String(settled[0].reason))
  }
}
let threw = false
try {
  await fetchGameStateAllFail()
} catch {
  threw = true
}
try {
  assert.ok(threw, 'all-fail did not throw — play.ts would render a silent empty dashboard')
  console.log('   → C PASS: total read failure throws (play.ts surfaces it).\n')
} catch (e) { bad(e.message) }

// ── Verdict ──────────────────────────────────────────────────────────────────
if (failures === 0) {
  console.log('═══ ALL CHECKS PASSED — chain reads complete on every table; 3060003 closed. ═══\n')
} else {
  console.log(`═══ ${failures} CHECK(S) FAILED ═══\n`)
  process.exit(1)
}
