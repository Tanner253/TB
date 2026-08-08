/** Shorter countdown after a failed payout attempt (winners still eligible). */
export function getPayoutFailureRetryMinutes(): number {
  const raw = parseInt(process.env.PAYOUT_FAILURE_RETRY_MINUTES || '3', 10)
  if (!Number.isFinite(raw) || raw < 1) return 3
  return Math.min(raw, 60)
}

/** Max Jupiter swap attempts per payout cycle (escalating slippage each try). */
export function getPayoutSwapMaxRetries(): number {
  const raw = parseInt(process.env.PAYOUT_SWAP_MAX_RETRIES || '3', 10)
  if (!Number.isFinite(raw) || raw < 1) return 3
  return Math.min(raw, 5)
}

export function getEffectivePayoutIntervalMinutes(
  normalIntervalMinutes: number,
  failedAttempts: number
): number {
  if (failedAttempts <= 0) return normalIntervalMinutes
  return Math.min(getPayoutFailureRetryMinutes(), normalIntervalMinutes)
}
