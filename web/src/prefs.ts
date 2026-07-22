/**
 * prefs.ts — pinned favourites.
 *
 * A pin is a view preference: it decides what floats to the top of YOUR
 * collection and has no on-chain meaning, so it lives in the plugin's own data
 * dir, reached through the office daemon (plugins/pocket-hatchery/index.js).
 *
 * NAMES USED TO LIVE HERE AND NO LONGER DO. The contract's `setname` writes the
 * name into the NFT's mutable data (atomicassets::setassetdata), which makes the
 * asset the only source of truth — the name shows in any wallet and follows the
 * creature when it is traded. While a local nickname existed alongside it, the
 * two disagreed: renaming updated the card and left the farm and the NFT on the
 * old name. Read names from chain.ts / play.ts (`Creature.nickname`); do not
 * reintroduce a local override here, or that mismatch comes straight back.
 *
 * Scope: `<network>:<account>` — networks are never merged, because the same
 * asset_id exists on both.
 *
 * The endpoint is same-origin when the daemon serves the panel (the real deploy
 * path). Opened from a bare vite preview it 404s; the hook then degrades to
 * in-memory prefs for that session rather than breaking the collection.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getActiveNetwork } from './network'

const CMD_URL = '/plugin/pocket-hatchery/cmd'

export interface Prefs {
  /** assetIds pinned to the top of the collection. */
  pins: string[]
}

const EMPTY: Prefs = { pins: [] }

interface CmdReply {
  ok: boolean
  msg?: string
  // The daemon still replies with `nicknames` for older clients. Deliberately not
  // read: creature names come from the NFT, and honouring this field here would
  // let a stale local value shadow the chain again.
  pins?: string[]
}

async function cmd(name: string, args: Record<string, unknown>): Promise<CmdReply | null> {
  try {
    const res = await fetch(CMD_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd: name, args }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as CmdReply
    return data && data.ok ? data : null
  } catch {
    // Daemon not reachable (bare preview / offline) — the caller keeps its optimistic
    // state, so the UI still works for the session.
    return null
  }
}

/**
 * Live pin state for one account, with optimistic writes.
 *
 * `persisted` is false when the daemon never answered, so the UI can say the prefs
 * are session-only instead of quietly pretending they were saved.
 */
export function useCreaturePrefs(account: string | null) {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY)
  const [persisted, setPersisted] = useState(true)
  const network = getActiveNetwork().id
  // Guards a late reply from a previous account overwriting the current one's prefs.
  const accountRef = useRef(account)
  accountRef.current = account

  useEffect(() => {
    if (!account) {
      setPrefs(EMPTY)
      return
    }
    let cancelled = false
    cmd('prefs', { network, account }).then((reply) => {
      if (cancelled || accountRef.current !== account) return
      if (!reply) {
        setPersisted(false)
        return
      }
      setPersisted(true)
      setPrefs({ pins: reply.pins ?? [] })
    })
    return () => {
      cancelled = true
    }
  }, [account, network])

  const togglePin = useCallback(
    async (assetId: string) => {
      if (!account) return
      const want = !prefs.pins.includes(assetId)
      setPrefs((p) => ({
        ...p,
        pins: want ? [...p.pins, assetId] : p.pins.filter((id) => id !== assetId),
      }))
      // Send the explicit target, not a toggle, so a double-tap can't race into
      // the opposite state on the server.
      const reply = await cmd('pin', { network, account, assetId, pinned: want })
      if (!reply) {
        setPersisted(false)
        return
      }
      setPersisted(true)
      setPrefs({ pins: reply.pins ?? [] })
    },
    [account, network, prefs.pins],
  )

  return { prefs, persisted, togglePin }
}

export interface SearchableCreature {
  assetId: string
  /** Species name decoded from genetics (the default display name). */
  name: string
  /** On-chain elemental family (speciescfg.family, e.g. "Fire"). */
  species: string
  rarity: string
}

/**
 * Filter a collection by a free-text query across name, asset id, species and
 * tier — the four things a player actually remembers a creature by. The `nickname`
 * argument is the creature's ON-CHAIN NFT name (Creature.nickname), so searching
 * for what a player renamed a creature to finds it. Matching is
 * case-insensitive substring; an empty query keeps everything.
 */
export function matchesQuery(
  creature: SearchableCreature,
  nickname: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [nickname ?? '', creature.name, creature.species, creature.rarity, creature.assetId]
  return haystack.some((field) => String(field).toLowerCase().includes(q))
}

/**
 * Pinned creatures first, each group keeping the collection's existing order, so
 * pinning only ever lifts a card — it never reshuffles the rest.
 */
export function sortPinnedFirst<T extends { assetId: string }>(creatures: T[], pins: string[]): T[] {
  const pinned = new Set(pins)
  return [
    ...creatures.filter((c) => pinned.has(c.assetId)),
    ...creatures.filter((c) => !pinned.has(c.assetId)),
  ]
}
