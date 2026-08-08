import {
  rankingNeedsVwapHydration,
  VWAP_HYDRATION_RETRY_MS,
} from '@/lib/tracker/holderService'

describe('rankingNeedsVwapHydration', () => {
  it('retries wallets stuck on No buy history after cooldown', () => {
    const stale = new Date(Date.now() - VWAP_HYDRATION_RETRY_MS - 1000)
    expect(
      rankingNeedsVwapHydration({
        vwap: 0,
        ineligibleReason: 'No buy history',
        vwapFetchedAt: stale,
      })
    ).toBe(true)
  })

  it('does not retry No buy history inside cooldown window', () => {
    expect(
      rankingNeedsVwapHydration({
        vwap: 0,
        ineligibleReason: 'No buy history',
        vwapFetchedAt: new Date(),
      })
    ).toBe(false)
  })

  it('always retries Buy history pending', () => {
    expect(
      rankingNeedsVwapHydration({
        vwap: 0,
        ineligibleReason: 'Buy history pending',
      })
    ).toBe(true)
  })

  it('skips wallets with complete vwap and first buy', () => {
    expect(
      rankingNeedsVwapHydration({
        vwap: 0.00001,
        ineligibleReason: null,
        firstBuyAt: new Date('2026-01-01'),
      })
    ).toBe(false)
  })

  it('retries partial rows with vwap but no first buy', () => {
    expect(
      rankingNeedsVwapHydration({
        vwap: 0.00001,
        ineligibleReason: 'No buy history',
        firstBuyAt: null,
      })
    ).toBe(true)
  })
})
