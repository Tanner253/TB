import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Payout, Tenant } from '@/lib/db/models'
import { fetchAppPayoutHistory } from '@/lib/payout/historyService'

jest.mock('@/lib/config', () => ({
  config: {
    tokenSymbol: 'TB',
  },
}))

jest.mock('@/lib/platform/config', () => ({
  getPlatformTenantSlug: () => 'topblast',
  getPlatformTokenMint: () => 'MintLegacy1111111111111111111111111111111',
  getPlatformTokenSymbol: () => 'TopBlast',
  isPlatformTenantSlug: (slug: string) => slug === 'topblast' || slug === '_legacy',
}))

describe('fetchAppPayoutHistory', () => {
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
    await Tenant.deleteMany({})
  })

  it('includes token mint and explorer url on each cycle', async () => {
    await Tenant.create({
      slug: 'pepe',
      mint: 'PepeMint1111111111111111111111111111111111',
      symbol: 'PEPE',
      decimals: 6,
      encryptedPayoutKey: 'enc',
      payoutWalletAddress: 'Pay1111111111111111111111111111111111111',
      devWalletAddress: '',
      status: 'active',
    })

    await Payout.insertMany([
      {
        tenantSlug: 'pepe',
        tokenMint: 'PepeMint1111111111111111111111111111111111',
        tokenSymbol: 'PEPE',
        cycle: 2,
        rank: 1,
        wallet: 'Winner1111111111111111111111111111111111111',
        amount: 12.5,
        amountTokens: 0.05,
        drawdownPct: -40,
        lossUsd: 25,
        txHash: 'txhash1111111111111111111111111111111111111111',
        status: 'success',
      },
      {
        tenantSlug: 'pepe',
        tokenMint: 'PepeMint1111111111111111111111111111111111',
        tokenSymbol: 'PEPE',
        cycle: 2,
        rank: 0,
        wallet: 'Dev111111111111111111111111111111111111111',
        amount: 2,
        amountTokens: 0.01,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: 'txhash2222222222222222222222222222222222222222',
        status: 'success',
      },
    ])

    const history = await fetchAppPayoutHistory(10)
    expect(history.cycles).toHaveLength(1)
    expect(history.cycles[0].token_symbol).toBe('PEPE')
    expect(history.cycles[0].token_mint).toBe('PepeMint1111111111111111111111111111111111')
    expect(history.cycles[0].token_mint_explorer_url).toContain('PepeMint1111111111111111111111111111111111')
    expect(history.cycles[0].session_slug).toBe('pepe')
  })

  it('falls back to tenant mint for legacy payouts without tokenMint', async () => {
    await Tenant.create({
      slug: 'bonk',
      mint: 'BonkMint1111111111111111111111111111111111',
      symbol: 'BONK',
      decimals: 6,
      encryptedPayoutKey: 'enc',
      payoutWalletAddress: 'Pay1111111111111111111111111111111111111',
      devWalletAddress: '',
      status: 'active',
    })

    await Payout.create({
      tenantSlug: 'bonk',
      cycle: 1,
      rank: 1,
      wallet: 'Winner1111111111111111111111111111111111111',
      amount: 5,
      amountTokens: 0.02,
      drawdownPct: -30,
      lossUsd: 10,
      status: 'success',
    })

    const history = await fetchAppPayoutHistory(10)
    expect(history.cycles[0].token_mint).toBe('BonkMint1111111111111111111111111111111111')
    expect(history.cycles[0].token_symbol).toBe('BONK')
  })
})
