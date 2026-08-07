/** Minimum token balance eligibility — set per listing at launch. */

export const DEFAULT_MIN_TOKEN_HOLDING = 1000

export const MIN_TOKEN_HOLDING_FLOOR = 1

/** Upper bound for raw token units (not USD). */
export const MAX_MIN_TOKEN_HOLDING = 1_000_000_000_000

export function validateMinTokenHolding(input?: number): number {
  const value = input ?? DEFAULT_MIN_TOKEN_HOLDING

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('Minimum token balance must be a whole number')
  }

  if (value < MIN_TOKEN_HOLDING_FLOOR || value > MAX_MIN_TOKEN_HOLDING) {
    throw new Error(
      `Minimum token balance must be between ${MIN_TOKEN_HOLDING_FLOOR.toLocaleString()} and ${MAX_MIN_TOKEN_HOLDING.toLocaleString()} tokens`
    )
  }

  return value
}

export function parseMinTokenHoldingInput(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return DEFAULT_MIN_TOKEN_HOLDING
  const value = Number(cleaned)
  return validateMinTokenHolding(value)
}

export function formatMinTokenHolding(value: number): string {
  return value.toLocaleString('en-US')
}
