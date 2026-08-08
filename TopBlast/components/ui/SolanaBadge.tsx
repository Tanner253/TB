'use client'

import Image from 'next/image'

type SolanaBadgeProps = {
  compact?: boolean
  className?: string
}

/** Solana chain branding — purple / mint gradient mark */
export function SolanaBadge({ compact = false, className = '' }: SolanaBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-sol-purple/40 bg-sol-purple/10 px-3 py-1.5 text-sol-mint shadow-[0_0_12px_rgba(153,69,255,0.2)] ${className}`}
      title="TopBlast on Solana · on-chart buybacks + token airdrops"
    >
      <Image
        src="/solana-logo.svg"
        alt="Solana"
        width={compact ? 18 : 22}
        height={compact ? 14 : 17}
        className="shrink-0"
      />
      <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
        {compact ? 'Solana · Volume' : 'Live on Solana · Chart Volume Engine'}
      </span>
    </div>
  )
}
