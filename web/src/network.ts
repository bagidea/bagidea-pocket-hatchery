/**
 * network.ts — single source of truth for the active WAX network.
 *
 * Dev-only switcher (internal use, NOT a public button): set ?network=wax-mainnet
 * in the URL; default is wax-testnet. The value is read once at module load, so a
 * switch is just a page reload with a different param.
 *
 * Everything that touches the chain reads this module:
 *   - chain.ts      → RPC endpoints + the game contract account (table reads)
 *   - contract.ts   → the contract account (WCW sign path)
 *   - wallet.ts     → chain id + RPC url for the WharfKit/WCW session
 *   - waxwing.ts    → the daemon wallet's network id (kept in sync on connect)
 *   - play.ts       → guards (mainnet is not playable yet)
 *
 * RULE (CEO): testnet-first. Mainnet is wired in config but its game contract is
 * NOT deployed yet (Kevin), so selecting mainnet blocks connect with a clear
 * message. Do not exercise mainnet until testnet passes.
 */

export type NetworkId = 'wax-testnet' | 'wax-mainnet'

export interface NetworkConfig {
  id: NetworkId
  label: string
  kind: 'testnet' | 'mainnet'
  chainId: string
  /** RPC endpoints the game reads tables from, tried in order. */
  rpc: readonly string[]
  /** The deployed game contract on this network. '' = not deployed → blocks connect. */
  contract: string
  /** waxwing daemon network id (its setnetwork vocabulary) — must stay in sync. */
  waxwingId: string
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  'wax-testnet': {
    id: 'wax-testnet',
    label: 'WAX Testnet',
    kind: 'testnet',
    chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
    rpc: ['https://wax-testnet.eosphere.io', 'https://testnet.waxsweden.org'],
    contract: 'phgamecreatr',
    waxwingId: 'wax-testnet',
  },
  'wax-mainnet': {
    id: 'wax-mainnet',
    label: 'WAX Mainnet',
    kind: 'mainnet',
    chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    rpc: ['https://wax.greymass.com'],
    contract: '', // not deployed yet — Kevin. Selecting this blocks connect.
    waxwingId: 'wax-mainnet',
  },
}

const ALLOWED = new Set<NetworkId>(Object.keys(NETWORKS) as NetworkId[])

function readFromUrl(): NetworkId {
  if (typeof window === 'undefined') return 'wax-testnet' // node scripts → testnet
  const raw = new URLSearchParams(window.location.search).get('network')
  return raw && ALLOWED.has(raw as NetworkId) ? (raw as NetworkId) : 'wax-testnet'
}

// Read once at load; a switch is a reload with a new ?network= value.
const ACTIVE: NetworkId = readFromUrl()

export function getActiveNetwork(): NetworkConfig {
  return NETWORKS[ACTIVE]
}

export function isMainnet(): boolean {
  return NETWORKS[ACTIVE].kind === 'mainnet'
}

/** True when the selected network actually has a deployed game contract. */
export function isPlayable(): boolean {
  return NETWORKS[ACTIVE].contract !== ''
}
