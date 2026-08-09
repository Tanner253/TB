import { decorateCatalogTenants } from '@/lib/platform/catalog'
import { testSolanaSecretKey } from './helpers/testKeypair'
import {
  DEV_FEE_BUYBACK_SHARE_PCT,
  DEV_FEE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
} from '@/lib/platform/flywheel'

describe('platform flywheel', () => {
  it('allocates 50% of dev fees to buyback and 50% to ops (6% of pool each)', () => {
    expect(DEV_FEE_PCT).toBe(12)
    expect(DEV_FEE_BUYBACK_SHARE_PCT).toBe(50)
    expect(PLATFORM_BUYBACK_PCT_OF_POOL).toBe(6)
    expect(PLATFORM_OPS_PCT_OF_POOL).toBe(6)
  })
})

describe('platform catalog', () => {
  const originalSlug = process.env.PLATFORM_TENANT_SLUG
  const originalMint = process.env.PLATFORM_TOKEN_MINT
  const originalTokenMint = process.env.TOKEN_MINT_ADDRESS
  const originalKey = process.env.PAYOUT_WALLET_PRIVATE_KEY

  afterEach(() => {
    if (originalSlug === undefined) delete process.env.PLATFORM_TENANT_SLUG
    else process.env.PLATFORM_TENANT_SLUG = originalSlug
    if (originalMint === undefined) delete process.env.PLATFORM_TOKEN_MINT
    else process.env.PLATFORM_TOKEN_MINT = originalMint
    if (originalTokenMint === undefined) delete process.env.TOKEN_MINT_ADDRESS
    else process.env.TOKEN_MINT_ADDRESS = originalTokenMint
    if (originalKey === undefined) delete process.env.PAYOUT_WALLET_PRIVATE_KEY
    else process.env.PAYOUT_WALLET_PRIVATE_KEY = originalKey
  })

  it('uses env platform entry instead of mongo when mint is configured', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.TOKEN_SYMBOL = 'TBLAST'

    const sorted = decorateCatalogTenants([
      {
        slug: 'other-coin',
        symbol: 'OTHER',
        mint: 'MintOther1111111111111111111111111111111',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        payoutWalletAddress: 'PoolOther1111111111111111111111111111111',
      },
      {
        slug: 'topblast',
        symbol: 'OLD',
        mint: 'MintBlast1111111111111111111111111111111',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        payoutWalletAddress: 'PoolBlast1111111111111111111111111111111',
      },
    ])

    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].symbol).toBe('TBLAST')
    expect(sorted[0].mint).toBe('So11111111111111111111111111111111111111112')
    expect(sorted[0].runsFromEnv).toBe(true)
    expect(sorted[0].status).toBe('active')
    expect(sorted.filter(t => t.slug === 'topblast')).toHaveLength(1)
  })

  it('shows active env platform when only mint is configured (no setup state)', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.PLATFORM_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.PLATFORM_TOKEN_SYMBOL = 'BLAST'
    delete process.env.PAYOUT_WALLET_PRIVATE_KEY

    const sorted = decorateCatalogTenants([])
    expect(sorted).toHaveLength(1)
    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].status).toBe('active')
    expect(sorted[0].runsFromEnv).toBe(true)
    expect(sorted[0].catalogOnly).toBeUndefined()
  })

  it('includes payout wallet when env key is configured', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    delete process.env.PLATFORM_TOKEN_SYMBOL
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.TOKEN_SYMBOL = 'TBLAST'
    process.env.PAYOUT_WALLET_PRIVATE_KEY = testSolanaSecretKey()
    process.env.PAYOUT_INTERVAL_MINUTES = '30'

    const sorted = decorateCatalogTenants([])
    expect(sorted[0].symbol).toBe('TBLAST')
    expect(sorted[0].payoutIntervalMinutes).toBe(30)
    expect(sorted[0].payoutWalletAddress.length).toBeGreaterThan(30)
  })

  it('falls back to mongo platform row when env mint is not set', () => {
    delete process.env.TOKEN_MINT_ADDRESS
    delete process.env.PLATFORM_TOKEN_MINT
    process.env.PLATFORM_TENANT_SLUG = 'topblast'

    const sorted = decorateCatalogTenants([
      {
        slug: 'topblast',
        symbol: 'BLAST',
        mint: 'MintBlast1111111111111111111111111111111',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        payoutWalletAddress: 'PoolBlast1111111111111111111111111111111',
      },
    ])

    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].isPlatformToken).toBe(true)
  })
})
