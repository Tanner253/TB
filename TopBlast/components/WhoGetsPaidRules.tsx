'use client'

import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'
import { ExternalToolsEligibilityNote } from '@/components/tenant/ExternalToolsEligibilityNote'
import { DEFAULT_WINNER_COUNT } from '@/lib/payout/winnerCount'
import {
  formatWinnerSharePercents,
  getCommunityPercent,
  getDevFeePercent,
  getWinnerShareDisplayPercents,
} from '@/lib/payout/shares'

const DEV_FEE = getDevFeePercent()
const COMMUNITY = getCommunityPercent()

interface WhoGetsPaidRulesProps {
  variant?: 'homepage' | 'compact'
  slug?: string
  className?: string
  winnerCount?: number
}

export function WhoGetsPaidRules({
  variant = 'homepage',
  slug,
  className = '',
  winnerCount = DEFAULT_WINNER_COUNT,
}: WhoGetsPaidRulesProps) {
  const sharePercents = getWinnerShareDisplayPercents(winnerCount)
  const shareLabel = formatWinnerSharePercents(winnerCount)
  const winnerLabel =
    winnerCount === DEFAULT_WINNER_COUNT
      ? `top ${winnerCount} eligible (3–10 at launch)`
      : `top ${winnerCount} eligible`

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
        <p className="text-ink-2 leading-relaxed">
          <span className="text-ink font-bold">Biggest wallet balance does not win.</span> Only wallets that pass{' '}
          <span className="text-sol-purple font-semibold">every rule below</span> are ranked. Winners are the{' '}
          <span className="text-red-600 dark:text-red-400 font-semibold">top eligible losers by drawdown %</span> (most underwater first;
          USD loss breaks ties).
        </p>
      </div>

      <EligibilityRequirements slug={slug} variant="full" className="mb-6" />

      <div className="rounded-xl border border-line bg-card/60 p-4 mb-6 text-left text-sm text-ink-2">
        <p className="font-medium text-ink mb-1">Protocol wallets excluded</p>
        <p>
          Liquidity pools (bonding curve / AMM), the payout pool wallet, and the platform dev fee wallet cannot rank
          or receive conviction-reward payouts.
        </p>
      </div>

      <ExternalToolsEligibilityNote className="mb-6" defaultOpen />

      <div className="rounded-xl border border-rh-green/20 bg-card/70 p-5 text-left">
        <p className="text-sm font-semibold uppercase tracking-wider text-sol-purple mb-2">Payout split</p>
        <p className="text-ink-2 text-sm leading-relaxed mb-3">
          The <span className="text-ink font-semibold">{winnerLabel}</span> wallets receive{' '}
          <span className="text-rh-green font-semibold">{COMMUNITY}%</span> of the payout pool (after a{' '}
          {DEV_FEE}% dev fee), split{' '}
          <span className="font-mono text-sol-purple">{shareLabel}</span>{' '}
          of the winner pool (biggest loser gets {sharePercents[0]}%). Each cycle: pool SOL market-buys your session token on-chart, then tokens airdrop to winners automatically.
        </p>
        <p className="text-xs text-ink-3">
          The countdown timer stays in &quot;listing limbo&quot; until the first eligible holder appears — holding tokens
          alone does not start a payout cycle.
        </p>
      </div>
    </div>
  )
}
