import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatCatalogPot, formatCatalogVolume } from '@/lib/platform/catalogClient'

interface CatalogMetricsProps {
  tenant: PublicTenantSummary
  layout?: 'grid' | 'inline'
}

export function CatalogMetrics({ tenant, layout = 'grid' }: CatalogMetricsProps) {
  const pot = formatCatalogPot(tenant)
  const volume = formatCatalogVolume(tenant)

  if (!pot && !volume) return null

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {pot ? (
          <span className="text-gray-400">
            <span className="text-gray-500">Pot </span>
            <span className="text-white font-medium tabular-nums">{pot}</span>
          </span>
        ) : null}
        {volume ? (
          <span className="text-gray-400">
            <span className="text-gray-500">Paid out </span>
            <span className="text-sol-mint/90 font-medium tabular-nums">{volume}</span>
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
      <div className="min-w-0">
        <p className="text-[0.65rem] uppercase tracking-wider text-gray-500 mb-0.5">Pot</p>
        <p className="text-sm font-semibold text-white tabular-nums truncate">
          {tenant.pot_usd_formatted ?? '—'}
        </p>
        {tenant.pot_sol != null ? (
          <p className="text-[0.65rem] text-gray-500 tabular-nums">{tenant.pot_sol.toFixed(4)} SOL</p>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] uppercase tracking-wider text-gray-500 mb-0.5">Paid out</p>
        <p className="text-sm font-semibold text-sol-mint/90 tabular-nums truncate">
          {tenant.total_distributed_usd_formatted ?? '—'}
        </p>
        {tenant.total_distributed_sol != null ? (
          <p className="text-[0.65rem] text-gray-500 tabular-nums">
            {tenant.total_distributed_sol.toFixed(4)} SOL
          </p>
        ) : null}
      </div>
    </div>
  )
}
