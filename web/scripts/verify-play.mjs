// verify-play.mjs — PROVE the Pocket Hatchery play layer against the LIVE chain.
//
// Two checks, no proxying, no mocking, no route interception:
//
//   1. ABI MATCH   — fetch the deployed phgamecreatr ABI and assert that every
//                    action shape play.ts (via contract.ts) builds matches the
//                    on-chain struct field-for-field. Catches any drift between
//                    the web layer and the deployed contract.
//
//   2. LIVE FIRE   — if the office waxwing wallet is unlocked, sign + broadcast
//                    the real gameplay actions (initplayer, harvest, hatch,
//                    claimreward) as ACTOR and print a real txid or the exact
//                    readable contract error for each. This is the SAME action
//                    data a browser wallet would sign via play.ts — only the
//                    signer differs (office keystore vs WCW/Anchor popup).
//
// Office rule: drive plain. Never proxy/mock — that masks real bugs (the old
// verify-phase2.mjs proxied everything and hid the chain-read failure for days).
//
// Usage:
//   node scripts/verify-play.mjs                # ACTOR defaults to officewax123
//   ACTOR=waxwingsuper node scripts/verify-play.mjs
//
// Live-fire needs the wallet unlocked first:
//   curl -s -X POST http://127.0.0.1:8787/plugin/wax-wallet/cmd \
//     -H 'content-type: application/json' -d '{"cmd":"unlock","args":"<master-pw>"}'
// (the wallet auto-locks after 10 min.)

const RPC = 'https://wax-testnet.eosphere.io'
const CONTRACT = 'phgamecreatr'
const WAXWING = 'http://127.0.0.1:8787/plugin/wax-wallet/cmd'
const ACTOR = process.env.ACTOR || 'officewax123'

// ── Helpers ──────────────────────────────────────────────────────────────────
async function rpc(path, body, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${RPC}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) throw new Error(`RPC ${path} ${res.status}: ${await res.text()}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// Talk to the office waxwing plugin via fetch (NOT execSync+curl). On Windows
// execSync spawns cmd.exe, whose quoting mangles the JSON body — fetch keeps the
// payload intact and is shell-independent.
async function waxwingCmd(cmd, args, timeoutMs = 45000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(WAXWING, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd, args }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// waxwing pushaction: sign + broadcast one action as the selected wallet account.
// Mirrors EXACTLY what play.ts builds (contract.ts PocketHatcheryContract.push):
//   { account: CONTRACT, name, authorization:[{actor,permission:'active'}], data }
async function pushAction(action, data, actor = ACTOR) {
  return waxwingCmd('pushaction', { contract: CONTRACT, action, from: actor, data })
}

// ── 1. ABI MATCH ─────────────────────────────────────────────────────────────
// What play.ts builds for each action (single source of truth: contract.ts).
// Keep this in lockstep with contract.ts PocketHatcheryContract — the ABI diff
// below fails loud if they drift.
const PLAY_ACTIONS = {
  initplayer: { owner: 'name' },
  hatch: { owner: 'name', egg_type: 'uint64' },
  feed: { owner: 'name', asset_id: 'uint64' },
  evolve: { owner: 'name', asset_id: 'uint64' },
  harvest: { owner: 'name' },
  claimreward: { owner: 'name' },
}

async function checkAbi() {
  const { abi } = await rpc('/v1/chain/get_abi', { account_name: CONTRACT })
  const structFields = Object.fromEntries(abi.structs.map((s) => [s.name, s.fields]))
  const actionNames = new Set(abi.actions.map((a) => a.name))

  const results = []
  let allOk = true
  for (const [name, expected] of Object.entries(PLAY_ACTIONS)) {
    const reasons = []
    if (!actionNames.has(name)) reasons.push(`action "${name}" missing from ABI`)
    const fields = structFields[name]
    if (!fields) reasons.push(`struct "${name}" missing from ABI`)
    else {
      const got = Object.fromEntries(fields.map((f) => [f.name, f.type]))
      const expKeys = Object.keys(expected)
      const gotKeys = Object.keys(got)
      if (expKeys.length !== gotKeys.length)
        reasons.push(`field count: play=${expKeys.length} abi=${gotKeys.length}`)
      for (const [k, v] of Object.entries(expected)) {
        if (got[k] !== v) reasons.push(`field ${k}: play=${v} abi=${got[k] ?? 'MISSING'}`)
      }
    }
    const ok = reasons.length === 0
    if (!ok) allOk = false
    results.push({ action: name, ok, ...(ok ? {} : { reasons }) })
  }
  return { allOk, results }
}

// ── 2. LIVE FIRE ─────────────────────────────────────────────────────────────
async function readSnapshot(actor) {
  const [cfg, player, creatures, pool] = await Promise.all([
    rpc('/v1/chain/get_table_rows', { code: CONTRACT, scope: CONTRACT, table: 'configv2', json: true, limit: 1 }),
    rpc('/v1/chain/get_table_rows', { code: CONTRACT, scope: CONTRACT, table: 'players', json: true, limit: 1, lower_bound: actor, upper_bound: actor }),
    rpc('/v1/chain/get_table_rows', { code: CONTRACT, scope: CONTRACT, table: 'creatures', json: true, limit: 200 }),
    rpc('/v1/chain/get_table_rows', { code: CONTRACT, scope: CONTRACT, table: 'rewardpool', json: true, limit: 1 }),
  ])
  return {
    hatchCost: cfg.rows[0]?.hatch_cost,
    paused: cfg.rows[0]?.paused,
    egg: player.rows[0]?.egg_balance ?? null,
    creaturesOwned: creatures.rows.filter((r) => r.owner === actor).length,
    rewardPoolBalance: pool.rows[0]?.balance ?? '(empty — unfunded)',
  }
}

async function walletUnlocked() {
  try {
    const s = (await waxwingCmd('status', {}, 15000)).status
    return { unlocked: !!s.unlocked, selected: s.selected }
  } catch {
    return { unlocked: false, selected: null }
  }
}

function summarizeFire(r) {
  if (r.ok) return { ok: true, txid: r.txId, explorer: r.explorer }
  return { ok: false, error: r.msg }
}

async function fireLoop(actor) {
  const seq = []
  // initplayer is an upsert — safe to re-run. harvest credits EGG from roster
  // (0 with no creatures, but the action itself must succeed). hatch is the
  // action play.ts uses (bypasses the broken firsthatch). claimreward needs a
  // qualifying creature — expect a readable logic error, NOT a wiring error.
  for (const [action, data] of [
    ['initplayer', { owner: actor }],
    ['harvest', { owner: actor }],
    ['hatch', { owner: actor, egg_type: 0 }],
    ['claimreward', { owner: actor }],
  ]) {
    const r = await pushAction(action, data, actor)
    seq.push({ action, ...summarizeFire(r) })
  }
  return seq
}

// ── Run ──────────────────────────────────────────────────────────────────────
const before = await readSnapshot(ACTOR)
const abi = await checkAbi()
const wl = await walletUnlocked()

let fire = null
if (wl.unlocked) {
  fire = await fireLoop(ACTOR)
} else {
  fire = { skipped: 'waxwing wallet is LOCKED — unlock it to run the live-fire step' }
}
const after = await readSnapshot(ACTOR)

const report = {
  contract: CONTRACT,
  rpc: RPC,
  actor: ACTOR,
  walletSelected: wl.selected,
  abiMatch: abi.allOk,
  abiResults: abi.results,
  stateBefore: before,
  stateAfter: after,
  liveFire: fire,
}
console.log(JSON.stringify(report, null, 2))

// Exit code: ABI mismatch is a hard fail. Live-fire "errors" are NOT failures —
// a readable contract error (e.g. the known hatch resolve bug) is exactly the
// signal we want to surface, so it doesn't fail the script.
process.exit(abi.allOk ? 0 : 1)
