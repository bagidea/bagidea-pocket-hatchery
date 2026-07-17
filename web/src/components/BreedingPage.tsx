import { useMemo, useState } from 'react'
import { CreatureSprite } from './CreatureCard'
import type { Creature, Resources } from '../play'
import styles from './BreedingPage.module.css'

interface BreedingPageProps {
  creatures: Creature[]
  resources: Resources
  breedCost: number | null
  disabled?: boolean
  onBreed: (parentA: string, parentB: string) => void
}

interface Validation {
  ok: boolean
  message: string
}

function formatCooldown(seconds: number): string {
  if (seconds <= 0) return 'Ready'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getCooldownLeft(creature: Creature): number {
  if (!creature.lastBred || !creature.breedCooldown) return 0
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, creature.lastBred + creature.breedCooldown - now)
}

function SelectableCard({
  creature,
  selected,
  slot,
  onClick,
}: {
  creature: Creature
  selected: boolean
  slot?: 'A' | 'B'
  onClick: () => void
}) {
  const cooldownLeft = getCooldownLeft(creature)
  const ready = cooldownLeft === 0
  const rarity = (creature.rarity || 'common').toLowerCase()

  return (
    <button
      type="button"
      className={`${styles.selectorCard} ${selected ? styles.selected : ''} ${styles[rarity] || styles.common}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className={styles.selectorArt}>
        <CreatureSprite genetics={creature.genetics} species={creature.name || creature.species} assetId={creature.assetId} rarity={creature.rarity} />
      </div>
      <div className={styles.selectorInfo}>
        <div className={styles.selectorName}>{creature.name || creature.species}</div>
        <div className={styles.selectorMeta}>
          #{String(creature.assetId).slice(-4)} · Stage {creature.stage}
        </div>
        <div className={`${styles.cooldownBadge} ${ready ? styles.ready : styles.busy}`}>
          {ready ? '💖 Ready to breed' : `⏱ ${formatCooldown(cooldownLeft)}`}
        </div>
      </div>
      {selected && (
        <div className={styles.slotBadge}>
          {slot === 'A' ? 'Sire' : 'Dam'}
        </div>
      )}
    </button>
  )
}

export function BreedingPage({ creatures, resources, breedCost, disabled, onBreed }: BreedingPageProps) {
  const [parentA, setParentA] = useState<string | null>(null)
  const [parentB, setParentB] = useState<string | null>(null)

  const cost = breedCost ?? 0

  const validation: Validation = useMemo(() => {
    if (!parentA || !parentB) {
      return { ok: false, message: 'Select both parents first' }
    }
    if (parentA === parentB) {
      return { ok: false, message: 'Must select two different creatures' }
    }
    const a = creatures.find((c) => c.assetId === parentA)
    const b = creatures.find((c) => c.assetId === parentB)
    if (!a || !b) {
      return { ok: false, message: 'Selected creature not found' }
    }
    const aCd = getCooldownLeft(a)
    const bCd = getCooldownLeft(b)
    if (aCd > 0) {
      return { ok: false, message: `Sire (${a.name}) cooldown: ${formatCooldown(aCd)}` }
    }
    if (bCd > 0) {
      return { ok: false, message: `Dam (${b.name}) cooldown: ${formatCooldown(bCd)}` }
    }
    if (cost > 0 && resources.hatch < cost) {
      return { ok: false, message: `Need ${cost} HATCH (have ${resources.hatch})` }
    }
    return { ok: true, message: 'Ready to breed' }
  }, [parentA, parentB, creatures, resources.hatch, cost])

  const handleBreed = () => {
    if (!validation.ok || !parentA || !parentB) return
    onBreed(parentA, parentB)
  }

  if (creatures.length < 2) {
    return (
      <div className={styles.breedingPage}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🪺</div>
          <p className={styles.emptyText}>
            You need at least 2 creatures to breed.
          </p>
          <p className={styles.emptyHint}>Hatch more eggs and come back!</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.breedingPage}>
      {/* Hero summary */}
      <section className={styles.breedHero}>
        <div className={styles.breedHeroText}>
          <h2 className={styles.breedTitle}>🧬 Breed Creatures</h2>
          <p className={styles.breedSub}>
            Select two parents — the system blends genes and mints a new offspring NFT.
          </p>
        </div>
        <div className={styles.costCard}>
          <div className={styles.costLabel}>Breed cost</div>
          <div className={styles.costValue}>{cost > 0 ? `${cost} HATCH` : '—'}</div>
          <div className={styles.balanceValue}>Balance: {resources.hatch.toLocaleString()} HATCH</div>
        </div>
      </section>

      {/* Selection */}
      <section className={styles.selectorSection}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Select Parents</h3>
          <span className={styles.sectionCount}>{creatures.length} available</span>
        </div>
        <div className={styles.selectorGrid}>
          {creatures.map((c) => {
            const selected = c.assetId === parentA || c.assetId === parentB
            const slot = c.assetId === parentA ? 'A' : c.assetId === parentB ? 'B' : undefined
            return (
              <SelectableCard
                key={c.assetId}
                creature={c}
                selected={selected}
                slot={slot}
                onClick={() => {
                  if (c.assetId === parentA) {
                    setParentA(null)
                  } else if (c.assetId === parentB) {
                    setParentB(null)
                  } else if (!parentA) {
                    setParentA(c.assetId)
                  } else if (!parentB) {
                    setParentB(c.assetId)
                  } else {
                    // both full → replace the older pick (parentB)
                    setParentB(c.assetId)
                  }
                }}
              />
            )
          })}
        </div>
      </section>

      {/* Match preview */}
      {(parentA || parentB) && (
        <section className={styles.previewSection}>
          <div className={styles.previewSlots}>
            <ParentSlot
              label="Sire"
              creature={creatures.find((c) => c.assetId === parentA)}
              onClear={() => setParentA(null)}
            />
            <div className={styles.heartDivider}>💞</div>
            <ParentSlot
              label="Dam"
              creature={creatures.find((c) => c.assetId === parentB)}
              onClear={() => setParentB(null)}
            />
          </div>
          <div className={`${styles.statusLine} ${validation.ok ? styles.ok : styles.warn}`}>
            {validation.message}
          </div>
          <button
            className={styles.breedBtn}
            onClick={handleBreed}
            disabled={disabled || !validation.ok}
          >
            <span>🧬</span>
            Breed Now
          </button>
        </section>
      )}
    </div>
  )
}

function ParentSlot({
  label,
  creature,
  onClear,
}: {
  label: string
  creature: Creature | undefined
  onClear: () => void
}) {
  if (!creature) {
    return (
      <div className={styles.emptySlot}>
        <span className={styles.emptySlotLabel}>{label}</span>
        <span className={styles.emptySlotHint}>Not selected</span>
      </div>
    )
  }

  return (
    <div className={styles.parentSlot}>
      <div className={styles.parentArt}>
        <CreatureSprite genetics={creature.genetics} species={creature.name || creature.species} assetId={creature.assetId} rarity={creature.rarity} />
      </div>
      <div className={styles.parentInfo}>
        <div className={styles.parentLabel}>{label}</div>
        <div className={styles.parentName}>{creature.name || creature.species}</div>
        <div className={styles.parentMeta}>#{String(creature.assetId).slice(-4)}</div>
      </div>
      <button type="button" className={styles.clearBtn} onClick={onClear} aria-label={`Clear ${label}`}>
        ✕
      </button>
    </div>
  )
}
