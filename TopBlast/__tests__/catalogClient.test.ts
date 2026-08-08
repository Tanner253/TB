import {
  filterCatalogTenants,
  pickTopCatalogTenants,
  sortCatalogTenants,
  tenantCatalogHref,
} from '@/lib/platform/catalogClient'
import type { PublicTenantSummary } from '@/lib/tenant/types'

const sample: PublicTenantSummary[] = [
  {
    slug: 'alpha',
    symbol: 'ALPHA',
    mint: 'MintAlpha1111111111111111111111111111111',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    payoutWalletAddress: 'Pool1111111111111111111111111111111111',
    featured: false,
  },
  {
    slug: 'topblast',
    symbol: 'BLAST',
    mint: 'MintBlast1111111111111111111111111111111',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
    payoutWalletAddress: 'Pool2222222222222222222222222222222222',
    featured: true,
    isPlatformToken: true,
  },
  {
    slug: 'beta',
    symbol: 'BETA',
    mint: 'MintBeta2222222222222222222222222222222222',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
    payoutWalletAddress: 'Pool3333333333333333333333333333333333',
    featured: false,
  },
]

describe('formatCompactUsd', () => {
  const { formatCompactUsd, formatCompactSol } = require('@/lib/solana/price')

  it('uses K/M with one decimal for large gen volume', () => {
    expect(formatCompactUsd(1_500)).toBe('$1.5K')
    expect(formatCompactUsd(2_300_000)).toBe('$2.3M')
    expect(formatCompactUsd(842)).toBe('$842')
  })

  it('formats compact SOL for catalog gen volume', () => {
    expect(formatCompactSol(1_200)).toBe('1.2K SOL')
    expect(formatCompactSol(0.0523)).toBe('0.05 SOL')
    expect(formatCompactSol(0)).toBe('0 SOL')
  })
})

describe('catalogClient', () => {
  it('builds tenant leaderboard href', () => {
    expect(tenantCatalogHref(sample[0])).toBe('/alpha/leaderboard')
  })

  it('filters by slug, symbol, and mint', () => {
    expect(filterCatalogTenants(sample, 'blast')).toHaveLength(1)
    expect(filterCatalogTenants(sample, 'mintbeta')).toHaveLength(1)
    expect(filterCatalogTenants(sample, 'alpha')).toHaveLength(1)
  })

  it('sorts featured first by default', () => {
    const sorted = sortCatalogTenants(sample, 'featured')
    expect(sorted[0].slug).toBe('topblast')
  })

  it('picks top three for homepage', () => {
    const top = pickTopCatalogTenants(sample, 3)
    expect(top).toHaveLength(3)
    expect(top[0].slug).toBe('topblast')
  })
})
