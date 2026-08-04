/** Minimum time after first buy before a holder can qualify for drawdown ranking. */
export const MIN_HOLD_DURATION_MINUTES = 15

export function formatHoldDuration(minutes: number): string {
  if (minutes <= 0) return '0 min'
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hrs} hr ${mins} min`
}

/** Unix ms when hold requirement is satisfied. */
export function getHoldEligibleAt(
  firstBuyTimestamp: number,
  minHoldMinutes: number = MIN_HOLD_DURATION_MINUTES
): number {
  return firstBuyTimestamp + minHoldMinutes * 60 * 1000
}

/** Seconds until hold requirement is met; null if first buy unknown, 0 if already satisfied. */
export function getHoldSecondsRemaining(
  firstBuyTimestamp: number | null | undefined,
  minHoldMinutes: number = MIN_HOLD_DURATION_MINUTES,
  now: number = Date.now()
): number | null {
  if (!firstBuyTimestamp) return null
  const remainingMs = getHoldEligibleAt(firstBuyTimestamp, minHoldMinutes) - now
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

export function formatHoldCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
