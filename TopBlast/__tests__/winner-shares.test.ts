import {
  getWinnerShareFractions,
  getWinnerShareDisplayPercents,
  formatWinnerSharePercents,
} from '@/lib/payout/winnerShares'
import {
  getPayoutForEligibleRank,
  getWinnerSharePercents,
} from '@/lib/payout/shares'
import {
  DEFAULT_WINNER_COUNT,
  minPoolForWinnerCount,
  validateWinnerCount,
  MIN_WINNER_COUNT,
  MAX_WINNER_COUNT,
} from '@/lib/payout/winnerCount'

describe('winnerCount', () => {
  it('defaults to 3 and validates range', () => {
    expect(validateWinnerCount()).toBe(DEFAULT_WINNER_COUNT)
    expect(validateWinnerCount(3)).toBe(3)
    expect(validateWinnerCount(10)).toBe(10)
    expect(() => validateWinnerCount(2)).toThrow()
    expect(() => validateWinnerCount(11)).toThrow()
  })

  it('scales minimum pool with winner count', () => {
    expect(minPoolForWinnerCount(3)).toBe(5)
    expect(minPoolForWinnerCount(10)).toBe(13.75)
  })
})

describe('getWinnerShareFractions', () => {
  it('preserves 60/25/15 for 3 winners', () => {
    const fractions = getWinnerShareFractions(3)
    expect(fractions).toEqual([0.6, 0.25, 0.15])
    expect(getWinnerSharePercents(3)).toEqual({ first: 60, second: 25, third: 15 })
  })

  it('sums to 1 for every supported winner count', () => {
    for (let n = MIN_WINNER_COUNT; n <= MAX_WINNER_COUNT; n++) {
      const fractions = getWinnerShareFractions(n)
      expect(fractions).toHaveLength(n)
      const sum = fractions.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 10)
    }
  })

  it('descends by rank — biggest loser gets most', () => {
    for (let n = MIN_WINNER_COUNT; n <= MAX_WINNER_COUNT; n++) {
      const fractions = getWinnerShareFractions(n)
      for (let i = 1; i < fractions.length; i++) {
        expect(fractions[i - 1]).toBeGreaterThan(fractions[i])
      }
    }
  })

  it('gives smaller shares as winner count increases', () => {
    const three = getWinnerShareFractions(3)[0]
    const ten = getWinnerShareFractions(10)[0]
    expect(ten).toBeLessThan(three)
  })

  it('formats display percents for UI', () => {
    expect(formatWinnerSharePercents(3)).toBe('60/25/15')
    const ten = getWinnerShareDisplayPercents(10)
    expect(ten).toHaveLength(10)
    expect(ten[0]).toBeGreaterThan(ten[9])
  })
})

describe('getPayoutForEligibleRank', () => {
  it('pays only configured ranks', () => {
    const pool = 1000
    expect(getPayoutForEligibleRank(pool, 0, 3)).toBeCloseTo(528, 0)
    expect(getPayoutForEligibleRank(pool, 2, 3)).toBeCloseTo(132, 0)
    expect(getPayoutForEligibleRank(pool, 3, 3)).toBe(0)
  })

  it('scales payout down for more winners at same rank', () => {
    const pool = 1000
    const firstOf3 = getPayoutForEligibleRank(pool, 0, 3)
    const firstOf10 = getPayoutForEligibleRank(pool, 0, 10)
    expect(firstOf10).toBeLessThan(firstOf3)
  })
})
