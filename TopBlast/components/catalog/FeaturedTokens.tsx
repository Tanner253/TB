'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { CatalogCard } from '@/components/catalog/CatalogCard'
import { useTenantCatalog } from '@/hooks/useTenantCatalog'
import { pickTopCatalogTenants } from '@/lib/platform/catalogClient'

interface FeaturedTokensProps {
  limit?: number
}

export function FeaturedTokens({ limit = 3 }: FeaturedTokensProps) {
  const { tenants, loading, error } = useTenantCatalog()
  const featured = pickTopCatalogTenants(tenants, limit)
  const reduceMotion = useReducedMotion()

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
            <span className="live-dot shrink-0" aria-hidden />
            Live
          </p>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Active sessions</h2>
          <p className="text-sm text-gray-500 mt-1">Platform token plus top pots by size</p>
        </div>
        <Link
          href="/catalog"
          className="text-sm font-medium text-sol-mint hover:text-white transition-colors whitespace-nowrap"
        >
          Browse all →
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-white/[0.08] bg-black/40 p-5 text-sm text-gray-400">
          Listings unavailable right now — try again shortly.
        </div>
      ) : null}

      {!loading && !error && featured.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center bg-black/30 text-gray-400 text-sm">
          No live listings yet.
        </div>
      ) : null}

      {!loading && !error && featured.length > 0 ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="grid gap-4 md:grid-cols-3"
        >
          {featured.map((tenant, i) => (
            <motion.div
              key={tenant.slug}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
            >
              <CatalogCard tenant={tenant} />
            </motion.div>
          ))}
        </motion.div>
      ) : null}
    </section>
  )
}
