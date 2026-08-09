import {
  DEFAULT_WINNER_COUNT,
  MAX_WINNER_COUNT,
  MIN_WINNER_COUNT,
  validateWinnerCount,
} from '@/lib/payout/winnerCount'

/** Legacy 3-winner split — preserved for existing listings and backward compat. */
const PRESET_THREE = [0.6, 0.25, 0.15] as const

const SUM_EPSILON = 1e-9

/** Descending linear weights: rank 1 (biggest loser) gets the largest share. */
export function getWinnerShareFractions(winnerCount: number = DEFAULT_WINNER_COUNT): number[] {
  const n = validateWinnerCount(winnerCount)
  if (n === 3) {
    return [...PRESET_THREE]
  }

  const weights = Array.from({ length: n }, (_, i) => n - i)
  const total = weights.reduce((sum, w) => sum + w, 0)
  const fractions = weights.map(w => w / total)
  assertWinnerSharesSum(fractions)
  assertDescending(fractions)
  return fractions
}

function assertWinnerSharesSum(fractions: number[]): void {
  const sum = fractions.reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1) > SUM_EPSILON) {
    throw new Error(`Winner share fractions must sum to 1, got ${sum}`)
  }
}

function assertDescending(fractions: number[]): void {
  for (let i = 1; i < fractions.length; i++) {
    if (fractions[i] >= fractions[i - 1]) {
      throw new Error('Winner shares must descend by rank (biggest loser gets most)')
    }
  }
}

/** Integer percent labels for UI (may not sum to exactly 100 — display only). */
export function getWinnerShareDisplayPercents(winnerCount: number = DEFAULT_WINNER_COUNT): number[] {
  return getWinnerShareFractions(winnerCount).map(f => Math.round(f * 100))
}

export function formatWinnerSharePercents(winnerCount: number = DEFAULT_WINNER_COUNT): string {
  return getWinnerShareDisplayPercents(winnerCount).join('/')
}

/** Legacy object shape for 3-winner UIs. */
export function getWinnerSharePercentsLegacy(winnerCount: number = DEFAULT_WINNER_COUNT) {
  const percents = getWinnerShareDisplayPercents(winnerCount)
  return {
    first: percents[0] ?? 0,
    second: percents[1] ?? 0,
    third: percents[2] ?? 0,
  }
}

export function isValidWinnerCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_WINNER_COUNT &&
    value <= MAX_WINNER_COUNT
  )
}
