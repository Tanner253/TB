'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { PublicTenantSummary } from '@/lib/tenant/types'
import { formatCatalogStatus, tenantCatalogHref, catalogCardSubtitle } from '@/lib/platform/catalogClient'
import { CatalogMetrics } from '@/components/catalog/CatalogMetrics'
import { CatalogTimerBadge } from '@/components/catalog/CatalogTimerBadge'

interface CatalogCardProps {
  tenant: PublicTenantSummary
  compact?: boolean
}

export function CatalogCard({ tenant, compact = false }: CatalogCardProps) {
  const isPlatform = tenant.isPlatformToken

  return (
    <Link href={tenantCatalogHref(tenant)}>
      <motion.article
        whileHover={{ y: compact ? -2 : -3 }}
        className={`group h-full rounded-xl border transition-colors ${
          compact ? 'p-4' : 'p-5'
        } ${
          isPlatform
            ? 'border-sol-mint/25 bg-gradient-to-br from-sol-purple/10 to-transparent hover:border-sol-mint/40'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-sol-mint/25 hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h2
                className={`font-bold tracking-tight truncate ${compact ? 'text-xl' : 'text-2xl'} ${
                  isPlatform ? 'text-sol-mint' : 'text-white'
                }`}
              >
                ${tenant.symbol}
              </h2>
              {isPlatform ? (
                <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sol-mint/10 text-sol-mint border border-sol-mint/25 shrink-0">
                  Platform
                </span>
              ) : null}
              <CatalogTimerBadge tenant={tenant} compact={compact} />
            </div>
            <p className="text-sm text-gray-500 font-mono">/{tenant.slug}</p>
          </div>
          <span
            className={`shrink-0 text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full border ${
              tenant.status === 'active'
                ? 'bg-sol-mint/10 text-sol-mint border-sol-mint/20'
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}
          >
            {formatCatalogStatus(tenant)}
          </span>
        </div>

        {tenant.mint ? (
          <p className="text-[0.7rem] font-mono text-gray-600 truncate mb-2 group-hover:text-gray-500 transition-colors">
            {tenant.mint}
          </p>
        ) : null}

        <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>{catalogCardSubtitle(tenant)}</p>

        <CatalogMetrics tenant={tenant} />

        <p className="mt-3 text-xs font-medium text-sol-mint opacity-0 group-hover:opacity-100 transition-opacity">
          View leaderboard →
        </p>
      </motion.article>
    </Link>
  )
}
