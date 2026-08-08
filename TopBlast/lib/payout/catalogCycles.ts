import 'server-only'

import { listActiveTenantSlugs, runForTenantSlug } from '@/lib/tenant/service'
import { runAutomatedTenantCycle } from '@/lib/payout/tenantCycle'
import { runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'

/** Min gap between catalog-driven multi-tenant cycle runs (serverless-safe). */
const CATALOG_CYCLE_THROTTLE_MS = 30 * 1000

declare global {
  // eslint-disable-next-line no-var
  var _lastCatalogTenantCyclesAt: number | undefined
}

/**
 * Advance payout timers / execute due cycles for all active tenants.
 * Called from GET /api/tenants so catalog/home traffic keeps sessions alive without opening each LB.
 */
export async function maybeRunTenantCyclesFromCatalog(): Promise<void> {
  const now = Date.now()
  if (
    global._lastCatalogTenantCyclesAt != null &&
    now - global._lastCatalogTenantCyclesAt < CATALOG_CYCLE_THROTTLE_MS
  ) {
    return
  }
  global._lastCatalogTenantCyclesAt = now

  const slugs = await listActiveTenantSlugs()
  if (slugs.length === 0) return

  await runAuthorizedPayout(async () => {
    for (const slug of slugs) {
      try {
        await runForTenantSlug(slug, () => runAutomatedTenantCycle())
      } catch (error) {
        console.error(`[Catalog] Tenant cycle failed for ${slug}:`, error)
      }
    }
  })
}
