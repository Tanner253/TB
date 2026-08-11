'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CatalogCard } from '@/components/catalog/CatalogCard'
import { CatalogListRow } from '@/components/catalog/CatalogListRow'
import { useTenantCatalog } from '@/hooks/useTenantCatalog'
import {
  CATALOG_SORT_OPTIONS,
  filterCatalogTenants,
  sortCatalogTenants,
  type CatalogSortId,
} from '@/lib/platform/catalogClient'

type ViewMode = 'grid' | 'list'

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  )
}

export function CatalogBrowser() {
  const { tenants, loading, error } = useTenantCatalog()
  const [query, setQuery] = useState('')
  const [sortId, setSortId] = useState<CatalogSortId>('featured')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const filtered = useMemo(
    () => sortCatalogTenants(filterCatalogTenants(tenants, query), sortId),
    [tenants, query, sortId]
  )

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-40 -mx-3 sm:-mx-5 px-3 sm:px-5 py-3 bg-[#030303]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, slug, or mint…"
              className="w-full rounded-lg bg-white/[0.04] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-sol-mint/40 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortId}
              onChange={e => setSortId(e.target.value as CatalogSortId)}
              className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-gray-300 focus:border-sol-mint/40 outline-none"
            >
              {CATALOG_SORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`p-2.5 transition-colors ${
                  viewMode === 'grid' ? 'bg-sol-mint/15 text-sol-mint' : 'text-gray-500 hover:text-white'
                }`}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                className={`p-2.5 border-l border-white/10 transition-colors ${
                  viewMode === 'list' ? 'bg-sol-mint/15 text-sol-mint' : 'text-gray-500 hover:text-white'
                }`}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>

        {!loading && !error ? (
          <p className="text-xs text-gray-500 mt-2">
            {filtered.length} listing{filtered.length === 1 ? '' : 's'}
            {query ? ` matching “${query.trim()}”` : ''}
          </p>
        ) : null}
      </div>

      {loading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="min-h-[14rem] rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center text-red-300 text-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          {query ? (
            <>
              <p className="text-gray-300 mb-2">No listings match your search</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-sm text-sol-mint hover:text-white transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-300 mb-2">No listings yet</p>
              <p className="text-sm text-gray-500 mb-6">Be the first to list your token on TopBlast.</p>
              <Link
                href="/launch"
                className="inline-flex px-5 py-2.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm"
              >
                List your token
              </Link>
            </>
          )}
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 && viewMode === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
          {filtered.map(tenant => (
            <CatalogCard key={tenant.slug} tenant={tenant} compact />
          ))}
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 && viewMode === 'list' ? (
        <div className="rounded-xl border border-white/[0.08] overflow-visible bg-black/20">
          <div className="hidden sm:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(7.5rem,9rem)_auto] gap-3 md:gap-4 px-4 py-2 text-[0.65rem] uppercase tracking-wider text-gray-500 border-b border-white/[0.06] bg-white/[0.02]">
            <span>Token</span>
            <span className="hidden md:block">Mint</span>
            <span>Pot</span>
            <span title="Lifetime SOL bought on-chart via payout-cycle Jupiter swaps">Gen volume</span>
            <span>Paid out</span>
            <span className="hidden lg:block">Payouts</span>
            <span>Status</span>
          </div>
          {filtered.map(tenant => (
            <CatalogListRow key={tenant.slug} tenant={tenant} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
