'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatCatalogStatus, tenantCatalogHref } from '@/lib/platform/catalogClient'
import { CatalogMetrics } from '@/components/catalog/CatalogMetrics'
import { CatalogTimerBadge } from '@/components/catalog/CatalogTimerBadge'
import { CatalogCountdown } from '@/components/catalog/CatalogCountdown'
import { TokenAvatar } from '@/components/ui/TokenAvatar'
import { useTokenMedia } from '@/hooks/useTokenMedia'

interface CatalogCardProps {
  tenant: PublicTenantSummary
  compact?: boolean
}

export function CatalogCard({ tenant, compact = false }: CatalogCardProps) {
  const isPlatform = tenant.isPlatformToken
  const padding = compact ? 'p-4' : 'p-5'
  const titleSize = compact ? 'text-xl' : 'text-2xl'
  const { media } = useTokenMedia(tenant.token_icon_url ? null : tenant.mint)
  const iconUrl = tenant.token_icon_url || media?.iconUrl || null

  return (
    <Link href={tenantCatalogHref(tenant)} className="block h-full">
      <motion.article
        whileHover={{ y: compact ? -2 : -3 }}
        className={`group relative z-0 flex h-full min-h-[15.5rem] flex-col overflow-visible rounded-xl border transition-colors ${padding} ${
          isPlatform
            ? 'border-sol-purple/30 bg-gradient-to-br from-sol-purple/10 to-transparent hover:border-sol-purple/40'
            : 'border-line bg-ink/[0.02] hover:border-sol-purple/25 hover:bg-ink/[0.04]'
        }`}
      >
        <div className="relative z-20 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            <TokenAvatar
              symbol={tenant.symbol}
              iconUrl={iconUrl}
              size={compact ? 'sm' : 'md'}
              highlighted={isPlatform}
              previewOnHover
            />
            <h2
              className={`min-w-0 font-bold tracking-tight truncate ${titleSize} ${
                isPlatform ? 'text-sol-purple' : 'text-ink'
              }`}
              title={`$${tenant.symbol}`}
            >
              ${tenant.symbol}
            </h2>
          </div>
          <span
            className={`shrink-0 text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full border ${
              tenant.status === 'active'
                ? 'bg-sol-purple/10 text-sol-purple border-sol-purple/20'
                : 'bg-ink/5 text-ink-2 border-line'
            }`}
          >
            {formatCatalogStatus(tenant)}
          </span>
        </div>

        <div className="mt-1.5 min-h-[1.375rem] flex flex-wrap items-center gap-1.5 shrink-0">
          {isPlatform ? (
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sol-purple/10 text-sol-purple border border-sol-purple/25 shrink-0">
              Platform
            </span>
          ) : null}
          <CatalogTimerBadge tenant={tenant} compact={compact} />
        </div>

        <p
          className="mt-1 text-sm text-ink-3 font-mono truncate shrink-0"
          title={`/${tenant.slug}`}
        >
          /{tenant.slug}
        </p>

        <p
          className={`mt-1 font-mono text-ink-3 truncate shrink-0 ${
            compact ? 'text-[0.65rem] min-h-[1rem]' : 'text-[0.7rem] min-h-[1.125rem]'
          } ${tenant.mint ? 'group-hover:text-ink-3 transition-colors' : 'text-transparent select-none'}`}
          title={tenant.mint ?? undefined}
          aria-hidden={!tenant.mint}
        >
          {tenant.mint ?? 'mint-placeholder'}
        </p>

        <div className="shrink-0">
          <CatalogCountdown tenant={tenant} compact={compact} />
        </div>

        <div className="mt-auto pt-3 shrink-0">
          <CatalogMetrics tenant={tenant} />
          <p className="mt-3 min-h-[1rem] text-xs font-medium text-sol-purple opacity-0 group-hover:opacity-100 transition-opacity">
            View leaderboard →
          </p>
        </div>
      </motion.article>
    </Link>
  )
}
