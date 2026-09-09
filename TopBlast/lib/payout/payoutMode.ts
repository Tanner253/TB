/**
 * Per-listing payout currency.
 *
 *  - 'token' (default): each cycle the pool SOL market-buys the session token
 *    via Jupiter (on-chart volume, tracked as Gen volume), then the purchased
 *    tokens are airdropped to winners.
 *  - 'sol': winners are paid SOL straight from the pool — no buyback, no
 *    airdrop, nothing sold or bought on the chart.
 *
 * Chosen at launch per listing. The PAYOUT_AS_NATIVE_TOKEN env only sets the
 * default for env-driven sessions (platform token / operator manual listing)
 * and the legacy single-tenant mode.
 */

export type PayoutMode = 'token' | 'sol'

export const DEFAULT_PAYOUT_MODE: PayoutMode = 'token'

export const PAYOUT_MODES: PayoutMode[] = ['token', 'sol']

export function isPayoutMode(value: unknown): value is PayoutMode {
  return value === 'token' || value === 'sol'
}

/** Coerce arbitrary input (launch form / API body) to a valid mode. */
export function validatePayoutMode(value: unknown): PayoutMode {
  if (value == null || value === '') return DEFAULT_PAYOUT_MODE
  if (typeof value === 'string' && isPayoutMode(value.trim().toLowerCase())) {
    return value.trim().toLowerCase() as PayoutMode
  }
  throw new Error("Payout currency must be 'token' or 'sol'")
}

/** Env-driven default for sessions without a Mongo row (and legacy mode). */
export function envDefaultPayoutMode(): PayoutMode {
  const raw = process.env.PAYOUT_AS_NATIVE_TOKEN?.trim().toLowerCase()
  if (raw === 'false' || raw === '0') return 'sol'
  return 'token'
}

/** Short human label, e.g. for catalog badges. */
export function payoutModeLabel(mode: PayoutMode, tokenSymbol?: string): string {
  return mode === 'sol' ? 'SOL payouts' : `$${tokenSymbol || 'TOKEN'} airdrops`
}
