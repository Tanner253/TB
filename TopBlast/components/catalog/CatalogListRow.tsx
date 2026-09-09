'use client'

import Link from 'next/link'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatCatalogStatus, tenantCatalogHref } from '@/lib/platform/catalogClient'
import { CatalogTimerBadge } from '@/components/catalog/CatalogTimerBadge'
import { CatalogCountdown } from '@/components/catalog/CatalogCountdown'
import { TokenAvatar } from '@/components/ui/TokenAvatar'
import { useTokenMedia } from '@/hooks/useTokenMedia'

function MetricValue({
  primary,
  secondary,
  primaryClassName = 'text-ink',
}: {
  primary: string
  secondary?: string | null
  primaryClassName?: string
}) {
  return (
    <div className="min-w-0">
      <p className={`text-sm font-medium tabular-nums truncate ${primaryClassName}`}>{primary}</p>
      <p className="text-[0.65rem] text-ink-3 tabular-nums truncate">
        {secondary ?? '\u00A0'}
      </p>
    </div>
  )
}

function PotCell({ tenant }: { tenant: PublicTenantSummary }) {
  return (
    <MetricValue
      primary={tenant.pot_usd_formatted ?? '—'}
      secondary={tenant.pot_sol != null ? `${tenant.pot_sol.toFixed(4)} SOL` : null}
    />
  )
}

function GeneratedVolumeCell({ tenant }: { tenant: PublicTenantSummary }) {
  return (
    <MetricValue
      primary={tenant.total_generated_volume_usd_formatted ?? '$0'}
      secondary={tenant.total_generated_volume_sol_formatted ?? '0 SOL'}
      primaryClassName="text-sol-purple"
    />
  )
}

function PaidOutCell({ tenant }: { tenant: PublicTenantSummary }) {
  return (
    <MetricValue
      primary={tenant.total_distributed_usd_formatted ?? '—'}
      primaryClassName="text-sol-mint"
    />
  )
}

function PayoutCell({ tenant }: { tenant: PublicTenantSummary }) {
  return (
    <div className="min-w-[7.5rem] max-w-[9rem] hidden lg:block">
      <CatalogCountdown tenant={tenant} compact />
    </div>
  )
}

export function CatalogListRow({ tenant }: { tenant: PublicTenantSummary }) {
  const isPlatform = tenant.isPlatformToken
  const { media } = useTokenMedia(tenant.token_icon_url ? null : tenant.mint)
  const iconUrl = tenant.token_icon_url || media?.iconUrl || null

  return (
    <Link
      href={tenantCatalogHref(tenant)}
      className={`group relative z-0 flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(7.5rem,9rem)_auto] sm:gap-3 md:gap-4 sm:items-center px-4 py-3 border-b border-line hover:bg-ink/[0.03] transition-colors overflow-visible ${
        isPlatform ? 'bg-sol-purple/[0.04]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0 sm:contents">
        <div className="relative z-20 min-w-0 flex items-center gap-3">
          <TokenAvatar
            symbol={tenant.symbol}
            iconUrl={iconUrl}
            size="sm"
            highlighted={isPlatform}
            previewOnHover
            className="sm:hidden"
          />
          <TokenAvatar
            symbol={tenant.symbol}
            iconUrl={iconUrl}
            size="md"
            highlighted={isPlatform}
            previewOnHover
            className="hidden sm:flex"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold truncate ${isPlatform ? 'text-sol-purple' : 'text-ink'}`}>
                ${tenant.symbol}
              </span>
              {isPlatform ? (
                <span className="text-[0.6rem] uppercase tracking-wider text-sol-purple/80 shrink-0">Platform</span>
              ) : null}
              {tenant.payout_mode === 'sol' ? (
                <span
                  className="text-[0.6rem] uppercase tracking-wider text-sky-700 dark:text-sky-300 shrink-0"
                  title="Winners are paid SOL directly from the pool — no buyback, no airdrop"
                >
                  ◎ SOL payouts
                </span>
              ) : null}
              <CatalogTimerBadge tenant={tenant} compact />
            </div>
            <p className="text-xs text-ink-3 font-mono truncate">/{tenant.slug}</p>
          </div>
        </div>

        <span
          className={`shrink-0 text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap sm:order-7 ${
            tenant.status === 'active'
              ? 'bg-sol-purple/10 text-sol-purple border-sol-purple/20'
              : 'bg-ink/5 text-ink-2 border-line'
          }`}
        >
          {formatCatalogStatus(tenant)}
        </span>
      </div>

      <div className="sm:hidden space-y-2">
        <CatalogCountdown tenant={tenant} compact />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-3 mb-0.5">Pot</p>
            <PotCell tenant={tenant} />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-3 mb-0.5">Gen vol</p>
            <GeneratedVolumeCell tenant={tenant} />
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-3 mb-0.5">Paid out</p>
            <PaidOutCell tenant={tenant} />
          </div>
        </div>
      </div>

      <p className="hidden md:block text-xs font-mono text-ink-3 truncate group-hover:text-ink-3">
        {tenant.mint || '—'}
      </p>

      <div className="hidden sm:block">
        <PotCell tenant={tenant} />
      </div>

      <div className="hidden sm:block">
        <GeneratedVolumeCell tenant={tenant} />
      </div>

      <div className="hidden sm:block">
        <PaidOutCell tenant={tenant} />
      </div>

      <PayoutCell tenant={tenant} />
    </Link>
  )
}
