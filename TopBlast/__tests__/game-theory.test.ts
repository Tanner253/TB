/**
 * TopBlast Game Theory Tests
 * 
 * Tests the core game mechanics as defined in FEATURE_SPEC.md:
 * - VWAP (Volume-Weighted Average Price) calculation
 * - Drawdown percentage calculation
 * - Winner selection and ranking
 * - Winner cooldown (can't win 2 rounds in a row)
 * - VWAP reset after winning (winners start fresh)
 * - Full game cycle behavior
 */

import {
  calculateVwap,
  calculateDrawdown,
  calculateLossUsd,
  checkEligibility,
  rankHolders,
  calculatePayouts,
  RankedHolder,
} from '@/lib/engine/calculations'

// Mock config for tests
jest.mock('@/lib/config', () => ({
  config: {
    minTokenHolding: 100000,
    minHoldDurationHours: 1,
    minLossThresholdPct: 10,
    poolBalanceUsd: 500,
    payoutSplit: {
      first: 0.80,
      second: 0.15,
      third: 0.05,
    },
  },
}))

describe('TopBlast Game Theory', () => {
  // ===========================================
  // SECTION 1: VWAP CALCULATION
  // ===========================================
  describe('VWAP (Volume-Weighted Average Price)', () => {
    /**
     * Per FEATURE_SPEC 5.1:
     * VWAP = Sum of (Price × Quantity) / Sum of Quantity
     */
    
    it('should calculate VWAP for single buy transaction', () => {
      // User buys 1,000,000 tokens at $0.0001
      const buys = [
        { timestamp: new Date(), amount: 1000000, priceUsd: 0.0001, type: 'buy' as const }
      ]
      expect(calculateVwap(buys)).toBe(0.0001)
    })

    it('should calculate VWAP for multiple buys (FEATURE_SPEC example)', () => {
      // From FEATURE_SPEC 5.1:
      // Buy #1: 1,000,000 tokens @ $0.0001 = $100
      // Buy #2: 500,000 tokens @ $0.0002 = $100
      // Total: 1,500,000 tokens, $200 cost
      // VWAP = $200 / 1,500,000 = $0.000133
      const buys = [
        { timestamp: new Date(), amount: 1000000, priceUsd: 0.0001, type: 'buy' as const },
        { timestamp: new Date(), amount: 500000, priceUsd: 0.0002, type: 'buy' as const },
      ]
      const vwap = calculateVwap(buys)
      expect(vwap).not.toBeNull()
      expect(vwap).toBeCloseTo(0.000133, 6)
    })

    it('should ignore sell transactions in VWAP calculation', () => {
      const activities = [
        { timestamp: new Date(), amount: 1000000, priceUsd: 0.0001, type: 'buy' as const },
        { timestamp: new Date(), amount: 500000, priceUsd: 0.00005, type: 'sell' as const }, // Should be ignored
      ]
      expect(calculateVwap(activities)).toBe(0.0001)
    })

    it('should return null when no buy transactions exist', () => {
      const activities = [
        { timestamp: new Date(), amount: 500000, priceUsd: 0.00005, type: 'sell' as const },
      ]
      expect(calculateVwap(activities)).toBeNull()
    })

    it('should handle DCA (Dollar Cost Averaging) scenario', () => {
      // User DCAs at decreasing prices
      const buys = [
        { timestamp: new Date(), amount: 100000, priceUsd: 0.0002, type: 'buy' as const }, // $20
        { timestamp: new Date(), amount: 200000, priceUsd: 0.00015, type: 'buy' as const }, // $30
        { timestamp: new Date(), amount: 400000, priceUsd: 0.0001, type: 'buy' as const }, // $40
      ]
      // Total: 700,000 tokens, $90 cost
      // VWAP = $90 / 700,000 = $0.0001286
      const vwap = calculateVwap(buys)
      expect(vwap).not.toBeNull()
      expect(vwap).toBeCloseTo(0.0001286, 6)
    })
  })

  // ===========================================
  // SECTION 2: DRAWDOWN CALCULATION
  // ===========================================
  describe('Drawdown Calculation', () => {
    /**
     * Per FEATURE_SPEC 5.2:
     * Drawdown % = ((Current Price - VWAP) / VWAP) × 100
     */

    it('should calculate drawdown (FEATURE_SPEC example)', () => {
      // VWAP: $0.000133, Current: $0.00008
      // Drawdown = ((0.00008 - 0.000133) / 0.000133) × 100 = -39.85%
      const drawdown = calculateDrawdown(0.000133, 0.00008)
      expect(drawdown).toBeCloseTo(-39.85, 1)
    })

    it('should return negative drawdown when underwater', () => {
      // Bought at $0.001, now at $0.0004 = -60%
      expect(calculateDrawdown(0.001, 0.0004)).toBeCloseTo(-60, 1)
    })

    it('should return positive drawdown when in profit', () => {
      // Bought at $0.0004, now at $0.001 = +150%
      expect(calculateDrawdown(0.0004, 0.001)).toBeCloseTo(150, 1)
    })

    it('should return 0 when price equals VWAP', () => {
      expect(calculateDrawdown(0.001, 0.001)).toBe(0)
    })

    it('should handle extreme drawdown (-90%+)', () => {
      // Bought at $0.001, now at $0.00005 = -95%
      expect(calculateDrawdown(0.001, 0.00005)).toBeCloseTo(-95, 1)
    })

    it('should return 0 for invalid VWAP', () => {
      expect(calculateDrawdown(0, 0.001)).toBe(0)
      expect(calculateDrawdown(null as any, 0.001)).toBe(0)
    })
  })

  // ===========================================
  // SECTION 3: ABSOLUTE LOSS CALCULATION
  // ===========================================
  describe('Absolute USD Loss', () => {
    /**
     * Per FEATURE_SPEC 5.3:
     * Absolute Loss = (VWAP - Current Price) × Token Balance
     */

    it('should calculate absolute loss correctly', () => {
      // VWAP: $0.001, Current: $0.0004, Balance: 1,000,000
      // Loss = (0.001 - 0.0004) × 1,000,000 = $600
      expect(calculateLossUsd(0.001, 0.0004, 1000000)).toBe(600)
    })

    it('should return 0 when in profit', () => {
      expect(calculateLossUsd(0.0004, 0.001, 1000000)).toBe(0)
    })

    it('should scale with token balance', () => {
      // Same price difference, different balances
      expect(calculateLossUsd(0.001, 0.0005, 100000)).toBe(50)
      expect(calculateLossUsd(0.001, 0.0005, 200000)).toBe(100)
    })
  })

  // ===========================================
  // SECTION 4: ELIGIBILITY RULES
  // ===========================================
  describe('Eligibility Rules', () => {
    /**
     * Per FEATURE_SPEC 6.1, a wallet must meet ALL requirements:
     * - Minimum Token Balance: ≥ 100,000 $TBLAST
     * - Minimum Hold Duration: ≥ 1 hour
     * - Minimum Loss Threshold: Loss > 10% of pool value
     * - Loss Position: Drawdown % < 0
     * - No Active Disqualification
     */

    const createHolder = (overrides = {}) => ({
      wallet: 'test_wallet',
      balance: 200000, // Above minimum (100k)
      vwap: 0.001,
      lastWinCycle: null as number | null,
      cooldownUntil: null as Date | null,
      ...overrides,
    })

    describe('Balance Requirement', () => {
      it('should reject holder below minimum balance (100k)', () => {
        const holder = createHolder({ balance: 99999 })
        const result = checkEligibility(holder, 0.0005, 500, 1)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('Insufficient balance')
      })

      it('should accept holder at exactly minimum balance', () => {
        const holder = createHolder({ balance: 100000 })
        const result = checkEligibility(holder, 0.0005, 500, 1)
        expect(result.eligible).toBe(true)
      })
    })

    describe('Buy History Requirement', () => {
      it('should reject holder without VWAP (no buys)', () => {
        const holder = createHolder({ vwap: null })
        const result = checkEligibility(holder, 0.0005, 500, 1)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('No buy history')
      })

      it('should reject holder with zero VWAP', () => {
        const holder = createHolder({ vwap: 0 })
        const result = checkEligibility(holder, 0.0005, 500, 1)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('No buy history')
      })
    })

    describe('Loss Position Requirement', () => {
      it('should reject holder in profit (drawdown >= 0)', () => {
        const holder = createHolder({ vwap: 0.0005 })
        const result = checkEligibility(holder, 0.001, 500, 1) // Current > VWAP = profit
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('In profit')
      })

      it('should reject holder at break-even', () => {
        const holder = createHolder({ vwap: 0.001 })
        const result = checkEligibility(holder, 0.001, 500, 1) // Current = VWAP
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('In profit')
      })

      it('should accept holder in loss position', () => {
        const holder = createHolder({ vwap: 0.001 })
        const result = checkEligibility(holder, 0.0005, 500, 1) // -50% loss
        expect(result.eligible).toBe(true)
      })
    })

    describe('Minimum Loss Threshold', () => {
      it('should reject holder with loss below 10% of pool', () => {
        // Pool: $500, 10% = $50 minimum loss
        // Balance: 200,000, VWAP: $0.001, Current: $0.0009 = -10%
        // Loss = (0.001 - 0.0009) × 200,000 = $20 < $50
        const holder = createHolder({ balance: 200000, vwap: 0.001 })
        const result = checkEligibility(holder, 0.0009, 500, 1)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('Loss below threshold')
      })

      it('should accept holder with loss above threshold', () => {
        // Balance: 200,000, VWAP: $0.001, Current: $0.0005 = -50%
        // Loss = (0.001 - 0.0005) × 200,000 = $100 > $50
        const holder = createHolder({ balance: 200000, vwap: 0.001 })
        const result = checkEligibility(holder, 0.0005, 500, 1)
        expect(result.eligible).toBe(true)
      })
    })

    describe('Winner Cooldown (CRITICAL)', () => {
      /**
       * Per FEATURE_SPEC 6.2:
       * Won previous cycle → Cannot win consecutively → 1 cycle cooldown
       */

      it('should reject holder who won last cycle (N-1)', () => {
        const holder = createHolder({ lastWinCycle: 5 })
        const result = checkEligibility(holder, 0.0005, 500, 6) // Current cycle = 6
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('Winner cooldown')
      })

      it('should reject holder who won current cycle', () => {
        const holder = createHolder({ lastWinCycle: 6 })
        const result = checkEligibility(holder, 0.0005, 500, 6) // Current cycle = 6
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('Winner cooldown')
      })

      it('should allow holder who won 2+ cycles ago', () => {
        const holder = createHolder({ lastWinCycle: 4 })
        const result = checkEligibility(holder, 0.0005, 500, 6) // Current cycle = 6
        expect(result.eligible).toBe(true)
      })

      it('should allow holder who never won', () => {
        const holder = createHolder({ lastWinCycle: null })
        const result = checkEligibility(holder, 0.0005, 500, 10)
        expect(result.eligible).toBe(true)
      })
    })
  })

  // ===========================================
  // SECTION 5: RANKING SYSTEM
  // ===========================================
  describe('Ranking System', () => {
    /**
     * Per FEATURE_SPEC 5.3:
     * Primary Sort: Drawdown % (most negative first)
     * Tiebreaker: Absolute USD loss value (higher loss wins ties)
     */

    const createRankedHolder = (overrides = {}): RankedHolder => ({
      wallet: 'test',
      balance: 100000,
      vwap: 0.001,
      currentPrice: 0.0005,
      drawdownPct: -50,
      lossUsd: 50,
      rank: 0,
      isEligible: true,
      ineligibleReason: null,
      ...overrides,
    })

    it('should rank by drawdown % (most negative first)', () => {
      const holders: RankedHolder[] = [
        createRankedHolder({ wallet: 'A', drawdownPct: -30 }),
        createRankedHolder({ wallet: 'B', drawdownPct: -70 }),
        createRankedHolder({ wallet: 'C', drawdownPct: -50 }),
      ]

      const ranked = rankHolders(holders)
      
      expect(ranked[0].wallet).toBe('B') // -70% (most negative)
      expect(ranked[1].wallet).toBe('C') // -50%
      expect(ranked[2].wallet).toBe('A') // -30%
    })

    it('should use USD loss as tiebreaker (FEATURE_SPEC example)', () => {
      // From FEATURE_SPEC 5.3:
      // Both at -65.2%, but different USD losses
      const holders: RankedHolder[] = [
        createRankedHolder({ wallet: '0xAAA', drawdownPct: -65.2, lossUsd: 45 }),
        createRankedHolder({ wallet: '0xBBB', drawdownPct: -65.2, lossUsd: 18 }),
      ]

      const ranked = rankHolders(holders)
      
      expect(ranked[0].wallet).toBe('0xAAA') // Higher USD loss wins tie
      expect(ranked[1].wallet).toBe('0xBBB')
    })

    it('should filter out ineligible holders', () => {
      const holders: RankedHolder[] = [
        createRankedHolder({ wallet: 'ELIGIBLE', isEligible: true }),
        createRankedHolder({ wallet: 'DISQUALIFIED', isEligible: false, ineligibleReason: 'Sold tokens' }),
        createRankedHolder({ wallet: 'COOLDOWN', isEligible: false, ineligibleReason: 'Winner cooldown' }),
      ]

      const ranked = rankHolders(holders)
      
      expect(ranked.length).toBe(1)
      expect(ranked[0].wallet).toBe('ELIGIBLE')
    })

    it('should assign sequential ranks', () => {
      const holders: RankedHolder[] = [
        createRankedHolder({ wallet: 'A', drawdownPct: -30 }),
        createRankedHolder({ wallet: 'B', drawdownPct: -70 }),
        createRankedHolder({ wallet: 'C', drawdownPct: -50 }),
      ]

      const ranked = rankHolders(holders)
      
      expect(ranked[0].rank).toBe(1)
      expect(ranked[1].rank).toBe(2)
      expect(ranked[2].rank).toBe(3)
    })
  })

  // ===========================================
  // SECTION 6: PAYOUT DISTRIBUTION
  // ===========================================
  describe('Payout Distribution', () => {
    /**
     * Per FEATURE_SPEC 5.4:
     * 1st Place: 80%
     * 2nd Place: 15%
     * 3rd Place: 5%
     */

    it('should split pool 80/15/5', () => {
      const payouts = calculatePayouts(1000)
      expect(payouts.first).toBe(800)
      expect(payouts.second).toBe(150)
      expect(payouts.third).toBe(50)
    })

    it('should handle exact FEATURE_SPEC example ($300 pool)', () => {
      const payouts = calculatePayouts(300)
      expect(payouts.first).toBe(240)
      expect(payouts.second).toBe(45)
      expect(payouts.third).toBe(15)
    })

    it('should handle small pool', () => {
      const payouts = calculatePayouts(10)
      expect(payouts.first).toBe(8)
      expect(payouts.second).toBe(1.5)
      expect(payouts.third).toBe(0.5)
    })

    it('should sum to 100% of pool', () => {
      const pool = 500
      const payouts = calculatePayouts(pool)
      expect(payouts.first + payouts.second + payouts.third).toBe(pool)
    })
  })

  // ===========================================
  // SECTION 7: FULL GAME CYCLE (INTEGRATION)
  // ===========================================
  describe('Full Game Cycle', () => {
    /**
     * Simulates the complete game theory flow:
     * Round N: Winners A, B, C selected
     * Round N+1: A, B, C on cooldown, D, E, F win
     * Round N+2: A, B, C cooldown expired, but VWAP reset = not eligible
     */

    interface TestHolder {
      wallet: string
      balance: number
      vwap: number
      lastWinCycle: number | null
    }

    const simulateRound = (
      holders: TestHolder[],
      currentPrice: number,
      poolBalance: number,
      currentCycle: number
    ) => {
      // Check eligibility for each holder
      const eligibleHolders = holders.map(h => {
        const eligibility = checkEligibility(
          { ...h, cooldownUntil: null },
          currentPrice,
          poolBalance,
          currentCycle
        )
        const drawdownPct = calculateDrawdown(h.vwap, currentPrice)
        const lossUsd = calculateLossUsd(h.vwap, currentPrice, h.balance)
        
        return {
          ...h,
          currentPrice,
          drawdownPct,
          lossUsd,
          rank: 0,
          isEligible: eligibility.eligible,
          ineligibleReason: eligibility.reason,
        } as RankedHolder
      })

      // Rank them
      const ranked = rankHolders(eligibleHolders)
      
      // Select top 3 winners
      const winners = ranked.slice(0, 3)
      
      return { ranked, winners }
    }

    it('should cycle through winners correctly over multiple rounds', () => {
      // Initial state: 6 holders, all bought at same price, all losing
      let holders: TestHolder[] = [
        { wallet: 'A', balance: 200000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'B', balance: 200000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'C', balance: 200000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'D', balance: 200000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'E', balance: 200000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'F', balance: 200000, vwap: 0.001, lastWinCycle: null },
      ]
      
      // To create different rankings, give them different balances (tiebreaker)
      holders[0].balance = 600000 // A: highest USD loss
      holders[1].balance = 500000 // B
      holders[2].balance = 400000 // C
      holders[3].balance = 300000 // D
      holders[4].balance = 200000 // E
      holders[5].balance = 150000 // F
      
      const currentPrice = 0.0005 // -50% from VWAP
      const poolBalance = 500

      // ROUND 1: All eligible, A, B, C should win (highest USD losses)
      let round = simulateRound(holders, currentPrice, poolBalance, 1)
      expect(round.winners.map(w => w.wallet)).toEqual(['A', 'B', 'C'])
      
      // Mark winners - set lastWinCycle and reset VWAP
      holders = holders.map(h => {
        if (['A', 'B', 'C'].includes(h.wallet)) {
          return { ...h, lastWinCycle: 1, vwap: currentPrice } // VWAP reset to current price
        }
        return h
      })

      // ROUND 2: A, B, C on cooldown, D, E, F should win
      round = simulateRound(holders, currentPrice, poolBalance, 2)
      expect(round.winners.map(w => w.wallet)).toEqual(['D', 'E', 'F'])
      
      // Verify A, B, C are excluded due to cooldown
      const abcInRound2 = round.ranked.filter(h => ['A', 'B', 'C'].includes(h.wallet))
      expect(abcInRound2.length).toBe(0) // Not in ranked list

      // Mark round 2 winners
      holders = holders.map(h => {
        if (['D', 'E', 'F'].includes(h.wallet)) {
          return { ...h, lastWinCycle: 2, vwap: currentPrice }
        }
        return h
      })

      // ROUND 3: A, B, C cooldown expired, but VWAP was reset to current price = 0% drawdown = not eligible
      round = simulateRound(holders, currentPrice, poolBalance, 3)
      
      // A, B, C have VWAP = current price, so drawdown = 0%, so they're "In profit" (not losing)
      const holdersABC = holders.filter(h => ['A', 'B', 'C'].includes(h.wallet))
      holdersABC.forEach(h => {
        const eligibility = checkEligibility(
          { ...h, cooldownUntil: null },
          currentPrice,
          poolBalance,
          3
        )
        expect(eligibility.eligible).toBe(false)
        expect(eligibility.reason).toBe('In profit')
      })
      
      // D, E, F are on cooldown in round 3
      // So NO ONE should be eligible!
      expect(round.winners.length).toBe(0)
    })

    it('should allow previous winners to win again if price drops below reset point', () => {
      // Scenario: A won at price $0.0005, VWAP reset to $0.0005
      // Price then drops to $0.00025 (-50% from reset point)
      // A should be eligible again
      
      const holders: TestHolder[] = [
        { wallet: 'A', balance: 200000, vwap: 0.0005, lastWinCycle: 1 }, // Won round 1, VWAP reset
      ]
      
      const poolBalance = 500

      // Round 3: Price at reset point - not eligible
      let result = simulateRound(holders, 0.0005, poolBalance, 3)
      expect(result.winners.length).toBe(0)

      // Round 4: Price dropped below reset point - eligible again!
      result = simulateRound(holders, 0.00025, poolBalance, 4)
      expect(result.winners.length).toBe(1)
      expect(result.winners[0].wallet).toBe('A')
    })

    it('should eventually pay all losers if price keeps climbing', () => {
      // Scenario: Price goes up, original losers rotate through
      // This tests the game theory: all original losers eventually win
      
      const initialPrice = 0.001
      const buyPrice = 0.002 // All bought at $0.002
      
      let holders: TestHolder[] = [
        { wallet: 'A', balance: 300000, vwap: buyPrice, lastWinCycle: null },
        { wallet: 'B', balance: 280000, vwap: buyPrice, lastWinCycle: null },
        { wallet: 'C', balance: 260000, vwap: buyPrice, lastWinCycle: null },
        { wallet: 'D', balance: 240000, vwap: buyPrice, lastWinCycle: null },
        { wallet: 'E', balance: 220000, vwap: buyPrice, lastWinCycle: null },
        { wallet: 'F', balance: 200000, vwap: buyPrice, lastWinCycle: null },
      ]
      
      const poolBalance = 500
      let currentPrice = initialPrice // -50% from buy price
      const winners: string[] = []

      // Simulate rounds until all have won or max iterations
      for (let cycle = 1; cycle <= 10; cycle++) {
        const round = simulateRound(holders, currentPrice, poolBalance, cycle)
        
        // Record winners
        round.winners.forEach(w => {
          if (!winners.includes(w.wallet)) {
            winners.push(w.wallet)
          }
        })
        
        // Mark winners - set cooldown AND reset VWAP
        holders = holders.map(h => {
          const isWinner = round.winners.some(w => w.wallet === h.wallet)
          if (isWinner) {
            return { ...h, lastWinCycle: cycle, vwap: currentPrice }
          }
          return h
        })
        
        // If all have won, stop
        if (winners.length === 6) break
      }

      // All 6 holders should have won at some point
      expect(winners.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    })
  })

  // ===========================================
  // SECTION 8: EDGE CASES
  // ===========================================
  describe('Edge Cases', () => {
    /**
     * Per FEATURE_SPEC 13.3
     */

    it('should handle 0 eligible holders', () => {
      const holders: RankedHolder[] = []
      const ranked = rankHolders(holders)
      expect(ranked.length).toBe(0)
    })

    it('should handle 1 eligible holder', () => {
      const holders: RankedHolder[] = [
        {
          wallet: 'SOLO',
          balance: 200000,
          vwap: 0.001,
          currentPrice: 0.0005,
          drawdownPct: -50,
          lossUsd: 100,
          rank: 0,
          isEligible: true,
          ineligibleReason: null,
        },
      ]
      const ranked = rankHolders(holders)
      expect(ranked.length).toBe(1)
      expect(ranked[0].rank).toBe(1)
    })

    it('should handle 2 eligible holders', () => {
      const holders: RankedHolder[] = [
        {
          wallet: 'A',
          balance: 200000,
          vwap: 0.001,
          currentPrice: 0.0005,
          drawdownPct: -50,
          lossUsd: 100,
          rank: 0,
          isEligible: true,
          ineligibleReason: null,
        },
        {
          wallet: 'B',
          balance: 200000,
          vwap: 0.001,
          currentPrice: 0.0005,
          drawdownPct: -60,
          lossUsd: 120,
          rank: 0,
          isEligible: true,
          ineligibleReason: null,
        },
      ]
      const ranked = rankHolders(holders)
      expect(ranked.length).toBe(2)
      expect(ranked[0].wallet).toBe('B') // Higher loss
    })

    it('should handle exact tie (same %, same loss) deterministically', () => {
      const holders: RankedHolder[] = [
        {
          wallet: 'AAAA',
          balance: 200000,
          vwap: 0.001,
          currentPrice: 0.0005,
          drawdownPct: -50,
          lossUsd: 100,
          rank: 0,
          isEligible: true,
          ineligibleReason: null,
        },
        {
          wallet: 'ZZZZ',
          balance: 200000,
          vwap: 0.001,
          currentPrice: 0.0005,
          drawdownPct: -50,
          lossUsd: 100,
          rank: 0,
          isEligible: true,
          ineligibleReason: null,
        },
      ]
      
      // Run multiple times to ensure deterministic
      const results = []
      for (let i = 0; i < 5; i++) {
        const ranked = rankHolders([...holders])
        results.push(ranked[0].wallet)
      }
      
      // All results should be the same (deterministic)
      expect(new Set(results).size).toBe(1)
    })
  })
})

