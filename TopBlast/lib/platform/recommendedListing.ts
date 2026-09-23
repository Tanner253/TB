import { DEFAULT_PAYOUT_INTERVAL_MINUTES } from '@/lib/platform/payoutIntervals'
import { DEFAULT_WINNER_COUNT } from '@/lib/payout/winnerCount'

/**
 * The listing setup TopBlast recommends, mirroring the platform token.
 *
 * These are not arbitrary defaults — this is the exact configuration the
 * $TOPBLAST session runs on, and the only one that has executed a full payout
 * cycle in production. A creator copying it gets the path with the most
 * mileage on it.
 *
 * Only `minTokenHolding` differs from the form's own defaults: 1,000 is a safe
 * floor for any supply, while 100,000 is the right bar for the 1B-supply tokens
 * Pons launches — low enough to be reachable, high enough that dust wallets do
 * not crowd the leaderboard.
 */
export const RECOMMENDED_LISTING = {
  winnerCount: DEFAULT_WINNER_COUNT,
  payoutIntervalMinutes: DEFAULT_PAYOUT_INTERVAL_MINUTES,
  minTokenHolding: 100_000,
  payoutMode: 'token' as const,
}

export const RECOMMENDED_LISTING_WHY =
  'Matches the $TOPBLAST platform session — 3 winners on a 15-minute cycle, ' +
  'paid by buying the token on its own curve so every payout lands as buy ' +
  'volume on the chart.'
