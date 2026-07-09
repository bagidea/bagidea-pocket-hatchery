import { useEffect, useState } from 'react'
import {
  computeSatiety,
  feedCooldown,
  earnRate,
  fedDurFor,
  STATE_LABEL,
  MOCK_SATIETY_CONFIG,
  type SatietyConfig,
} from '../satiety'
import type { Rarity } from './CreatureCard'
import styles from './SatietyMeter.module.css'

/**
 * SatietyMeter — the Feed-v2 "ความอิ่ม" block: a live-decaying satiety bar, the
 * creature's rarity earn rate (why it's worth feeding), and a stateful Feed
 * button (Full / Hungry / Starving + cooldown countdown).
 *
 * Pure presentation over the satiety.ts model. It re-renders on a 1s tick so the
 * bar visibly falls and the cooldown counts down without the player clicking.
 * All timing/earn math lives in satiety.ts — this file only draws it.
 */
interface SatietyMeterProps {
  /** Unix seconds of the creature's last feed (chain: creature_row.last_fed). */
  lastFed: number
  rarity: Rarity
  stage: number
  onFeed?: () => void
  /** Card-level disable (an action is mid-flight, or max stage). */
  disabled?: boolean
  /** Override the decay clock (preview uses a fast one). Defaults to MOCK. */
  config?: SatietyConfig
  /**
   * Live fed_dur (seconds) for this creature from chain (configv3.fed_dur_*).
   * When absent, the per-rarity spec default (FED_DUR_DEFAULT) is used.
   */
  fedDurSec?: number
}

/** Format seconds into a short countdown (mirrors App.tsx's formatCooldown). */
function fmt(seconds: number): string {
  if (seconds <= 0) return 'Ready'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function SatietyMeter({
  lastFed,
  rarity,
  stage,
  onFeed,
  disabled = false,
  config = MOCK_SATIETY_CONFIG,
  fedDurSec,
}: SatietyMeterProps) {
  // 1s tick → the bar decays and the cooldown counts down on screen.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Resolve the fed_dur: preview override > live chain value > per-rarity default.
  const fedDur = fedDurFor(rarity, config, fedDurSec)
  const reading = computeSatiety(lastFed, now, fedDur, config)
  const cd = feedCooldown(lastFed, now, config)
  const earn = earnRate(rarity, stage, reading.state)

  const stateClass =
    reading.state === 'full' ? styles.full
      : reading.state === 'hungry' ? styles.hungry
        : styles.starving

  // The Feed button is blocked while an action is running or the cooldown is up.
  const feedBlocked = disabled || cd.onCooldown

  return (
    <div className={styles.wrap}>
      {/* ── Satiety bar ── */}
      <div className={styles.barHead}>
        <span className={styles.barLabel}>🍽️ Satiety</span>
        <span className={`${styles.stateBadge} ${stateClass}`}>
          {reading.state === 'full' ? '😋' : reading.state === 'hungry' ? '😕' : '😖'}
          {STATE_LABEL[reading.state]}
        </span>
        <span className={styles.barPercent}>{Math.round(reading.percent)}%</span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${stateClass}`}
          style={{ width: `${reading.percent}%` }}
        />
      </div>

      {/* ── Earn rate (rarity-driven) ── */}
      <div className={styles.earnRow}>
        <span className={styles.earnRarity}>
          {rarity.charAt(0).toUpperCase() + rarity.slice(1)} ×{earn.multiplier.toFixed(2)}
        </span>
        <span className={styles.earnRate} title="EGG earned per hour at current satiety">
          {earn.effective.toFixed(1)}
          <span className={styles.earnUnit}>EGG/hr</span>
          {reading.state !== 'full' && (
            <span className={styles.earnBase}>(full: {earn.base.toFixed(1)})</span>
          )}
        </span>
      </div>

      {/* ── Feed button (stateful) ── */}
      <button
        className={`${styles.feedBtn} ${stateClass}`}
        onClick={onFeed}
        disabled={feedBlocked}
      >
        {cd.onCooldown ? (
          <>⏳ Feed in {fmt(cd.secondsLeft)}</>
        ) : reading.state === 'starving' ? (
          <>🍎 Feed now! · Free</>
        ) : reading.state === 'hungry' ? (
          <>🍎 Feed · Free</>
        ) : (
          <>🍎 Feed · Free</>
        )}
      </button>
    </div>
  )
}
