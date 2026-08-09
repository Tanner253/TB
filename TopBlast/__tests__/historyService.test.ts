import { MongoMemoryServer } from 'mongodb-memory-server'
import { Payout, Tenant } from '@/lib/db/models'
import { fetchAppPayoutHistory } from '@/lib/payout/historyService'
import { startMemoryMongo, stopMemoryMongo } from './helpers/memoryMongo'

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

const TEST_TENANT_SLUGS = ['pepe', 'bonk'] as const
const TEST_PAYOUT_TENANTS = ['pepe', 'bonk', '_legacy'] as const

describe('fetchAppPayoutHistory', () => {
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
    await Payout.deleteMany({ tenantSlug: { $in: [...TEST_PAYOUT_TENANTS] } })
    await Tenant.deleteMany({ slug: { $in: [...TEST_TENANT_SLUGS] } })
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
    expect(history.cycles[0].payouts[0].amount_unit).toBe('SOL')
    expect(history.cycles[0].payouts[1].amount_unit).toBe('SOL')
  })

  it('labels native token winner payouts with the session symbol', async () => {
    await Payout.insertMany([
      {
        tenantSlug: '_legacy',
        tokenMint: 'MintLegacy1111111111111111111111111111111111',
        tokenSymbol: 'TBLAST',
        cycle: 9,
        rank: 1,
        wallet: 'Winner1111111111111111111111111111111111111',
        amount: 7.32,
        amountTokens: 2_729_024.507339,
        drawdownPct: -41.55,
        lossUsd: 12,
        txHash: 'txhash1111111111111111111111111111111111111111',
        status: 'success',
      },
      {
        tenantSlug: '_legacy',
        tokenMint: 'MintLegacy1111111111111111111111111111111111',
        tokenSymbol: 'TBLAST',
        cycle: 9,
        rank: 0,
        wallet: 'Dev111111111111111111111111111111111111111',
        amount: 0.26,
        amountTokens: 0.003422,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: 'txhash2222222222222222222222222222222222222222',
        status: 'success',
      },
    ])

    const history = await fetchAppPayoutHistory(10)
    const cycle = history.cycles.find(c => c.cycle === 9)
    expect(cycle).toBeDefined()
    expect(cycle!.payouts.find(p => p.rank === 1)?.amount_unit).toBe('TBLAST')
    expect(cycle!.payouts.find(p => p.rank === 1)?.amount_eth).toBe('2,729,025')
    expect(cycle!.payouts.find(p => p.rank === 0)?.amount_unit).toBe('SOL')
    expect(cycle!.total_token_amount).toBe('2,729,025')
    expect(cycle!.total_token_symbol).toBe('TBLAST')
    expect(cycle!.total_usd_formatted).toBe('$7.58')
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
