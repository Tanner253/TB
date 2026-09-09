'use client'

import Link from 'next/link'
import { CHART_VOLUME_ENGINE } from '@/lib/marketing/devValueProp'

interface ChartVolumeExplainerProps {
  compact?: boolean
  showCatalogLink?: boolean
}

export function ChartVolumeExplainer({ compact = false, showCatalogLink = true }: ChartVolumeExplainerProps) {
  const copy = CHART_VOLUME_ENGINE

  return (
    <section
      className={`rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/30 via-card/40 to-transparent ${
        compact ? 'p-5' : 'p-6 md:p-8'
      }`}
    >
      <div className={`flex flex-col gap-2 ${compact ? 'mb-4' : 'mb-6'}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sol-purple">
          Volume engine
        </p>
        <h2 className={`font-bold text-ink ${compact ? 'text-xl' : 'text-2xl'}`}>{copy.title}</h2>
        <p className={`text-sol-purple/80 font-medium ${compact ? 'text-sm' : 'text-base'}`}>
          {copy.tagline}
        </p>
        <p className={`text-ink-2 leading-relaxed ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>
          {copy.intro}
        </p>
      </div>

      <ol className={`grid gap-3 ${compact ? 'md:grid-cols-3 mb-4' : 'md:grid-cols-3 mb-6'}`}>
        {copy.steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-line bg-card/70 p-4"
          >
            <p className="text-xs font-mono text-sol-purple/80 mb-1">0{index + 1}</p>
            <p className="font-semibold text-ink text-sm mb-1">{step.title}</p>
            <p className="text-xs text-ink-2 leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className={`grid gap-3 ${compact ? 'md:grid-cols-3 mb-4' : 'md:grid-cols-3 mb-6'}`}>
        {copy.stats.map(stat => (
          <div
            key={stat.label}
            className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-center"
          >
            <div className="text-lg font-bold text-sol-purple">{stat.value}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-ink-3 mt-1">{stat.label}</div>
            <div className="text-xs text-ink-3 mt-1">{stat.hint}</div>
          </div>
        ))}
      </div>

      <p className={`text-ink-2 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>{copy.footer}</p>

      {showCatalogLink && !compact ? (
        <p className="text-xs text-ink-3 mt-4">
          See live{' '}
          <Link href="/catalog" className="text-sol-purple hover:text-ink transition-colors">
            Gen volume
          </Link>{' '}
          on every catalog listing.
        </p>
      ) : null}
    </section>
  )
}
