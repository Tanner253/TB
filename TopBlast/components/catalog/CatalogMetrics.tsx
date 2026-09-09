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
  primaryClassName = 'text-ink',
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
      <p className="text-[0.65rem] uppercase tracking-wider text-ink-3 mb-0.5 truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${primaryClassName}`}>{primary}</p>
      {secondary ? (
        <p className="text-[0.65rem] text-ink-3 tabular-nums truncate">{secondary}</p>
      ) : (
        <p className="text-[0.65rem] text-ink-3 tabular-nums invisible" aria-hidden>
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

  if (layout === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {pot ? (
          <span className="text-ink-2">
            <span className="text-ink-3">Pot </span>
            <span className="text-ink font-medium tabular-nums">{pot}</span>
          </span>
        ) : null}
        {generated ? (
          <span className="text-ink-2">
            <span className="text-ink-3">Gen vol </span>
            <span className="text-sol-purple font-medium tabular-nums">{generated}</span>
          </span>
        ) : null}
        {volume ? (
          <span className="text-ink-2">
            <span className="text-ink-3">Paid out </span>
            <span className="text-sol-mint font-medium tabular-nums">{volume}</span>
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line">
      <MetricCell
        label="Pot"
        primary={tenant.pot_usd_formatted ?? '—'}
        secondary={tenant.pot_sol != null ? `${tenant.pot_sol.toFixed(4)} SOL` : null}
      />
      <MetricCell
        label="Gen volume"
        title="Lifetime SOL spent buying this token on-chart during payout cycles (Jupiter swaps before winner airdrops)"
        primary={tenant.total_generated_volume_usd_formatted ?? '$0'}
        secondary={tenant.total_generated_volume_sol_formatted ?? '0 SOL'}
        primaryClassName="text-sol-purple"
      />
      <MetricCell
        label="Paid out"
        title="Lifetime value distributed from payout history"
        primary={tenant.total_distributed_usd_formatted ?? '—'}
        primaryClassName="text-sol-mint"
      />
    </div>
  )
}
