import { decorateCatalogTenants } from '@/lib/platform/catalog'
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

  afterEach(() => {
    if (originalSlug === undefined) delete process.env.PLATFORM_TENANT_SLUG
    else process.env.PLATFORM_TENANT_SLUG = originalSlug
    if (originalMint === undefined) delete process.env.PLATFORM_TOKEN_MINT
    else process.env.PLATFORM_TOKEN_MINT = originalMint
  })

  it('pins platform tenant first and marks featured', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
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
        symbol: 'BLAST',
        mint: 'MintBlast1111111111111111111111111111111',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        payoutWalletAddress: 'PoolBlast1111111111111111111111111111111',
      },
    ])

    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].featured).toBe(true)
    expect(sorted[0].isPlatformToken).toBe(true)
  })

  it('injects catalog-only platform entry when mint configured but payout env missing', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.PLATFORM_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.PLATFORM_TOKEN_SYMBOL = 'BLAST'
    delete process.env.PAYOUT_WALLET_PRIVATE_KEY

    const sorted = decorateCatalogTenants([])
    expect(sorted).toHaveLength(1)
    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].catalogOnly).toBe(true)
    expect(sorted[0].runsFromEnv).toBeFalsy()
    expect(sorted[0].isPlatformToken).toBe(true)
  })

  it('injects live env platform entry when mint and payout key are configured', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    delete process.env.PLATFORM_TOKEN_SYMBOL
    process.env.TOKEN_MINT_ADDRESS = 'So11111111111111111111111111111111111111112'
    process.env.TOKEN_SYMBOL = 'TBLAST'
    process.env.PAYOUT_WALLET_PRIVATE_KEY = 'CHhp3YcNXkAzLcEy33P3X2CgnhDEGcRCyyQDwtk8rjhKtmAypiD3Qd28Ub5gXkNjmxG1F3jUWXyXCqj5XbbKv3B'
    process.env.PAYOUT_INTERVAL_MINUTES = '30'

    const sorted = decorateCatalogTenants([])
    expect(sorted).toHaveLength(1)
    expect(sorted[0].catalogOnly).toBe(false)
    expect(sorted[0].runsFromEnv).toBe(true)
    expect(sorted[0].status).toBe('active')
    expect(sorted[0].symbol).toBe('TBLAST')
    expect(sorted[0].payoutIntervalMinutes).toBe(30)
    expect(sorted[0].payoutWalletAddress.length).toBeGreaterThan(30)
  })
})
