'use client'

import { useEffect, useState } from 'react'
import { MIN_HOLD_DURATION_MINUTES, formatHoldDuration } from '@/lib/eligibility/holdDuration'
import { formatPayoutInterval, DEFAULT_PAYOUT_INTERVAL_MINUTES } from '@/lib/platform/payoutIntervals'

type Thresholds = {
  min_balance?: string
  min_hold_display?: string
  min_loss_pct?: number
  payout_interval_display?: string
}

interface EligibilityRequirementsProps {
  slug?: string
  variant?: 'compact' | 'full'
  className?: string
}

function useThresholds(slug?: string): Thresholds {
  const [thresholds, setThresholds] = useState<Thresholds>({
    min_balance: '1,000',
    min_hold_display: formatHoldDuration(MIN_HOLD_DURATION_MINUTES),
    min_loss_pct: 10,
    payout_interval_display: formatPayoutInterval(DEFAULT_PAYOUT_INTERVAL_MINUTES),
  })

  useEffect(() => {
    const url = slug ? `/api/t/${slug}/stats` : '/api/stats'
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.thresholds) {
          setThresholds(json.data.thresholds)
        }
      })
      .catch(() => {})
  }, [slug])

  return thresholds
}

export function EligibilityRequirements({
  slug,
  variant = 'full',
  className = '',
}: EligibilityRequirementsProps) {
  const thresholds = useThresholds(slug)
  const compact = variant === 'compact'

  const requirements = [
    {
      n: 1,
      title: 'Minimum token balance',
      body: `Hold at least ${thresholds.min_balance} tokens.`,
    },
    {
      n: 2,
      title: `${thresholds.min_hold_display} minimum hold`,
      body: 'From first on-chain buy.',
    },
    {
      n: 3,
      title: 'In a loss position',
      body: 'Price below VWAP (average buy price).',
    },
    {
      n: 4,
      title: `Loss ≥ ${thresholds.min_loss_pct}% of live pool`,
      body: 'USD loss must meet the threshold on the leaderboard.',
    },
    {
      n: 5,
      title: 'Has not sold',
      body: 'Any sell or transfer-out disqualifies the wallet.',
    },
    {
      n: 6,
      title: 'Not on winner cooldown',
      body: 'Previous cycle winner sits out one round.',
    },
    {
      n: 7,
      title: `${thresholds.payout_interval_display ?? '15 minutes'} payout cycle`,
      body: 'Timer starts when the first eligible holder appears; winners paid on this schedule until the listing ends.',
    },
  ]

  return (
    <div className={className}>
      <p
        className={`font-semibold uppercase tracking-wider text-rh-lime ${compact ? 'text-xs mb-3' : 'text-sm mb-4'}`}
      >
        Eligibility requirements
      </p>
      {!compact && (
        <p className="text-sm text-gray-400 mb-4">
          Holders must pass every rule to rank. Winners are the top eligible losers by drawdown % (most underwater first).
        </p>
      )}
      <ol className={compact ? 'space-y-2 text-sm' : 'space-y-3'}>
        {requirements.map(req => (
          <li
            key={req.n}
            className={
              compact
                ? 'flex gap-2 text-gray-300'
                : 'flex gap-3 rounded-lg border border-rh-green/10 bg-rh-green/5 p-4'
            }
          >
            <span
              className={
                compact
                  ? 'text-rh-lime font-bold shrink-0'
                  : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rh-green/20 text-sm font-bold text-rh-lime'
              }
            >
              {req.n}.
            </span>
            <div>
              <span className={compact ? 'text-white font-medium' : 'font-semibold text-white'}>{req.title}</span>
              {!compact && <p className="text-sm text-gray-400 mt-0.5">{req.body}</p>}
              {compact && <span className="text-gray-500"> — {req.body}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
