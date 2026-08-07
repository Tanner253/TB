'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { SolanaBadge } from '@/components/ui/SolanaBadge'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { HOW_TO_RUN_LISTING } from '@/lib/tenant/launchHelp'
import { DEV_HERO, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'

interface TenantSummary {
  slug: string
  symbol: string
  mint: string
  status: string
  payoutWalletAddress: string
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

export default function CatalogPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-sol-purple/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-sol-purple/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      <header className="relative z-10 border-b border-rh-green/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TopBlastLogo size="md" />
            <span className="text-xl font-bold">
              <span className="text-rh-green">TOP</span>BLAST
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-rh-green hidden sm:inline"
            >
              Whitepaper
            </a>
            <Link
              href="/launch"
              className="px-4 py-2 bg-sol-gradient text-black rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              {DEV_HERO.cta}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{DEV_HERO.headline}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-6">{DEV_HERO.subhead}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/launch"
              className="px-6 py-3 bg-sol-gradient text-black rounded-xl font-bold hover:opacity-90"
            >
              {DEV_HERO.cta}
            </Link>
            <a
              href={WHITEPAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-white/20 rounded-xl font-bold text-gray-200 hover:bg-white/5"
            >
              Read whitepaper
            </a>
          </div>
          <SolanaBadge />
        </motion.div>

        <ForCreatorsSection showLaunchCta={false} />

        <div className="my-12">
          <DynamicPotExplainer />
        </div>

        <div className="mb-12">
          <FlywheelTokenomics />
        </div>

        <section className="mb-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
          <h2 className="text-lg font-bold text-rh-lime mb-4">{HOW_TO_RUN_LISTING.title}</h2>
          <ol className="grid md:grid-cols-2 gap-4">
            {HOW_TO_RUN_LISTING.steps.map(step => (
              <li key={step.n} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rh-green/20 text-sm font-bold text-rh-lime">
                  {step.n}
                </span>
                <div>
                  <p className="font-medium text-white text-sm">{step.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/launch" className="inline-block mt-6 text-sm text-rh-lime hover:underline">
            Create a listing →
          </Link>
        </section>

        {loading && <p className="text-center text-gray-500">Loading catalog…</p>}
        {error && <p className="text-center text-red-400">{error}</p>}

        {platformTenant && (
          <div className="mb-8">
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Platform token</h2>
            <Link href={tenantHref(platformTenant)}>
              <motion.div
                whileHover={{ y: -4 }}
                className="glass-panel rounded-xl p-6 border-sol-mint/30 bg-gradient-to-br from-sol-purple/10 to-transparent h-full"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-sol-mint">{platformTenant.symbol}</h2>
                      <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full bg-sol-mint/10 text-sol-mint border border-sol-mint/30">
                        Platform
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">/{platformTenant.slug}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-rh-green/10 text-rh-green border border-rh-green/20">
                    {platformTenant.catalogOnly ? 'Configure' : platformTenant.status}
                  </span>
                </div>
                {platformTenant.mint ? (
                  <p className="text-xs font-mono text-gray-500 truncate mb-2">{platformTenant.mint}</p>
                ) : null}
                <p className="text-sm text-gray-400">
                  {platformTenant.catalogOnly
                    ? 'Pin your platform token mint in env or launch a session to go live.'
                    : 'Featured · dev-fee buyback flywheel'}
                </p>
              </motion.div>
            </Link>
          </div>
        )}

        {!loading && !error && communityTenants.length === 0 && !platformTenant && (
          <div className="glass-panel rounded-2xl p-10 text-center border-rh-green/20">
            <p className="text-gray-300 mb-6">
              No community tokens live yet. Be the first to launch bullish-holder rewards for your coin.
            </p>
            <Link href="/launch" className="inline-block px-6 py-3 bg-sol-gradient text-black rounded-xl font-bold">
              Get started
            </Link>
          </div>
        )}

        {communityTenants.length > 0 && (
          <>
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Live listings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {communityTenants.map(tenant => (
                <Link key={tenant.slug} href={tenantHref(tenant)}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="glass-panel rounded-xl p-6 border-rh-green/15 hover:border-rh-green/30 transition-colors h-full"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h2 className="text-2xl font-bold text-rh-lime">{tenant.symbol}</h2>
                        <p className="text-sm text-gray-500">/{tenant.slug}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-rh-green/10 text-rh-green border border-rh-green/20">
                        {tenant.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-500 truncate mb-2">{tenant.mint}</p>
                    {tenant.payoutWalletAddress ? (
                      <p className="text-sm text-gray-400">
                        Payout pool:{' '}
                        <span className="font-mono text-gray-300">
                          {tenant.payoutWalletAddress.slice(0, 8)}…
                        </span>
                      </p>
                    ) : null}
                  </motion.div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
