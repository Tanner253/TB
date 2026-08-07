'use client'

import { DYNAMIC_POT } from '@/lib/marketing/devValueProp'
import { DEV_FEE_PCT } from '@/lib/platform/flywheel'
import { getWinnerSharePercents, getCommunityPercent } from '@/lib/payout/shares'

const SHARES = getWinnerSharePercents()
const COMMUNITY = getCommunityPercent()

export function DynamicPotExplainer({ compact = false }: { compact?: boolean }) {
  const ex = DYNAMIC_POT.example
  const winnerPool = ex.poolUsd * (COMMUNITY / 100)
  const firstShare = winnerPool * (SHARES.first / 100)

  return (
    <section
      className={`rounded-2xl border border-amber-500/20 bg-amber-950/10 text-left ${
        compact ? 'p-5' : 'p-6 md:p-8'
      }`}
    >
      <h2 className={`font-bold text-amber-300 mb-2 ${compact ? 'text-lg' : 'text-xl'}`}>
        {DYNAMIC_POT.title}
      </h2>
      <p className="text-sm text-gray-400 mb-6">{DYNAMIC_POT.intro}</p>

      <ul className={`space-y-4 mb-6 ${compact ? 'text-sm' : ''}`}>
        {DYNAMIC_POT.bullets.map(item => (
          <li key={item.title} className="flex gap-3">
            <span className="text-rh-lime font-bold shrink-0">→</span>
            <div>
              <p className="font-medium text-white">{item.title}</p>
              <p className="text-gray-400 text-sm mt-0.5">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Worked example</p>
        <p className="text-gray-300">
          Pool ≈ <span className="text-white font-mono">${ex.poolUsd.toLocaleString()}</span> → min
          eligible loss ≈{' '}
          <span className="text-amber-300 font-mono">${ex.minLossUsd.toLocaleString()}</span>{' '}
          (10% of pool). After {DEV_FEE_PCT}% platform fee, 1st place ≈{' '}
          <span className="text-rh-lime font-mono">${Math.round(firstShare).toLocaleString()}</span>{' '}
          ({SHARES.first}% of {COMMUNITY}% winner pool).
        </p>
      </div>
    </section>
  )
}
