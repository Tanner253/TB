import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import {
  deriveSessionDisplayState,
  type SessionDisplayState,
} from '@/lib/session/displayState'

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

/** Shared session phase for catalog cards — matches leaderboard displayState. */
export function deriveCatalogSessionDisplay(tenant: PublicTenantSummary): SessionDisplayState {
  return deriveSessionDisplayState({
    timerStatus: tenant.payout_timer_status ?? 'waiting',
    secondsRemaining: tenant.payout_seconds_remaining ?? null,
    eligibleCount: tenant.payout_eligible_count ?? 0,
    rankedHolderCount: tenant.payout_ranked_count ?? 0,
    poolFundedForPayout: tenant.payout_pool_funded !== false,
  })
}

export function isCatalogPoolBelowMinimum(tenant: PublicTenantSummary): boolean {
  return deriveCatalogSessionDisplay(tenant).poolBelowMinimum
}

/** Same timer fields the leaderboard uses — no re-derivation. */
export function isCatalogTimerActive(tenant: PublicTenantSummary): boolean {
  return deriveCatalogSessionDisplay(tenant).effectiveTimerStatus === 'active'
}

/** Limbo badge: timer not running yet (matches leaderboard waiting states). */
export function isCatalogPayoutPaused(tenant: PublicTenantSummary): boolean {
  if (tenant.status !== 'active') return false
  const phase = deriveCatalogSessionDisplay(tenant).phase
  return phase !== 'countdown' && phase !== 'payout_due'
}

export function catalogPayoutTimerLabel(tenant: PublicTenantSummary): string {
  if (tenant.status !== 'active') return formatCatalogStatus(tenant)
  const display = deriveCatalogSessionDisplay(tenant)
  switch (display.phase) {
    case 'countdown':
      return display.effectiveSecondsRemaining != null && display.effectiveSecondsRemaining <= 0
        ? 'Payout due'
        : 'Payouts active'
    case 'payout_due':
      return 'Payout due'
    case 'timer_starting':
      return 'Timer starting'
    case 'waiting_for_topup':
      return 'Waiting for topup'
    case 'syncing':
      return 'Syncing'
    case 'limbo':
    default:
      return 'Waiting for volume'
  }
}

export function catalogCountdownSubtitle(tenant: PublicTenantSummary): string | null {
  if (tenant.status !== 'active') return null
  const display = deriveCatalogSessionDisplay(tenant)
  const eligible = tenant.payout_eligible_count ?? 0

  if (display.phase === 'countdown' || display.phase === 'payout_due') {
    return 'Next payout countdown'
  }
  if (display.phase === 'waiting_for_topup') {
    return eligible > 0
      ? `${eligible} eligible — send SOL to fund the pool`
      : 'Pool below minimum — top up to start cycles'
  }
  if (display.phase === 'timer_starting') {
    return `${eligible} eligible — timer starting`
  }
  if ((tenant.payout_ranked_count ?? 0) > 0) {
    return 'Timer starts when the first holder qualifies'
  }
  if (tenant.payoutIntervalMinutes) {
    return `Payouts every ${formatPayoutInterval(tenant.payoutIntervalMinutes)}`
  }
  return null
}

export function formatCatalogPot(tenant: PublicTenantSummary): string | null {
  if (tenant.pot_usd_formatted != null && tenant.pot_sol != null) {
    return `${tenant.pot_usd_formatted} · ${tenant.pot_sol.toFixed(4)} SOL`
  }
  return null
}

export function formatCatalogVolume(tenant: PublicTenantSummary): string | null {
  return tenant.total_distributed_usd_formatted ?? null
}

export function formatCatalogGeneratedVolume(tenant: PublicTenantSummary): string | null {
  if (
    tenant.total_generated_volume_usd_formatted != null &&
    tenant.total_generated_volume_sol_formatted != null
  ) {
    return `${tenant.total_generated_volume_usd_formatted} · ${tenant.total_generated_volume_sol_formatted}`
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
    return 'Live reward session'
  }
  return 'Conviction reward session'
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

/** Top N listings for homepage: platform token first, then highest pot sizes. */
export function pickTopCatalogTenants(
  tenants: PublicTenantSummary[],
  limit = 3
): PublicTenantSummary[] {
  if (limit <= 0 || tenants.length === 0) return []

  const platform =
    tenants.find(t => t.isPlatformToken) ??
    tenants.find(t => t.featured && t.isPlatformToken !== false) ??
    null

  const byPotDesc = (a: PublicTenantSummary, b: PublicTenantSummary) =>
    (b.pot_sol ?? 0) - (a.pot_sol ?? 0)

  const rest = tenants
    .filter(t => t.slug !== platform?.slug)
    .sort(byPotDesc)

  const picked: PublicTenantSummary[] = []
  if (platform) picked.push(platform)

  for (const tenant of rest) {
    if (picked.length >= limit) break
    picked.push(tenant)
  }

  return picked
}
