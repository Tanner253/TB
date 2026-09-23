import { DEFAULT_WINNER_COUNT } from '@/lib/payout/winnerCount'
import {
  BUYBACK_BURN_PCT,
  COMMUNITY_PCT,
  DEV_FEE_PCT as DEV_FEE_PERCENT,
  PROTOCOL_FEE_PCT,
} from '@/lib/platform/flywheel'
import {
  formatWinnerSharePercents,
  getWinnerShareDisplayPercents,
  getWinnerShareFractions,
  getWinnerSharePercentsLegacy,
} from '@/lib/payout/winnerShares'

/** Winner-pool share labels for default 3-winner listings */
export function getWinnerSharePercents(winnerCount: number = DEFAULT_WINNER_COUNT) {
  return getWinnerSharePercentsLegacy(winnerCount)
}

export function getDevFeePercent() {
  return DEV_FEE_PERCENT
}

/** The buyback-and-burn cut, which is not part of the dev fee. */
export function getBurnPercent() {
  return BUYBACK_BURN_PCT
}

export function getProtocolFeePercent() {
  return PROTOCOL_FEE_PCT
}

export function getCommunityPercent() {
  return COMMUNITY_PCT
}

/** USD payout for eligible rank (0 = 1st biggest loser). Unused ranks return 0. */
export function getPayoutForEligibleRank(
  poolUsd: number,
  eligibleRank: number,
  winnerCount: number = DEFAULT_WINNER_COUNT
): number {
  const fractions = getWinnerShareFractions(winnerCount)
  if (eligibleRank < 0 || eligibleRank >= fractions.length) return 0
  // Both protocol cuts come off before winners split anything, so this
  // estimate has to net out the burn share too — otherwise the leaderboard
  // quotes a prize 10% larger than the cycle will actually pay.
  const winnersPool = poolUsd * (COMMUNITY_PCT / 100)
  return winnersPool * fractions[eligibleRank]
}

export function getPayoutSplitLabels(winnerCount: number = DEFAULT_WINNER_COUNT) {
  const shares = getWinnerSharePercents(winnerCount)
  return {
    dev: `${getDevFeePercent()}%`,
    burn: `${getBurnPercent()}%`,
    protocol: `${getProtocolFeePercent()}%`,
    first: `${shares.first}%`,
    second: `${shares.second}%`,
    third: `${shares.third}%`,
    community: `${getCommunityPercent()}%`,
    all: formatWinnerSharePercents(winnerCount),
    percents: getWinnerShareDisplayPercents(winnerCount),
  }
}

export { formatWinnerSharePercents, getWinnerShareDisplayPercents, getWinnerShareFractions }
