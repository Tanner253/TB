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

/**
 * Seconds until a hold deadline, recomputed on a tick.
 *
 * Computing this once per render looks right and is frozen in practice: the
 * parent only re-renders on the 60s leaderboard poll, so "Eligible in 2:33"
 * sat unchanged for a minute at a time and read as broken. Deriving from the
 * timestamp on every tick also means a throttled or sleeping tab catches up
 * the moment it comes back, rather than resuming where it left off.
 */
function useHoldCountdown(eligibleAt: string | null, fallbackSeconds?: number | null): number {
  const [seconds, setSeconds] = useState(() =>
    eligibleAt ? secondsUntil(eligibleAt) : fallbackSeconds ?? 0
  )

  useEffect(() => {
    if (!eligibleAt) {
      setSeconds(fallbackSeconds ?? 0)
      return
    }
    const sync = () => setSeconds(secondsUntil(eligibleAt))
    sync()
    const id = setInterval(sync, 250)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [eligibleAt, fallbackSeconds])

  return seconds
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
      const sync = () => setRemaining(secondsUntil(holdEligibleAt))
      const id = setInterval(sync, 250)
      document.addEventListener('visibilitychange', sync)
      return () => {
        clearInterval(id)
        document.removeEventListener('visibilitychange', sync)
      }
    }
    if (holdSecondsRemaining != null && holdSecondsRemaining > 0) {
      // No absolute timestamp here, so anchor one now and subtract from it —
      // decrementing loses whatever time the tab spends throttled.
      const deadline = Date.now() + holdSecondsRemaining * 1000
      const sync = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
      sync()
      const id = setInterval(sync, 250)
      document.addEventListener('visibilitychange', sync)
      return () => {
        clearInterval(id)
        document.removeEventListener('visibilitychange', sync)
      }
    }
  }, [holdEligibleAt, holdSecondsRemaining])

  if (remaining <= 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs rounded-full font-mono tabular-nums ${className}`}
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

export function HolderIneligibleCallout({
  ineligibleReason,
  holdEligibleAt,
  holdSecondsRemaining,
  firstBuyAt,
  minHoldMinutes = 15,
  className = '',
}: HolderStatusProps) {
  const resolvedHoldEligibleAt = resolveHoldEligibleAt(
    holdEligibleAt,
    firstBuyAt,
    minHoldMinutes
  )
  const holdRemaining = useHoldCountdown(resolvedHoldEligibleAt, holdSecondsRemaining)
  const showHold = holdRemaining > 0

  const reason = ineligibleReason || 'Not eligible yet'
  const isLoading =
    reason === 'Loading transaction history...' || reason === 'Recalculating...'

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        isLoading
          ? 'border-blue-500/25 bg-blue-500/10 text-blue-200'
          : showHold
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-line bg-ink/[0.04] text-ink-2'
      } ${className}`}
      role="status"
    >
      {showHold ? (
        <p className="font-medium text-amber-700 dark:text-amber-200 mb-0.5">
          Eligible in {formatHoldCountdown(holdRemaining)}
        </p>
      ) : null}
      <p>{isLoading ? 'Analyzing wallet on-chain…' : reason}</p>
    </div>
  )
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
  // Ticks too, so the badge clears the moment the hold completes rather than
  // lingering until the next poll.
  const liveHoldRemaining = useHoldCountdown(resolvedHoldEligibleAt, holdSecondsRemaining)
  const showHoldCountdown = liveHoldRemaining > 0

  if (isEligible) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rh-green/20 text-rh-green text-xs rounded-full">
        ✓ Eligible
      </span>
    )
  }

  if (ineligibleReason === 'Loading transaction history...' || ineligibleReason === 'Recalculating...') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs rounded-full">
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
      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-ink-2 text-xs rounded-full"
      title={ineligibleReason || 'Not eligible'}
    >
      {ineligibleReason || 'Not eligible'}
    </span>
  )
}
