import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'

export type CatalogSortId = 'featured' | 'newest' | 'oldest' | 'name-asc' | 'name-desc'

export const CATALOG_SORT_OPTIONS: { id: CatalogSortId; label: string }[] = [
  { id: 'featured', label: 'Featured first' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name-asc', label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
]

/** Every listing card opens the live leaderboard for that token. */
export function tenantCatalogHref(tenant: PublicTenantSummary): string {
  return `/${tenant.slug}/leaderboard`
}

export function formatCatalogStatus(tenant: PublicTenantSummary): string {
  return tenant.status === 'active' ? 'live' : tenant.status
}

/** Live session with payout timer paused — waiting for eligible underwater holders. */
export function isCatalogPayoutPaused(tenant: PublicTenantSummary): boolean {
  return tenant.status === 'active' && tenant.payout_timer_status === 'waiting'
}

export function catalogPayoutTimerLabel(tenant: PublicTenantSummary): string {
  if (tenant.status !== 'active') return formatCatalogStatus(tenant)
  if (tenant.payout_timer_status === 'active') return 'Payouts active'
  return 'Waiting for volume'
}

export function formatCatalogPot(tenant: PublicTenantSummary): string | null {
  if (tenant.pot_usd_formatted != null && tenant.pot_sol != null) {
    return `${tenant.pot_usd_formatted} · ${tenant.pot_sol.toFixed(4)} SOL`
  }
  return null
}

export function formatCatalogVolume(tenant: PublicTenantSummary): string | null {
  if (tenant.total_distributed_usd_formatted != null && tenant.total_distributed_sol != null) {
    return `${tenant.total_distributed_usd_formatted} · ${tenant.total_distributed_sol.toFixed(4)} SOL`
  }
  return null
}

export function catalogCardSubtitle(tenant: PublicTenantSummary): string {
  if (tenant.payoutIntervalMinutes) {
    return `Payouts every ${formatPayoutInterval(tenant.payoutIntervalMinutes)}`
  }
  if (tenant.payoutWalletAddress) {
    return `Pool · ${tenant.payoutWalletAddress.slice(0, 6)}…${tenant.payoutWalletAddress.slice(-4)}`
  }
  if (tenant.runsFromEnv) {
    return 'Live loss-mining session'
  }
  return 'Loss-mining session'
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
