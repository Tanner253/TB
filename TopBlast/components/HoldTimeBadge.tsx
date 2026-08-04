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
  firstBuyAt?: string | null
  minHoldMinutes?: number
}

function resolveHoldEligibleAt(
  holdEligibleAt?: string | null,
  firstBuyAt?: string | null,
  minHoldMinutes: number = 15
): string | null {
  if (holdEligibleAt) return holdEligibleAt
  if (!firstBuyAt) return null
  const eligibleMs = new Date(firstBuyAt).getTime() + minHoldMinutes * 60 * 1000
  if (eligibleMs <= Date.now()) return null
  return new Date(eligibleMs).toISOString()
}

export function HolderStatus({
  isEligible,
  ineligibleReason,
  holdEligibleAt,
  holdSecondsRemaining,
  firstBuyAt,
  minHoldMinutes = 15,
}: HolderStatusProps) {
  const resolvedHoldEligibleAt = resolveHoldEligibleAt(
    holdEligibleAt,
    firstBuyAt,
    minHoldMinutes
  )
  const showHoldCountdown =
    (holdSecondsRemaining ?? 0) > 0 ||
    (resolvedHoldEligibleAt != null && secondsUntil(resolvedHoldEligibleAt) > 0)

  if (isEligible) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rh-green/20 text-rh-green text-xs rounded-full">
        ✓ Eligible
      </span>
    )
  }

  if (ineligibleReason === 'Loading transaction history...' || ineligibleReason === 'Recalculating...') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/15 text-blue-300 text-xs rounded-full">
        Analyzing wallet...
      </span>
    )
  }

  if (showHoldCountdown) {
    return (
      <div className="flex flex-col items-center gap-1">
        <HoldTimeBadge
          holdEligibleAt={resolvedHoldEligibleAt}
          holdSecondsRemaining={holdSecondsRemaining}
        />
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
