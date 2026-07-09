import { SessionKit, Session } from '@wharfkit/session'
import { ChainDefinition } from '@wharfkit/common'
import { WebRenderer } from '@wharfkit/web-renderer'
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { getActiveNetwork } from './network'

// The chain the WCW/Anchor session binds to follows the active network
// (?network= switcher). testnet chain id f16b1833…; RPC leads with eosphere.io
// (waxsweden.org is flaky). Verified reachable 2026-07-02.
const net = getActiveNetwork()
export const activeChain = ChainDefinition.from({ id: net.chainId, url: net.rpc[0] })

// One codebase, both wallets. WCW (MyCloudWallet) supports wax-testnet per the
// connector source; Anchor covers both chains.
const walletPlugins = [new WalletPluginCloudWallet(), new WalletPluginAnchor()]

export const sessionKit = new SessionKit({
  appName: 'pocket-hatchery',
  chains: [activeChain],
  ui: new WebRenderer(),
  walletPlugins,
})

/**
 * Login must be called inside a user gesture (onClick) so the wallet popup/tab
 * is not blocked by the browser.
 */
export async function login(): Promise<Session> {
  const { session } = await sessionKit.login()
  return session
}

export async function restore(): Promise<Session | undefined> {
  return sessionKit.restore()
}

export async function logout(): Promise<void> {
  await sessionKit.logout()
}
