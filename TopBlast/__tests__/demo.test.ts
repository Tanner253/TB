import { calculateDrawdown, calculateLossUsd, calculatePayouts, rankHolders, RankedHolder } from '@/lib/engine/calculations'
import { config } from '@/lib/config'

describe('Configuration', () => {
  it('should have required config values', () => {
    expect(config.payoutSplit.first).toBe(0.80)
    expect(config.payoutSplit.second).toBe(0.15)
    expect(config.payoutSplit.third).toBe(0.05)
  })

  it('should have valid thresholds', () => {
    expect(config.minTokenHolding).toBeGreaterThan(0)
    expect(config.minHoldDurationHours).toBeGreaterThanOrEqual(0)
    expect(config.minLossThresholdPct).toBeGreaterThan(0)
  })
})

describe('Winner Selection', () => {
  const currentPrice = 0.00001
  
  const mockHolders: RankedHolder[] = [
    {
      wallet: 'wallet1',
      balance: 100000000,
      vwap: 0.00002, // -50%
      currentPrice,
      drawdownPct: calculateDrawdown(0.00002, currentPrice),
      lossUsd: calculateLossUsd(0.00002, currentPrice, 100000000),
      rank: 0,
      isEligible: true,
      ineligibleReason: null,
    },
    {
      wallet: 'wallet2',
      balance: 150000000,
      vwap: 0.00003, // -66.6%
      currentPrice,
      drawdownPct: calculateDrawdown(0.00003, currentPrice),
      lossUsd: calculateLossUsd(0.00003, currentPrice, 150000000),
      rank: 0,
      isEligible: true,
      ineligibleReason: null,
    },
    {
      wallet: 'wallet3',
      balance: 50000000,
      vwap: 0.000025, // -60%
      currentPrice,
      drawdownPct: calculateDrawdown(0.000025, currentPrice),
      lossUsd: calculateLossUsd(0.000025, currentPrice, 50000000),
      rank: 0,
      isEligible: true,
      ineligibleReason: null,
    },
  ]

  it('should rank by drawdown percentage (most negative first)', () => {
    const ranked = rankHolders(mockHolders)
    expect(ranked[0].wallet).toBe('wallet2') // -66.6%
    expect(ranked[1].wallet).toBe('wallet3') // -60%
    expect(ranked[2].wallet).toBe('wallet1') // -50%
  })

  it('should handle ties by USD loss', () => {
    const tieHolders: RankedHolder[] = [
      {
        wallet: 'tie1',
        balance: 100000000,
        vwap: 0.00002,
        currentPrice,
        drawdownPct: -50,
        lossUsd: 10,
        rank: 0,
        isEligible: true,
        ineligibleReason: null,
      },
      {
        wallet: 'tie2',
        balance: 200000000,
        vwap: 0.00002,
        currentPrice,
        drawdownPct: -50,
        lossUsd: 20,
        rank: 0,
        isEligible: true,
        ineligibleReason: null,
      },
    ]

    const ranked = rankHolders(tieHolders)
    expect(ranked[0].wallet).toBe('tie2') // Higher loss wins tie
    expect(ranked[1].wallet).toBe('tie1')
  })
})

describe('Payout Calculation', () => {
  it('should distribute 80/15/5 correctly', () => {
    const pool = 1000
    const payouts = calculatePayouts(pool)
    expect(payouts.first).toBe(800)
    expect(payouts.second).toBe(150)
    expect(payouts.third).toBe(50)
  })

  it('should handle small pool', () => {
    const pool = 10
    const payouts = calculatePayouts(pool)
    expect(payouts.first).toBe(8)
    expect(payouts.second).toBe(1.5)
    expect(payouts.third).toBe(0.5)
  })

  it('should handle zero pool', () => {
    const payouts = calculatePayouts(0)
    expect(payouts.first).toBe(0)
    expect(payouts.second).toBe(0)
    expect(payouts.third).toBe(0)
  })
})
