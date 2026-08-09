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
  winnerCount?: number
  winnerSharePercents?: number[]
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
  winnerCount = 3,
  winnerSharePercents = [],
  minHoldMinutes = 15,
}: LeaderboardHolderCardProps) {
  const isEligible = holder.is_eligible === true
  const hasVwap =
    (holder.vwap_raw ?? 0) > 0 &&
    holder.ineligible_reason !== 'No buy history' &&
    holder.ineligible_reason !== 'Buy history pending'
  const eligibleRank = holder.eligible_rank
  const isWinnerSlot =
    isEligible && eligibleRank != null && eligibleRank >= 1 && eligibleRank <= winnerCount
  const isPedestal = isWinnerSlot && eligibleRank <= 3
  const payoutIdx = isWinnerSlot ? eligibleRank - 1 : -1
  const payoutAmount =
    payoutIdx >= 0 ? getPayoutForEligibleRank(poolValue, payoutIdx, winnerCount) : 0
  const sharePercent = payoutIdx >= 0 ? winnerSharePercents[payoutIdx] : null

  return (
    <article
      className={`p-4 border-b border-white/[0.06] ${!isEligible ? 'bg-white/[0.01]' : isWinnerSlot ? 'bg-rh-green/[0.03]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">
            {isPedestal ? ['🥇', '🥈', '🥉'][eligibleRank - 1] : isWinnerSlot ? '🏅' : '🏅'}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm text-gray-200 truncate">{holder.wallet_display}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              #{holder.rank ?? index + 1}
              {isWinnerSlot ? ` · winner #${eligibleRank}` : ''}
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
            {payoutAmount > 0 && isWinnerSlot ? (
              <>
                ${payoutAmount.toFixed(2)}
                {sharePercent != null ? (
                  <span className="block text-xs font-normal text-gray-500">{sharePercent}% share</span>
                ) : null}
              </>
            ) : (
              '—'
            )}
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
