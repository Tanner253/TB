'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import { LaunchHowTo } from '@/components/tenant/LaunchHowTo'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { DEV_FEE_PCT } from '@/lib/platform/flywheel'
import { TopBlastLogo } from '@/components/ui/TopBlastLogo'
import { LAUNCH_KEY_HELP } from '@/lib/tenant/launchHelp'
import { DEV_HERO, TRUST_FOOTER, WHITEPAPER_URL } from '@/lib/marketing/devValueProp'

export default function LaunchPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    slug: '',
    symbol: '',
    mint: '',
    payoutWalletPrivateKey: '',
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
      <header className="border-b border-rh-green/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <TopBlastLogo size="sm" />
            <span className="font-bold">TopBlast</span>
          </Link>
          <a
            href={WHITEPAPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-rh-green"
          >
            Whitepaper
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">{DEV_HERO.cta}</h1>
          <p className="text-gray-400 mb-4">{DEV_HERO.subhead}</p>
          <p className="text-gray-500 text-sm mb-6">
            Flat {DEV_FEE_PCT}% platform fee per cycle (server-side). Your creator wallet funds winner SOL only.
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
              <p className="text-xs text-gray-600 mt-1">Your session URL: topblast.xyz/{form.slug || 'your-slug'}</p>
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
