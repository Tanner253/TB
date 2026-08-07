'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AppHeader } from '@/components/platform/AppHeader'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import { DEV_HERO } from '@/lib/marketing/devValueProp'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'

interface TenantSummary {
  slug: string
  symbol: string
  mint: string
  status: string
  payoutWalletAddress: string
  payoutIntervalMinutes?: number
  featured?: boolean
  isPlatformToken?: boolean
  catalogOnly?: boolean
}

function tenantHref(tenant: TenantSummary): string {
  if (tenant.catalogOnly) {
    return `/launch?slug=${encodeURIComponent(tenant.slug)}`
  }
  return `/${tenant.slug}`
}

function CatalogCard({ tenant }: { tenant: TenantSummary }) {
  const isPlatform = tenant.isPlatformToken

  return (
    <Link href={tenantHref(tenant)}>
      <motion.article
        whileHover={{ y: -3 }}
        className={`group h-full rounded-xl border p-5 transition-colors ${
          isPlatform
            ? 'border-sol-mint/25 bg-gradient-to-br from-sol-purple/10 to-transparent hover:border-sol-mint/40'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-sol-mint/25 hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className={`text-2xl font-bold tracking-tight ${isPlatform ? 'text-sol-mint' : 'text-white'}`}>
                ${tenant.symbol}
              </h2>
              {isPlatform ? (
                <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sol-mint/10 text-sol-mint border border-sol-mint/25">
                  Platform
                </span>
              ) : null}
            </div>
            <p className="text-sm text-gray-500 font-mono">/{tenant.slug}</p>
          </div>
          <span
            className={`text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full border ${
              tenant.status === 'active'
                ? 'bg-sol-mint/10 text-sol-mint border-sol-mint/20'
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}
          >
            {tenant.catalogOnly ? 'Setup' : tenant.status}
          </span>
        </div>

        {tenant.mint ? (
          <p className="text-[0.7rem] font-mono text-gray-600 truncate mb-3 group-hover:text-gray-500 transition-colors">
            {tenant.mint}
          </p>
        ) : null}

        <p className="text-sm text-gray-400">
          {tenant.catalogOnly
            ? 'Configure platform token mint to feature here.'
            : tenant.payoutIntervalMinutes
              ? `Payouts every ${formatPayoutInterval(tenant.payoutIntervalMinutes)}`
              : tenant.payoutWalletAddress
                ? `Pool · ${tenant.payoutWalletAddress.slice(0, 6)}…${tenant.payoutWalletAddress.slice(-4)}`
                : 'Loss-mining session'}
        </p>

        <p className="mt-4 text-xs font-medium text-sol-mint opacity-0 group-hover:opacity-100 transition-opacity">
          Open session →
        </p>
      </motion.article>
    </Link>
  )
}

export default function CatalogPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLearn, setShowLearn] = useState(false)

  useEffect(() => {
    fetch('/api/tenants')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setTenants(json.data.tenants || [])
        } else {
          setError(json.error || 'Failed to load catalog')
        }
      })
      .catch(() => setError('Failed to load catalog'))
      .finally(() => setLoading(false))
  }, [])

  const communityTenants = tenants.filter(t => !t.isPlatformToken)
  const platformTenant = tenants.find(t => t.isPlatformToken)

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sol-purple/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      </div>

      <AppHeader active="catalog" />

      <main className="relative z-10 max-w-6xl mx-auto px-5 py-10">
        <div className="mb-10">
          <p className="text-sol-mint text-xs font-semibold uppercase tracking-[0.14em] mb-2">Solana SaaS</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{DEV_HERO.headline}</h1>
          <p className="text-gray-400 max-w-2xl text-sm md:text-base leading-relaxed">{DEV_HERO.subhead}</p>
        </div>

        <section className="mb-12">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold">Live listings</h2>
              <p className="text-sm text-gray-500">Independent loss-mining sessions · choose payout frequency at launch</p>
            </div>
            <Link
              href="/launch"
              className="hidden sm:inline-flex text-sm font-medium text-sol-mint hover:text-white transition-colors"
            >
              + New listing
            </Link>
          </div>

          {loading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && communityTenants.length === 0 && !platformTenant && (
            <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
              <p className="text-gray-300 mb-2">No listings yet</p>
              <p className="text-sm text-gray-500 mb-6">Launch bullish-holder rewards for your token in minutes.</p>
              <Link href="/launch" className="inline-flex px-5 py-2.5 bg-sol-gradient text-black rounded-lg font-semibold text-sm">
                Create first listing
              </Link>
            </div>
          )}

          {!loading && (platformTenant || communityTenants.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platformTenant ? <CatalogCard tenant={platformTenant} /> : null}
              {communityTenants.map(tenant => (
                <CatalogCard key={tenant.slug} tenant={tenant} />
              ))}
            </div>
          )}
        </section>

        <section className="mb-12">
          <FlywheelTokenomics />
        </section>

        <section className="border-t border-white/[0.06] pt-8">
          <button
            type="button"
            onClick={() => setShowLearn(v => !v)}
            className="flex items-center justify-between w-full text-left py-2 group"
          >
            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
              How TopBlast works
            </span>
            <span className="text-gray-500 text-lg">{showLearn ? '−' : '+'}</span>
          </button>

          {showLearn ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-8 pb-8"
            >
              <ForCreatorsSection showLaunchCta={false} />
              <DynamicPotExplainer />
            </motion.div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
