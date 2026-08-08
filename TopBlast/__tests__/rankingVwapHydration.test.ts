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

  it('skips wallets with real vwap', () => {
    expect(
      rankingNeedsVwapHydration({
        vwap: 0.00001,
        ineligibleReason: null,
      })
    ).toBe(false)
  })
})
