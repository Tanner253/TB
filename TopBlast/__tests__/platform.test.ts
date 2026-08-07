import { decorateCatalogTenants } from '@/lib/platform/catalog'
import {
  DEV_FEE_BUYBACK_SHARE_PCT,
  DEV_FEE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
} from '@/lib/platform/flywheel'

describe('platform flywheel', () => {
  it('allocates 50% of dev fees to buyback (6% of pool)', () => {
    expect(DEV_FEE_PCT).toBe(12)
    expect(DEV_FEE_BUYBACK_SHARE_PCT).toBe(50)
    expect(PLATFORM_BUYBACK_PCT_OF_POOL).toBe(6)
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

  it('injects catalog-only platform entry when mint configured but tenant missing', () => {
    process.env.PLATFORM_TENANT_SLUG = 'topblast'
    process.env.PLATFORM_TOKEN_MINT = 'So11111111111111111111111111111111111111112'
    process.env.PLATFORM_TOKEN_SYMBOL = 'BLAST'

    const sorted = decorateCatalogTenants([])
    expect(sorted).toHaveLength(1)
    expect(sorted[0].slug).toBe('topblast')
    expect(sorted[0].catalogOnly).toBe(true)
    expect(sorted[0].isPlatformToken).toBe(true)
  })
})
