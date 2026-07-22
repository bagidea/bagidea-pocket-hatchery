import { useEffect, useRef } from 'react'
import styles from './HelpOverlay.module.css'

// ── Table of contents sections ─────────────────────────────────
const TOC = [
  { id: 'what-is', label: '1. What is PH?' },
  { id: 'getting-started', label: '2. Getting Started' },
  { id: 'how-to-play', label: '3. Actions' },
  { id: 'lifecycle', label: '4. Lifecycle' },
  { id: 'rarity', label: '5. Rarity' },
  { id: 'tips', label: '6. Tips' },
  { id: 'quick-ref', label: '⚡ Quick Ref' },
]

// ── Shared table component ─────────────────────────────────────
function GT({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Guide content ──────────────────────────────────────────────
function GuideContent() {
  return (
    <>
      <p className={styles.intro}>
        Welcome to Pocket Hatchery — a virtual pet game where you hatch, raise, and evolve NFT creatures on the WAX
        blockchain. No blockchain experience required.
      </p>

      {/* 1. What is Pocket Hatchery */}
      <section className={styles.section} id="what-is">
        <h2 className={styles.h2}>1. What is Pocket Hatchery?</h2>
        <p className={styles.p}>
          Pocket Hatchery is a creature-collection idle game running on the <strong>WAX blockchain</strong>. Every
          creature you hatch is an <strong>NFT</strong> you truly own — stored in the AtomicAssets collection{' '}
          <code>phgamecreatr</code>. The game uses two tokens:
        </p>
        <GT
          head={['Token', 'Symbol', 'Purpose']}
          rows={[
            ['🥚 EGG', 'EGG', 'Hatch eggs, evolve creatures, daily actions'],
            ['💎 HATCH', 'HATCH', 'Premium — breed, accelerate, burn rewards, seasonal claims'],
          ]}
        />
        <p className={styles.note}>You do not need to buy anything to start. The game is free to play.</p>
      </section>

      <div className={styles.divider} />

      {/* 2. Getting Started */}
      <section className={styles.section} id="getting-started">
        <h2 className={styles.h2}>2. Getting Started</h2>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>2.1 Connect Your Wallet</h3>
          <p className={styles.p}>When you open Pocket Hatchery you will see two connection options:</p>
          <ul className={styles.tipList}>
            <li>
              <strong>WAX Cloud Wallet (WCW)</strong> — a web-based wallet. Good for desktop and mobile.
            </li>
            <li>
              <strong>waxwing</strong> — the office's built-in wallet. Use this if you already have a waxwing account.
            </li>
          </ul>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>2.2 First-Time Setup (initplayer)</h3>
          <p className={styles.p}>
            If this is your first time playing, the game will ask you to run <strong>initplayer</strong> — a one-time
            on-chain action that creates your player profile. After that, you land on the dashboard.
          </p>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>2.3 Safety Note</h3>
          <div className={styles.callout}>
            Every action opens a <strong>signing sheet</strong> before anything goes on-chain. You review what you are
            signing and can <strong>cancel at any time</strong>. Nothing is broadcast until you tap{' '}
            <strong>Sign</strong>.
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* 3. How to Play */}
      <section className={styles.section} id="how-to-play">
        <h2 className={styles.h2}>3. How to Play</h2>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.1 🥚 Hatch Egg</h3>
          <p className={styles.p}>
            Hatching creates a new creature NFT. Rarity is determined by RNG at the moment of hatching.
          </p>
          <GT
            head={['Parameter', 'Value']}
            rows={[
              ['Cost', '150 EGG'],
              ['Rarity', 'Random (see Section 5 for odds)'],
              ['Result', 'New creature NFT at stage 0 (Egg)'],
            ]}
          />
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.2 ⏳ Awaken Timer</h3>
          <p className={styles.p}>
            After hatching, your creature is at <strong>stage 0</strong> (Egg) and cannot earn EGG yet. Wait for the
            awaken timer — it automatically promotes the creature to <strong>stage 1</strong> (Hatchling).
          </p>
          <GT
            head={['Rarity', 'Awaken Time', 'WAX Wake Cost']}
            rows={[
              ['Common', '1 hour', '3 WAX'],
              ['Uncommon', '1.5 hours', '5 WAX'],
              ['Rare', '2 hours', '10 WAX'],
              ['Epic', '2.5 hours', '20 WAX'],
              ['Legendary', '3 hours', '40 WAX'],
              ['Mythic', '3 hours', '80 WAX'],
            ]}
          />
          <p className={styles.note}>
            Paying WAX to wake instantly is optional — just wait and the timer resolves on its own on your next harvest.
          </p>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.3 🍎 Feed</h3>
          <p className={styles.p}>
            Feeding fills your creature's <strong>satiety bar</strong> so it can earn EGG and grow. A hungry creature
            earns nothing.
          </p>
          <GT
            head={['Parameter', 'Value']}
            rows={[
              ['Cost', 'FREE (0 EGG)'],
              ['Cooldown', '6 hours per creature'],
              ['Daily limit', '3 feeds per creature'],
              ['Growth boost', '+100 growth per feed'],
            ]}
          />
          <GT
            head={['Rarity', 'Fed Duration', 'Feeds Needed (approx.)']}
            rows={[
              ['Common', '48 hours (2 days)', 'Every other day'],
              ['Uncommon', '72 hours (3 days)', 'Twice a week'],
              ['Rare', '120 hours (5 days)', 'Once or twice a week'],
              ['Epic', '7 days', 'Once a week'],
              ['Legendary', '10 days', '~3 times a month'],
              ['Mythic', '14 days', 'Twice a month'],
            ]}
          />
          <p className={styles.note}>
            Rarer creatures are easier to care for — Mythic creatures only need feeding twice a month.
          </p>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.4 🌾 Harvest EGG</h3>
          <p className={styles.p}>Harvest collects the EGG your creatures have earned since your last harvest.</p>
          <GT
            head={['Parameter', 'Value']}
            rows={[
              ['Cooldown', '1 hour'],
              ['Offline cap', '8 hours (earnings beyond 8h are lost)'],
              ['Daily cap', '240 base, scales with rarity'],
            ]}
          />
          <GT
            head={['Best Rarity', 'Daily Cap', 'Earn Multiplier']}
            rows={[
              ['Common', '240 EGG', '×1.0'],
              ['Uncommon', '264 EGG', '×1.1'],
              ['Rare', '336 EGG', '×1.4'],
              ['Epic', '432 EGG', '×1.8'],
              ['Legendary', '576 EGG', '×2.4'],
              ['Mythic', '792 EGG', '×3.3'],
            ]}
          />
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.5 ✨ Evolve</h3>
          <p className={styles.p}>
            Evolve advances your creature to the next stage, increasing its EGG yield. Your creature must be{' '}
            <strong>fed</strong> and have enough <strong>growth</strong>.
          </p>
          <GT
            head={['Transition', 'Cost']}
            rows={[
              ['Hatchling → Juvenile (1 → 2)', '600 EGG'],
              ['Juvenile → Adult (2 → 3)', '900 EGG'],
              ['Adult → Evolved (3 → 4)', '1,200 EGG'],
              ['Evolved → Final (4 → 5)', '1,500 EGG'],
              ['Total (1 → 5)', '4,200 EGG'],
            ]}
          />
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.6 💕 Breed</h3>
          <p className={styles.p}>
            Breeding pairs two of your creatures to produce a new offspring NFT. Both parents must be at least stage 1.
          </p>
          <GT
            head={['Parameter', 'Value']}
            rows={[
              ['Cost', '5.0000 HATCH'],
              ['Cooldown', '24 hours per parent'],
              ['Token flow', '40% burned, 60% goes to reward pool'],
              ['Result', 'New creature with blended genes from both parents'],
            ]}
          />
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.7 🔥 Burn</h3>
          <p className={styles.p}>
            Burning <strong>destroys</strong> the creature NFT permanently. In return you receive a{' '}
            <strong>HATCH reward</strong> and a small EGG refund. The HATCH reward scales with stage and rarity.
          </p>
          <GT
            head={['Stage', 'Common', 'Rare', 'Epic', 'Mythic']}
            rows={[
              ['0 (Egg)', '2 HATCH', '20 HATCH', '50 HATCH', '300 HATCH'],
              ['2 (Juvenile)', '10 HATCH', '100 HATCH', '250 HATCH', '1,500 HATCH'],
              ['5 (Final)', '100 HATCH', '1,000 HATCH', '2,500 HATCH', '15,000 HATCH'],
            ]}
          />
          <div className={styles.callout}>
            Burning is a strategic decision. A fully-raised Mythic at stage 5 is worth 15,000 HATCH — but you lose the
            creature forever.
          </div>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>3.8 🎁 Claim Season Reward</h3>
          <p className={styles.p}>Once per season, you can claim a HATCH reward based on your highest-stage creature.</p>
          <GT
            head={['Parameter', 'Value']}
            rows={[
              ['Frequency', '1 claim per player per season'],
              ['Requirements', 'At least one creature at stage 2+ AND currently fed'],
              ['Payout (stage 2)', '15 HATCH'],
              ['Payout (stage 3)', '25 HATCH'],
              ['Payout (stage 4)', '45 HATCH'],
              ['Payout (stage 5)', '85 HATCH'],
            ]}
          />
        </div>
      </section>

      <div className={styles.divider} />

      {/* 4. Lifecycle */}
      <section className={styles.section} id="lifecycle">
        <h2 className={styles.h2}>4. Creature Lifecycle</h2>
        <p className={styles.p}>Every creature progresses through six stages:</p>
        <pre className={styles.codeBlock}>{
`Stage 0    Stage 1      Stage 2     Stage 3    Stage 4    Stage 5
  EGG   ▶ HATCHLING ▶  JUVENILE ▶  ADULT   ▶  EVOLVED ▶  FINAL
(1h–3h)   Earn EGG    Claim       Higher     Near max    MAX 🏆
          Feed+Breed   reward(≥2)  yield`
        }</pre>
        <GT
          head={['Stage', 'Name', 'Key Unlocks']}
          rows={[
            ['0', 'Egg', 'Just hatched — waiting to awaken'],
            ['1', 'Hatchling', 'Can earn EGG, be fed, breed'],
            ['2', 'Juvenile', 'Eligible for seasonal claim reward'],
            ['3', 'Adult', 'Higher EGG yield'],
            ['4', 'Evolved', 'Near-max yield'],
            ['5', 'Final', 'Maximum yield and burn value'],
          ]}
        />
      </section>

      <div className={styles.divider} />

      {/* 5. Rarity */}
      <section className={styles.section} id="rarity">
        <h2 className={styles.h2}>5. Rarity System</h2>
        <p className={styles.p}>There are 6 rarity tiers. When you hatch, the game rolls RNG against these weights:</p>
        <GT
          head={['Rarity', 'Drop Chance', '1 in N Hatches', 'Earn Multi', 'Fed Duration', 'Daily Cap']}
          rows={[
            ['🟢 Common', '69.00%', '1.4', '×1.0', '48h', '240'],
            ['🔵 Uncommon', '20.00%', '5', '×1.1', '72h', '264'],
            ['🟣 Rare', '8.00%', '12.5', '×1.4', '120h', '336'],
            ['🟡 Epic', '2.50%', '40', '×1.8', '7 days', '432'],
            ['🟠 Legendary', '0.45%', '222', '×2.4', '10 days', '576'],
            ['🔴 Mythic', '0.05%', '2,000', '×3.3', '14 days', '792'],
          ]}
        />
        <GT
          head={['Goal', 'Hatches Needed (avg)', 'EGG Cost']}
          rows={[
            ['First Uncommon', '5', '750 EGG'],
            ['First Rare', '12.5', '1,875 EGG'],
            ['First Epic', '40', '6,000 EGG'],
            ['First Legendary', '222', '33,300 EGG'],
            ['First Mythic', '2,000', '300,000 EGG'],
          ]}
        />
        <p className={styles.note}>
          Mythic is a genuine long-term chase. Most players will see their first Epic within a month of daily play.
        </p>
      </section>

      <div className={styles.divider} />

      {/* 6. Tips */}
      <section className={styles.section} id="tips">
        <h2 className={styles.h2}>6. Tips for Beginners</h2>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>🥚 Day 1–3: Get Your First Creatures</h3>
          <ul className={styles.tipList}>
            <li>Hatch your first egg (150 EGG). Wait 1 hour for it to awaken.</li>
            <li>Feed it. Feeding is free — there is no reason not to keep your creatures fed.</li>
            <li>Harvest every few hours. The 8-hour offline cap means you never lose more than 8h of earnings.</li>
            <li>Hatch more eggs as you earn EGG. More creatures = more total earnings.</li>
          </ul>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>🥚 Week 1: Evolve and Diversify</h3>
          <ul className={styles.tipList}>
            <li>Evolve your best creature as soon as it has enough growth and is fed.</li>
            <li>Aim for at least one Rare. With 12–13 hatches, you have a good chance.</li>
            <li>Claim your season reward once you have a stage 2+ creature that is fed. Free HATCH.</li>
          </ul>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>🥚 Month 1: Build Your Collection</h3>
          <ul className={styles.tipList}>
            <li>Focus on one high-rarity creature. Its higher daily cap benefits all your earnings.</li>
            <li>Keep 2–3 creatures fed. You do not need to feed every creature.</li>
            <li>Breed strategically. 5 HATCH + 24h cooldown per parent — only breed when you have spare HATCH.</li>
          </ul>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>🥚 General Wisdom</h3>
          <div className={styles.doGrid}>
            <div className={styles.doCol}>
              <p className={styles.colTitle}>Do ✓</p>
              <ul className={styles.doList}>
                <li>Feed before going offline</li>
                <li>Harvest regularly (every 1–8 hours)</li>
                <li>Evolve your rarest creature first</li>
                <li>Burn duplicates you don't need</li>
                <li>Claim season reward as soon as eligible</li>
              </ul>
            </div>
            <div className={styles.dontCol}>
              <p className={styles.colTitle}>Don't ✗</p>
              <ul className={styles.dontList}>
                <li>Let creatures starve (earn 0)</li>
                <li>Harvest more than once per hour (wasted)</li>
                <li>Evolve low-rarity creatures with spare EGG</li>
                <li>Burn your only high-rarity creature</li>
                <li>Miss a season — claims do not stack</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.subsection}>
          <h3 className={styles.h3}>Token Flow Summary</h3>
          <div className={styles.tokenGrid}>
            <div className={styles.tokenCard}>
              <p className={styles.tokenCardTitle}>💎 HATCH</p>
              <p className={styles.tokenCardBody}>Hard currency · scarce, deflationary. Earned via Burn / Claim. Spent on Breed / Accelerate.</p>
            </div>
            <div className={styles.tokenCard}>
              <p className={styles.tokenCardTitle}>🥚 EGG</p>
              <p className={styles.tokenCardBody}>Soft currency · earned through care. Spent on Hatch / Evolve. Harvested every hour.</p>
            </div>
            <div className={styles.tokenCard}>
              <p className={styles.tokenCardTitle}>⬡ WAX</p>
              <p className={styles.tokenCardBody}>Real money · convenience only. Used to Wake creatures instantly (optional).</p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* Quick Reference */}
      <section className={styles.section} id="quick-ref">
        <h2 className={styles.h2}>⚡ Quick Reference</h2>
        <GT
          head={['Action', 'Cost', 'Cooldown', 'Key Requirement']}
          rows={[
            ['Hatch', '150 EGG', 'None', 'None'],
            ['Feed', 'FREE', '6h · 3/day max', 'None'],
            ['Harvest', 'FREE', '1h · 8h offline cap', 'None'],
            ['Evolve', '300×(stage+1) EGG', 'None', 'Growth threshold + fed'],
            ['Breed', '5 HATCH', '24h/parent', 'Both stage 1+'],
            ['Burn', 'Creature destroyed', 'None', 'None'],
            ['Claim', 'FREE', '1/season', 'Stage 2+ + fed'],
            ['Wake (WAX)', '3–80 WAX', 'None', 'Stage 0 only'],
            ['Unlock Slot 4', '500 EGG', 'None', 'Have 3 slots'],
            ['Unlock Slot 5', '1,200 EGG', 'None', 'Have 4 slots'],
            ['Unlock Slot 6', '2,500 EGG', 'None', 'Have 5 slots'],
          ]}
        />
        <p className={styles.note} style={{ marginTop: 12 }}>
          <em>Pocket Hatchery — hatch, raise, evolve, and collect. Your creatures, your journey. 🥚</em>
        </p>
      </section>
    </>
  )
}

// ── HelpOverlay ────────────────────────────────────────────────
export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const scrollTo = (id: string) => {
    const el = scrollRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="How to Play">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>❓ How to Play</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close guide">
            ✕
          </button>
        </div>

        {/* TOC pills */}
        <nav className={styles.toc} aria-label="Guide sections">
          {TOC.map((item) => (
            <button key={item.id} className={styles.tocBtn} onClick={() => scrollTo(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div className={styles.scroll} ref={scrollRef}>
          <GuideContent />
        </div>
      </div>
    </div>
  )
}
