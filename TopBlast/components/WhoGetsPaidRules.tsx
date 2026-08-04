'use client'

import { useEffect, useState } from 'react'
import { getWinnerSharePercents, getDevFeePercent, getCommunityPercent } from '@/lib/payout/shares'
import { MIN_HOLD_DURATION_MINUTES, formatHoldDuration } from '@/lib/eligibility/holdDuration'

const SHARES = getWinnerSharePercents()
const DEV_FEE = getDevFeePercent()
const COMMUNITY = getCommunityPercent()

type Thresholds = {
  min_balance?: string
  min_hold_display?: string
  min_loss_pct?: number
}

interface WhoGetsPaidRulesProps {
  variant?: 'homepage' | 'compact'
  className?: string
}

export function WhoGetsPaidRules({ variant = 'homepage', className = '' }: WhoGetsPaidRulesProps) {
  const [thresholds, setThresholds] = useState<Thresholds>({
    min_balance: '1,000',
    min_hold_display: formatHoldDuration(MIN_HOLD_DURATION_MINUTES),
    min_loss_pct: 10,
  })

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.thresholds) {
          setThresholds(json.data.thresholds)
        }
      })
      .catch(() => {})
  }, [])

  const requirements = [
    {
      n: 1,
      title: 'Minimum token balance',
      body: `Hold at least ${thresholds.min_balance} tokens in your wallet.`,
    },
    {
      n: 2,
      title: `${thresholds.min_hold_display} minimum hold`,
      body: 'Counted from your first on-chain buy. Hardcoded — not configurable.',
    },
    {
      n: 3,
      title: 'In a loss position',
      body: 'Current token price must be below your VWAP (volume-weighted average buy price).',
    },
    {
      n: 4,
      title: `Loss ≥ ${thresholds.min_loss_pct}% of the live pool`,
      body: 'Your USD loss must meet the threshold shown on the leaderboard (updates with pool size).',
    },
    {
      n: 5,
      title: 'Has not sold',
      body: 'Any sell or transfer-out of tokens disqualifies the wallet.',
    },
    {
      n: 6,
      title: 'Not on winner cooldown',
      body: 'If you won the previous payout cycle, you sit out until the next one.',
    },
    {
      n: 7,
      title: 'Not a protocol wallet',
      body: 'The payout pool wallet and dev fee wallet cannot rank or receive loss-mining payouts.',
    },
  ]

  const isHomepage = variant === 'homepage'

  return (
    <div className={className}>
      <div
        className={
          isHomepage
            ? 'mb-6 rounded-xl border border-amber-500/30 bg-amber-950/20 p-5 text-left'
            : 'mb-6 rounded-xl border border-amber-500/30 bg-amber-950/20 p-5'
        }
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-2">Important</p>
        <p className="text-gray-200 leading-relaxed">
          <span className="text-white font-bold">Biggest wallet balance does not win.</span> Only wallets that pass{' '}
          <span className="text-rh-lime font-semibold">every rule below</span> are ranked. Winners are the{' '}
          <span className="text-red-400 font-semibold">top eligible losers by drawdown %</span> (most underwater first;
          USD loss breaks ties).
        </p>
      </div>

      <ol className="space-y-3 mb-6 text-left">
        {requirements.map((req) => (
          <li key={req.n} className="flex gap-3 rounded-lg border border-rh-green/10 bg-rh-green/5 p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rh-green/20 text-sm font-bold text-rh-lime">
              {req.n}
            </span>
            <div>
              <p className="font-semibold text-white">{req.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{req.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-rh-green/20 bg-black/40 p-5 text-left">
        <p className="text-sm font-semibold uppercase tracking-wider text-rh-lime mb-2">Payout split</p>
        <p className="text-gray-300 text-sm leading-relaxed mb-3">
          The <span className="text-white font-semibold">top 3 eligible</span> wallets receive{' '}
          <span className="text-rh-green font-semibold">{COMMUNITY}%</span> of the payout pool (after a{' '}
          {DEV_FEE}% dev fee), split{' '}
          <span className="font-mono text-rh-lime">
            {SHARES.first}/{SHARES.second}/{SHARES.third}
          </span>{' '}
          of the winner pool. Payouts are sent in native ETH automatically.
        </p>
        <p className="text-xs text-gray-500">
          The countdown timer stays in &quot;launch limbo&quot; until the first eligible holder appears — holding tokens
          alone does not start a payout cycle.
        </p>
      </div>
    </div>
  )
}
