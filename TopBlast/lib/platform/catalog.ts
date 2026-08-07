import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  getPlatformTenantSlug,
  getPlatformTokenMint,
  isPlatformTenantSlug,
} from './config'
import {
  buildPlatformEnvCatalogEntry,
  isPlatformMintConfigured,
} from './envPlatform'

function isPlatformListing(t: PublicTenantSummary, platformMint: string): boolean {
  return (
    isPlatformTenantSlug(t.slug) ||
    (!!platformMint && t.mint === platformMint) ||
    !!t.isPlatformToken
  )
}

/**
 * Catalog listings: Mongo SaaS tenants + env-driven platform token.
 * Platform token never shows "setup" — mint in env = live leaderboard card.
 */
export function decorateCatalogTenants(tenants: PublicTenantSummary[]): PublicTenantSummary[] {
  const platformSlug = getPlatformTenantSlug()
  const platformMint = getPlatformTokenMint()

  const community = tenants.filter(t => !isPlatformListing(t, platformMint))

  const decorated = community.map(t => ({
    ...t,
    featured: false,
    isPlatformToken: false,
  }))

  if (isPlatformMintConfigured()) {
    decorated.unshift(buildPlatformEnvCatalogEntry())
  } else {
    // No env mint — keep a Mongo row for platform slug if one exists (rare)
    const mongoPlatform = tenants.find(t => t.slug === platformSlug)
    if (mongoPlatform) {
      decorated.unshift({
        ...mongoPlatform,
        featured: true,
        isPlatformToken: true,
      })
    }
  }

  decorated.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return decorated
}
