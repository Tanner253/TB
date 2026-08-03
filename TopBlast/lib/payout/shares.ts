import { config } from '@/lib/config'

/** Winner-pool share labels (of pool after dev fee) */
export function getWinnerSharePercents() {
  return {
    first: Math.round(config.payoutSplit.first * 100),
    second: Math.round(config.payoutSplit.second * 100),
    third: Math.round(config.payoutSplit.third * 100),
  }
}

export function getDevFeePercent() {
  return Math.round(config.devFeePct * 100)
}

export function getCommunityPercent() {
  return Math.round((1 - config.devFeePct) * 100)
}

/** USD payout for eligible rank (0 = 1st, 1 = 2nd, 2 = 3rd) */
export function getPayoutForEligibleRank(poolUsd: number, eligibleRank: number): number {
  if (eligibleRank < 0 || eligibleRank > 2) return 0
  const winnersPool = poolUsd * (1 - config.devFeePct)
  const splits = [config.payoutSplit.first, config.payoutSplit.second, config.payoutSplit.third]
  return winnersPool * splits[eligibleRank]
}

export function getPayoutSplitLabels() {
  const shares = getWinnerSharePercents()
  return {
    dev: `${getDevFeePercent()}%`,
    first: `${shares.first}%`,
    second: `${shares.second}%`,
    third: `${shares.third}%`,
    community: `${getCommunityPercent()}%`,
  }
}
