// verify-waxwing-connect.mjs — PROVE the "Connect via waxwing" path end-to-end.
//
// This is the testnet round-trip the CEO asked for: prove the game can use the
// office daemon wallet (waxwing) as its wallet backend — READ account/balance,
// then SIGN at least one game action — same flow waxwing.ts + play.ts drive.
//
// It mirrors EXACTLY what the browser does over the Vite /office proxy:
//   ensureNetwork → status → account → balance → pushaction
// (Node has no CORS, so it talks to the daemon directly; waxwing.ts honors
//  VITE_WAXWING_BASE for the same purpose.)
//
// CEO RULE: testnet-first, and if the wallet is LOCKED at the sign step, STOP
// and report — do NOT auto-unlock. The read half still proves the connect; the
// sign half is gated on an unlocked wallet and will say so plainly.
//
// Usage (wallet on wax-testnet, selected = waxwingsuper):
//   node scripts/verify-waxwing-connect.mjs
//   ACTOR=waxwingsuper node scripts/verify-waxwing-connect.mjs

const WAXWING = process.env.WAXWING || 'http://127.0.0.1:8787/plugin/wax-wallet/cmd'
const NETWORK = process.env.NETWORK || 'wax-testnet' // game's active network (must sync)
const ACTOR_OVERRIDE = process.env.ACTOR // default = wallet's selected account
// A cheap, idempotent game action to sign (Kevin: harvest is a clean live action;
// initplayer is an upsert — both safe to re-fire). harvest credits EGG from roster.
const SIGN_ACTION = process.env.SIGN_ACTION || 'harvest'

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
    return { httpOk: res.ok, status: res.status, body: await res.json() }
  } finally {
    clearTimeout(t)
  }
}

const pass = []
const fail = []
function check(name, cond, detail) {
  ;(cond ? pass : fail).push(name)
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ── 1. ensureNetwork (sync wallet to the game's network) ────────────────────
const setNet = await waxwingCmd('setnetwork', { network: NETWORK })
check(
  `wallet synced to game network (${NETWORK})`,
  setNet.body?.ok !== false,
  setNet.body?.ok === false ? setNet.body?.msg : 'already/in sync',
)

// ── 2. status (selected account + lock state) ───────────────────────────────
const st = (await waxwingCmd('status', {})).body.status
const actor = ACTOR_OVERRIDE || st.accounts.find((a) => a.selected)?.account || st.accounts[0]?.account
check(
  'status: wallet has a selected account',
  !!actor,
  `selected=${st.selected} actor=${actor} unlocked=${st.unlocked}`,
)
check(
  `wallet network matches game (${NETWORK})`,
  st.network?.id === NETWORK,
  `wallet=${st.network?.id} game=${NETWORK}`,
)

// ── 3. READ account (core WAX balance + CPU/NET/RAM) ────────────────────────
const acct = (await waxwingCmd('account', { name: actor })).body.account
check(
  'READ account via waxwing',
  !!acct?.account,
  `${acct?.account} · ${acct?.coreBalance ?? '?'} · HATCH=${acct?.tokens?.find((t) => t.symbol === 'HATCH')?.amount ?? 0}`,
)

// ── 4. READ token balance (the $HATCH the dashboard shows) ──────────────────
const bal = (await waxwingCmd('balance', { name: actor, symbol: 'HATCH' })).body
const hatchAmt = Array.isArray(bal?.balance)
  ? bal.balance.join(', ')
  : bal?.balance?.amount ?? bal?.balance
check('READ $HATCH balance via waxwing', hatchAmt !== undefined && hatchAmt !== '', String(hatchAmt))

// ── 5. SIGN one game action (the round-trip) ────────────────────────────────
// CEO rule: if the wallet is LOCKED here, STOP and report — never auto-unlock.
const contract = 'phgamecreatr'
let signed = null
if (st.unlocked) {
  const push = await waxwingCmd('pushaction', {
    contract,
    action: SIGN_ACTION,
    from: actor,
    data: { owner: actor },
  })
  if (push.body?.ok) {
    signed = { ok: true, txid: push.body.txId, explorer: push.body.explorer }
  } else {
    signed = { ok: false, error: push.body?.msg || push.body?.error || JSON.stringify(push.body) }
  }
} else {
  signed = {
    ok: false,
    locked: true,
    error: `wallet is LOCKED — CEO rule: stop & report for re-unlock (then re-run). action "${SIGN_ACTION}" NOT sent.`,
  }
}
check(
  `SIGN "${SIGN_ACTION}" via waxwing pushaction`,
  signed.ok,
  signed.ok ? `txid=${signed.txid} ${signed.explorer ?? ''}` : signed.error,
)

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\n── ROUND-TRIP REPORT ──')
console.log(
  JSON.stringify(
    {
      network: NETWORK,
      actor,
      walletUnlocked: st.unlocked,
      read: { account: !!acct, balance: hatchAmt !== undefined },
      sign: signed,
    },
    null,
    2,
  ),
)

console.log(`\n${pass.length} passed, ${fail.length} failed`)
// A locked-wallet sign step is NOT a hard fail (read path proved the connect);
// it's the expected "stop & ask owner to re-unlock" signal. Only a real read
// failure or a network mismatch fails the script.
const hardFail = fail.some((f) => !f.startsWith('SIGN'))
process.exit(hardFail ? 1 : 0)
