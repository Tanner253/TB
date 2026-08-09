import {
  rankingNeedsVwapHydration,
  payoutBlockedByPendingVwap,
  VWAP_HYDRATION_RETRY_MS,
} from '@/lib/tracker/holderService'

describe('payoutBlockedByPendingVwap', () => {
  it('blocks when a top holder still needs buy history', () => {
    const rankings = [
      { wallet: 'A', balance: 1_000_000, vwap: 0, ineligibleReason: 'Loading buy history...' },
      { wallet: 'B', balance: 500_000, vwap: 0.001, ineligibleReason: null },
    ]
    expect(payoutBlockedByPendingVwap(rankings, 3)).toBe(true)
  })

  it('allows payout when top holders have resolved VWAP', () => {
    const rankings = [
      {
        wallet: 'A',
        balance: 1_000_000,
        vwap: 0.002,
        firstBuyAt: new Date(),
        ineligibleReason: 'In profit',
      },
      {
        wallet: 'B',
        balance: 500_000,
        vwap: 0.001,
        firstBuyAt: new Date(),
        ineligibleReason: 'In profit',
      },
    ]
    expect(payoutBlockedByPendingVwap(rankings, 3)).toBe(false)
  })
})

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
