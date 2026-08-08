'use client'

import Link from 'next/link'
import { AppHeader } from '@/components/platform/AppHeader'
import { CatalogBrowser } from '@/components/catalog/CatalogBrowser'

export default function CatalogPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-sol-purple/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      <AppHeader active="catalog" />

      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-5 py-6 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-sol-mint text-xs font-semibold uppercase tracking-[0.14em] mb-2">Explore</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Token catalog</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live loss-mining sessions — sort by pot, on-chart Gen volume, or total paid out
            </p>
          </div>
          <Link
            href="/launch"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity shrink-0"
          >
            + List token
          </Link>
        </div>

        <CatalogBrowser />
      </main>
    </div>
  )
}
