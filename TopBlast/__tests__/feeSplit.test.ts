import {
  BUYBACK_BURN_PCT,
  COMMUNITY_PCT,
  DEV_FEE_PCT,
  PROTOCOL_FEE_PCT,
} from '@/lib/platform/flywheel'
import { getWinnerShareFractions } from '@/lib/payout/winnerShares'

/**
 * The split is the product's central promise, so it is asserted as arithmetic
 * on a concrete pool rather than as constants agreeing with themselves.
 */
describe('payout pool split (20% protocol / 80% community)', () => {
  const POOL = 100

  const devFee = POOL * (DEV_FEE_PCT / 100)
  const burnShare = POOL * (BUYBACK_BURN_PCT / 100)
  const winnersPool = POOL - devFee - burnShare

  it('takes $12 dev and $8 burn from a $100 pool', () => {
    expect(devFee).toBeCloseTo(12, 10)
    expect(burnShare).toBeCloseTo(8, 10)
  })

  it('leaves $80 for eligible losers', () => {
    expect(winnersPool).toBeCloseTo(80, 10)
    expect(winnersPool).toBeCloseTo(POOL * (COMMUNITY_PCT / 100), 10)
  })

  it('never creates or destroys value', () => {
    expect(devFee + burnShare + winnersPool).toBeCloseTo(POOL, 10)
    expect(PROTOCOL_FEE_PCT + COMMUNITY_PCT).toBe(100)
  })

  it('pays first place 60% of the 80%, not of the whole pool', () => {
    const [first] = getWinnerShareFractions(3)
    expect(winnersPool * first).toBeCloseTo(48, 10)
    expect(winnersPool * first).toBeLessThan(POOL * first)
  })

  it('scales the worked example in the docs', () => {
    const pool = 2000
    const winners = pool - pool * (DEV_FEE_PCT / 100) - pool * (BUYBACK_BURN_PCT / 100)
    const [first] = getWinnerShareFractions(3)
    expect(winners).toBeCloseTo(1600, 10)
    expect(Math.round(winners * first)).toBe(960)
  })

  it('keeps every winner share inside the community pool', () => {
    for (const count of [3, 5, 10]) {
      const fractions = getWinnerShareFractions(count)
      const total = fractions.reduce((a, b) => a + b, 0) * winnersPool
      expect(total).toBeCloseTo(winnersPool, 8)
      expect(total).toBeLessThanOrEqual(POOL * (COMMUNITY_PCT / 100) + 1e-8)
    }
  })
})
