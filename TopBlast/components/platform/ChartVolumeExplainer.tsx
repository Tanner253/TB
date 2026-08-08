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
      className={`rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/30 via-black/40 to-transparent ${
        compact ? 'p-5' : 'p-6 md:p-8'
      }`}
    >
      <div className={`flex flex-col gap-2 ${compact ? 'mb-4' : 'mb-6'}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-300/90">
          Volume engine
        </p>
        <h2 className={`font-bold text-white ${compact ? 'text-xl' : 'text-2xl'}`}>{copy.title}</h2>
        <p className={`text-purple-200/80 font-medium ${compact ? 'text-sm' : 'text-base'}`}>
          {copy.tagline}
        </p>
        <p className={`text-gray-400 leading-relaxed ${compact ? 'text-sm' : 'text-sm md:text-base'}`}>
          {copy.intro}
        </p>
      </div>

      <ol className={`grid gap-3 ${compact ? 'md:grid-cols-3 mb-4' : 'md:grid-cols-3 mb-6'}`}>
        {copy.steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-white/[0.08] bg-black/40 p-4"
          >
            <p className="text-xs font-mono text-purple-300/80 mb-1">0{index + 1}</p>
            <p className="font-semibold text-white text-sm mb-1">{step.title}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className={`grid gap-3 ${compact ? 'md:grid-cols-3 mb-4' : 'md:grid-cols-3 mb-6'}`}>
        {copy.stats.map(stat => (
          <div
            key={stat.label}
            className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-center"
          >
            <div className="text-lg font-bold text-purple-200">{stat.value}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-gray-500 mt-1">{stat.label}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.hint}</div>
          </div>
        ))}
      </div>

      <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>{copy.footer}</p>

      {showCatalogLink && !compact ? (
        <p className="text-xs text-gray-500 mt-4">
          See live{' '}
          <Link href="/catalog" className="text-purple-300 hover:text-white transition-colors">
            Gen volume
          </Link>{' '}
          on every catalog listing.
        </p>
      ) : null}
    </section>
  )
}
