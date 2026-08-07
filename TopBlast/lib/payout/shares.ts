/** Protocol-wide payout constants (same for all tenants) */
const PAYOUT_SPLIT = { first: 0.60, second: 0.25, third: 0.15 }
const DEV_FEE_PCT = 0.12

/** Winner-pool share labels (of pool after dev fee) */
export function getWinnerSharePercents() {
  return {
    first: Math.round(PAYOUT_SPLIT.first * 100),
    second: Math.round(PAYOUT_SPLIT.second * 100),
    third: Math.round(PAYOUT_SPLIT.third * 100),
  }
}

export function getDevFeePercent() {
  return Math.round(DEV_FEE_PCT * 100)
}

export function getCommunityPercent() {
  return Math.round((1 - DEV_FEE_PCT) * 100)
}

/** USD payout for eligible rank (0 = 1st, 1 = 2nd, 2 = 3rd) */
export function getPayoutForEligibleRank(poolUsd: number, eligibleRank: number): number {
  if (eligibleRank < 0 || eligibleRank > 2) return 0
  const winnersPool = poolUsd * (1 - DEV_FEE_PCT)
  const splits = [PAYOUT_SPLIT.first, PAYOUT_SPLIT.second, PAYOUT_SPLIT.third]
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
