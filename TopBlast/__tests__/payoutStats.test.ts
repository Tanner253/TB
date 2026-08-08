import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Payout } from '@/lib/db/models'
import { fetchTenantPayoutStats } from '@/lib/payout/payoutStats'
import { runWithTenant } from '@/lib/tenant/context'
import type { TenantRuntimeConfig } from '@/lib/tenant/types'

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
    mongo = await MongoMemoryServer.create()
    await mongoose.connect(mongo.getUri())
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongo.stop()
  })

  beforeEach(async () => {
    await Payout.deleteMany({})
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
    expect(stats.total_generated_volume_usd).toBe(23)
    expect(stats.total_distributed_sol).toBeCloseTo(0.09)
    expect(stats.total_generated_volume_sol).toBeCloseTo(0.09)
    expect(stats.successful_winner_payouts).toBe(3)
    expect(stats.average_payout_usd).toBeCloseTo(23 / 3)
    expect(stats.most_wins).toEqual({
      wallet: 'Winner1111111111111111111111111111111111111',
      win_count: 2,
    })
  })

  it('uses payout history for distributed totals even when swap ledger is lower', async () => {
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
    ])

    const stats = await runWithTenant(TENANT, () => fetchTenantPayoutStats())

    expect(stats.total_distributed_usd).toBeCloseTo(18.89)
    expect(stats.total_generated_volume_usd).toBeCloseTo(18.89)
    expect(stats.total_distributed_sol).toBe(0)
    expect(stats.total_generated_volume_sol).toBe(0)
  })
})
