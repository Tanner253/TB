import 'server-only'

import { getTenantSlug } from './context'

/** Prefix in-memory cache keys with active tenant to prevent serverless bleed. */
export function tenantCacheKey(...parts: string[]): string {
  return [getTenantSlug(), ...parts].join(':')
}

/** Remove cache entries for one tenant (defaults to active tenant). */
export function clearTenantCacheEntries(
  map: Map<string, unknown> | undefined,
  tenantSlug?: string
): void {
  if (!map) return
  const prefix = `${tenantSlug ?? getTenantSlug()}:`
  for (const key of [...map.keys()]) {
    if (key.startsWith(prefix)) {
      map.delete(key)
    }
  }
}
