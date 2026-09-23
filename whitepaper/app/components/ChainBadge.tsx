'use client'

/**
 * Chain badge — "Live on Robinhood Chain", with the Pons launchpad named as
 * the venue TopBlast buys and lists through.
 *
 * Drawn inline rather than loaded as an image so it picks up the theme accent
 * without shipping two files. The whitepaper is dark-only, so the cut-outs are
 * the page background rather than a theme token.
 */
type ChainBadgeProps = {
  compact?: boolean
  className?: string
}

export function ChainBadge({ compact = false, className = '' }: ChainBadgeProps) {
  const s = compact ? 16 : 20
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-sol-purple/40 bg-sol-purple/10 px-3 py-1.5 text-sol-purple shadow-rh-glow-sm ${className}`}
      title="TopBlast on Robinhood Chain · on-chart buybacks + token airdrops via Pons"
    >
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className="shrink-0" aria-hidden="true">
        <path
          d="M24 3.5C24 3.5 7.5 14.5 7.5 26.5C7.5 35 14 43.5 24 44.5C34 43.5 40.5 35 40.5 26.5C40.5 14.5 24 3.5 24 3.5Z"
          fill="currentColor"
        />
        <path d="M24 9L15 26.5L24 40.5L33 26.5L24 9Z" fill="#0a0612" opacity="0.35" />
        <path d="M24 12L20 26L24 36L28 26L24 12Z" fill="#0a0612" opacity="0.2" />
      </svg>
      <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
        {compact ? 'Robinhood Chain' : 'Live on Robinhood Chain · Pons'}
      </span>
    </div>
  )
}
