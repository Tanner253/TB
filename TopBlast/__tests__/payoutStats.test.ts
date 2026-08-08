import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Payout, PayoutVolumeSwap } from '@/lib/db/models'
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
    await PayoutVolumeSwap.deleteMany({})
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
    expect(stats.successful_winner_payouts).toBe(3)
    expect(stats.average_payout_usd).toBeCloseTo(23 / 3)
    expect(stats.most_wins).toEqual({
      wallet: 'Winner1111111111111111111111111111111111111',
      win_count: 2,
    })
  })

  it('aggregates generated swap volume for tenant', async () => {
    await PayoutVolumeSwap.insertMany([
      {
        tenantSlug: 'pepe',
        tokenMint: TENANT.tokenMint,
        cycle: 1,
        swapSol: 0.05,
        swapUsd: 7.5,
        txHash: 'swap1',
      },
      {
        tenantSlug: 'pepe',
        tokenMint: TENANT.tokenMint,
        cycle: 2,
        swapSol: 0.03,
        swapUsd: 4.5,
        txHash: 'swap2',
      },
      {
        tenantSlug: 'other',
        tokenMint: 'OtherMint',
        cycle: 1,
        swapSol: 1,
        swapUsd: 100,
        txHash: 'swap3',
      },
    ])

    const stats = await runWithTenant(TENANT, () => fetchTenantPayoutStats())

    expect(stats.total_generated_volume_sol).toBeCloseTo(0.08)
    expect(stats.total_generated_volume_usd).toBeCloseTo(12)
  })

  it('sums multiple swap txs for the same cycle (retry buys)', async () => {
    await PayoutVolumeSwap.insertMany([
      {
        tenantSlug: 'pepe',
        tokenMint: TENANT.tokenMint,
        cycle: 9,
        swapSol: 0.068,
        swapUsd: 5.15,
        txHash: 'swap-cycle9-a',
      },
      {
        tenantSlug: 'pepe',
        tokenMint: TENANT.tokenMint,
        cycle: 9,
        swapSol: 0.032,
        swapUsd: 2.43,
        txHash: 'swap-cycle9-b',
      },
    ])

    const stats = await runWithTenant(TENANT, () => fetchTenantPayoutStats())

    expect(stats.total_generated_volume_sol).toBeCloseTo(0.1)
    expect(stats.total_generated_volume_usd).toBeCloseTo(7.58)
  })
})
