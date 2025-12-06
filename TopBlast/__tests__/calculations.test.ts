import { 
  calculateVwap, 
  calculateDrawdown, 
  calculateLossUsd, 
  checkEligibility, 
  rankHolders, 
  calculatePayouts,
  WalletActivity,
  RankedHolder
} from '@/lib/engine/calculations'

describe('Calculation Engine', () => {
  describe('calculateVwap', () => {
    it('should calculate VWAP correctly for single buy', () => {
      const buys: WalletActivity[] = [
        { timestamp: new Date(), amount: 1000, priceUsd: 0.001, type: 'buy' }
      ]
      expect(calculateVwap(buys)).toBe(0.001)
    })

    it('should calculate VWAP correctly for multiple buys', () => {
      const buys: WalletActivity[] = [
        { timestamp: new Date(), amount: 1000, priceUsd: 0.001, type: 'buy' },
        { timestamp: new Date(), amount: 1000, priceUsd: 0.002, type: 'buy' },
      ]
      // (0.001 * 1000 + 0.002 * 1000) / 2000 = 0.0015
      expect(calculateVwap(buys)).toBe(0.0015)
    })

    it('should handle weighted average correctly', () => {
      const buys: WalletActivity[] = [
        { timestamp: new Date(), amount: 1000, priceUsd: 0.001, type: 'buy' }, // $1
        { timestamp: new Date(), amount: 3000, priceUsd: 0.00133333, type: 'buy' }, // ~$4
      ]
      // Total cost: $5, Total quantity: 4000
      // VWAP = 5/4000 = 0.00125
      const result = calculateVwap(buys)
      expect(result).not.toBeNull()
      expect(result).toBeCloseTo(0.00125, 4)
    })

    it('should return null for empty buys', () => {
      const buys: WalletActivity[] = [
        { timestamp: new Date(), amount: 100, priceUsd: 0.001, type: 'sell' }
      ]
      expect(calculateVwap(buys)).toBeNull()
    })

    it('should return null for zero quantity', () => {
      const buys: WalletActivity[] = [
        { timestamp: new Date(), amount: 0, priceUsd: 0.001, type: 'buy' }
      ]
      expect(calculateVwap(buys)).toBeNull()
    })
  })

  describe('calculateDrawdown', () => {
    it('should calculate positive drawdown (loss)', () => {
      // Bought at $1, now at $0.5 = -50%
      expect(calculateDrawdown(1, 0.5)).toBe(-50)
    })

    it('should calculate negative drawdown (profit)', () => {
      // Bought at $0.5, now at $1 = +100%
      expect(calculateDrawdown(0.5, 1)).toBe(100)
    })

    it('should return 0 when price unchanged', () => {
      expect(calculateDrawdown(1, 1)).toBe(0)
    })

    it('should handle zero VWAP', () => {
      expect(calculateDrawdown(0, 1)).toBe(0)
    })

    it('should calculate extreme drawdown', () => {
      // Bought at 0.001, now at 0.0001 = -90%
      expect(calculateDrawdown(0.001, 0.0001)).toBeCloseTo(-90)
    })
  })

  describe('calculateLossUsd', () => {
    it('should calculate loss correctly when underwater', () => {
      // Bought at $1, now at $0.5, balance 100 tokens. Loss = (1 - 0.5) * 100 = $50
      expect(calculateLossUsd(1, 0.5, 100)).toBe(50)
    })

    it('should return 0 when in profit', () => {
      expect(calculateLossUsd(0.5, 1, 100)).toBe(0)
    })

    it('should return 0 when price equals VWAP', () => {
      expect(calculateLossUsd(1, 1, 100)).toBe(0)
    })

    it('should scale with balance', () => {
      // Bought at $1, now at $0.5, balance 200 tokens. Loss = (1 - 0.5) * 200 = $100
      expect(calculateLossUsd(1, 0.5, 200)).toBe(100)
    })
  })

  describe('checkEligibility', () => {
    const baseHolder = {
      wallet: 'test_wallet',
      balance: 200000, // Above minimum
      vwap: 0.001, // Bought at $0.001
      lastWinCycle: null,
      cooldownUntil: null,
    }

    it('should mark eligible holder as eligible', () => {
      const result = checkEligibility(baseHolder, 0.0005, 100, 1) // -50%
      expect(result.eligible).toBe(true)
    })

    it('should reject holder with insufficient balance', () => {
      const holder = { ...baseHolder, balance: 100 }
      const result = checkEligibility(holder, 0.0005, 100, 1)
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('Insufficient balance')
    })

    it('should reject holder without VWAP', () => {
      const holder = { ...baseHolder, vwap: null }
      const result = checkEligibility(holder, 0.0005, 100, 1)
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('No buy history')
    })

    it('should reject holder not in loss position', () => {
      const result = checkEligibility(baseHolder, 0.002, 100, 1) // In profit
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('In profit')
    })

    it('should reject holder who won last cycle', () => {
      const holder = { ...baseHolder, lastWinCycle: 1 }
      const result = checkEligibility(holder, 0.0005, 100, 2)
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('Winner cooldown')
    })

    it('should allow holder who won 2+ cycles ago', () => {
      const holder = { ...baseHolder, lastWinCycle: 1 }
      const result = checkEligibility(holder, 0.0005, 100, 3)
      expect(result.eligible).toBe(true)
    })

    it('should reject holder with active cooldown', () => {
      const holder = { 
        ...baseHolder, 
        cooldownUntil: new Date(Date.now() + 3600000) // 1 hour from now
      }
      const result = checkEligibility(holder, 0.0005, 100, 1)
      expect(result.eligible).toBe(false)
      expect(result.reason).toBe('Cooldown active')
    })
  })

  describe('rankHolders', () => {
    const mockHolders: RankedHolder[] = [
      { wallet: 'A', balance: 1000, vwap: 0.002, currentPrice: 0.001, drawdownPct: -50, lossUsd: 100, rank: 0, isEligible: true, ineligibleReason: null },
      { wallet: 'B', balance: 1000, vwap: 0.003, currentPrice: 0.001, drawdownPct: -66.67, lossUsd: 200, rank: 0, isEligible: true, ineligibleReason: null },
      { wallet: 'C', balance: 1000, vwap: 0.002, currentPrice: 0.001, drawdownPct: -50, lossUsd: 150, rank: 0, isEligible: true, ineligibleReason: null },
      { wallet: 'D', balance: 1000, vwap: 0.0015, currentPrice: 0.001, drawdownPct: -33.33, lossUsd: 50, rank: 0, isEligible: true, ineligibleReason: null },
      { wallet: 'E', balance: 1000, vwap: 0.004, currentPrice: 0.001, drawdownPct: -75, lossUsd: 300, rank: 0, isEligible: false, ineligibleReason: 'Disqualified' },
    ]

    it('should rank by drawdown percentage (most negative first)', () => {
      const ranked = rankHolders(mockHolders)
      expect(ranked[0].wallet).toBe('B') // -66.67%
      expect(ranked[1].wallet).toBe('C') // -50% (higher loss)
      expect(ranked[2].wallet).toBe('A') // -50%
      expect(ranked[3].wallet).toBe('D') // -33.33%
    })

    it('should use USD loss as tiebreaker', () => {
      const ranked = rankHolders(mockHolders)
      // C (-50%, $150 loss) should be before A (-50%, $100 loss)
      expect(ranked[1].wallet).toBe('C')
      expect(ranked[2].wallet).toBe('A')
    })

    it('should filter out ineligible holders', () => {
      const ranked = rankHolders(mockHolders)
      expect(ranked.length).toBe(4)
      expect(ranked.find(h => h.wallet === 'E')).toBeUndefined()
    })

    it('should assign correct ranks', () => {
      const ranked = rankHolders(mockHolders)
      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(2)
      expect(ranked[2].rank).toBe(3)
      expect(ranked[3].rank).toBe(4)
    })
  })

  describe('calculatePayouts', () => {
    it('should calculate 80/15/5 split correctly', () => {
      const payouts = calculatePayouts(1000)
      expect(payouts.first).toBe(800)
      expect(payouts.second).toBe(150)
      expect(payouts.third).toBe(50)
    })

    it('should handle small pool', () => {
      const payouts = calculatePayouts(10)
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
})
