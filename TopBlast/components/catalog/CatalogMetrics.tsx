import type { PublicTenantSummary } from '@/lib/tenant/types'
import {
  formatCatalogPot,
  formatCatalogVolume,
  formatCatalogGeneratedVolume,
} from '@/lib/platform/catalogClient'

interface CatalogMetricsProps {
  tenant: PublicTenantSummary
  layout?: 'grid' | 'inline'
}

function MetricCell({
  label,
  primary,
  secondary,
  primaryClassName = 'text-white',
  title,
}: {
  label: string
  primary: string
  secondary?: string | null
  primaryClassName?: string
  title?: string
}) {
  return (
    <div className="min-w-0" title={title}>
      <p className="text-[0.65rem] uppercase tracking-wider text-gray-500 mb-0.5 truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${primaryClassName}`}>{primary}</p>
      {secondary ? (
        <p className="text-[0.65rem] text-gray-500 tabular-nums truncate">{secondary}</p>
      ) : (
        <p className="text-[0.65rem] text-gray-600 tabular-nums invisible" aria-hidden>
          0.0000 SOL
        </p>
      )}
    </div>
  )
}

export function CatalogMetrics({ tenant, layout = 'grid' }: CatalogMetricsProps) {
  const pot = formatCatalogPot(tenant)
  const volume = formatCatalogVolume(tenant)
  const generated = formatCatalogGeneratedVolume(tenant)

  if (!pot && !volume && !generated) return null

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {pot ? (
          <span className="text-gray-400">
            <span className="text-gray-500">Pot </span>
            <span className="text-white font-medium tabular-nums">{pot}</span>
          </span>
        ) : null}
        {generated ? (
          <span className="text-gray-400">
            <span className="text-gray-500">Gen vol </span>
            <span className="text-purple-300/90 font-medium tabular-nums">{generated}</span>
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
    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
      <MetricCell
        label="Pot"
        primary={tenant.pot_usd_formatted ?? '—'}
        secondary={tenant.pot_sol != null ? `${tenant.pot_sol.toFixed(4)} SOL` : null}
      />
      <MetricCell
        label="Gen volume"
        title="Lifetime SOL spent buying this token on-chart during payout cycles (Jupiter swaps before winner airdrops)"
        primary={tenant.total_generated_volume_usd_formatted ?? '$0.00'}
        secondary={
          tenant.total_generated_volume_sol != null
            ? `${tenant.total_generated_volume_sol.toFixed(4)} SOL`
            : '0.0000 SOL'
        }
        primaryClassName="text-purple-300/90"
      />
      <MetricCell
        label="Paid out"
        primary={tenant.total_distributed_usd_formatted ?? '—'}
        secondary={
          tenant.total_distributed_sol != null
            ? `${tenant.total_distributed_sol.toFixed(4)} SOL`
            : null
        }
        primaryClassName="text-sol-mint/90"
      />
    </div>
  )
}
