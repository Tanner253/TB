/** Winners per payout cycle — set at listing launch (immutable). */

export const MIN_WINNER_COUNT = 3
export const MAX_WINNER_COUNT = 10
export const DEFAULT_WINNER_COUNT = 3

/** Base USD minimum pool at 3 winners; scales with extra winner slots. */
const BASE_MIN_POOL_USD = 5
const MIN_POOL_USD_PER_EXTRA_WINNER = 1.25

export function clampWinnerCount(value: number): number {
  return Math.min(MAX_WINNER_COUNT, Math.max(MIN_WINNER_COUNT, Math.round(value)))
}

export function validateWinnerCount(input?: number): number {
  const count = input ?? DEFAULT_WINNER_COUNT
  if (!Number.isFinite(count) || count < MIN_WINNER_COUNT || count > MAX_WINNER_COUNT) {
    throw new Error(`Winner count must be between ${MIN_WINNER_COUNT} and ${MAX_WINNER_COUNT}`)
  }
  return Math.round(count)
}

/** Dynamic minimum pool USD — more winners need more SOL for transfers + swap. */
export function minPoolForWinnerCount(winnerCount: number): number {
  const n = validateWinnerCount(winnerCount)
  const usd = BASE_MIN_POOL_USD + (n - MIN_WINNER_COUNT) * MIN_POOL_USD_PER_EXTRA_WINNER
  return Math.round(usd * 100) / 100
}

export function formatWinnerCountLabel(count: number): string {
  const n = clampWinnerCount(count)
  return n === 1 ? '1 winner' : `top ${n}`
}

export const WINNER_COUNT_OPTIONS = Array.from(
  { length: MAX_WINNER_COUNT - MIN_WINNER_COUNT + 1 },
  (_, i) => MIN_WINNER_COUNT + i
)
