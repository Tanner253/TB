import 'server-only'

import { listActiveTenantSlugs, runForTenantSlug } from '@/lib/tenant/service'
import { runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import { isPumpAutoCollectEnabled } from '@/lib/pump/config'
import { collectPumpCreatorFeesForActiveTenant } from '@/lib/pump/maybeCollectOnPoll'

/** Min gap between catalog-driven multi-tenant Pump collects (matches catalog cycle throttle). */
const CATALOG_COLLECT_THROTTLE_MS = 30 * 1000

declare global {
  // eslint-disable-next-line no-var
  var _lastCatalogPumpCollectAt: number | undefined
}

/**
 * Attempt Pump creator fee collection for every active tenant.
 * Called from GET /api/tenants — home/catalog traffic, no cron.
 */
export async function maybeCollectPumpCreatorFeesFromCatalog(): Promise<void> {
  if (!isPumpAutoCollectEnabled()) return

  const now = Date.now()
  if (
    global._lastCatalogPumpCollectAt != null &&
    now - global._lastCatalogPumpCollectAt < CATALOG_COLLECT_THROTTLE_MS
  ) {
    return
  }
  global._lastCatalogPumpCollectAt = now

  const slugs = await listActiveTenantSlugs()
  if (slugs.length === 0) return

  await runAuthorizedPayout(async () => {
    for (const slug of slugs) {
      try {
        await runForTenantSlug(slug, () => collectPumpCreatorFeesForActiveTenant())
      } catch (error) {
        console.warn(`[PumpCollect] Catalog sweep failed for ${slug}:`, error)
      }
    }
  })
}

/** Test helper */
export function resetCatalogPumpCollectThrottle(): void {
  global._lastCatalogPumpCollectAt = undefined
}
