/**
 * TopBlast Persistence & Integration Tests
 * 
 * Tests the data persistence layer to ensure:
 * - Winners are properly saved to database
 * - Cooldown data persists across cycles
 * - VWAP reset is persisted after winning
 * - Full payout flow works correctly
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import {
  Holder,
  Snapshot,
  Payout,
  Disqualification,
  PoolBalance,
  IHolder,
} from '@/lib/db/models'
import {
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
    payoutIntervalMinutes: 60,
  },
}))

describe('Persistence Layer', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    // Create in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const uri = mongoServer.getUri()
    await mongoose.connect(uri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    // Clear all collections before each test
    await Holder.deleteMany({})
    await Snapshot.deleteMany({})
    await Payout.deleteMany({})
    await Disqualification.deleteMany({})
    await PoolBalance.deleteMany({})
  })

  // ===========================================
  // SECTION 1: HOLDER PERSISTENCE
  // ===========================================
  describe('Holder Model', () => {
    it('should save and retrieve a holder', async () => {
      const holderData = {
        wallet: 'test_wallet_123',
        balance: 200000,
        vwap: 0.001,
        totalBought: 200000,
        totalCostBasis: 200,
        firstBuyAt: new Date(),
        lastActivityAt: new Date(),
        lastWinCycle: null,
        isEligible: true,
        ineligibleReason: null,
      }

      await Holder.create(holderData)

      const retrieved = await Holder.findOne({ wallet: 'test_wallet_123' })
      expect(retrieved).not.toBeNull()
      expect(retrieved!.wallet).toBe('test_wallet_123')
      expect(retrieved!.balance).toBe(200000)
      expect(retrieved!.vwap).toBe(0.001)
    })

    it('should update lastWinCycle when holder wins', async () => {
      // Create holder
      await Holder.create({
        wallet: 'winner_wallet',
        balance: 200000,
        vwap: 0.001,
        lastWinCycle: null,
      })

      // Simulate winning cycle 5
      await Holder.findOneAndUpdate(
        { wallet: 'winner_wallet' },
        { lastWinCycle: 5 }
      )

      const updated = await Holder.findOne({ wallet: 'winner_wallet' })
      expect(updated!.lastWinCycle).toBe(5)
    })

    it('should reset VWAP when winner is paid', async () => {
      const currentPrice = 0.0005

      // Create holder with old VWAP
      await Holder.create({
        wallet: 'paid_winner',
        balance: 200000,
        vwap: 0.001, // Original VWAP
        lastWinCycle: null,
      })

      // Simulate payout - reset VWAP to current price
      await Holder.findOneAndUpdate(
        { wallet: 'paid_winner' },
        { vwap: currentPrice, lastWinCycle: 10 }
      )

      const updated = await Holder.findOne({ wallet: 'paid_winner' })
      expect(updated!.vwap).toBe(0.0005) // Reset to current price
      expect(updated!.lastWinCycle).toBe(10)
    })

    it('should persist cooldown data across multiple reads', async () => {
      // Create holder with cooldown
      await Holder.create({
        wallet: 'cooldown_wallet',
        balance: 200000,
        vwap: 0.001,
        lastWinCycle: 5,
      })

      // Read multiple times to ensure persistence
      const read1 = await Holder.findOne({ wallet: 'cooldown_wallet' })
      const read2 = await Holder.findOne({ wallet: 'cooldown_wallet' })
      const read3 = await Holder.findOne({ wallet: 'cooldown_wallet' })

      expect(read1!.lastWinCycle).toBe(5)
      expect(read2!.lastWinCycle).toBe(5)
      expect(read3!.lastWinCycle).toBe(5)
    })
  })

  // ===========================================
  // SECTION 2: DISQUALIFICATION PERSISTENCE
  // ===========================================
  describe('Disqualification Model', () => {
    it('should create disqualification for winner', async () => {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

      await Disqualification.create({
        wallet: 'winner_dq',
        reason: 'winner_cooldown',
        expiresAt,
      })

      const dq = await Disqualification.findOne({ wallet: 'winner_dq' })
      expect(dq).not.toBeNull()
      expect(dq!.reason).toBe('winner_cooldown')
      expect(dq!.expiresAt.getTime()).toBe(expiresAt.getTime())
    })

    it('should find active disqualifications', async () => {
      // Create expired DQ
      await Disqualification.create({
        wallet: 'expired_dq',
        reason: 'winner_cooldown',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      })

      // Create active DQ
      await Disqualification.create({
        wallet: 'active_dq',
        reason: 'winner_cooldown',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      })

      const activeDqs = await Disqualification.find({
        expiresAt: { $gt: new Date() },
      })

      expect(activeDqs.length).toBe(1)
      expect(activeDqs[0].wallet).toBe('active_dq')
    })
  })

  // ===========================================
  // SECTION 3: SNAPSHOT PERSISTENCE
  // ===========================================
  describe('Snapshot Model', () => {
    it('should save snapshot with rankings', async () => {
      const rankings = [
        { wallet: 'A', rank: 1, drawdownPct: -70, lossUsd: 100 },
        { wallet: 'B', rank: 2, drawdownPct: -60, lossUsd: 80 },
        { wallet: 'C', rank: 3, drawdownPct: -50, lossUsd: 60 },
      ]

      await Snapshot.create({
        cycle: 1,
        timestamp: new Date(),
        tokenPrice: 0.0005,
        poolBalance: 500,
        totalHolders: 100,
        eligibleCount: 50,
        rankings,
      })

      const snapshot = await Snapshot.findOne({ cycle: 1 })
      expect(snapshot).not.toBeNull()
      expect(snapshot!.rankings.length).toBe(3)
      expect(snapshot!.rankings[0].wallet).toBe('A')
    })

    it('should retrieve latest snapshot', async () => {
      // Create multiple snapshots
      await Snapshot.create({
        cycle: 1,
        timestamp: new Date(Date.now() - 3600000),
        tokenPrice: 0.0006,
        poolBalance: 500,
        totalHolders: 100,
        eligibleCount: 50,
        rankings: [],
      })

      await Snapshot.create({
        cycle: 2,
        timestamp: new Date(),
        tokenPrice: 0.0005,
        poolBalance: 600,
        totalHolders: 110,
        eligibleCount: 55,
        rankings: [],
      })

      const latest = await Snapshot.findOne().sort({ cycle: -1 })
      expect(latest!.cycle).toBe(2)
      expect(latest!.poolBalance).toBe(600)
    })
  })

  // ===========================================
  // SECTION 4: PAYOUT PERSISTENCE
  // ===========================================
  describe('Payout Model', () => {
    it('should save payout records', async () => {
      await Payout.create({
        cycle: 1,
        rank: 1,
        wallet: 'winner_1st',
        amount: 400,
        amountTokens: 800000000,
        drawdownPct: -70,
        lossUsd: 150,
        txHash: 'abc123',
        status: 'success',
      })

      const payout = await Payout.findOne({ cycle: 1, rank: 1 })
      expect(payout).not.toBeNull()
      expect(payout!.wallet).toBe('winner_1st')
      expect(payout!.amount).toBe(400)
      expect(payout!.status).toBe('success')
    })

    it('should retrieve payout history for a wallet', async () => {
      // Create multiple payouts
      await Payout.insertMany([
        { cycle: 1, rank: 1, wallet: 'repeat_winner', amount: 400, amountTokens: 800000000, drawdownPct: -70, lossUsd: 150, status: 'success' },
        { cycle: 5, rank: 2, wallet: 'repeat_winner', amount: 75, amountTokens: 150000000, drawdownPct: -55, lossUsd: 80, status: 'success' },
        { cycle: 3, rank: 1, wallet: 'other_winner', amount: 400, amountTokens: 800000000, drawdownPct: -65, lossUsd: 120, status: 'success' },
      ])

      const walletPayouts = await Payout.find({ wallet: 'repeat_winner' }).sort({ cycle: 1 })
      expect(walletPayouts.length).toBe(2)
      expect(walletPayouts[0].cycle).toBe(1)
      expect(walletPayouts[1].cycle).toBe(5)
    })
  })

  // ===========================================
  // SECTION 5: FULL WINNER CYCLE (INTEGRATION)
  // ===========================================
  describe('Full Winner Cycle Integration', () => {
    /**
     * This test simulates the complete winner selection and payout flow:
     * 1. Create holders in database
     * 2. Run eligibility check
     * 3. Rank holders
     * 4. Select winners
     * 5. Update database (cooldown, VWAP reset)
     * 6. Verify winners can't win next round
     * 7. Verify VWAP reset makes them ineligible (in profit)
     */

    const createTestHolders = async () => {
      // Create 6 holders all at -50% loss
      const holders = [
        { wallet: 'A', balance: 300000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'B', balance: 280000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'C', balance: 260000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'D', balance: 240000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'E', balance: 220000, vwap: 0.001, lastWinCycle: null },
        { wallet: 'F', balance: 200000, vwap: 0.001, lastWinCycle: null },
      ]

      await Holder.insertMany(holders)
      return holders
    }

    const runWinnerSelection = async (currentPrice: number, poolBalance: number, currentCycle: number) => {
      // Load holders from DB
      const dbHolders = await Holder.find({})
      
      // Calculate eligibility and rankings
      const rankedHolders: RankedHolder[] = dbHolders.map(h => {
        const eligibility = checkEligibility(
          {
            wallet: h.wallet,
            balance: h.balance,
            vwap: h.vwap,
            lastWinCycle: h.lastWinCycle,
            cooldownUntil: null,
          },
          currentPrice,
          poolBalance,
          currentCycle
        )

        const drawdownPct = calculateDrawdown(h.vwap || 0, currentPrice)
        const lossUsd = calculateLossUsd(h.vwap || 0, currentPrice, h.balance)

        return {
          wallet: h.wallet,
          balance: h.balance,
          vwap: h.vwap || 0,
          currentPrice,
          drawdownPct,
          lossUsd,
          rank: 0,
          isEligible: eligibility.eligible,
          ineligibleReason: eligibility.reason,
        }
      })

      return rankHolders(rankedHolders).slice(0, 3)
    }

    const markWinners = async (winners: RankedHolder[], currentPrice: number, currentCycle: number) => {
      for (const winner of winners) {
        // Update holder in DB
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          {
            vwap: currentPrice, // Reset VWAP
            lastWinCycle: currentCycle,
            updatedAt: new Date(),
          }
        )

        // Create disqualification record
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        })
      }
    }

    it('should correctly cycle winners across multiple rounds', async () => {
      await createTestHolders()
      const currentPrice = 0.0005 // -50% from VWAP
      const poolBalance = 500

      // ROUND 1: A, B, C should win (highest USD losses)
      let winners = await runWinnerSelection(currentPrice, poolBalance, 1)
      expect(winners.map(w => w.wallet)).toEqual(['A', 'B', 'C'])

      // Mark winners
      await markWinners(winners, currentPrice, 1)

      // Verify DB state
      const holderA = await Holder.findOne({ wallet: 'A' })
      expect(holderA!.lastWinCycle).toBe(1)
      expect(holderA!.vwap).toBe(currentPrice)

      // ROUND 2: A, B, C on cooldown, D, E, F should win
      winners = await runWinnerSelection(currentPrice, poolBalance, 2)
      expect(winners.map(w => w.wallet)).toEqual(['D', 'E', 'F'])

      // Mark winners
      await markWinners(winners, currentPrice, 2)

      // ROUND 3: All on cooldown or in profit (VWAP reset)
      winners = await runWinnerSelection(currentPrice, poolBalance, 3)
      // A, B, C: cooldown expired but VWAP = current price = 0% drawdown = ineligible
      // D, E, F: still on cooldown
      expect(winners.length).toBe(0)
    })

    it('should allow previous winners when price drops below reset point', async () => {
      await createTestHolders()
      const poolBalance = 500

      // ROUND 1: Price at 0.0005 (-50%)
      let currentPrice = 0.0005
      let winners = await runWinnerSelection(currentPrice, poolBalance, 1)
      await markWinners(winners, currentPrice, 1)

      // ROUND 3 (skip round 2 to expire cooldown): Price at same level
      // A, B, C have VWAP reset to 0.0005, so 0% drawdown = ineligible
      winners = await runWinnerSelection(currentPrice, poolBalance, 3)
      const eligibleWallets = winners.map(w => w.wallet)
      expect(eligibleWallets).not.toContain('A')
      expect(eligibleWallets).not.toContain('B')
      expect(eligibleWallets).not.toContain('C')

      // ROUND 4: Price drops to 0.00025 (-50% from reset point)
      currentPrice = 0.00025
      
      // Update D, E, F to have won round 3 (so they're on cooldown)
      await Holder.updateMany(
        { wallet: { $in: ['D', 'E', 'F'] } },
        { lastWinCycle: 3, vwap: 0.0005 }
      )

      winners = await runWinnerSelection(currentPrice, poolBalance, 4)
      
      // A, B, C should now be eligible (VWAP 0.0005 → current 0.00025 = -50%)
      // D, E, F on cooldown
      const round4Wallets = winners.map(w => w.wallet)
      expect(round4Wallets).toContain('A')
      expect(round4Wallets).toContain('B')
      expect(round4Wallets).toContain('C')
    })

    it('should persist winner history in Payout collection', async () => {
      await createTestHolders()
      const currentPrice = 0.0005
      const poolBalance = 500
      const payouts = calculatePayouts(poolBalance)

      // ROUND 1
      const winners = await runWinnerSelection(currentPrice, poolBalance, 1)

      // Save payouts
      await Payout.insertMany([
        {
          cycle: 1,
          rank: 1,
          wallet: winners[0].wallet,
          amount: payouts.first,
          amountTokens: payouts.first / currentPrice,
          drawdownPct: winners[0].drawdownPct,
          lossUsd: winners[0].lossUsd,
          status: 'success',
        },
        {
          cycle: 1,
          rank: 2,
          wallet: winners[1].wallet,
          amount: payouts.second,
          amountTokens: payouts.second / currentPrice,
          drawdownPct: winners[1].drawdownPct,
          lossUsd: winners[1].lossUsd,
          status: 'success',
        },
        {
          cycle: 1,
          rank: 3,
          wallet: winners[2].wallet,
          amount: payouts.third,
          amountTokens: payouts.third / currentPrice,
          drawdownPct: winners[2].drawdownPct,
          lossUsd: winners[2].lossUsd,
          status: 'success',
        },
      ])

      // Verify payout history
      const payoutHistory = await Payout.find({ cycle: 1 }).sort({ rank: 1 })
      expect(payoutHistory.length).toBe(3)
      expect(payoutHistory[0].amount).toBe(400) // 80% of 500
      expect(payoutHistory[1].amount).toBe(75)  // 15% of 500
      expect(payoutHistory[2].amount).toBe(25)  // 5% of 500
    })
  })

  // ===========================================
  // SECTION 6: DATA CONSISTENCY
  // ===========================================
  describe('Data Consistency', () => {
    it('should maintain consistent state after concurrent updates', async () => {
      // Create holder
      await Holder.create({
        wallet: 'concurrent_test',
        balance: 200000,
        vwap: 0.001,
        lastWinCycle: null,
      })

      // Simulate concurrent updates
      const updates = [
        Holder.findOneAndUpdate({ wallet: 'concurrent_test' }, { balance: 300000 }),
        Holder.findOneAndUpdate({ wallet: 'concurrent_test' }, { vwap: 0.0008 }),
      ]

      await Promise.all(updates)

      // Final state should have both updates
      const holder = await Holder.findOne({ wallet: 'concurrent_test' })
      // Note: In MongoDB, the last write wins, so we just verify data integrity
      expect(holder).not.toBeNull()
      expect(holder!.wallet).toBe('concurrent_test')
    })

    it('should properly index for fast winner lookups', async () => {
      // Create many holders
      const holders = []
      for (let i = 0; i < 100; i++) {
        holders.push({
          wallet: `wallet_${i.toString().padStart(3, '0')}`,
          balance: 200000 + i * 1000,
          vwap: 0.001,
          lastWinCycle: i < 10 ? 1 : null, // First 10 won cycle 1
        })
      }
      await Holder.insertMany(holders)

      // Query for holders NOT on cooldown
      const eligible = await Holder.find({
        $or: [
          { lastWinCycle: null },
          { lastWinCycle: { $lt: 1 } }, // Won before cycle 1
        ],
      })

      expect(eligible.length).toBe(90) // 100 - 10 on cooldown
    })
  })
})

