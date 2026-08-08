'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import {
  LaunchAfterSubmitFlow,
  LaunchSetupChecklist,
  LaunchSkippedCyclesNote,
} from '@/components/tenant/LaunchHowTo'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { ChartVolumeExplainer } from '@/components/platform/ChartVolumeExplainer'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'
import { AppHeader } from '@/components/platform/AppHeader'
import { LaunchTabBar, LaunchTabPanel, useLaunchTabs } from '@/components/launch/LaunchTabs'
import { LAUNCH_KEY_HELP } from '@/lib/tenant/launchHelp'
import { DEV_HERO, TRUST_FOOTER } from '@/lib/marketing/devValueProp'
import { appHostname } from '@/lib/marketing/urls'
import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  PAYOUT_INTERVAL_OPTIONS,
} from '@/lib/platform/payoutIntervals'
import { DEFAULT_MIN_TOKEN_HOLDING } from '@/lib/platform/minTokenHolding'


export default function LaunchPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useLaunchTabs('create')
  const [form, setForm] = useState({
    slug: '',
    symbol: '',
    mint: '',
    payoutWalletPrivateKey: '',
    payoutIntervalMinutes: DEFAULT_PAYOUT_INTERVAL_MINUTES,
    minTokenHolding: DEFAULT_MIN_TOKEN_HOLDING,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          minTokenHolding: form.minTokenHolding || DEFAULT_MIN_TOKEN_HOLDING,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || 'Listing failed')
      }
      setForm(f => ({ ...f, payoutWalletPrivateKey: '' }))
      router.push(`/${json.data.slug}/leaderboard`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Listing failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader active="launch" />

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <header className="mb-8">
            <p className="text-sol-mint text-xs font-semibold uppercase tracking-[0.14em] mb-2">Self-serve listing</p>
            <h1 className="text-3xl font-bold mb-2">{DEV_HERO.cta}</h1>
            <p className="text-gray-400 text-sm md:text-base max-w-2xl">{DEV_HERO.subhead}</p>
          </header>

          <div className="mb-8">
            <LaunchTabBar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          <LaunchTabPanel tabId="create" activeTab={activeTab}>
            <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 md:p-8 border-rh-green/20 space-y-5">
              <p className="text-sm text-gray-500">
                Fill in your token details below. Need help first?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('setup')}
                  className="text-sol-mint hover:text-rh-lime underline underline-offset-2"
                >
                  Open the setup guide
                </button>
                .
              </p>

              <label className="block">
                <span className="text-sm text-gray-400">URL slug</span>
                <input
                  required
                  value={form.slug}
                  onChange={e =>
                    setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                  }
                  placeholder="my-token"
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Session URL: {appHostname()}/{form.slug || 'your-slug'}
                </p>
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">Ticker symbol</span>
                <input
                  required
                  value={form.symbol}
                  onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                  placeholder="BLAST"
                  maxLength={12}
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 focus:border-rh-green/50 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">SPL mint (contract address)</span>
                <input
                  required
                  value={form.mint}
                  onChange={e => setForm(f => ({ ...f, mint: e.target.value.trim() }))}
                  placeholder="Token mint base58"
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">{LAUNCH_KEY_HELP.payoutInterval.title}</span>
                <select
                  value={form.payoutIntervalMinutes}
                  onChange={e => setForm(f => ({ ...f, payoutIntervalMinutes: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 text-sm focus:border-rh-green/50 outline-none"
                >
                  {PAYOUT_INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">{LAUNCH_KEY_HELP.payoutInterval.body}</p>
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">{LAUNCH_KEY_HELP.minTokenHolding.title}</span>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  min={1}
                  value={String(form.minTokenHolding)}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/,/g, '').replace(/[^\d]/g, '')
                    setForm(f => ({
                      ...f,
                      minTokenHolding: cleaned ? Number(cleaned) : DEFAULT_MIN_TOKEN_HOLDING,
                    }))
                  }}
                  placeholder={String(DEFAULT_MIN_TOKEN_HOLDING)}
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-gray-500 mt-2">{LAUNCH_KEY_HELP.minTokenHolding.body}</p>
              </label>

              <label className="block">
                <span className="text-sm text-gray-400">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.title}</span>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={form.payoutWalletPrivateKey}
                  onChange={e => setForm(f => ({ ...f, payoutWalletPrivateKey: e.target.value.trim() }))}
                  placeholder="Base58 private key — fund with SOL for winner payouts"
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-gray-500 mt-2">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.body}</p>
              </label>

              {error ? <p className="text-red-400 text-sm">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-sol-gradient text-black rounded-xl font-bold disabled:opacity-50"
              >
                {submitting ? 'Creating listing…' : 'Create listing & start TopBlast'}
              </button>

              <p className="text-xs text-gray-600 text-center">
                Keys are encrypted at rest.{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('fees')}
                  className="text-gray-400 hover:text-sol-mint underline underline-offset-2"
                >
                  Platform fee details
                </button>
              </p>
            </form>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="setup" activeTab={activeTab}>
            <div className="space-y-6">
              <LaunchSetupChecklist />
              <LaunchAfterSubmitFlow />
              <p className="text-sm text-gray-500 text-center">
                Ready?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="text-sol-mint hover:text-rh-lime underline underline-offset-2"
                >
                  Go to Create listing
                </button>
              </p>
            </div>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="payouts" activeTab={activeTab}>
            <div className="space-y-6">
              <ChartVolumeExplainer compact showCatalogLink={false} />
              <DynamicPotExplainer compact hideTimer />
              <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
                <h2 className="text-lg font-bold mb-4">Eligibility requirements</h2>
                <EligibilityRequirements variant="compact" />
              </section>
              <LaunchSkippedCyclesNote className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6" />
            </div>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="fees" activeTab={activeTab}>
            <div className="space-y-6">
              <ForCreatorsSection
                compact
                hideHero
                showLaunchCta={false}
                showBenefits={false}
                showTrustFooter={false}
              />
              <FlywheelTokenomics compact />
              <p className="text-xs text-gray-500 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                {TRUST_FOOTER}
              </p>
            </div>
          </LaunchTabPanel>
        </motion.div>
      </main>
    </div>
  )
}
