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
  /** Hide headline block when the parent page already shows it. */
  hideHero?: boolean
  /** Omit sections already covered elsewhere on the page. */
  showComparison?: boolean
  showBenefits?: boolean
  showTrustFooter?: boolean
}

export function ForCreatorsSection({
  showLaunchCta = true,
  compact = false,
  hideHero = false,
  showComparison = true,
  showBenefits = true,
  showTrustFooter = true,
}: ForCreatorsSectionProps) {
  return (
    <section className={compact ? 'space-y-6' : 'mb-12 space-y-8'}>
      {!hideHero ? (
        <div className="text-left">
          <p className="text-xs uppercase tracking-wider text-sol-purple mb-2">For Solana token creators</p>
          <h2 className={`font-bold mb-3 ${compact ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
            {DEV_HERO.headline}
          </h2>
          <p className="text-ink-2 max-w-2xl">{DEV_HERO.subhead}</p>
        </div>
      ) : null}

      {showComparison ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead>
              <tr className="border-b border-line bg-ink/5">
                <th className="p-4 font-medium text-ink-2">Approach</th>
                <th className="p-4 font-medium text-ink-2">Holder behavior</th>
                <th className="p-4 font-medium text-ink-2">Chart / community</th>
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
                  <td className="p-4 font-semibold text-ink">{row.name}</td>
                  <td className="p-4 text-ink-2">{row.holderBehavior}</td>
                  <td className="p-4 text-ink-2">
                    <span className={row.tone === 'positive' ? 'text-sol-purple' : 'text-ink-2'}>
                      {row.chartEffect}
                    </span>
                    {row.devOptics ? (
                      <span className="block text-xs text-ink-3 mt-1">{row.devOptics}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showBenefits ? (
        <div className="grid md:grid-cols-2 gap-4">
          {CREATOR_BENEFITS.map(item => (
            <div
              key={item.title}
              className="rounded-xl border border-rh-green/15 bg-rh-green/5 p-4 text-left"
            >
              <p className="font-semibold text-ink text-sm">{item.title}</p>
              <p className="text-xs text-ink-2 mt-1">{item.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showTrustFooter ? <p className="text-xs text-ink-3 text-left">{TRUST_FOOTER}</p> : null}

      {showLaunchCta ? (
        <Link
          href="/launch"
          className="inline-block px-6 py-3 bg-sol-gradient text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90"
        >
          {DEV_HERO.cta} →
        </Link>
      ) : null}
    </section>
  )
}
