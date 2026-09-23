import { config } from '@/lib/config'
import { formatUsd } from '@/lib/solana/price'
import type { LivePoolBalance } from '@/lib/payout/poolBalance'

/** Flat USD minimum — payout cycles must not start or run below this. */
export function minPoolForPayoutUsd(): number {
  return config.minPoolForPayout
}

export function minPoolForPayoutLabel(): string {
  return formatUsd(minPoolForPayoutUsd())
}

/** Live USD value of SOL in the listing payout wallet at fetch time (DexScreener → pool.solPrice). */
export function payoutWalletUsd(pool: LivePoolBalance): number {
  if (!pool.solPrice || pool.solPrice <= 0) return 0
  return pool.walletSol * pool.solPrice
}

export function isPoolFundedForPayout(pool: LivePoolBalance): boolean {
  if (!pool.available || !pool.payoutWalletAddress || pool.walletSol <= 0) {
    return false
  }
  if (!pool.solPrice || pool.solPrice <= 0) {
    return false
  }
  return payoutWalletUsd(pool) >= minPoolForPayoutUsd()
}

/**
 * True only when we could actually price the pool.
 *
 * `isPoolFundedForPayout` answers "may a cycle run", so it fails closed on a
 * missing native price — the right call for spending money. But a failed price
 * lookup is NOT evidence the wallet is empty, and treating it as such paused
 * the countdown every time the price feed hiccuped, restarting it from the full
 * interval so a cycle could never reach zero. Anything that *pauses* on
 * underfunding must check this first.
 */
export function poolFundingIsKnown(pool: LivePoolBalance): boolean {
  return Boolean(pool.available && pool.payoutWalletAddress && pool.solPrice && pool.solPrice > 0)
}

/** Priced, and genuinely below the bar — the only safe reason to pause a timer. */
export function isPoolConfirmedBelowMinimum(pool: LivePoolBalance): boolean {
  if (!poolFundingIsKnown(pool)) return false
  return payoutWalletUsd(pool) < minPoolForPayoutUsd()
}
