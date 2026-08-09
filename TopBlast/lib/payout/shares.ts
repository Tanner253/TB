import { DEFAULT_WINNER_COUNT } from '@/lib/payout/winnerCount'
import {
  formatWinnerSharePercents,
  getWinnerShareDisplayPercents,
  getWinnerShareFractions,
  getWinnerSharePercentsLegacy,
} from '@/lib/payout/winnerShares'

/** Protocol-wide dev fee (same for all tenants) */
const DEV_FEE_PCT = 0.12

/** Winner-pool share labels for default 3-winner listings */
export function getWinnerSharePercents(winnerCount: number = DEFAULT_WINNER_COUNT) {
  return getWinnerSharePercentsLegacy(winnerCount)
}

export function getDevFeePercent() {
  return Math.round(DEV_FEE_PCT * 100)
}

export function getCommunityPercent() {
  return Math.round((1 - DEV_FEE_PCT) * 100)
}

/** USD payout for eligible rank (0 = 1st biggest loser). Unused ranks return 0. */
export function getPayoutForEligibleRank(
  poolUsd: number,
  eligibleRank: number,
  winnerCount: number = DEFAULT_WINNER_COUNT
): number {
  const fractions = getWinnerShareFractions(winnerCount)
  if (eligibleRank < 0 || eligibleRank >= fractions.length) return 0
  const winnersPool = poolUsd * (1 - DEV_FEE_PCT)
  return winnersPool * fractions[eligibleRank]
}

export function getPayoutSplitLabels(winnerCount: number = DEFAULT_WINNER_COUNT) {
  const shares = getWinnerSharePercents(winnerCount)
  return {
    dev: `${getDevFeePercent()}%`,
    first: `${shares.first}%`,
    second: `${shares.second}%`,
    third: `${shares.third}%`,
    community: `${getCommunityPercent()}%`,
    all: formatWinnerSharePercents(winnerCount),
    percents: getWinnerShareDisplayPercents(winnerCount),
  }
}

export { formatWinnerSharePercents, getWinnerShareDisplayPercents, getWinnerShareFractions }
