import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Holder, CurrentRankings } from '@/lib/db/models'
import {
  persistWinnerAfterPayout,
  loadLastWinCycleByWallet,
} from '@/lib/payout/winnerPersistence'

describe('winnerPersistence', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongoServer.getUri()
    await mongoose.connect(process.env.MONGODB_URI)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    ;(global as any).mongoose = { conn: null, promise: null }
    await Holder.deleteMany({})
    await CurrentRankings.deleteMany({})
  })

  it('persists winner cooldown and VWAP reset to Holder and rankings', async () => {
    await CurrentRankings.create({
      key: 'current_rankings',
      tokenMint: '0xtoken',
      rankings: [
        {
          wallet: '0xe52ecc0b8cb032a200301e0e5f79276af77201bd',
          balance: 1000,
          vwap: 0.000003,
          drawdownPct: -3,
          lossUsd: 1,
          isEligible: true,
          ineligibleReason: null,
          lastWinCycle: null,
        },
      ],
      totalHolders: 1,
      eligibleCount: 1,
      holdersWithVwap: 1,
      tokenPrice: 0.000002,
      lastCalculated: new Date(),
    })

    await persistWinnerAfterPayout(
      '0xE52ecc0b8cb032a200301E0e5F79276AF77201bd',
      17,
      0.000002625
    )

    const holder = await Holder.findOne({
      wallet: '0xe52ecc0b8cb032a200301e0e5f79276af77201bd',
    })
    expect(holder!.lastWinCycle).toBe(17)
    expect(holder!.vwap).toBe(0.000002625)
    expect(holder!.ineligibleReason).toBe('Winner cooldown')

    const rankings = await CurrentRankings.findOne({ key: 'current_rankings' })
    expect(rankings!.rankings[0].lastWinCycle).toBe(17)
    expect(rankings!.rankings[0].isEligible).toBe(false)
    expect(rankings!.eligibleCount).toBe(0)
  })

  it('loads lastWinCycle from Holder collection', async () => {
    const wallet = '0x1234567890123456789012345678901234567890'
    await Holder.create({
      wallet: wallet.toLowerCase(),
      balance: 100,
      lastWinCycle: 5,
    })

    const map = await loadLastWinCycleByWallet([wallet])
    expect(map.get(wallet.toLowerCase())).toBe(5)
  })

  it('falls back to successful Payout records when Holder is missing', async () => {
    const { Payout } = await import('@/lib/db/models')
    const wallet = '0xe52ecc0b8cb032a200301e0e5f79276af77201bd'

    await Payout.create({
      cycle: 16,
      rank: 1,
      wallet,
      amount: 3.03,
      amountTokens: 0.00162,
      drawdownPct: -3,
      lossUsd: 1.12,
      txHash: '0xabc',
      status: 'success',
    })

    const map = await loadLastWinCycleByWallet([wallet])
    expect(map.get(wallet.toLowerCase())).toBe(16)
  })
})
