export type PayoutTimerStatus = 'waiting' | 'active'

/** Shared countdown math for executor + catalog (Mongo TimerState fields). */
export function computePayoutSecondsRemaining(input: {
  timerStatus: PayoutTimerStatus
  lastPayoutTime: Date | string | null | undefined
  payoutIntervalMinutes: number
  now?: number
}): number | null {
  if (input.timerStatus !== 'active') return null

  const intervalSeconds = input.payoutIntervalMinutes * 60
  if (!input.lastPayoutTime) return intervalSeconds

  const lastMs = new Date(input.lastPayoutTime).getTime()
  if (!Number.isFinite(lastMs)) return intervalSeconds

  const now = input.now ?? Date.now()
  const elapsedMs = now - lastMs
  const intervalMs = input.payoutIntervalMinutes * 60 * 1000
  return Math.max(0, Math.floor((intervalMs - elapsedMs) / 1000))
}

export function formatPayoutCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
