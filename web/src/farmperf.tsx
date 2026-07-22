/**
 * farmperf.tsx — real-GPU performance harness for the living farm.
 *
 * Mounts the SHIPPING FarmScene with a full cast of 21 creatures spanning every
 * species and every mood (content / hungry / starving / asleep), at the same
 * stage size the game uses. No mocks of the render path — the real sprites, the
 * real frame loop, the real filters. Trace this in headed real Chrome (hardware
 * GPU) to see where the farm actually spends its frame budget.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/baloo-2/400.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/mali/400.css'
import '@fontsource/mali/600.css'
import './styles/tokens.css'
import './index.css'
import { FarmScene } from './components/FarmScene'
import type { FarmCreature } from './farm'
import { initVariationSpec } from './variationSpecImpl'

initVariationSpec()

const SPECIES_INDEX: Record<string, number> = {
  foxling: 0, owlet: 1, droplet: 2, pebblit: 3, sproutling: 4,
  flicker: 5, glimmer: 6, wisp: 7, fluffle: 8, shellby: 9, dracling: 10, buzzle: 11,
}
const SPECIES = Object.keys(SPECIES_INDEX)

// Deterministic gene so every run traces the identical cast (no Math.random).
function gene(species: string, seed: number): string {
  const sid = SPECIES_INDEX[species] ?? 0
  const b = (_n: number, bits: number) => (seed * 2654435761) % (1 << bits)
  let g = BigInt(0)
  g |= BigInt(sid & 0xf) << 0n
  g |= BigInt(b(1, 8) & 0xff) << 4n
  g |= BigInt(b(2, 8) & 0xff) << 12n
  g |= BigInt(b(3, 4) & 0xf) << 20n
  g |= BigInt(b(4, 8) & 0xff) << 24n
  g |= BigInt(b(5, 4) & 0xf) << 32n
  g |= BigInt(b(6, 4) & 0xf) << 36n
  g |= BigInt(b(7, 4) & 0xf) << 40n
  g |= BigInt(b(8, 4) & 0xf) << 44n
  g |= BigInt(b(9, 2) & 0xf) << 48n
  g |= BigInt(b(10, 2) & 0xf) << 52n
  g |= BigInt(b(11, 2) & 0xf) << 56n
  g |= BigInt((seed % 7 === 0 ? 1 : 0) & 0xf) << 60n
  return g.toString(16).padStart(16, '0').toUpperCase() + '0'.repeat(48)
}

const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const
const now = Math.floor(Date.now() / 1000)

// 21 creatures: cycle species, spread moods. ~1/5 asleep (stage 0), the rest a
// mix of content / hungry / starving via lastFed age against a fast decay.
const creatures: FarmCreature[] = Array.from({ length: 21 }, (_, i) => {
  const species = SPECIES[i % SPECIES.length]
  const asleep = i % 5 === 0
  const fedAgeSec = [0, 40 * 60, 3 * 60 * 60][i % 3] // fresh / hungry / starving-ish
  return {
    assetId: String(5000 + i),
    name: `${species} #${i}`,
    genetics: gene(species, i + 1),
    rarity: RARITY[i % RARITY.length],
    stage: asleep ? 0 : 1 + (i % 3),
    lastFed: now - fedAgeSec,
    fedDur: 60 * 60,
    bornAt: now - 24 * 60 * 60,
    awakenDur: 60 * 60,
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <FarmScene creatures={creatures} />
    </div>
  </StrictMode>,
)
