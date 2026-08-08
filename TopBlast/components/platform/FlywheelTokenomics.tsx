'use client'

import Link from 'next/link'
import {
  DEV_FEE_PCT,
  DEV_FEE_BUYBACK_SHARE_PCT,
  DEV_FEE_OPS_SHARE_PCT,
  FLYWHEEL_BURN_STATUS,
  FLYWHEEL_INTRO,
  FLYWHEEL_TREE,
  PLATFORM_BUYBACK_PCT_OF_POOL,
  PLATFORM_OPS_PCT_OF_POOL,
} from '@/lib/platform/flywheel'

interface FlywheelTokenomicsProps {
  compact?: boolean
}

function FlywheelTree({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-rh-green/20 bg-black/50 font-mono text-sm leading-relaxed ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="text-gray-300">{FLYWHEEL_TREE.root}</div>
      <div className="mt-2 pl-3 border-l-2 border-rh-green/30 space-y-2">
        <div>
          <span className="text-sol-mint">├─ </span>
          <span className="text-gray-200">{FLYWHEEL_TREE.buyback}</span>
          <div className="pl-5 mt-1 text-gray-400">
            <span className="text-sol-mint">└─ </span>
            {FLYWHEEL_TREE.burn}
            {FLYWHEEL_BURN_STATUS === 'planned' ? (
              <span className="ml-2 text-xs uppercase tracking-wider text-amber-400/90">(automated — roadmap)</span>
            ) : null}
          </div>
        </div>
        <div>
          <span className="text-sol-mint">└─ </span>
          <span className="text-gray-200">{FLYWHEEL_TREE.ops}</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500 font-sans leading-normal">{FLYWHEEL_TREE.burnNote}</p>
    </div>
  )
}

export function FlywheelTokenomics({ compact = false }: FlywheelTokenomicsProps) {
  return (
    <section className={compact ? '' : 'glass-panel rounded-2xl p-8 border-rh-green/20'}>
      <div className={compact ? '' : 'max-w-3xl mx-auto'}>
        <h2 className={`font-bold text-rh-lime ${compact ? 'text-xl mb-3' : 'text-2xl mb-4 text-center'}`}>
          Platform fee flywheel
        </h2>
        <p className={`text-gray-400 ${compact ? 'text-sm mb-4' : 'text-center mb-6'}`}>{FLYWHEEL_INTRO}</p>

        <FlywheelTree compact={compact} />

        <div className={`grid gap-3 ${compact ? 'md:grid-cols-3 mt-4' : 'md:grid-cols-3 mt-6 mb-6'}`}>
          <div className="rounded-xl border border-rh-green/20 bg-black/40 p-4 text-center">
            <div className="text-3xl font-bold text-rh-green">{DEV_FEE_PCT}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Protocol fee / cycle</div>
          </div>
          <div className="rounded-xl border border-sol-mint/20 bg-black/40 p-4 text-center">
            <div className="text-3xl font-bold text-sol-mint">{PLATFORM_BUYBACK_PCT_OF_POOL}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
              → Buyback ({DEV_FEE_BUYBACK_SHARE_PCT}% of fee)
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center">
            <div className="text-3xl font-bold text-white">{PLATFORM_OPS_PCT_OF_POOL}%</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
              → Ops ({DEV_FEE_OPS_SHARE_PCT}% of fee)
            </div>
          </div>
        </div>

        {!compact && (
          <p className="text-xs text-gray-500 text-center">
            Separate from each listing&apos;s session volume engine (on-chart buys + token airdrops to winners). This
            flywheel routes the 12% platform fee to TopBlast treasury buyback and ops.{' '}
            <Link href="/launch" className="text-rh-green hover:text-rh-lime transition-colors">
              Launch your token →
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
