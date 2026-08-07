import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  getPlatformTenantSlug,
  getPlatformTokenMint,
  getPlatformTokenSymbol,
  isPlatformTenantSlug,
} from './config'

export function decorateCatalogTenants(tenants: PublicTenantSummary[]): PublicTenantSummary[] {
  const platformSlug = getPlatformTenantSlug()
  const platformMint = getPlatformTokenMint()

  const decorated = tenants.map(t => ({
    ...t,
    featured: isPlatformTenantSlug(t.slug) || (!!platformMint && t.mint === platformMint),
    isPlatformToken: isPlatformTenantSlug(t.slug) || (!!platformMint && t.mint === platformMint),
  }))

  decorated.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const hasPlatformEntry = decorated.some(t => t.isPlatformToken)
  if (!hasPlatformEntry && platformMint) {
    decorated.unshift({
      slug: platformSlug,
      symbol: getPlatformTokenSymbol(),
      mint: platformMint,
      status: 'active',
      createdAt: new Date(0).toISOString(),
      payoutWalletAddress: '',
      featured: true,
      isPlatformToken: true,
      catalogOnly: true,
    })
  }

  return decorated
}
