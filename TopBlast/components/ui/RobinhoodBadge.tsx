'use client'

import Image from 'next/image'

type RobinhoodBadgeProps = {
  compact?: boolean
  className?: string
}

/** Robinhood Chain branding — matches waddle.bet EVM badge style */
export function RobinhoodBadge({ compact = false, className = '' }: RobinhoodBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-100 shadow-md ${className}`}
      title="TopBlast on Robinhood Chain (EVM)"
    >
      <Image
        src="/robinhood-feather.svg"
        alt="Robinhood Chain"
        width={compact ? 16 : 20}
        height={compact ? 16 : 20}
        className="shrink-0"
      />
      <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
        {compact ? 'Robinhood EVM' : 'Robinhood Chain · EVM'}
      </span>
    </div>
  )
}
