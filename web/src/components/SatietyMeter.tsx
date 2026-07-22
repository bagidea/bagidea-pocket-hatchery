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
import { secondsToDailyReset, fmtDuration } from '../actionGates'
import type { Rarity } from './CreatureCard'
import styles from './SatietyMeter.module.css'

/**
 * SatietyMeter — the Feed-v2 satiety block: a live-decaying satiety bar, the
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
  /**
   * Live feed cooldown (seconds) from chain (configv3.feed_cd). Overrides the
   * config's feedCooldownSec fallback so the "Feed in …" countdown matches chain.
   */
  feedCdSec?: number
  /**
   * Live full-satiety earn (EGG/hr) from chain (speciescfg.yield × earn_mult) and
   * the total rarity premium for the badge. When both are present the meter shows
   * exactly what harvest() pays; when absent it reconstructs from satiety.ts.
   */
  earnFull?: number
  earnMult?: number
  /**
   * Account-wide feed quota for today (players.feeds_today / configv3.feed_daily_cap,
   * day-reset already applied by chain.ts). The cap is per PLAYER, not per creature,
   * so it is shown on every card: three feeds a day is the whole account's budget.
   * Omitted (demo/preview) → the quota line and its gate are hidden entirely.
   */
  feedsToday?: number
  feedDailyCap?: number
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
  feedCdSec,
  earnFull,
  earnMult,
  feedsToday,
  feedDailyCap,
}: SatietyMeterProps) {
  // 1s tick → the bar decays and the cooldown counts down on screen.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Resolve the fed_dur: preview override > live chain value > per-rarity default.
  const fedDur = fedDurFor(rarity, config, fedDurSec)
  // Bind the feed cooldown to the live chain value (configv3.feed_cd) when threaded,
  // else the config fallback. A preview config with its own short cooldown wins.
  const effConfig =
    feedCdSec != null && feedCdSec > 0 && config.fedDurSec == null
      ? { ...config, feedCooldownSec: feedCdSec }
      : config
  const reading = computeSatiety(lastFed, now, fedDur, effConfig)
  const cd = feedCooldown(lastFed, now, effConfig)
  // Prefer the chain-real earn (species.yield × earn_mult) when the card threads
  // it; fall back to satiety.ts's reconstruction for demo/preview creatures.
  const live = earnFull != null && earnMult != null ? { baseFull: earnFull, multiplier: earnMult } : undefined
  const earn = earnRate(rarity, stage, reading.state, live)

  const stateClass =
    reading.state === 'full' ? styles.full
      : reading.state === 'hungry' ? styles.hungry
        : styles.starving

  // Account-wide daily feed quota (configv3.feed_daily_cap = 3). The contract
  // asserts `feeds_today < feed_daily_cap` AFTER the cooldown check, so a player
  // who has spent the quota must not be able to fire the tx at all — that is the
  // exact path that answered with a raw "feed daily cap reached" assertion.
  const hasQuota = feedDailyCap != null && feedDailyCap > 0 && feedsToday != null
  const capReached = hasQuota && feedsToday! >= feedDailyCap!
  const feedsLeft = hasQuota ? Math.max(0, feedDailyCap! - feedsToday!) : 0
  const resetIn = secondsToDailyReset(now)

  // The Feed button is blocked while an action is running, the cooldown is up, or
  // today's account-wide feed quota is spent.
  const feedBlocked = disabled || cd.onCooldown || capReached
  // A just-woken creature (stage 0→1) inherits last_fed = born_at, so the 6h feed
  // cooldown fires while it is actually FULL (fed_until = last_fed + fed_dur is
  // days out). Showing "Feed on cooldown" there reads like the game is broken, so
  // when the cooldown is up but the creature is still fed (fed_until in the
  // future) we say "Full — feed again in …" instead. Only once fed_until has
  // passed do we fall back to the plain cooldown label. `now`/`lastFed` are
  // unix seconds; fedDur is the live configv3 value threaded through the card.
  const fedUntil = lastFed > 0 ? lastFed + fedDur : now
  const stillFed = now < fedUntil

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

      {/* ── Earn rate (rarity-driven) ──
          Satiety empty → the creature stops earning (contract: no food = 0 EGG),
          so flag it grey and prompt a feed instead of showing a misleading rate. */}
      <div className={styles.earnRow}>
        <span className={styles.earnRarity}>
          {rarity.charAt(0).toUpperCase() + rarity.slice(1)} ×{earn.multiplier.toFixed(2)}
        </span>
        {reading.percent <= 0 ? (
          <span className={styles.notEarning} title="Out of food — feed to start earning EGG again">
            💤 Not earning
          </span>
        ) : (
          <span className={styles.earnRate} title="EGG earned per hour at current satiety">
            {earn.effective.toFixed(1)}
            <span className={styles.earnUnit}>EGG/hr</span>
            {reading.state !== 'full' && (
              <span className={styles.earnBase}>(full: {earn.base.toFixed(1)})</span>
            )}
          </span>
        )}
      </div>

      {/* ── Daily feed quota (account-wide) ──
          The number the chain actually asserts on. Shown before the button so a
          player reads "3/3 used" first and never taps into an assertion. */}
      {hasQuota && (
        <div className={styles.quotaRow} data-cap-reached={capReached ? 1 : 0}>
          <span className={styles.quotaLabel} title="Feeds are capped per account per day, not per creature">
            Feeds today
          </span>
          <span className={styles.quotaCount} data-testid="feed-quota">
            {feedsToday}/{feedDailyCap}
          </span>
          <span className={styles.quotaReset}>
            {capReached ? `resets in ${fmtDuration(resetIn)}` : `${feedsLeft} left · resets in ${fmtDuration(resetIn)}`}
          </span>
        </div>
      )}

      {/* ── Feed button (stateful) ── */}
      <button
        className={`${styles.feedBtn} ${stateClass}`}
        onClick={onFeed}
        disabled={feedBlocked}
        title={capReached ? `You have used all ${feedDailyCap} feeds for today across your account. The quota resets at UTC midnight.` : undefined}
        data-testid="feed-btn"
      >
        {capReached ? (
          <>🚫 Daily feed limit {feedsToday}/{feedDailyCap} — resets in {fmt(resetIn)}</>
        ) : cd.onCooldown ? (
          stillFed ? (
            <>😋 Full — feed again in {fmt(cd.secondsLeft)}</>
          ) : (
            <>⏳ Feed in {fmt(cd.secondsLeft)}</>
          )
        ) : reading.state === 'starving' ? (
          <>🍎 Feed now! · Free</>
        ) : reading.state === 'hungry' ? (
          <>🍎 Feed · Free</>
        ) : (
          <>🍎 Feed · Free</>
        )}
      </button>

      {/* When the creature is already fed (Feed correctly gated), Feed is NOT the
          next step — it would only error on chain. Point the player at what
          actually pays out: the Harvest button. Only shown while genuinely fed
          and on the feed cooldown, so it never competes with a real Feed prompt. */}
      {capReached && (
        <span className={styles.nextStep} data-testid="feed-cap-note">
          🚫 All {feedDailyCap} of today&apos;s feeds are used — the quota is shared by
          every creature you own and resets at UTC midnight. Your fed creatures keep
          earning EGG in the meantime.
        </span>
      )}

      {!capReached && cd.onCooldown && stillFed && reading.percent > 0 && (
        <span className={styles.nextStep}>
          🌾 Fed &amp; earning — collect EGG with Harvest below
        </span>
      )}
    </div>
  )
}
