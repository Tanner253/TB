import type { PublicTenantSummary } from '@/lib/tenant/types'
import { isCatalogPayoutPaused, catalogPayoutTimerLabel } from '@/lib/platform/catalogClient'

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

interface CatalogTimerBadgeProps {
  tenant: PublicTenantSummary
  compact?: boolean
}

export function CatalogTimerBadge({ tenant, compact = false }: CatalogTimerBadgeProps) {
  if (!isCatalogPayoutPaused(tenant)) return null

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-200/90 ${
        compact
          ? 'text-[0.6rem] uppercase tracking-wider px-1.5 py-0.5'
          : 'text-[0.65rem] uppercase tracking-wider px-2 py-1'
      }`}
      title="Payout timer paused until an eligible underwater holder qualifies"
    >
      <PauseIcon className="shrink-0" />
      <span className="truncate">{catalogPayoutTimerLabel(tenant)}</span>
    </span>
  )
}
