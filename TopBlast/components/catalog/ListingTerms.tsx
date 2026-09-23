'use client'

import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'

/**
 * The terms a holder is actually signing up to, at a glance.
 *
 * Every listing sets its own winner count, cycle length, payout currency and
 * entry bar at /launch, and none of that was visible while browsing — two
 * tokens sat side by side in the catalog looking identical while one paid ten
 * winners hourly in its own token and the other paid three in ETH every six
 * hours. These badges are that difference, in the order a holder cares about
 * it: can I win, how often, in what, and what do I need to hold.
 *
 * Each badge carries a `title` with the full sentence, because the short label
 * is a reminder, not an explanation.
 */

function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

type Tone = 'accent' | 'mint' | 'sky' | 'neutral'

const TONE: Record<Tone, string> = {
  accent: 'bg-sol-purple/10 text-sol-purple border-sol-purple/25',
  mint: 'bg-sol-mint/10 text-sol-mint border-sol-mint/25',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
  neutral: 'bg-ink/[0.04] text-ink-2 border-line',
}

function Badge({
  icon,
  label,
  title,
  tone = 'neutral',
  size = 'sm',
}: {
  icon: string
  label: string
  title: string
  tone?: Tone
  size?: 'sm' | 'md'
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border whitespace-nowrap ${TONE[tone]} ${
        size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[0.65rem]'
      }`}
    >
      <span aria-hidden className="opacity-80">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </span>
  )
}

export interface ListingTermsProps {
  tenant: PublicTenantSummary
  /** md is the leaderboard header; sm is a catalog card. */
  size?: 'sm' | 'md'
  /** Hide badges the surrounding UI already states. */
  omit?: Array<'winners' | 'interval' | 'payout' | 'entry' | 'loss'>
  className?: string
}

export function ListingTerms({ tenant, size = 'sm', omit = [], className = '' }: ListingTermsProps) {
  const hide = new Set(omit)
  const symbol = tenant.symbol || 'TOKEN'
  const winners = tenant.winnerCount ?? 3
  const interval = tenant.payoutIntervalMinutes
  const paysToken = (tenant.payout_mode ?? 'token') !== 'sol'
  const minHold = tenant.minTokenHolding
  const minLoss = tenant.minLossThresholdPct

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {!hide.has('winners') && (
        <Badge
          size={size}
          tone="accent"
          icon="🏆"
          label={`${winners} winner${winners === 1 ? '' : 's'}`}
          title={`The ${winners} most underwater eligible holders split the pool each cycle, in descending shares.`}
        />
      )}

      {!hide.has('interval') && interval ? (
        <Badge
          size={size}
          tone="neutral"
          icon="⏱"
          label={formatPayoutInterval(interval)}
          title={`A payout cycle runs every ${formatPayoutInterval(interval)} once at least one holder qualifies.`}
        />
      ) : null}

      {!hide.has('payout') && (
        <Badge
          size={size}
          tone={paysToken ? 'mint' : 'sky'}
          icon={paysToken ? '📈' : 'Ξ'}
          label={paysToken ? `Buyback → $${symbol}` : 'Paid in ETH'}
          title={
            paysToken
              ? `The pool market-buys $${symbol} on its Pons curve and airdrops it to winners — the payout lands as real buy volume on the chart.`
              : 'Winners receive ETH straight from the pool. No buyback, so no buy volume on the chart.'
          }
        />
      )}

      {!hide.has('entry') && minHold && minHold > 0 ? (
        <Badge
          size={size}
          tone="neutral"
          icon="🔑"
          label={`≥ ${compactNumber(minHold)} to enter`}
          title={`A wallet must hold at least ${minHold.toLocaleString()} $${symbol} to be ranked at all.`}
        />
      ) : null}

      {!hide.has('loss') && minLoss && minLoss > 0 ? (
        <Badge
          size={size}
          tone="neutral"
          icon="📉"
          label={`≥ ${minLoss}% of pool`}
          title={`A wallet's loss must be worth at least ${minLoss}% of the current pool before it can win.`}
        />
      ) : null}
    </div>
  )
}
