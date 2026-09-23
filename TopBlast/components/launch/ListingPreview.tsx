'use client'

import { ListingTerms } from '@/components/catalog/ListingTerms'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import { getWinnerShareDisplayPercents } from '@/lib/payout/winnerShares'
import { COMMUNITY_PCT, DEV_FEE_PCT, BUYBACK_BURN_PCT } from '@/lib/platform/flywheel'
import { MAX_PAYOUT_PCT_OF_SUPPLY } from '@/lib/payout/supplyCap'
import { appHostname } from '@/lib/marketing/urls'
import type { PublicTenantSummary } from '@/lib/tenant/types'

/**
 * What the listing will look like once it is live, updating as the form is
 * filled.
 *
 * The settings lock at launch and are otherwise abstract — "3 winners, 15
 * minutes, 100,000 minimum" does not tell a creator what they are choosing.
 * This shows the same badges holders will read in the catalog, plus the split
 * of an example pool, so the consequences of each choice are visible while it
 * is still changeable.
 *
 * The example pool is deliberately round and labelled as an example: it is
 * arithmetic on the numbers in the form, not a projection of what anyone will
 * earn.
 */
const EXAMPLE_POOL_USD = 100

export function ListingPreview({
  slug,
  symbol,
  mint,
  winnerCount,
  payoutIntervalMinutes,
  minTokenHolding,
  payoutMode,
}: {
  slug: string
  symbol: string
  mint: string
  winnerCount: number
  payoutIntervalMinutes: number
  minTokenHolding: number
  payoutMode: 'token' | 'sol'
}) {
  const shownSymbol = symbol.trim() || 'TOKEN'
  const shownSlug = slug.trim() || 'your-token'

  const tenant = {
    slug: shownSlug,
    symbol: shownSymbol,
    mint,
    status: 'active',
    createdAt: '',
    payoutWalletAddress: '',
    winnerCount,
    payoutIntervalMinutes,
    minTokenHolding,
    payout_mode: payoutMode,
  } as PublicTenantSummary

  const community = EXAMPLE_POOL_USD * (COMMUNITY_PCT / 100)
  const shares = getWinnerShareDisplayPercents(winnerCount)

  return (
    <aside className="rounded-2xl border border-line bg-card/60 p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Live preview
      </p>
      <h3 className="mt-1 text-sm font-bold text-ink">How holders will see it</h3>

      <div className="mt-4 rounded-xl border border-line bg-paper/60 p-4">
        <p className="font-bold text-ink">${shownSymbol}</p>
        {/* The link is the thing a creator shares, so it reads as the headline
            rather than a technical field buried under the ticker. */}
        <p className="mt-1 break-all font-mono text-xs text-sol-purple">
          {appHostname()}/{shownSlug}
        </p>
        <p className="mt-0.5 text-[0.65rem] text-ink-3">Your session link — share this anywhere</p>
        <ListingTerms tenant={tenant} size="sm" className="mt-3" />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-ink-2">
          If a cycle paid out ${EXAMPLE_POOL_USD}
          <span className="font-normal text-ink-3"> — example, not a projection</span>
        </p>
        <ul className="mt-2 space-y-1 text-xs text-ink-2">
          {shares.map((pct, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-ink-3">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '·'} Winner {i + 1}
              </span>
              <span className="font-mono tabular-nums">
                ${((community * pct) / 100).toFixed(2)}
                <span className="ml-1 text-ink-3">({pct}%)</span>
              </span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-ink-3">
            <span>Protocol — {DEV_FEE_PCT}% dev + {BUYBACK_BURN_PCT}% burn</span>
            <span className="font-mono tabular-nums">
              ${(EXAMPLE_POOL_USD - community).toFixed(2)}
            </span>
          </li>
        </ul>
      </div>

      <p className="mt-4 text-[0.7rem] leading-relaxed text-ink-3">
        A cycle runs every {formatPayoutInterval(payoutIntervalMinutes)} once at least one holder is
        underwater and holds {minTokenHolding.toLocaleString()} ${shownSymbol}.{' '}
        {payoutMode === 'token'
          ? 'Winners are paid in your token, bought on its own curve — so each payout is buy volume on your chart.'
          : 'Winners are paid ETH directly, so payouts do not create buy volume on your chart.'}
      </p>

      {payoutMode === 'token' ? (
        <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-3">
          <strong className="text-ink-2">Supply guard:</strong> no single payout delivers more than{' '}
          {MAX_PAYOUT_PCT_OF_SUPPLY}% of supply in tokens. If a winner&rsquo;s share is larger than
          that, the rest is paid to them in ETH the same cycle — so one payout can never dump a
          chart-breaking position on one wallet.
        </p>
      ) : null}
    </aside>
  )
}
