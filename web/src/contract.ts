import type { Session } from '@wharfkit/session'
import { getActiveNetwork } from './network'

// Follows the active network (?network= switcher). testnet = phgamecreatr;
// mainnet = '' until Kevin deploys there.
export const CONTRACT_ACCOUNT = getActiveNetwork().contract

export interface ContractCallResult {
  txid: string
  actionName: string
  action: Record<string, unknown>
  broadcast: boolean
}

/**
 * Shape of a WharfKit `session.transact()` broadcast result. We only need the
 * transaction id, so we read it defensively across the documented locations
 * (`response.transaction_id` on a broadcast, `id` as a checksum fallback).
 */
interface TransactResultLike {
  response?: { transaction_id?: string }
  id?: unknown
}

/**
 * Sign + broadcast a contract action through the user's own browser wallet
 * (WAX Cloud Wallet / Anchor) via the live WharfKit session.
 *
 * This is the only signing path that works for a public player on wax-testnet:
 * it does not need the office's local keystore. (The previous waxwing
 * `pushaction` path required the office wallet to be unlocked and only signed
 * with keys that live in that keystore, so it could not serve an external user.)
 */
export class PocketHatcheryContract {
  private session: Session

  constructor(session: Session) {
    this.session = session
  }

  private get actor(): string {
    return String(this.session.actor)
  }

  private get permission(): string {
    // WharfKit sessions default to the "active" permission.
    return String(this.session.permission ?? 'active')
  }

  // Public so play.ts can sign an arbitrary action through the unified GameSigner
  // (the WCW path). Named methods below are thin wrappers over this. `contract`
  // overrides the target account for actions that aren't on the game contract —
  // e.g. the Awaken WAX wake, which is an eosio.token::transfer, not a game action.
  async push(
    name: string,
    data: Record<string, unknown>,
    contract?: string,
  ): Promise<ContractCallResult> {
    const account = contract ?? CONTRACT_ACCOUNT
    const action = {
      account,
      name,
      authorization: [{ actor: this.actor, permission: this.permission }],
      data,
    }
    const result = (await this.session.transact(
      { actions: [action] },
      { broadcast: true },
    )) as TransactResultLike
    const txid = String(result?.response?.transaction_id ?? result?.id ?? '')
    return { txid, actionName: name, action, broadcast: true }
  }

  /**
   * Sign + broadcast SEVERAL pre-built actions as ONE atomic transaction — the
   * In-Game Marketplace path (list = announcesale+createoffer, buy = deposit+
   * purchasesale). The actions arrive fully built (market.ts) with the actor
   * already in their authorization; this only hands them to the wallet.
   */
  async pushActions(
    actions: { account: string; name: string; authorization: { actor: string; permission: string }[]; data: Record<string, unknown> }[],
  ): Promise<{ txid: string }> {
    const result = (await this.session.transact(
      { actions },
      { broadcast: true },
    )) as TransactResultLike
    return { txid: String(result?.response?.transaction_id ?? result?.id ?? '') }
  }

  async initplayer(): Promise<ContractCallResult> {
    return this.push('initplayer', { owner: this.actor })
  }

  async hatch(eggType: number): Promise<ContractCallResult> {
    return this.push('hatch', { owner: this.actor, egg_type: eggType })
  }

  async feed(assetId: string): Promise<ContractCallResult> {
    return this.push('feed', { owner: this.actor, asset_id: assetId })
  }

  async evolve(assetId: string): Promise<ContractCallResult> {
    return this.push('evolve', { owner: this.actor, asset_id: assetId })
  }

  async harvest(): Promise<ContractCallResult> {
    return this.push('harvest', { owner: this.actor })
  }

  async claimreward(): Promise<ContractCallResult> {
    return this.push('claimreward', { owner: this.actor })
  }

  async breed(parentA: string, parentB: string): Promise<ContractCallResult> {
    return this.push('breed', {
      owner: this.actor,
      parent_a: parentA,
      parent_b: parentB,
    })
  }

  async setname(assetId: string, newName: string): Promise<ContractCallResult> {
    return this.push('setname', {
      owner: this.actor,
      asset_id: assetId,
      new_name: newName,
    })
  }

  async burncreature(assetId: string): Promise<ContractCallResult> {
    return this.push('burncreature', { owner: this.actor, asset_id: assetId })
  }

  async accelerate(assetId: string, amount: string): Promise<ContractCallResult> {
    return this.push('accelerate', { owner: this.actor, asset_id: assetId, amount })
  }

  async withdraw(
    tokenContract: string,
    quantity: string,
    to: string,
    memo = '',
  ): Promise<ContractCallResult> {
    return this.push('withdraw', {
      token_contract: tokenContract,
      quantity,
      to,
      memo,
    })
  }
}

export function getContract(session: Session): PocketHatcheryContract {
  return new PocketHatcheryContract(session)
}
