/**
 * waxwing.ts — the office daemon wallet as a SECOND connect backend.
 *
 * Connect path #2 (alongside the standard WAX Cloud Wallet / Anchor WCW path):
 * instead of popping a browser wallet, the game drives the office's own waxwing
 * wallet (daemon :8787). Reads use waxwing status/account/balance; signing uses
 * waxwing pushaction — the SAME {account, action, data} a browser wallet would
 * sign, only the signer differs (daemon keystore vs a popup).
 *
 * TRANSPORT: same-origin via the Vite dev proxy. The browser calls
 * `/office/plugin/wax-wallet/cmd`, which Vite forwards to 127.0.0.1:8787. The
 * daemon has no CORS headers and ignores OPTIONS, so a direct cross-origin fetch
 * from :5173 is blocked; the proxy sidesteps CORS with no daemon change.
 * (For a node script with no proxy, set VITE_WAXWING_BASE to the daemon URL.)
 *
 * NETWORK SYNC: waxwing keeps its OWN selected network. The game calls
 * ensureNetwork() on connect so the wallet is on the same chain as the game
 * (testnet↔mainnet switch via ?network= stays in lockstep).
 */
import { getActiveNetwork } from './network'

// Dev → Vite proxy at /office (same-origin, no CORS); prod → daemon directly.
const WAXWING_BASE =
  (import.meta.env?.VITE_WAXWING_BASE as string | undefined) ||
  (import.meta.env?.DEV ? '/office' : 'http://127.0.0.1:8787')
const WAXWING_CMD = `${WAXWING_BASE}/plugin/wax-wallet/cmd`
const EVENTS = `${WAXWING_BASE}/event`

export interface WaxwingAccount {
  account: string
  permission: string
  publicKey: string
  selected?: boolean
}

export interface WaxwingStatus {
  network: { id: string; kind: string; name?: string }
  networks?: unknown[]
  accounts: WaxwingAccount[]
  selected: string
  auth?: string
  unlocked: boolean
  unlockedKeys?: number
  hasPassword: boolean
  /** Live sign-intents awaiting a Sign (built by ANY client — incl. the game). */
  pendingIntents?: WaxwingIntent[]
  /** Resolved intent outcomes, kept briefly after the single-use intent is gone. */
  intentResults?: WaxwingIntentResult[]
}

/** The recorded outcome of a resolved sign-intent (read via status().intentResults). */
export interface WaxwingIntentResult {
  id: string
  at: number
  ok: boolean
  txid?: string
  error?: string
  kind?: string
  action?: string
  label?: string
}

export interface WaxwingPushResult {
  ok: boolean
  txid?: string
  explorer?: string
  error?: string
}

/** A pending sign-intent returned by `buildaction` and resolved by `confirm`. */
export interface WaxwingIntent {
  id: string
  kind: string
  action?: string
  contract?: string
  data?: Record<string, unknown>
  label?: string
  owner?: string
  network: string
  networkId: string
  chainKind: string
  coreSymbol?: string
  expiresAt: number
}

async function cmd<T = unknown>(
  command: string,
  args: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(WAXWING_CMD, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd: command, args }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`waxwing ${command} HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Full wallet status: selected network, stored accounts, lock state. */
export async function waxwingStatus(): Promise<WaxwingStatus> {
  const r = await cmd<{ status: WaxwingStatus }>('status', {})
  return r.status
}

/**
 * Make sure the daemon wallet is on the same network as the game. setnetwork is
 * idempotent; call before connect so a testnet↔mainnet URL switch syncs the
 * wallet too. Throws if the daemon rejects the network id.
 */
export async function ensureNetwork(waxwingId = getActiveNetwork().waxwingId): Promise<void> {
  const before = await waxwingStatus()
  if (before.network?.id !== waxwingId) {
    await cmd('setnetwork', { network: waxwingId })
  }
}

/** Account info (core WAX balance + CPU/NET/RAM) on the wallet's network. */
export async function waxwingAccount(name: string): Promise<unknown> {
  const r = await cmd<{ account: unknown }>('account', { name })
  return r.account
}

/** Token balance for one account; pass symbol+contract for a precise read. */
export async function waxwingBalance(
  name: string,
  symbol?: string,
  contract?: string,
): Promise<unknown> {
  const r = await cmd<{ balance: unknown }>('balance', {
    name,
    ...(symbol ? { symbol } : {}),
    ...(contract ? { contract } : {}),
  })
  return r.balance
}

/**
 * Sign + broadcast a game action as `from`. Mirrors contract.ts exactly — same
 * contract/action/data, only the signer differs. Requires the wallet UNLOCKED
 * (the daemon holds encrypted keys; pushaction can't sign otherwise).
 *
 * Returns { ok, txid } on success; throws a readable error on failure so the
 * play layer can surface it (e.g. "wallet locked" or the contract assertion msg).
 */
export async function waxwingPushAction(
  action: string,
  data: Record<string, unknown>,
  from: string,
  contract = getActiveNetwork().contract,
): Promise<{ txid: string }> {
  const r = await cmd<WaxwingPushResult & { msg?: string; txId?: string }>(
    'pushaction',
    { contract, action, from, data },
  )
  if (r.ok) return { txid: String(r.txId ?? r.txid ?? '') }
  // waxwing returns { ok:false, msg } on a sign/broadcast failure — surface it.
  throw new Error(r.msg || r.error || 'waxwing pushaction failed')
}

/**
 * Build a sign-intent for a game action — the confirm-before-broadcast path.
 * `pushaction` signs + broadcasts immediately (used by admin/deploy scripts);
 * `buildaction` only VALIDATES + returns an intent. The UI must show the
 * summary to the player and call `waxwingConfirm(id)` after they tap Sign
 * (CEO rule: never broadcast a player action without their tap). `label` is a
 * human-readable summary the Sign popup shows (e.g. "Hatch Egg −150 HATCH").
 *
 * This reuses the exact same sx_ intent + confirm/cancel gate as send/stake.
 */
export async function waxwingBuildAction(
  action: string,
  data: Record<string, unknown>,
  from: string,
  opts: { contract?: string; label?: string } = {},
): Promise<WaxwingIntent> {
  const r = await cmd<{ confirmRequired?: boolean; intent?: WaxwingIntent; msg?: string }>(
    'buildaction',
    {
      contract: opts.contract ?? getActiveNetwork().contract,
      action,
      from,
      data,
      label: opts.label ?? '',
    },
  )
  if (r.confirmRequired && r.intent) return r.intent
  throw new Error(r.msg || 'waxwing buildaction failed')
}

/**
 * Broadcast a previously-built intent after the player taps Sign in the popup.
 * Single-use: the engine drops the intent once broadcast (or on TTL/expiry).
 */
export async function waxwingConfirm(id: string): Promise<{ txid: string; explorer?: string }> {
  const r = await cmd<{
    result?: { broadcast?: boolean; txId?: string; explorer?: string }
    msg?: string
  }>('confirm', { id })
  if (r.result?.broadcast) {
    return { txid: String(r.result.txId ?? ''), explorer: r.result.explorer }
  }
  throw new Error(r.msg || 'waxwing confirm failed')
}

/** Drop a pending sign-intent (player dismissed the Sign popup). */
export async function waxwingCancel(id: string): Promise<void> {
  await cmd('cancel', { id })
}

/**
 * Wait for a built intent to resolve by polling the daemon's status — the
 * player signs (or cancels) IN THE WALLET, never in the game. The game builds
 * an intent (buildaction), opens the waxwing panel, then awaits this; the
 * player's tap in waxwing broadcasts (or cancels) it, and the engine records
 * the outcome. The intent is single-use, so once it leaves `pendingIntents` we
 * read its recorded outcome from `intentResults` (kept ~60s after resolve) and
 * resolve on success / throw 'cancelled' (or the error) otherwise.
 *
 * `signal` lets the game abort the wait when the player taps Cancel IN-GAME —
 * the caller should also `waxwingCancel(id)` so the engine drops the intent.
 */
export async function waxwingWaitForIntent(
  id: string,
  opts: { signal?: AbortSignal; timeoutMs?: number; pollMs?: number } = {},
): Promise<{ txid: string }> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000 // intent TTL is 5 min
  const pollMs = opts.pollMs ?? 1500
  const start = Date.now()
  for (;;) {
    if (opts.signal?.aborted) throw new Error('cancelled')
    if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for sign')
    const s = await waxwingStatus()
    const stillPending = (s.pendingIntents || []).some((p) => p.id === id)
    if (!stillPending) {
      // Intent is gone — read its recorded outcome.
      const r = (s.intentResults || []).find((x) => x.id === id)
      if (r && r.ok && r.txid) return { txid: r.txid }
      const err = r?.error || 'cancelled' // gone with no record → expired/restart
      throw new Error(err)
    }
    await new Promise((res) => setTimeout(res, pollMs))
  }
}

/**
 * The waxwing panel URL — absolute daemon URL (not proxied through Vite) so
 * other code can reference the daemon directly.
 */
export function waxwingPanelURL(): string {
  return 'http://127.0.0.1:8787/plugin/wax-wallet/panel.html'
}

const WAXWING_WINDOW = JSON.stringify({
  type: 'window.open',
  src: '/plugin/wax-wallet/panel',
  title: 'waxwing',
  key: 'plugin:wax-wallet',
  w: 540,
  h: 800,
  resizable: 0,
})

async function postWindowOpen(signal?: AbortSignal): Promise<void> {
  await fetch(EVENTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: WAXWING_WINDOW,
    signal,
  })
}

/**
 * Open the waxwing wallet as a **native shell window** and bring it to
 * the front. POSTs a "window.open" event to the daemon's /event endpoint
 * → daemon broadcasts to all WebSocket clients → overlay route() catches
 * "window.open" → popWindow() → shellPost("open-window:…") → shell
 * native window (or focuses the existing one via singleton check on key).
 *
 * Two-phase: the first POST opens/creates the window; after a 500ms pause
 * (enough for the OS to finish mapping the window), a second POST hits the
 * same singleton key so the shell calls set_focus() — guaranteeing the
 * window is on top every time. Falls back to window.open() when the daemon
 * is not reachable at all.
 */
export async function openWaxwingPanel(): Promise<void> {
  // Phase 1 — open (or re-focus via singleton) the native window.
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    await postWindowOpen(ctrl.signal)
    clearTimeout(timer)
  } catch {
    // daemon not reachable at all — fall back to browser tab.
    window.open(waxwingPanelURL(), '_blank')
    return
  }

  // Phase 2 — after a short settle, fire again so the shell's singleton
  // check calls set_focus() on the now-mapped window, pulling it to the
  // top even when the user clicked "Open Wallet" from behind another app.
  try {
    await new Promise((r) => setTimeout(r, 500))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    await postWindowOpen(ctrl.signal)
    clearTimeout(timer)
  } catch {
    // focus call failed — window is already open from phase 1, harmless.
  }
}
