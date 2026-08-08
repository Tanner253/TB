import { config } from '@/lib/config'
import { isPoolFundedForPayout, minPoolForPayoutLabel } from '@/lib/payout/poolMinimum'
import type { TenantDiagnosticsInput } from '@/lib/tenant/diagnostics'

export type SessionStatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'loading'

/** One-line status for toast / banner — not a diagnostic wall. */
export interface SessionStatus {
  tone: SessionStatusTone
  message: string
  /** Stay visible until dismissed or the underlying issue clears */
  persistent: boolean
}

/**
 * Pick a single user-facing status message.
 * Returns null when the session is healthy and the countdown UI is enough.
 */
export function deriveSessionStatus(input: TenantDiagnosticsInput): SessionStatus | null {
  const {
    pool,
    timer,
    trackedHolders,
    holdersWithVwap,
    eligibleCount,
    hasRankings,
  } = input

  if (!pool.available || !pool.payoutWalletAddress) {
    return {
      tone: 'error',
      message: 'Payout wallet unavailable — check operator configuration',
      persistent: true,
    }
  }

  if (pool.walletSol <= 0) {
    return {
      tone: 'error',
      message: 'Add SOL to the payout wallet to enable rewards',
      persistent: true,
    }
  }

  if (!isPoolFundedForPayout(pool)) {
    return {
      tone: 'warning',
      message:
        pool.walletSol > 0
          ? `Reward pool is ${pool.poolUsdFormatted} — add SOL until the pool reaches ${minPoolForPayoutLabel()} to run payout cycles`
          : `Add at least ${minPoolForPayoutLabel()} to the payout wallet to enable rewards`,
      persistent: true,
    }
  }

  if (!priceAvailable(input)) {
    return {
      tone: 'loading',
      message: 'Waiting for live price feed…',
      persistent: false,
    }
  }

  if (!hasRankings || trackedHolders === 0) {
    if (hasRankings && holdersWithVwap > 0) {
      return {
        tone: 'loading',
        message: 'Refreshing holder list from chain…',
        persistent: false,
      }
    }
    if (!hasRankings || holdersWithVwap === 0) {
      return {
        tone: 'loading',
        message: 'Indexing holders from chain…',
        persistent: false,
      }
    }
  }

  if (trackedHolders > 0 && holdersWithVwap === 0) {
    return {
      tone: 'loading',
      message: 'Loading buy history…',
      persistent: false,
    }
  }

  if (eligibleCount > 0 && timer.timer_status === 'active') {
    if (timer.seconds_remaining != null && timer.seconds_remaining <= 0) {
      return {
        tone: 'success',
        message: 'Sending payouts to top losers…',
        persistent: false,
      }
    }
    return null
  }

  if (eligibleCount > 0 && timer.timer_status === 'waiting') {
    return {
      tone: 'success',
      message: `${eligibleCount} eligible — payout timer starting`,
      persistent: false,
    }
  }

  return null
}

function priceAvailable(input: TenantDiagnosticsInput): boolean {
  return input.priceAvailable !== false
}
