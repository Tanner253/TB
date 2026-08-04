'use client'

import { useEffect, useState } from 'react'
import { formatHoldCountdown } from '@/lib/eligibility/holdDuration'

interface HoldTimeBadgeProps {
  holdEligibleAt?: string | null
  holdSecondsRemaining?: number | null
  className?: string
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000))
}

export function HoldTimeBadge({
  holdEligibleAt,
  holdSecondsRemaining,
  className = '',
}: HoldTimeBadgeProps) {
  const initial =
    holdEligibleAt != null
      ? secondsUntil(holdEligibleAt)
      : holdSecondsRemaining ?? 0

  const [remaining, setRemaining] = useState(initial)

  useEffect(() => {
    if (holdEligibleAt) {
      setRemaining(secondsUntil(holdEligibleAt))
      const id = setInterval(() => setRemaining(secondsUntil(holdEligibleAt)), 1000)
      return () => clearInterval(id)
    }
    if (holdSecondsRemaining != null && holdSecondsRemaining > 0) {
      setRemaining(holdSecondsRemaining)
      const id = setInterval(() => {
        setRemaining((prev) => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(id)
    }
  }, [holdEligibleAt, holdSecondsRemaining])

  if (remaining <= 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 text-amber-300 text-xs rounded-full font-mono tabular-nums ${className}`}
      title="Minimum hold time before eligibility"
    >
      <span className="text-amber-400/80">⏳</span>
      Eligible in {formatHoldCountdown(remaining)}
    </span>
  )
}

interface HolderStatusProps {
  isEligible: boolean
  ineligibleReason?: string | null
  holdEligibleAt?: string | null
  holdSecondsRemaining?: number | null
}

export function HolderStatus({
  isEligible,
  ineligibleReason,
  holdEligibleAt,
  holdSecondsRemaining,
}: HolderStatusProps) {
  const showHoldCountdown =
    (holdSecondsRemaining ?? 0) > 0 ||
    (holdEligibleAt != null && secondsUntil(holdEligibleAt) > 0)

  if (isEligible) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rh-green/20 text-rh-green text-xs rounded-full">
        ✓ Eligible
      </span>
    )
  }

  if (showHoldCountdown) {
    return (
      <div className="flex flex-col items-center gap-1">
        <HoldTimeBadge
          holdEligibleAt={holdEligibleAt}
          holdSecondsRemaining={holdSecondsRemaining}
        />
        {ineligibleReason && ineligibleReason !== 'Hold duration not met' && (
          <span
            className="text-[10px] text-gray-500 max-w-[140px] truncate"
            title={ineligibleReason}
          >
            {ineligibleReason}
          </span>
        )}
      </div>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full"
      title={ineligibleReason || 'Not eligible'}
    >
      {ineligibleReason || 'Not eligible'}
    </span>
  )
}
