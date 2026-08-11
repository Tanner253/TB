import { Keypair } from '@solana/web3.js'
import { Holder, CurrentRankings } from '@/lib/db/models'
import { runWithTenant } from '@/lib/tenant/context'
import {
  persistWinnerAfterPayout,
  loadLastWinCycleByWallet,
} from '@/lib/payout/winnerPersistence'
import {
  clearMemoryCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from './helpers/memoryMongo'
import type { MongoMemoryServer } from 'mongodb-memory-server'

describe('winnerPersistence', () => {
  let mongoServer: MongoMemoryServer

  beforeAll(async () => {
    mongoServer = await startMemoryMongo()
  })

  afterAll(async () => {
    await stopMemoryMongo(mongoServer)
  })

  beforeEach(async () => {
    ;(global as any).mongoose = { conn: null, promise: null }
    await clearMemoryCollections()
  })

  it('persists winner cooldown and VWAP reset to Holder and rankings', async () => {
    const wallet = Keypair.generate().publicKey.toBase58()

    await CurrentRankings.create({
      key: 'current_rankings',
      tokenMint: 'So11111111111111111111111111111111111111112',
      rankings: [
        {
          wallet,
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

    await persistWinnerAfterPayout(wallet, 17, 0.000002625)

    const holder = await Holder.findOne({ wallet })
    expect(holder!.lastWinCycle).toBe(17)
    expect(holder!.vwap).toBe(0.000002625)
    expect(holder!.ineligibleReason).toBe('Winner cooldown')

    const rankings = await CurrentRankings.findOne({ key: 'current_rankings' })
    expect(rankings!.rankings[0].lastWinCycle).toBe(17)
    expect(rankings!.rankings[0].isEligible).toBe(false)
    expect(rankings!.eligibleCount).toBe(0)
  })

  it('updates legacy holder row instead of inserting duplicate wallet', async () => {
    const wallet = Keypair.generate().publicKey.toBase58()

    await Holder.create({
      wallet,
      tenantSlug: '_legacy',
      balance: 500_000,
      vwap: 0.000003,
    })

    await runWithTenant(
      {
        tenantSlug: 'uponly',
        tokenMint: 'mint',
        tokenSymbol: 'UP',
        tokenDecimals: 6,
        payoutWalletAddress: 'addr',
        payoutWalletPrivateKey: 'key',
      },
      () => persistWinnerAfterPayout(wallet, 1, 0.000002625)
    )

    const holders = await Holder.find({ wallet })
    expect(holders).toHaveLength(1)
    expect(holders[0].tenantSlug).toBe('uponly')
    expect(holders[0].lastWinCycle).toBe(1)
    expect(holders[0].ineligibleReason).toBe('Winner cooldown')
  })

  it('loads lastWinCycle from Holder collection', async () => {
    const wallet = Keypair.generate().publicKey.toBase58()
    await Holder.create({
      wallet,
      balance: 100,
      lastWinCycle: 5,
    })

    const map = await loadLastWinCycleByWallet([wallet])
    expect(map.get(wallet)).toBe(5)
  })

  it('falls back to successful Payout records when Holder is missing', async () => {
    const { Payout } = await import('@/lib/db/models')
    const wallet = Keypair.generate().publicKey.toBase58()

    await Payout.create({
      cycle: 16,
      rank: 1,
      wallet,
      amount: 3.03,
      amountTokens: 0.00162,
      drawdownPct: -3,
      lossUsd: 1.12,
      txHash: '5abc',
      status: 'success',
    })

    const map = await loadLastWinCycleByWallet([wallet])
    expect(map.get(wallet)).toBe(16)
  })
})
