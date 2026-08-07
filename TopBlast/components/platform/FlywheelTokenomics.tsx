'use client'

import Link from 'next/link'
import {
  DEV_FEE_PCT,
  DEV_FEE_BUYBACK_SHARE_PCT,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  DEV_FEE_OPS_SHARE_PCT,
  FLYWHEEL_STEPS,
} from '@/lib/platform/flywheel'

interface FlywheelTokenomicsProps {
  compact?: boolean
}

export function FlywheelTokenomics({ compact = false }: FlywheelTokenomicsProps) {
  return (
    <section className={compact ? '' : 'glass-panel rounded-2xl p-8 border-rh-green/20'}>
      <div className={compact ? '' : 'max-w-3xl mx-auto'}>
        <h2 className={`font-bold text-rh-lime ${compact ? 'text-xl mb-3' : 'text-2xl mb-4 text-center'}`}>
          Platform flywheel
        </h2>
        <p className={`text-gray-400 ${compact ? 'text-sm mb-4' : 'text-center mb-8'}`}>
          Every SaaS tenant pays a flat {DEV_FEE_PCT}% protocol fee to the TopBlast platform wallet (
          <code className="text-rh-green text-xs">DEV_WALLET_ADDRESS</code> — server env, not set by launchers).
          Payout cycles run automatically via cron.{' '}
          <span className="text-white">{DEV_FEE_BUYBACK_SHARE_PCT}% of collected fees</span> ({PLATFORM_BUYBACK_PCT_OF_POOL}% of each pool) buys the platform token — the only manual step today.
        </p>

        <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-3 mb-8'}`}>
          <div className="rounded-xl border border-rh-green/20 bg-black/40 p-4 text-center">
            <div className="text-3xl font-bold text-rh-green">{DEV_FEE_PCT}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Dev fee per cycle</div>
          </div>
          <div className="rounded-xl border border-sol-mint/20 bg-black/40 p-4 text-center">
            <div className="text-3xl font-bold text-sol-mint">{PLATFORM_BUYBACK_PCT_OF_POOL}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">→ Platform token buyback</div>
          </div>
          <div className={`rounded-xl border border-white/10 bg-black/40 p-4 text-center ${compact ? 'md:col-span-2' : ''}`}>
            <div className="text-3xl font-bold text-white">{DEV_FEE_OPS_SHARE_PCT}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Dev fee → ops &amp; infra</div>
          </div>
        </div>

        <ol className={`space-y-2 ${compact ? 'text-sm' : ''}`}>
          {FLYWHEEL_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-gray-300">
              <span className="text-rh-green font-mono shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {!compact && (
          <p className="text-xs text-gray-500 mt-6 text-center">
            SaaS utility is the priority — the flywheel aligns platform growth with every launch on the network.{' '}
            <Link href="/launch" className="text-rh-green hover:text-rh-lime transition-colors">
              Launch your token →
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
