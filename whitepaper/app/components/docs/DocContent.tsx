'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CopyContractAddress } from '../CopyContractAddress'
import {
  APP_URL,
  DEFAULT_MIN_TOKEN_HOLDING,
  DEFAULT_MIN_TOKEN_HOLDING_LABEL,
  FLYWHEEL,
  LINKS,
  PAYOUT,
  PAYOUT_INTERVAL_OPTIONS,
  PAYOUT_INTERVAL_OPTIONS_TEXT,
} from './config'
import {
  DocCard,
  DocCode,
  DocCta,
  DocGrid,
  DocHeader,
  DocList,
  DocSection,
  DocStat,
  DocTable,
} from './DocPrimitives'

const TOKEN_CA = ''

const UPDATES = [
  {
    version: 'v3.2.0',
    date: 'Aug 2026',
    tag: 'Current',
    items: [
      'Dev-first positioning and unified Solana docs',
      'Live DexScreener price stream with Pump.fun migration',
      'Session diagnostics for self-serve troubleshooting',
    ],
  },
  {
    version: 'v3.1.0',
    date: 'Aug 2026',
    tag: 'Shipped',
    items: [
      'Self-serve SaaS at /launch',
      'Multi-tenant cron and encrypted payout keys',
      'Platform token buyback flywheel (6% of pool)',
    ],
  },
  {
    version: 'v3.0.0',
    date: 'Aug 2026',
    tag: 'Solana',
    items: [
      'Native SOL payouts on Solana mainnet',
      'Helius holder indexing and VWAP engine',
      '12% dev fee · 88% to top 3 eligible losers (60/25/15)',
    ],
  },
]

const ROADMAP = [
  { phase: '1', title: 'Solana launch', status: 'Done', detail: 'Loss-mining live with Helius, SOL payouts, eligibility-gated timer.' },
  { phase: '2', title: 'Multi-tenant SaaS', status: 'Done', detail: 'Self-serve listings, catalog, per-slug sessions, encrypted keys.' },
  { phase: '3', title: 'Growth & automation', status: 'Now', detail: 'Buyback bot, creator analytics, public API.' },
  { phase: '4', title: 'Scale', status: '2027', detail: 'Launch partners, premium tiers, automated treasury ops.' },
]

export function DocContent() {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <main className="doc-main">
      <DocSection id="for-creators">
        <DocHeader
          eyebrow="For Solana builders"
          title="Reward bullish holders — not sellers"
          description="TopBlast turns creator-fee SOL into loss-mining rewards for holders who bought the top and stayed in. No cashback sell pressure. No dev-tax FUD."
        />
        <DocTable
          headers={['Approach', 'Holder behavior', 'Chart effect']}
          highlightRow={2}
          rows={[
            ['Cashback / rebates', 'Buy → claim → sell', 'Instant sell pressure'],
            ['Creator rewards only', 'Fees accumulate to dev', 'No direct holder loop'],
            ['TopBlast loss-mining', 'Hold underwater, compete for SOL', 'Rewards conviction, not exits'],
          ]}
        />
        <DocGrid cols={2}>
          <DocCard title="Self-serve SaaS" accent="purple">
            <p className="doc-prose">
              Community tokens launch at <strong>/launch</strong> — mint, ticker, payout frequency, minimum token balance, and encrypted payout wallet. Each listing gets an isolated URL and cron session.
            </p>
          </DocCard>
          <DocCard title="Hands-off ops" accent="mint">
            <p className="doc-prose">
              Choose payout frequency and minimum balance at launch ({PAYOUT_INTERVAL_OPTIONS_TEXT}; default {DEFAULT_MIN_TOKEN_HOLDING_LABEL} tokens). Cron indexes holders, ranks eligible losers, and sends native SOL from your funded wallet on that schedule.
            </p>
          </DocCard>
          <DocCard title="Dynamic pot">
            <p className="doc-prose">
              Pool size and min-loss threshold scale together. Bigger funded wallet → bigger payouts → higher bar to qualify.
            </p>
          </DocCard>
          <DocCard title="Pump.fun ready">
            <p className="doc-prose">
              Live price follows DexScreener across bonding curve and PumpSwap/Raydium migration — no manual pair switch.
            </p>
          </DocCard>
        </DocGrid>
        <div className="doc-cta-row">
          <DocCta href={LINKS.launch} label="Create your listing" />
          <DocCta href={LINKS.catalog} label="Browse live catalog" variant="ghost" />
        </div>
      </DocSection>

      <DocSection id="protocol">
        <DocHeader
          eyebrow="Protocol"
          title="How loss-mining works"
          description="Three automated steps — track entry, rank drawdown, blast SOL to the top 3 eligible losers."
        />
        <DocGrid cols={3}>
          <DocCard title="1 · Track entry" accent="purple">
            <p className="doc-prose">VWAP is computed from on-chain buy history via Helius. Sells are ignored for cost basis.</p>
          </DocCard>
          <DocCard title="2 · Rank drawdown" accent="amber">
            <p className="doc-prose">Every cycle scans holders. Eligible wallets sort by drawdown % (most underwater first), USD loss tiebreaks.</p>
          </DocCard>
          <DocCard title="3 · Blast rewards" accent="mint">
            <p className="doc-prose">
              Top 3 receive {PAYOUT.first}/{PAYOUT.second}/{PAYOUT.third} of the winner pool. Native SOL — no claim step.
            </p>
          </DocCard>
        </DocGrid>
        <DocCard title="VWAP & drawdown">
          <DocCode>{`VWAP = Total cost basis / Total tokens bought
Drawdown % = ((Current price − VWAP) / VWAP) × 100

Ranking: most negative drawdown % first → USD loss tiebreaker`}</DocCode>
        </DocCard>
        <DocGrid cols={4}>
          <DocStat label="Cycle" value="Configurable" hint={PAYOUT_INTERVAL_OPTIONS_TEXT} />
          <DocStat label="Winners" value="Top 3" hint="Eligible only" />
          <DocStat label="Community" value={`${PAYOUT.community}%`} hint="Of payout pool" />
          <DocStat label="Dev fee" value={`${PAYOUT.dev}%`} hint="Platform wallet" />
        </DocGrid>
      </DocSection>

      <DocSection id="dynamic-pot">
        <DocHeader
          eyebrow="Game design"
          title="Dynamic pot & eligibility"
          description="The pool and qualification threshold move together — you control budget by topping up creator-fee SOL."
        />
        <DocGrid cols={2}>
          <DocCard title="Pot size">
            <p className="doc-prose">~99% of the launcher&apos;s payout wallet SOL each cycle. Fund the wallet; the protocol handles the rest.</p>
          </DocCard>
          <DocCard title="Min loss rule">
            <p className="doc-prose">Underwater loss must be ≥ 10% of live pool USD. $500 pool → ~$50 min loss. $5,000 → ~$500.</p>
          </DocCard>
          <DocCard title="Timer">
            <p className="doc-prose">Pick a cycle at launch ({PAYOUT_INTERVAL_OPTIONS_TEXT}). Countdown starts when the first eligible holder appears — not at launch. Empty rankings stay in waiting state.</p>
          </DocCard>
          <DocCard title="Example">
            <p className="doc-prose">
              $2,000 pool → ~$200 min loss → 1st place ≈ <strong className="text-sol-mint">$1,056</strong> SOL ({PAYOUT.first}% of {PAYOUT.community}% winner pool after {PAYOUT.dev}% fee).
            </p>
          </DocCard>
        </DocGrid>
      </DocSection>

      <DocSection id="eligibility">
        <DocHeader
          eyebrow="Eligibility"
          title="Who gets paid"
          description="Biggest wallet does not win. Every rule below must pass before a wallet enters the leaderboard."
        />
        <DocCard accent="amber">
          <p className="doc-prose doc-prose--emphasis">
            Winners are the top <strong>eligible</strong> losers by drawdown — not largest balance, not earliest buyer, not most tokens.
          </p>
        </DocCard>
        <ol className="doc-steps">
          {[
            ['Minimum token balance', `Set at /launch (default ${DEFAULT_MIN_TOKEN_HOLDING_LABEL} raw tokens). Shown live on each listing's Stats & Leaderboard — locked after creation.`],
            ['15 minute hold', 'From first on-chain buy. Hardcoded — not env-configurable.'],
            ['Loss position', 'Current price below VWAP (underwater vs average buy).'],
            ['Dynamic min loss', 'USD loss ≥ 10% of live pool balance.'],
            ['No sells or transfers out', 'Any sell or outgoing transfer disqualifies immediately.'],
            ['Winner cooldown', 'Previous cycle winners sit out one full cycle.'],
            ['Payout frequency', `Set at /launch — ${PAYOUT_INTERVAL_OPTIONS_TEXT}. Default 15 minutes.`],
          ].map(([title, body], i) => (
            <li key={title} className="doc-step">
              <span className="doc-step-num">{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <DocCta href={LINKS.catalog} label="Browse live listings" variant="ghost" />
      </DocSection>

      <DocSection id="saas">
        <DocHeader
          eyebrow="Multi-tenant SaaS"
          title="Platform architecture"
          description="One stack, many isolated listings. Each token gets its own session, payout wallet, and cron cycle."
        />
        <DocCard title="Launcher flow">
          <DocCode>{`/launch → mint + ticker + payout frequency + min token balance + payout private key (encrypted)
     → /{slug}/leaderboard · stats · history
     → POST /api/cron/tenants (platform cron; each listing uses its chosen interval)

Platform token (TopBlast): configured by operators via server env — runs at /topblast without the SaaS launch form.`}</DocCode>
        </DocCard>
        <DocGrid cols={2}>
          <DocCard title="Payout schedules" accent="amber">
            <DocList
              items={PAYOUT_INTERVAL_OPTIONS.map(label => `${label} cycles`)}
            />
            <p className="text-sm text-gray-400 mt-3">Selected once at launch. Shorter cycles drive engagement; longer cycles create fewer, larger payout moments.</p>
          </DocCard>
          <DocCard title="For launchers" accent="mint">
            <DocList
              items={[
                'Pick payout frequency and minimum token balance in the launch form',
                'Fund your creator-rewards wallet with SOL',
                'Session diagnostics explain empty pool, indexing, or no eligible holders',
                `Flat ${PAYOUT.dev}% protocol fee each cycle → platform treasury`,
                'Listings never share holder data or payout keys',
              ]}
            />
          </DocCard>
          <DocCard title="For platform token holders" accent="purple">
            <DocList
              items={[
                `${FLYWHEEL.devFeeBuybackShare}% of all dev fees → platform token buyback`,
                `${FLYWHEEL.buybackPctOfPool}% of every community payout pool network-wide`,
                `${FLYWHEEL.opsShareOfDevFee}% of dev fees → infra, security, growth`,
                'More SaaS tenants → recurring buy pressure on platform token',
              ]}
            />
          </DocCard>
        </DocGrid>
        <div className="doc-fee-flow">
          <span>Payout pool (SOL)</span>
          <span className="doc-fee-arrow">→</span>
          <span className="doc-fee-pill doc-fee-pill--winners">{PAYOUT.community}% winners · 60/25/15</span>
          <span className="doc-fee-plus">+</span>
          <span className="doc-fee-pill doc-fee-pill--dev">{PAYOUT.dev}% dev · {FLYWHEEL.buybackPctOfPool}% buyback</span>
        </div>
      </DocSection>

      <DocSection id="security">
        <DocHeader
          eyebrow="Security"
          title="Keys, encryption & cron auth"
          description="Launchers never see platform secrets. Operators configure server-side env only."
        />
        <DocGrid cols={2}>
          <DocCard title="Payout key encryption" accent="purple">
            <p className="doc-prose">
              TopBlast encrypts each launcher&apos;s payout private key with AES-256-GCM before MongoDB storage. Keys are decrypted only during that listing&apos;s payout cycle. Configured by operators — not exposed to launchers.
            </p>
            <p className="doc-prose doc-prose--muted">Protects against DB leaks — not full server compromise.</p>
          </DocCard>
          <DocCard title="Cron authentication" accent="mint">
            <p className="doc-prose">
              Scheduled jobs call <code className="doc-inline-code">POST /api/cron/tenants</code> with a server-side bearer secret. Prevents public triggering of payouts or snapshots.
            </p>
            <p className="doc-prose doc-prose--muted">Operators configure the secret in deployment env + external cron Authorization header.</p>
          </DocCard>
        </DocGrid>
        <DocCard title="Launcher payout key">
          <p className="doc-prose">
            Submitted at /launch — usually the wallet receiving Pump.fun or Raydium creator fees. TopBlast signs SOL transfers to winners from this wallet only. Never logged in plain text.
          </p>
        </DocCard>
      </DocSection>

      <DocSection id="token">
        <DocHeader
          eyebrow="Platform token"
          title="Economics & flywheel"
          description="88% of each cycle to eligible winners. 12% protocol fee powers buyback, burn, and platform ops."
        />
        <DocCard title="Platform fee flywheel" accent="purple">
          <p className="doc-prose mb-4">{FLYWHEEL.intro}</p>
          <div className="doc-flywheel-tree">
            <div className="doc-flywheel-line">{FLYWHEEL.tree.root}</div>
            <div className="doc-flywheel-branch">
              <div className="doc-flywheel-line">
                <span className="doc-flywheel-glyph">├─</span> {FLYWHEEL.tree.buyback}
              </div>
              <div className="doc-flywheel-line doc-flywheel-line--nested">
                <span className="doc-flywheel-glyph">└─</span> {FLYWHEEL.tree.burn}
                {FLYWHEEL.burnStatus === 'planned' ? (
                  <span className="doc-flywheel-badge">Automated — roadmap</span>
                ) : null}
              </div>
              <div className="doc-flywheel-line">
                <span className="doc-flywheel-glyph">└─</span> {FLYWHEEL.tree.ops}
              </div>
            </div>
          </div>
          <p className="doc-prose doc-prose--muted mt-4">{FLYWHEEL.tree.burnNote}</p>
        </DocCard>
        <DocGrid cols={3}>
          <DocStat label="Protocol fee" value={`${FLYWHEEL.devFeePct}%`} hint="Per tenant cycle" />
          <DocStat label="Buyback" value={`${FLYWHEEL.buybackPctOfPool}%`} hint={`${FLYWHEEL.devFeeBuybackShare}% of fee → token`} />
          <DocStat label="Ops / infra" value={`${FLYWHEEL.opsPctOfPool}%`} hint={`${FLYWHEEL.opsShareOfDevFee}% of fee`} />
        </DocGrid>
        <DocGrid cols={2}>
          <DocCard title="Fee split">
            <div className="doc-bar-chart">
              <div className="doc-bar doc-bar--community" style={{ width: `${PAYOUT.community}%` }}>
                {PAYOUT.community}% community
              </div>
              <div className="doc-bar doc-bar--dev" style={{ width: `${PAYOUT.dev}%` }}>
                {PAYOUT.dev}% dev
              </div>
            </div>
            <p className="doc-prose doc-prose--muted mt-4">
              Winner pool split: {PAYOUT.first}% / {PAYOUT.second}% / {PAYOUT.third}% for 1st / 2nd / 3rd eligible losers.
            </p>
          </DocCard>
          <DocCard title="Win-win thesis">
            <p className="doc-prose">
              <strong className="text-sol-mint">Price pumps</strong> — token appreciates, standard upside.
            </p>
            <p className="doc-prose">
              <strong className="text-red-400">Price dumps</strong> — drawdown climbs, eligible holders compete for SOL from the pool.
            </p>
          </DocCard>
        </DocGrid>
        {TOKEN_CA ? (
          <CopyContractAddress address={TOKEN_CA} symbol="TopBlast" className="mt-6" />
        ) : (
          <p className="doc-prose doc-prose--muted">Platform token mint is configured by TopBlast operators in server env when live.</p>
        )}
      </DocSection>

      <DocSection id="technical">
        <DocHeader
          eyebrow="Architecture"
          title="Technical stack"
          description="Production implementation on Solana mainnet — no mocked chain data in prod."
        />
        <DocGrid cols={3}>
          <DocCard title="Data layer">
            <DocList items={['MongoDB — holders, snapshots, payouts, tenant keys', 'Helius RPC + DAS — balances & tx history', 'Per-tenant isolation by slug']} />
          </DocCard>
          <DocCard title="Price feed">
            <DocList items={['DexScreener WebSocket + 1s REST fallback in browser', 'Server: DexScreener → Jupiter → Helius (no TTL cache)', 'Auto pair switch on Pump.fun migration']} />
          </DocCard>
          <DocCard title="Runtime">
            <DocList items={['Next.js 14 on Vercel', 'Multi-tenant cron /api/cron/tenants', '@solana/web3.js native SOL transfers']} />
          </DocCard>
        </DocGrid>
        <div className="doc-faq">
          {[
            {
              q: 'What starts the payout timer?',
              a: 'The timer enters waiting state at launch. Countdown begins when the first holder passes all eligibility rules — not when the token is listed.',
            },
            {
              q: 'What happens when the platform token mint changes?',
              a: 'When operators change the platform token mint in server configuration, holder data, payout history, and the timer reset to cycle 0 waiting state. SaaS listings are unaffected.',
            },
            {
              q: 'How is anti-gaming enforced?',
              a: 'Sell detection, transfer-out disqualification, winner cooldown, minimum hold duration, and dynamic min-loss threshold — all evaluated on-chain each cycle.',
            },
          ].map((item, i) => (
            <div key={item.q} className="doc-faq-item">
              <button type="button" className="doc-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                {item.q}
                <span>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i ? <p className="doc-faq-a">{item.a}</p> : null}
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="roadmap">
        <DocHeader eyebrow="Roadmap" title="Where we are" description="SaaS v1 shipped. Focus now on automation, polish, and partner launches." />
        <div className="doc-roadmap">
          {ROADMAP.map(item => (
            <div key={item.phase} className="doc-roadmap-item">
              <div className="doc-roadmap-meta">
                <span className="doc-roadmap-phase">Phase {item.phase}</span>
                <span className={`doc-roadmap-status doc-roadmap-status--${item.status.toLowerCase().replace(' ', '-')}`}>
                  {item.status}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="doc-updates">
          <h3 className="doc-subtitle">Recent releases</h3>
          {UPDATES.map(u => (
            <div key={u.version} className="doc-update">
              <div className="doc-update-head">
                <span className="doc-update-version">{u.version}</span>
                <span className="doc-update-date">{u.date}</span>
                <span className="doc-update-tag">{u.tag}</span>
              </div>
              <ul>
                {u.items.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DocSection>

      <footer className="doc-footer">
        <div className="doc-footer-inner">
          <div className="doc-footer-brand">
            <Image src="/logo.png" alt="TopBlast" width={28} height={28} className="rounded-md" />
            <span>TopBlast · Solana loss-mining SaaS</span>
          </div>
          <div className="doc-footer-links">
            <a href={APP_URL} target="_blank" rel="noopener noreferrer">App</a>
            <a href={LINKS.launch} target="_blank" rel="noopener noreferrer">Launch</a>
            <a href={LINKS.catalog} target="_blank" rel="noopener noreferrer">Catalog</a>
            <a href={LINKS.platformLeaderboard} target="_blank" rel="noopener noreferrer">Platform session</a>
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer">X</a>
          </div>
          <p className="doc-footer-copy">© 2026 TopBlast · Built on Solana</p>
        </div>
      </footer>
    </main>
  )
}
