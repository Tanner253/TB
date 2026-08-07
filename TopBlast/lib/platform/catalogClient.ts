import type { PublicTenantSummary } from '@/lib/tenant/types'

export type CatalogSortId = 'featured' | 'newest' | 'oldest' | 'name-asc' | 'name-desc'

export const CATALOG_SORT_OPTIONS: { id: CatalogSortId; label: string }[] = [
  { id: 'featured', label: 'Featured first' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
]

export function tenantCatalogHref(tenant: PublicTenantSummary): string {
  if (tenant.catalogOnly) {
    return `/launch?slug=${encodeURIComponent(tenant.slug)}`
  }
  return `/${tenant.slug}`
}

export function filterCatalogTenants(
  tenants: PublicTenantSummary[],
  query: string
): PublicTenantSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return tenants

  return tenants.filter(t => {
    return (
      t.slug.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().includes(q)
    )
  })
}

export function sortCatalogTenants(
  tenants: PublicTenantSummary[],
  sortId: CatalogSortId
): PublicTenantSummary[] {
  const copy = [...tenants]

  switch (sortId) {
    case 'featured':
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      break
    case 'newest':
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      break
    case 'oldest':
      copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      break
    case 'name-asc':
      copy.sort((a, b) => a.symbol.localeCompare(b.symbol))
      break
    case 'name-desc':
      copy.sort((a, b) => b.symbol.localeCompare(a.symbol))
      break
  }

  return copy
}

/** Top N listings for homepage preview (platform first, then newest). */
export function pickTopCatalogTenants(
  tenants: PublicTenantSummary[],
  limit = 3
): PublicTenantSummary[] {
  return sortCatalogTenants(tenants, 'featured').slice(0, limit)
}

export function formatCatalogStatus(tenant: PublicTenantSummary): string {
  if (tenant.catalogOnly) return 'Setup'
  return tenant.status
}
