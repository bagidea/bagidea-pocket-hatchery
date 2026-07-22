import { useEffect, useState } from 'react'
import { computeAwaken, awakenDurFor } from '../awaken'
import type { Rarity } from './CreatureCard'
import styles from './AwakenMeter.module.css'

/**
 * AwakenMeter — the Awaken-v2 wake block: a live sleep-timer bar and a WAX
 * "Wake now" button. Rendered INSTEAD of the SatietyMeter while a creature is
 * asleep (stage 0) — a dozing egg can't be fed, only woken.
 *
 * Pure presentation over the awaken.ts model. Re-renders on a 1s tick so the
 * timer bar fills and the countdown ticks without a click. All timing lives in
 * awaken.ts; this file only draws it. Once the sleep timer elapses the paid wake
 * is gone (the contract auto-awakens for free on the next harvest) so the button
 * flips to a "harvest to awaken" hint.
 */
interface AwakenMeterProps {
  /** Unix seconds the creature hatched (chain: creature_row.born_at). */
  bornAt: number
  rarity: Rarity
  /** Live awaken_dur (seconds) from chain (configv3.awaken_dur_*); falls back to spec default. */
  awakenDurSec?: number
  /** WAX wake cost in whole units for the button label (configv3.wake_cost_*). */
  wakeCostWax?: number
  onWake?: () => void
  /** Card-level disable (an action is mid-flight). */
  disabled?: boolean
}

/** Format seconds into a HH:MM:SS countdown clock (the boss asked to see exactly
 *  when it wakes — a live ticking clock reads clearer than "1h 2m"). */
function fmtClock(seconds: number): string {
  if (seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function AwakenMeter({
  bornAt,
  rarity,
  awakenDurSec,
  wakeCostWax,
  onWake,
  disabled = false,
}: AwakenMeterProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Live awaken_dur: chain value when threaded, else per-rarity spec default.
  const dur = awakenDurFor(rarity, awakenDurSec)
  const reading = computeAwaken(0, bornAt, now, dur)
  const stateClass = reading.canAutoAwaken ? styles.ready : styles.sleeping
  const cost = wakeCostWax ?? 0

  return (
    <div className={styles.wrap}>
      {/* ── Sleep-timer bar ── */}
      <div className={styles.barHead}>
        <span className={styles.barLabel}>💤 Sleep</span>
        <span className={`${styles.stateBadge} ${stateClass}`}>
          {reading.canAutoAwaken ? '🌅 Ready' : '😴 Sleeping'}
        </span>
        <span className={styles.barPercent}>{Math.round(reading.progressPct)}%</span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${stateClass}`}
          style={{ width: `${reading.progressPct}%` }}
        />
      </div>

      {/* ── Countdown / free-awaken hint ── */}
      <div className={styles.timerRow}>
        {reading.canAutoAwaken ? (
          <span className={styles.freeHint}>🌅 Ready — tap Harvest to wake for free</span>
        ) : (
          <>
            <span className={styles.timerLabel}>Auto-wakes in</span>
            <span className={styles.timerValue}>{fmtClock(reading.secondsToAwaken)}</span>
          </>
        )}
      </div>

      {/* ── Wake button ──
          Sleeping → the paid "skip the timer" wake (WAX). Once the timer elapses
          the contract REJECTS a paid wake (harvest auto-awakens for free), so we
          drop the WAX button entirely and show the free-harvest hint instead.
          No onWake (spectator/read-only card) → no button: the sleep timer above
          is the whole story and nothing here can reach a wallet. */}
      {onWake && (reading.canAutoAwaken ? (
        <button className={styles.wakeBtn} disabled>
          🌅 Ready — tap Harvest to wake (free)
        </button>
      ) : (
        <button
          className={styles.wakeBtn}
          onClick={onWake}
          disabled={disabled}
          title="Send WAX to wake this creature now (skip the timer)"
        >
          ⚡ Wake now · {cost} WAX · skip timer
        </button>
      ))}
    </div>
  )
}
