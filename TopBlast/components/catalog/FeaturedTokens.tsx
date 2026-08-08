'use client'

import Link from 'next/link'
import { CatalogCard } from '@/components/catalog/CatalogCard'
import { useTenantCatalog } from '@/hooks/useTenantCatalog'
import { pickTopCatalogTenants } from '@/lib/platform/catalogClient'

interface FeaturedTokensProps {
  limit?: number
}

export function FeaturedTokens({ limit = 3 }: FeaturedTokensProps) {
  const { tenants, loading, error } = useTenantCatalog()
  const featured = pickTopCatalogTenants(tenants, limit)

  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold">Top listings</h2>
          <p className="text-sm text-gray-500">Featured sessions — Gen volume tracks SOL bought on-chart each cycle</p>
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
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4 text-red-300 text-sm">{error}</div>
      ) : null}

      {!loading && !error && featured.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-gray-300 mb-2">No live listings yet</p>
          <Link href="/launch" className="text-sm text-sol-mint hover:text-white transition-colors">
            Launch the first token →
          </Link>
        </div>
      ) : null}

      {!loading && !error && featured.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {featured.map(tenant => (
            <CatalogCard key={tenant.slug} tenant={tenant} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
