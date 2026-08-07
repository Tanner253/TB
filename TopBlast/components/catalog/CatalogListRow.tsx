'use client'

import Link from 'next/link'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import { formatCatalogStatus, tenantCatalogHref, catalogCardSubtitle } from '@/lib/platform/catalogClient'

function payoutLabel(tenant: PublicTenantSummary): string {
  if (tenant.payoutIntervalMinutes) return formatPayoutInterval(tenant.payoutIntervalMinutes)
  return catalogCardSubtitle(tenant)
}

export function CatalogListRow({ tenant }: { tenant: PublicTenantSummary }) {
  const isPlatform = tenant.isPlatformToken

  return (
    <Link
      href={tenantCatalogHref(tenant)}
      className={`group flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:gap-3 md:gap-4 sm:items-center px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors ${
        isPlatform ? 'bg-sol-purple/[0.04]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0 sm:contents">
        <div className="min-w-0 flex items-center gap-3">
          <div
            className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
              isPlatform
                ? 'bg-sol-mint/15 text-sol-mint border border-sol-mint/25'
                : 'bg-white/5 text-gray-300 border border-white/10'
            }`}
          >
            {tenant.symbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold truncate ${isPlatform ? 'text-sol-mint' : 'text-white'}`}>
                ${tenant.symbol}
              </span>
              {isPlatform ? (
                <span className="text-[0.6rem] uppercase tracking-wider text-sol-mint/80 shrink-0">Platform</span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 font-mono truncate">/{tenant.slug}</p>
          </div>
        </div>

        <span
          className={`shrink-0 text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap sm:order-4 ${
            tenant.status === 'active'
              ? 'bg-sol-mint/10 text-sol-mint border-sol-mint/20'
              : 'bg-white/5 text-gray-400 border-white/10'
          }`}
        >
          {formatCatalogStatus(tenant)}
        </span>
      </div>

      <p className="hidden md:block text-xs font-mono text-gray-600 truncate group-hover:text-gray-500">
        {tenant.mint || '—'}
      </p>

      <span className="text-xs text-gray-400 sm:whitespace-nowrap">{payoutLabel(tenant)}</span>
    </Link>
  )
}
