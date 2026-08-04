'use client'

import Image from 'next/image'

type RobinhoodBadgeProps = {
  compact?: boolean
  className?: string
}

/** Robinhood Chain branding — neon green feather */
export function RobinhoodBadge({ compact = false, className = '' }: RobinhoodBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-rh-green/40 bg-rh-green/10 px-3 py-1.5 text-rh-lime shadow-[0_0_12px_rgba(0,200,5,0.15)] ${className}`}
      title="TopBlast on Robinhood Chain (EVM) · ETH payouts"
    >
      <Image
        src="/robinhood-icon.png"
        alt="Robinhood Chain"
        width={compact ? 16 : 20}
        height={compact ? 16 : 20}
        className="shrink-0 rounded-sm"
      />
      <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
        {compact ? 'Robinhood · ETH' : 'Robinhood Chain · ETH Payouts'}
      </span>
    </div>
  )
}
