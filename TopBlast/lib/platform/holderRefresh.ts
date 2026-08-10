/** Throttle live holder snapshots (Birdeye) — separate from Helius DAS cache. */

import { tenantCacheKey } from '@/lib/tenant/tenantCacheKey'

declare global {
  // eslint-disable-next-line no-var
  var _holderRefreshLastAt: Map<string, number> | undefined
}

function lastRefreshMap() {
  if (!global._holderRefreshLastAt) global._holderRefreshLastAt = new Map()
  return global._holderRefreshLastAt
}

function parseMs(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Default 60s — one Birdeye batch per tenant per minute in worker mode. */
export function holderRefreshIntervalMs(): number {
  return parseMs(process.env.HOLDER_REFRESH_INTERVAL_MS, 60 * 1000)
}

export function holderRefreshKey(tenantKey: string): string {
  return tenantCacheKey(`holderRefresh:${tenantKey}`)
}

export function shouldSkipHolderRefresh(
  tenantKey: string,
  force = false,
  intervalMs?: number
): boolean {
  if (force) return false
  const interval = intervalMs ?? holderRefreshIntervalMs()
  const last = lastRefreshMap().get(holderRefreshKey(tenantKey)) ?? 0
  return Date.now() - last < interval
}

export function markHolderRefresh(tenantKey: string): void {
  lastRefreshMap().set(holderRefreshKey(tenantKey), Date.now())
}

export function resetHolderRefreshThrottle(): void {
  lastRefreshMap().clear()
}
