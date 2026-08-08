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
