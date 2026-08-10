import {
  buildRankingRowsFromBirdeye,
} from '@/lib/tracker/birdeyeRankings'

jest.mock('@/lib/eligibility/excludedWallets', () => ({
  isExcludedParticipantWallet: () => false,
}))

jest.mock('@/lib/eligibility/liquidityPools', () => ({
  isLiquidityPoolWallet: () => false,
}))

describe('buildRankingRowsFromBirdeye', () => {
  const ctx = {
    mint: 'EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump',
    tokenPrice: 0.000006131,
    poolUsd: 500,
    currentCycle: 1,
    lastWinByWallet: new Map<string, number>(),
    minTokenHolding: 1000,
    tokenDecimals: 6,
  }

  it('marks underwater buyer eligible when loss exceeds pool threshold', () => {
    const rows = buildRankingRowsFromBirdeye(
      [
        {
          wallet: 'A4ege1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          balance: 31_659_096,
          vwap: 0.000002358,
          firstBuyTimestamp: Date.parse('2025-10-24T06:17:37Z'),
          hasSold: false,
          hasTransferIn: false,
        },
      ],
      { ...ctx, tokenPrice: 0.000001500, poolUsd: 200 }
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].vwap).toBeGreaterThan(0)
    expect(rows[0].drawdownPct).toBeLessThan(0)
    expect(rows[0].isEligible).toBe(true)
  })

  it('disqualifies sold holder', () => {
    const rows = buildRankingRowsFromBirdeye(
      [
        {
          wallet: '4wRHFNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          balance: 34_513_861,
          vwap: 0.000004255,
          firstBuyTimestamp: Date.parse('2026-04-29T14:42:59Z'),
          hasSold: true,
          hasTransferIn: false,
        },
      ],
      ctx
    )

    expect(rows[0].isEligible).toBe(false)
    expect(rows[0].ineligibleReason).toBe('Sold tokens')
  })

  it('flags transfer-only holder without entry price', () => {
    const rows = buildRankingRowsFromBirdeye(
      [
        {
          wallet: '3KGLdaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          balance: 563_158_364,
          vwap: null,
          firstBuyTimestamp: Date.parse('2026-08-09T04:52:55Z'),
          hasSold: false,
          hasTransferIn: true,
        },
      ],
      ctx
    )

    expect(rows[0].vwap).toBe(0)
    expect(rows[0].isEligible).toBe(false)
    expect(rows[0].ineligibleReason).toBe('Received via transfer')
  })
})
