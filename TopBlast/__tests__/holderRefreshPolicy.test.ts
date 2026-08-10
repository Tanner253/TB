import {
  hasMaterialPriceChange,
  holderIdleRefreshIntervalMs,
  isIdleTenantSession,
  resolveHolderRefreshIntervalMs,
} from '@/lib/platform/holderRefreshPolicy'
import {
  buildRankingRowsFromBirdeye,
  recomputeRankingRowsFromSnapshot,
} from '@/lib/tracker/birdeyeRankings'

jest.mock('@/lib/eligibility/excludedWallets', () => ({
  isExcludedParticipantWallet: () => false,
}))

jest.mock('@/lib/eligibility/liquidityPools', () => ({
  isLiquidityPoolWallet: () => false,
}))

describe('holderRefreshPolicy', () => {
  it('treats waiting timer with no eligible and unfunded pool as idle', () => {
    expect(
      isIdleTenantSession({ timerStatus: 'waiting', eligibleCount: 0, poolFunded: false })
    ).toBe(true)
    expect(
      isIdleTenantSession({ timerStatus: 'active', eligibleCount: 0, poolFunded: false })
    ).toBe(false)
    expect(
      isIdleTenantSession({ timerStatus: 'waiting', eligibleCount: 2, poolFunded: false })
    ).toBe(false)
  })

  it('uses longer interval for idle tenants', () => {
    expect(holderIdleRefreshIntervalMs()).toBeGreaterThanOrEqual(15 * 60 * 1000)
    expect(
      resolveHolderRefreshIntervalMs({
        timerStatus: 'waiting',
        eligibleCount: 0,
        poolFunded: false,
      })
    ).toBe(holderIdleRefreshIntervalMs())
  })

  it('detects material price moves', () => {
    expect(hasMaterialPriceChange(0.000006, 0.000006, 0.5)).toBe(false)
    expect(hasMaterialPriceChange(0.000006, 0.0000061, 0.5)).toBe(true)
    expect(hasMaterialPriceChange(0, 0.000006)).toBe(true)
  })
})

describe('recomputeRankingRowsFromSnapshot', () => {
  const ctx = {
    mint: 'EvEPfQmH2BEe9XbiV8fghaafRWbG7n5oBEiLy5KNpump',
    tokenPrice: 0.000001500,
    poolUsd: 200,
    currentCycle: 1,
    lastWinByWallet: new Map<string, number>(),
    minTokenHolding: 1000,
    tokenDecimals: 6,
  }

  it('recomputes eligibility when price drops without Birdeye holder fields changing', () => {
    const stored = buildRankingRowsFromBirdeye(
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
      { ...ctx, tokenPrice: 0.000006131, poolUsd: 500 }
    )

    const recomputed = recomputeRankingRowsFromSnapshot(stored, ctx)
    expect(recomputed[0].isEligible).toBe(true)
    expect(recomputed[0].drawdownPct).toBeLessThan(0)
  })
})
