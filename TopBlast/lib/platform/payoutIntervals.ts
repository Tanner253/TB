/** Supported payout cycle lengths — set per listing at launch. */

export const DEFAULT_PAYOUT_INTERVAL_MINUTES = 15

export interface PayoutIntervalOption {
  minutes: number
  label: string
  description: string
}

export const PAYOUT_INTERVAL_OPTIONS: readonly PayoutIntervalOption[] = [
  { minutes: 15, label: '15 minutes', description: 'Fast cycles — high engagement' },
  { minutes: 30, label: '30 minutes', description: 'Balanced pace for active communities' },
  { minutes: 60, label: '1 hour', description: 'Steady rhythm with less overhead' },
  { minutes: 120, label: '2 hours', description: 'Medium-term holder incentives' },
  { minutes: 240, label: '4 hours', description: 'Lower frequency, larger perceived pots' },
  { minutes: 360, label: '6 hours', description: 'Slow burn — fewer, bigger moments' },
] as const

const ALLOWED_MINUTES = new Set(PAYOUT_INTERVAL_OPTIONS.map(o => o.minutes))

export function isAllowedPayoutIntervalMinutes(minutes: number): boolean {
  return ALLOWED_MINUTES.has(minutes)
}

export function validatePayoutIntervalMinutes(input?: number): number {
  const minutes = input ?? DEFAULT_PAYOUT_INTERVAL_MINUTES
  if (!Number.isFinite(minutes) || !isAllowedPayoutIntervalMinutes(minutes)) {
    const labels = PAYOUT_INTERVAL_OPTIONS.map(o => o.label).join(', ')
    throw new Error(`Payout frequency must be one of: ${labels}`)
  }
  return minutes
}

export function formatPayoutInterval(minutes: number): string {
  const match = PAYOUT_INTERVAL_OPTIONS.find(o => o.minutes === minutes)
  if (match) return match.label
  if (minutes < 60) return `${minutes} minutes`
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return `${minutes} minutes`
}

/** e.g. "15 minutes, 30 minutes, 1 hour, 2 hours, 4 hours, or 6 hours" */
export function formatPayoutIntervalOptionsList(): string {
  const labels = PAYOUT_INTERVAL_OPTIONS.map(o => o.label)
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

export function getPayoutIntervalOption(minutes: number): PayoutIntervalOption | undefined {
  return PAYOUT_INTERVAL_OPTIONS.find(o => o.minutes === minutes)
}

/** Compact label for stat cards, e.g. "15m", "6h" */
export function formatPayoutIntervalCompact(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1h' : `${hours}h`
  }
  return `${minutes}m`
}

/** Hero / catalog shorthand for selectable range */
export const PAYOUT_INTERVAL_RANGE_COMPACT = `${formatPayoutIntervalCompact(PAYOUT_INTERVAL_OPTIONS[0].minutes)}–${formatPayoutIntervalCompact(PAYOUT_INTERVAL_OPTIONS[PAYOUT_INTERVAL_OPTIONS.length - 1].minutes)}`
