'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import { LaunchHowTo } from '@/components/tenant/LaunchHowTo'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { DEV_FEE_PCT, PLATFORM_BUYBACK_PCT_OF_POOL, PLATFORM_OPS_PCT_OF_POOL } from '@/lib/platform/flywheel'
import { AppHeader } from '@/components/platform/AppHeader'
import { LAUNCH_KEY_HELP } from '@/lib/tenant/launchHelp'
import { DEV_HERO, TRUST_FOOTER } from '@/lib/marketing/devValueProp'
import { appHostname } from '@/lib/marketing/urls'
import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  PAYOUT_INTERVAL_OPTIONS,
} from '@/lib/platform/payoutIntervals'

export default function LaunchPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    slug: '',
    symbol: '',
    mint: '',
    payoutWalletPrivateKey: '',
    payoutIntervalMinutes: DEFAULT_PAYOUT_INTERVAL_MINUTES,
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
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || 'Launch failed')
      }
      router.push(`/${json.data.slug}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Launch failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader active="launch" />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">{DEV_HERO.cta}</h1>
          <p className="text-gray-400 mb-4">{DEV_HERO.subhead}</p>
          <p className="text-gray-500 text-sm mb-6">
            Flat {DEV_FEE_PCT}% platform fee per cycle funds the TopBlast flywheel —{' '}
            {PLATFORM_BUYBACK_PCT_OF_POOL}% of each pool buys platform token (burn), {PLATFORM_OPS_PCT_OF_POOL}% ops.
            Your creator wallet funds winner SOL only.
          </p>

          <div className="mb-8">
            <ForCreatorsSection compact showLaunchCta={false} />
          </div>

          <div className="mb-8">
            <DynamicPotExplainer compact />
          </div>

          <div className="mb-10">
            <LaunchHowTo />
          </div>

          <div className="mb-8">
            <FlywheelTokenomics compact />
          </div>

          <h2 className="text-xl font-bold mb-4">Create your listing</h2>
          <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-8 border-rh-green/20 space-y-5">
            <label className="block">
              <span className="text-sm text-gray-400">URL slug</span>
              <input
                required
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="my-token"
                className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
              />
              <p className="text-xs text-gray-600 mt-1">
                Your session URL: {appHostname()}/{form.slug || 'your-slug'}
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
              <span className="text-sm text-gray-400">Contract address (SPL mint / CA)</span>
              <input
                required
                value={form.mint}
                onChange={e => setForm(f => ({ ...f, mint: e.target.value.trim() }))}
                placeholder="Token mint base58"
                className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
              />
              <p className="text-xs text-gray-600 mt-1">The on-chain mint for your Solana token.</p>
            </label>

            <label className="block">
              <span className="text-sm text-gray-400">{LAUNCH_KEY_HELP.payoutInterval.title}</span>
              <select
                value={form.payoutIntervalMinutes}
                onChange={e =>
                  setForm(f => ({ ...f, payoutIntervalMinutes: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 text-sm focus:border-rh-green/50 outline-none"
              >
                {PAYOUT_INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">{LAUNCH_KEY_HELP.payoutInterval.body}</p>
            </label>

            <label className="block">
              <span className="text-sm text-gray-400">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.title}</span>
              <input
                required
                type="password"
                autoComplete="off"
                value={form.payoutWalletPrivateKey}
                onChange={e => setForm(f => ({ ...f, payoutWalletPrivateKey: e.target.value.trim() }))}
                placeholder="Base58 private key — fund this wallet with SOL for winner payouts"
                className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.body}</p>
              <p className="text-xs text-gray-600 mt-2">
                Encrypted at rest on TopBlast servers. Never shared or logged in plain text.
              </p>
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-sol-gradient text-black rounded-xl font-bold disabled:opacity-50"
            >
              {submitting ? 'Creating listing…' : 'Create listing & start TopBlast'}
            </button>

            <p className="text-xs text-gray-500 text-center">{TRUST_FOOTER}</p>
          </form>
        </motion.div>
      </main>
    </div>
  )
}
