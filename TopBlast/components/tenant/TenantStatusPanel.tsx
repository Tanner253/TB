'use client'

import type { TenantDiagnostic, TenantDiagnostics } from '@/lib/tenant/diagnostics'
import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'

const ELIGIBILITY_DIAGNOSTIC_IDS = new Set([
  'all_in_profit',
  'upcoming_eligible',
  'ineligible_breakdown',
  'no_holders',
  'vwap_pending',
  'timer_waiting',
])

const severityStyles: Record<
  TenantDiagnostic['severity'],
  { border: string; bg: string; icon: string }
> = {
  success: {
    border: 'border-rh-green/30',
    bg: 'bg-rh-green/5',
    icon: '✓',
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    icon: 'ℹ',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    icon: '!',
  },
  error: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    icon: '✕',
  },
}

const overallStyles: Record<TenantDiagnostics['overall'], string> = {
  healthy: 'text-rh-green',
  attention: 'text-amber-400',
  blocked: 'text-red-400',
  initializing: 'text-blue-400',
}

interface TenantStatusPanelProps {
  diagnostics?: TenantDiagnostics | null
  compact?: boolean
  slug?: string
}

export function TenantStatusPanel({ diagnostics, compact = false, slug }: TenantStatusPanelProps) {
  if (!diagnostics?.items?.length) return null

  const showEligibility = diagnostics.items.some(i => ELIGIBILITY_DIAGNOSTIC_IDS.has(i.id))

  return (
    <div
      className={`rounded-xl border border-white/10 ${compact ? 'p-4' : 'p-6'} bg-black/40`}
      role="status"
      aria-live="polite"
    >
      <div className={`${compact ? 'mb-3' : 'mb-4'}`}>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Session status</p>
        <h2 className={`text-lg font-bold ${overallStyles[diagnostics.overall]}`}>
          {diagnostics.headline}
        </h2>
      </div>

      <ul className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
        {diagnostics.items.map(item => {
          const style = severityStyles[item.severity]
          return (
            <li
              key={item.id}
              className={`rounded-lg border ${style.border} ${style.bg} p-3`}
            >
              <div className="flex gap-2">
                <span className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold opacity-80">
                  {style.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-gray-400 mt-0.5">{item.message}</p>
                  {item.action ? (
                    <p className="text-rh-lime/90 mt-2 text-sm">
                      <span className="text-gray-500">What to do: </span>
                      {item.action}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {showEligibility ? (
        <div className={`${compact ? 'mt-4 pt-4' : 'mt-6 pt-6'} border-t border-white/10`}>
          <EligibilityRequirements slug={slug} variant="compact" />
        </div>
      ) : null}
    </div>
  )
}
