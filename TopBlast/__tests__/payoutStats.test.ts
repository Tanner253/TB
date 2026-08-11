import { MongoMemoryServer } from 'mongodb-memory-server'
import { Payout, PayoutVolumeSwap } from '@/lib/db/models'
import { fetchTenantPayoutStats } from '@/lib/payout/payoutStats'
import { runWithTenant } from '@/lib/tenant/context'
import type { TenantRuntimeConfig } from '@/lib/tenant/types'
import { clearMemoryCollections, startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo'

jest.mock('@/lib/solana/price', () => ({
  getSolPrice: jest.fn(async () => 50),
}))

const TENANT: TenantRuntimeConfig = {
  tenantSlug: 'pepe',
  tokenMint: 'PepeMint1111111111111111111111111111111111',
  tokenSymbol: 'PEPE',
  tokenDecimals: 6,
  payoutWalletPrivateKey: 'test',
  devWalletAddress: '',
  payoutIntervalMinutes: 15,
  minTokenHolding: 100000,
  minLossThresholdPct: 10,
  minPoolSol: 0.001,
  minPoolEth: 0.001,
  executePayouts: false,
}

describe('fetchTenantPayoutStats', () => {
  let mongo: MongoMemoryServer

  beforeAll(async () => {
    mongo = await startMemoryMongo()
    process.env.MONGODB_URI = mongo.getUri()
  })

  afterAll(async () => {
    delete process.env.MONGODB_URI
    await stopMemoryMongo(mongo)
  })

  beforeEach(async () => {
    await clearMemoryCollections()
  })

  it('aggregates cycles, distributed totals, and most wins for tenant', async () => {
    await Payout.insertMany([
      {
        tenantSlug: 'pepe',
        cycle: 1,
        rank: 1,
        wallet: 'Winner1111111111111111111111111111111111111',
        amount: 10,
        amountTokens: 0.04,
        drawdownPct: -50,
        lossUsd: 20,
        status: 'success',
      },
      {
        tenantSlug: 'pepe',
        cycle: 1,
        rank: 2,
        wallet: 'Winner2222222222222222222222222222222222222',
        amount: 5,
        amountTokens: 0.02,
        drawdownPct: -40,
        lossUsd: 12,
        status: 'success',
      },
      {
        tenantSlug: 'pepe',
        cycle: 2,
        rank: 1,
        wallet: 'Winner1111111111111111111111111111111111111',
        amount: 8,
        amountTokens: 0.03,
        drawdownPct: -45,
        lossUsd: 15,
        status: 'success',
      },
      {
        tenantSlug: 'other',
        cycle: 1,
        rank: 1,
        wallet: 'Other11111111111111111111111111111111111111',
        amount: 99,
        amountTokens: 1,
        drawdownPct: -30,
        lossUsd: 10,
        status: 'success',
      },
    ])

    const stats = await runWithTenant(TENANT, () => fetchTenantPayoutStats())

    expect(stats.total_cycles).toBe(2)
    expect(stats.total_distributed_usd).toBe(23)
    // Gen volume mirrors paid-out USD; SOL = USD / solPrice
    expect(stats.total_generated_volume_usd).toBe(23)
    expect(stats.total_generated_volume_sol).toBeCloseTo(23 / 50)
    expect(stats.total_distributed_sol).toBeCloseTo(0.09)
    expect(stats.successful_winner_payouts).toBe(3)
    expect(stats.average_payout_usd).toBeCloseTo(23 / 3)
    expect(stats.most_wins).toEqual({
      wallet: 'Winner1111111111111111111111111111111111111',
      win_count: 2,
    })
  })

  it('keeps gen volume equal to paid out even when swap ledger differs', async () => {
    await Payout.insertMany([
      {
        tenantSlug: 'pepe',
        cycle: 1,
        rank: 1,
        wallet: 'Winner1111111111111111111111111111111111111',
        amount: 18.89,
        amountTokens: 2_729_024.664,
        drawdownPct: -50,
        lossUsd: 20,
        status: 'success',
      },
      {
        tenantSlug: 'pepe',
        cycle: 1,
        rank: 0,
        wallet: 'Dev111111111111111111111111111111111111111',
        amount: 1.5,
        amountTokens: 0.03,
        drawdownPct: 0,
        lossUsd: 0,
        status: 'success',
      },
    ])
    await PayoutVolumeSwap.create({
      tenantSlug: 'pepe',
      tokenMint: 'PepeMint1111111111111111111111111111111111',
      tokenSymbol: 'PEPE',
      cycle: 1,
      swapSol: 0.4,
      swapUsd: 20,
      outputTokensHuman: 2_729_024.664,
      txHash: 'SwapTx111111111111111111111111111111111111111111111111111111111',
    })

    const stats = await runWithTenant(TENANT, () => fetchTenantPayoutStats())

    expect(stats.total_distributed_usd).toBeCloseTo(20.39)
    expect(stats.total_distributed_sol).toBeCloseTo(0.03)
    expect(stats.total_generated_volume_usd).toBeCloseTo(20.39)
    expect(stats.total_generated_volume_sol).toBeCloseTo(20.39 / 50)
  })
})