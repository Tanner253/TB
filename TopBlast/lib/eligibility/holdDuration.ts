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
