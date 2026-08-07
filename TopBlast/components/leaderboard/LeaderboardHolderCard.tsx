'use client'

import { getPayoutForEligibleRank } from '@/lib/payout/shares'
import { HolderIneligibleCallout, HolderStatus } from '@/components/HoldTimeBadge'

export interface LeaderboardRow {
  rank?: number
  wallet: string
  wallet_display: string
  balance: string
  is_eligible?: boolean
  ineligible_reason?: string | null
  eligible_rank?: number | null
  hold_seconds_remaining?: number | null
  hold_eligible_at?: string | null
  first_buy_at?: string | null
  drawdown_pct?: number
  loss_usd?: string
  vwap_raw?: number
}

interface LeaderboardHolderCardProps {
  holder: LeaderboardRow
  index: number
  poolValue: number
  minHoldMinutes?: number
}

function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function drawdownLabel(pct: number | undefined | null, hasVwap: boolean): string {
  if (!hasVwap || pct == null) return '—'
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function drawdownClass(pct: number | undefined | null, hasVwap: boolean): string {
  if (!hasVwap || pct == null) return 'text-gray-500'
  if (pct < 0) return 'text-red-400'
  if (pct > 0) return 'text-rh-green'
  return 'text-gray-400'
}

export function LeaderboardHolderCard({
  holder,
  index,
  poolValue,
  minHoldMinutes = 15,
}: LeaderboardHolderCardProps) {
  const isEligible = holder.is_eligible === true
  const hasVwap = (holder.vwap_raw ?? 0) > 0
  const eligibleRank = holder.eligible_rank != null ? holder.eligible_rank - 1 : -1
  const payoutAmount =
    eligibleRank >= 0 && eligibleRank < 3 ? getPayoutForEligibleRank(poolValue, eligibleRank) : 0

  return (
    <article
      className={`p-4 border-b border-white/[0.06] ${!isEligible ? 'bg-white/[0.01]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">
            {isEligible && index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅'}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm text-gray-200 truncate">{holder.wallet_display}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              #{holder.rank ?? index + 1}
              {isEligible && holder.eligible_rank ? ` · eligible #${holder.eligible_rank}` : ''}
            </p>
          </div>
        </div>
        {isEligible ? (
          <HolderStatus isEligible />
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-gray-500">Drawdown</dt>
          <dd className={`font-mono ${drawdownClass(holder.drawdown_pct, hasVwap)}`}>
            {drawdownLabel(holder.drawdown_pct, hasVwap)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-gray-500">Balance</dt>
          <dd className="font-mono text-gray-200">{formatNumber(holder.balance)}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-gray-500">Loss (USD)</dt>
          <dd className="font-mono text-gray-300">{holder.loss_usd ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] uppercase tracking-wider text-gray-500">Payout</dt>
          <dd className="font-mono font-semibold text-rh-green">
            {payoutAmount > 0 && isEligible ? `$${payoutAmount.toFixed(2)}` : '—'}
          </dd>
        </div>
      </dl>

      {!isEligible ? (
        <HolderIneligibleCallout
          ineligibleReason={holder.ineligible_reason}
          holdEligibleAt={holder.hold_eligible_at}
          holdSecondsRemaining={holder.hold_seconds_remaining}
          firstBuyAt={holder.first_buy_at}
          minHoldMinutes={minHoldMinutes}
        />
      ) : null}
    </article>
  )
}
