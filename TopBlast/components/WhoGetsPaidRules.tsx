'use client'

import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'
import { ExternalToolsEligibilityNote } from '@/components/tenant/ExternalToolsEligibilityNote'
import { getWinnerSharePercents, getDevFeePercent, getCommunityPercent } from '@/lib/payout/shares'

const SHARES = getWinnerSharePercents()
const DEV_FEE = getDevFeePercent()
const COMMUNITY = getCommunityPercent()

interface WhoGetsPaidRulesProps {
  variant?: 'homepage' | 'compact'
  slug?: string
  className?: string
}

export function WhoGetsPaidRules({ variant = 'homepage', slug, className = '' }: WhoGetsPaidRulesProps) {

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

      <EligibilityRequirements slug={slug} variant="full" className="mb-6" />

      <div className="rounded-xl border border-white/10 bg-black/30 p-4 mb-6 text-left text-sm text-gray-400">
        <p className="font-medium text-white mb-1">Protocol wallets excluded</p>
        <p>
          Liquidity pools (bonding curve / AMM), the payout pool wallet, and the platform dev fee wallet cannot rank
          or receive conviction-reward payouts.
        </p>
      </div>

      <ExternalToolsEligibilityNote className="mb-6" defaultOpen />

      <div className="rounded-xl border border-rh-green/20 bg-black/40 p-5 text-left">
        <p className="text-sm font-semibold uppercase tracking-wider text-rh-lime mb-2">Payout split</p>
        <p className="text-gray-300 text-sm leading-relaxed mb-3">
          The <span className="text-white font-semibold">top 3 eligible</span> wallets receive{' '}
          <span className="text-rh-green font-semibold">{COMMUNITY}%</span> of the payout pool (after a{' '}
          {DEV_FEE}% dev fee), split{' '}
          <span className="font-mono text-rh-lime">
            {SHARES.first}/{SHARES.second}/{SHARES.third}
          </span>{' '}
          of the winner pool. Each cycle: pool SOL market-buys your session token on-chart, then tokens airdrop to winners automatically.
        </p>
        <p className="text-xs text-gray-500">
          The countdown timer stays in &quot;listing limbo&quot; until the first eligible holder appears — holding tokens
          alone does not start a payout cycle.
        </p>
      </div>
    </div>
  )
}
