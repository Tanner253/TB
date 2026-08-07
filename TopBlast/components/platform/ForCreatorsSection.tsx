'use client'

import Link from 'next/link'
import {
  ALTERNATIVES_COMPARISON,
  CREATOR_BENEFITS,
  DEV_HERO,
  TRUST_FOOTER,
} from '@/lib/marketing/devValueProp'

interface ForCreatorsSectionProps {
  showLaunchCta?: boolean
  compact?: boolean
}

export function ForCreatorsSection({
  showLaunchCta = true,
  compact = false,
}: ForCreatorsSectionProps) {
  return (
    <section className={compact ? 'space-y-6' : 'mb-12 space-y-8'}>
      <div className="text-left">
        <p className="text-xs uppercase tracking-wider text-rh-lime mb-2">For Solana token creators</p>
        <h2 className={`font-bold mb-3 ${compact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
          {DEV_HERO.headline}
        </h2>
        <p className="text-gray-400 max-w-2xl">{DEV_HERO.subhead}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="p-4 font-medium text-gray-400">Approach</th>
              <th className="p-4 font-medium text-gray-400">Holder behavior</th>
              <th className="p-4 font-medium text-gray-400">Chart / community</th>
            </tr>
          </thead>
          <tbody>
            {ALTERNATIVES_COMPARISON.map(row => (
              <tr
                key={row.id}
                className={
                  row.tone === 'positive'
                    ? 'bg-rh-green/5 border-t border-rh-green/20'
                    : 'border-t border-white/5'
                }
              >
                <td className="p-4 font-semibold text-white">{row.name}</td>
                <td className="p-4 text-gray-300">{row.holderBehavior}</td>
                <td className="p-4 text-gray-400">
                  <span className={row.tone === 'positive' ? 'text-rh-lime' : 'text-gray-400'}>
                    {row.chartEffect}
                  </span>
                  {row.devOptics ? (
                    <span className="block text-xs text-gray-500 mt-1">{row.devOptics}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {CREATOR_BENEFITS.map(item => (
          <div
            key={item.title}
            className="rounded-xl border border-rh-green/15 bg-rh-green/5 p-4 text-left"
          >
            <p className="font-semibold text-white text-sm">{item.title}</p>
            <p className="text-xs text-gray-400 mt-1">{item.body}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-left">{TRUST_FOOTER}</p>

      {showLaunchCta ? (
        <Link
          href="/launch"
          className="inline-block px-6 py-3 bg-sol-gradient text-black rounded-xl font-bold text-sm hover:opacity-90"
        >
          {DEV_HERO.cta} →
        </Link>
      ) : null}
    </section>
  )
}
