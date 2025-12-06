/**
 * TopBlast API Routes Tests
 * 
 * Tests the full API workflow to ensure:
 * - Snapshot route correctly calculates and stores rankings
 * - Payout route correctly processes winners
 * - Winner VWAP is reset correctly for future rounds
 * - Winner cooldown is applied correctly
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import {
  Holder,
  Snapshot,
  Payout,
  Disqualification,
  PoolBalance,
} from '@/lib/db/models'
import {
  calculateDrawdown,
  calculateLossUsd,
  checkEligibility,
  rankHolders,
  calculatePayouts,
  RankedHolder,
} from '@/lib/engine/calculations'

// Mock config
jest.mock('@/lib/config', () => ({
  config: {
    tokenMint: 'mock_token_mint',
    tokenSymbol: 'TEST',
    tokenDecimals: 6,
    minTokenHolding: 100000,
    minHoldDurationHours: 1,
    minLossThresholdPct: 10,
    poolBalanceUsd: 500,
    minPoolForPayout: 50,
    payoutSplit: {
      first: 0.80,
      second: 0.15,
      third: 0.05,
    },
    payoutIntervalMinutes: 60,
    executePayouts: false, // Don't execute real transfers in tests
    cronSecret: 'test_secret',
    isProd: false,
    isDev: true,
  },
  validateConfig: () => ({ valid: true, errors: [] }),
}))

describe('API Routes Workflow', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    await mongoose.connect(mongoServer.getUri())
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Holder.deleteMany({})
    await Snapshot.deleteMany({})
    await Payout.deleteMany({})
    await Disqualification.deleteMany({})
    await PoolBalance.deleteMany({})
  })

  // ===========================================
  // SNAPSHOT WORKFLOW
  // ===========================================
  describe('Snapshot Workflow', () => {
    /**
     * Simulates what the /api/cron/snapshot route does
     */

    const simulateSnapshot = async (
      holders: Array<{ wallet: string; balance: number; vwap: number; lastWinCycle: number | null }>,
      tokenPrice: number,
      poolBalance: number,
      cycle: number
    ) => {
      // This simulates the snapshot route logic
      
      // 1. Remove expired disqualifications
      await Disqualification.deleteMany({ expiresAt: { $lt: new Date() } })
      
      // 2. Load active disqualifications
      const activeDqs = await Disqualification.find({ expiresAt: { $gt: new Date() } })
      const dqWallets = new Set(activeDqs.map(d => d.wallet))

      // 3. Check each holder for eligibility and calculate rankings
      const rankedHolders: RankedHolder[] = []

      for (const holder of holders) {
        // Skip disqualified
        if (dqWallets.has(holder.wallet)) {
          continue
        }

        // Load from DB to get reset VWAP
        const dbHolder = await Holder.findOne({ wallet: holder.wallet })
        
        // Use DB VWAP if user has won before (their VWAP was reset)
        const effectiveVwap = (dbHolder?.lastWinCycle && dbHolder?.vwap) 
          ? dbHolder.vwap 
          : holder.vwap

        const eligibility = checkEligibility(
          {
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            lastWinCycle: dbHolder?.lastWinCycle || holder.lastWinCycle,
            cooldownUntil: null,
          },
          tokenPrice,
          poolBalance,
          cycle
        )

        const drawdownPct = calculateDrawdown(effectiveVwap, tokenPrice)
        const lossUsd = calculateLossUsd(effectiveVwap, tokenPrice, holder.balance)

        // Update holder in DB
        await Holder.findOneAndUpdate(
          { wallet: holder.wallet },
          {
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            isEligible: eligibility.eligible,
            ineligibleReason: eligibility.reason,
            lastWinCycle: dbHolder?.lastWinCycle || holder.lastWinCycle,
          },
          { upsert: true }
        )

        if (eligibility.eligible) {
          rankedHolders.push({
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            currentPrice: tokenPrice,
            drawdownPct,
            lossUsd,
            rank: 0,
            isEligible: true,
            ineligibleReason: null,
          })
        }
      }

      // 4. Rank holders
      const ranked = rankHolders(rankedHolders)

      // 5. Save snapshot
      await Snapshot.create({
        cycle,
        timestamp: new Date(),
        tokenPrice,
        poolBalance,
        totalHolders: holders.length,
        eligibleCount: ranked.length,
        rankings: ranked.slice(0, 50),
      })

      return ranked
    }

    it('should create snapshot with correct rankings', async () => {
      const holders = [
        { wallet: 'A', balance: 300000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'B', balance: 280000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'C', balance: 260000, vwap: 0.001, lastWinCycle: null },
      ]

      const ranked = await simulateSnapshot(holders, 0.0005, 500, 1)

      expect(ranked.length).toBe(3)
      expect(ranked[0].wallet).toBe('A') // Highest USD loss
      expect(ranked[1].wallet).toBe('B')
      expect(ranked[2].wallet).toBe('C')

      const snapshot = await Snapshot.findOne({ cycle: 1 })
      expect(snapshot).not.toBeNull()
      expect(snapshot!.eligibleCount).toBe(3)
    })

    it('should exclude winners on cooldown', async () => {
      // Create holder who won last cycle
      await Holder.create({
        wallet: 'WINNER',
        balance: 300000,
        vwap: 0.001,
        lastWinCycle: 1,
        isEligible: false,
        ineligibleReason: 'Winner cooldown',
      })

      const holders = [
        { wallet: 'WINNER', balance: 300000, vwap: 0.001, lastWinCycle: 1 },
        { wallet: 'OTHER', balance: 280000, vwap: 0.001, lastWinCycle: null },
      ]

      const ranked = await simulateSnapshot(holders, 0.0005, 500, 2)

      // WINNER should be excluded (won cycle 1, now cycle 2)
      expect(ranked.length).toBe(1)
      expect(ranked[0].wallet).toBe('OTHER')
    })

    it('should use reset VWAP for previous winners', async () => {
      // Create holder who won and had VWAP reset
      await Holder.create({
        wallet: 'RESET_WINNER',
        balance: 300000,
        vwap: 0.0005, // Reset to price at win time
        lastWinCycle: 1,
        isEligible: false,
      })

      const holders = [
        // Original VWAP was 0.001, but DB has 0.0005 (reset)
        { wallet: 'RESET_WINNER', balance: 300000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'NEW_HOLDER', balance: 280000, vwap: 0.001, lastWinCycle: null },
      ]

      // Price is still 0.0005 - same as reset VWAP
      const ranked = await simulateSnapshot(holders, 0.0005, 500, 3)

      // RESET_WINNER should be ineligible (VWAP 0.0005 = current price = 0% drawdown = "In profit")
      const resetWinner = ranked.find(h => h.wallet === 'RESET_WINNER')
      expect(resetWinner).toBeUndefined()

      // NEW_HOLDER should be eligible
      expect(ranked.length).toBe(1)
      expect(ranked[0].wallet).toBe('NEW_HOLDER')
    })
  })

  // ===========================================
  // PAYOUT WORKFLOW
  // ===========================================
  describe('Payout Workflow', () => {
    /**
     * Simulates what the /api/cron/payout route does
     */

    const simulatePayout = async (cycle: number, tokenPrice: number) => {
      // 1. Get latest snapshot
      const snapshot = await Snapshot.findOne().sort({ cycle: -1 })
      if (!snapshot) throw new Error('No snapshot')

      // 2. Check if already processed
      const existingPayouts = await Payout.find({ cycle: snapshot.cycle })
      if (existingPayouts.length > 0) throw new Error('Already processed')

      // 3. Get pool balance
      const pool = await PoolBalance.findOne()
      const poolBal = pool?.balance || 500

      // 4. Get winners from snapshot
      const rankings = snapshot.rankings as any[]
      const winners = rankings.slice(0, 3)

      if (winners.length === 0) {
        return { success: true, skipped: true, reason: 'No eligible winners' }
      }

      // 5. Calculate payouts
      const payouts = calculatePayouts(poolBal)
      const payoutAmounts = [payouts.first, payouts.second, payouts.third]

      // 6. Process each winner
      const results = []
      for (let i = 0; i < winners.length; i++) {
        const winner = winners[i]
        const amountUsd = payoutAmounts[i]
        const amountTokens = tokenPrice > 0 ? Math.floor(amountUsd / tokenPrice) : 0

        // Save payout record
        await Payout.create({
          cycle: snapshot.cycle,
          rank: i + 1,
          wallet: winner.wallet,
          amount: amountUsd,
          amountTokens,
          drawdownPct: winner.drawdownPct,
          lossUsd: winner.lossUsd,
          status: 'pending', // executePayouts is false
        })

        // Add winner cooldown
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        })

        // Update lastWinCycle in Holder
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { lastWinCycle: snapshot.cycle }
        )

        // Reset VWAP to current price (game theory: winners start fresh)
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { vwap: tokenPrice }
        )

        results.push({
          rank: i + 1,
          wallet: winner.wallet,
          amount: amountUsd,
        })
      }

      return { success: true, results }
    }

    it('should process payouts correctly', async () => {
      // Setup: Create snapshot with winners
      const rankings = [
        { wallet: 'A', drawdownPct: -50, lossUsd: 150, rank: 1, balance: 300000, vwap: 0.001 },
        { wallet: 'B', drawdownPct: -50, lossUsd: 140, rank: 2, balance: 280000, vwap: 0.001 },
        { wallet: 'C', drawdownPct: -50, lossUsd: 130, rank: 3, balance: 260000, vwap: 0.001 },
      ]

      await Snapshot.create({
        cycle: 1,
        timestamp: new Date(),
        tokenPrice: 0.0005,
        poolBalance: 500,
        totalHolders: 3,
        eligibleCount: 3,
        rankings,
      })

      // Create holders in DB
      for (const r of rankings) {
        await Holder.create({
          wallet: r.wallet,
          balance: r.balance,
          vwap: r.vwap,
          lastWinCycle: null,
        })
      }

      const result = await simulatePayout(1, 0.0005)

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(3)

      // Check payouts were recorded
      const payouts = await Payout.find({ cycle: 1 })
      expect(payouts.length).toBe(3)
      expect(payouts[0].amount).toBe(400) // 80%
      expect(payouts[1].amount).toBe(75)  // 15%
      expect(payouts[2].amount).toBe(25)  // 5%

      // Check cooldowns were created
      const dqs = await Disqualification.find()
      expect(dqs.length).toBe(3)

      // Check VWAP was reset
      const holderA = await Holder.findOne({ wallet: 'A' })
      expect(holderA!.vwap).toBe(0.0005)
      expect(holderA!.lastWinCycle).toBe(1)
    })

    it('should not allow double-processing same cycle', async () => {
      // Create snapshot
      await Snapshot.create({
        cycle: 1,
        timestamp: new Date(),
        tokenPrice: 0.0005,
        poolBalance: 500,
        totalHolders: 1,
        eligibleCount: 1,
        rankings: [{ wallet: 'A', drawdownPct: -50, lossUsd: 100, rank: 1, balance: 200000, vwap: 0.001 }],
      })

      await Holder.create({ wallet: 'A', balance: 200000, vwap: 0.001 })

      // Process once
      await simulatePayout(1, 0.0005)

      // Try to process again
      await expect(simulatePayout(1, 0.0005)).rejects.toThrow('Already processed')
    })
  })

  // ===========================================
  // FULL GAME THEORY FLOW
  // ===========================================
  describe('Full Game Theory Flow', () => {
    /**
     * Tests the complete game theory:
     * Round N: A, B, C win
     * Round N+1: A, B, C on cooldown, D, E, F win
     * Round N+2: A, B, C cooldown expired, but VWAP reset = 0% drawdown = not eligible
     * Round N+3: If price drops, A, B, C become eligible again
     */

    const runFullCycle = async (
      holders: Array<{ wallet: string; balance: number; vwap: number }>,
      tokenPrice: number,
      cycle: number,
      simulatedTime?: Date // Allow simulating time passage
    ) => {
      const now = simulatedTime || new Date()
      
      // Clean up expired DQs based on simulated time
      await Disqualification.deleteMany({ expiresAt: { $lt: now } })
      const activeDqs = await Disqualification.find({ expiresAt: { $gt: now } })
      const dqWallets = new Set(activeDqs.map(d => d.wallet))

      const rankedHolders: RankedHolder[] = []

      for (const holder of holders) {
        if (dqWallets.has(holder.wallet)) continue

        const dbHolder = await Holder.findOne({ wallet: holder.wallet })
        const effectiveVwap = (dbHolder?.lastWinCycle && dbHolder?.vwap)
          ? dbHolder.vwap
          : holder.vwap

        const eligibility = checkEligibility(
          {
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            lastWinCycle: dbHolder?.lastWinCycle || null,
            cooldownUntil: null,
          },
          tokenPrice,
          500,
          cycle
        )

        await Holder.findOneAndUpdate(
          { wallet: holder.wallet },
          {
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            lastWinCycle: dbHolder?.lastWinCycle || null,
            isEligible: eligibility.eligible,
            ineligibleReason: eligibility.reason,
          },
          { upsert: true }
        )

        if (eligibility.eligible) {
          rankedHolders.push({
            wallet: holder.wallet,
            balance: holder.balance,
            vwap: effectiveVwap,
            currentPrice: tokenPrice,
            drawdownPct: calculateDrawdown(effectiveVwap, tokenPrice),
            lossUsd: calculateLossUsd(effectiveVwap, tokenPrice, holder.balance),
            rank: 0,
            isEligible: true,
            ineligibleReason: null,
          })
        }
      }

      const ranked = rankHolders(rankedHolders)
      const winners = ranked.slice(0, 3)

      // Mark winners
      for (const winner of winners) {
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { lastWinCycle: cycle, vwap: tokenPrice }
        )
        // Use simulated time for DQ expiry
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        })
      }

      await Snapshot.create({
        cycle,
        timestamp: new Date(),
        tokenPrice,
        poolBalance: 500,
        totalHolders: holders.length,
        eligibleCount: ranked.length,
        rankings: ranked,
      })

      return winners.map(w => w.wallet)
    }

    it('should demonstrate complete game theory cycle', async () => {
      const holders = [
        { wallet: 'A', balance: 300000, vwap: 0.001 },
        { wallet: 'B', balance: 280000, vwap: 0.001 },
        { wallet: 'C', balance: 260000, vwap: 0.001 },
        { wallet: 'D', balance: 240000, vwap: 0.001 },
        { wallet: 'E', balance: 220000, vwap: 0.001 },
        { wallet: 'F', balance: 200000, vwap: 0.001 },
      ]

      let currentPrice = 0.0005 // -50% from original VWAP
      const baseTime = new Date()

      // Round 1: A, B, C win (highest USD losses)
      let winners = await runFullCycle(holders, currentPrice, 1, baseTime)
      expect(winners).toEqual(['A', 'B', 'C'])

      // Verify A, B, C have reset VWAP
      const holderA = await Holder.findOne({ wallet: 'A' })
      expect(holderA!.vwap).toBe(0.0005)
      expect(holderA!.lastWinCycle).toBe(1)

      // Round 2: 1 hour later - D, E, F win (A, B, C on cooldown)
      const round2Time = new Date(baseTime.getTime() + 1 * 60 * 60 * 1000)
      winners = await runFullCycle(holders, currentPrice, 2, round2Time)
      expect(winners).toEqual(['D', 'E', 'F'])

      // Round 3: 2.5 hours later - A, B, C DQ expired, but 0% drawdown (VWAP = price)
      // D, E, F still on cooldown (only 1.5 hours since their win)
      const round3Time = new Date(baseTime.getTime() + 2.5 * 60 * 60 * 1000)
      winners = await runFullCycle(holders, currentPrice, 3, round3Time)
      expect(winners).toEqual([])

      // Round 4: 3.5 hours later, price drops - A, B, C have loss again!
      // D, E, F DQ also expired now (2.5 hours since Round 2)
      // But D, E, F VWAP was reset too, so at new price they're eligible
      // A, B, C have VWAP 0.0005, new price 0.00025 = -50% loss - ELIGIBLE!
      currentPrice = 0.00025
      const round4Time = new Date(baseTime.getTime() + 3.5 * 60 * 60 * 1000)
      winners = await runFullCycle(holders, currentPrice, 4, round4Time)
      
      // A, B, C should win (VWAP 0.0005 -> 0.00025 = -50%, highest balances)
      // D, E, F also have VWAP 0.0005 -> 0.00025 = -50%, but lower balances
      expect(winners).toEqual(['A', 'B', 'C'])
    })
  })
})

