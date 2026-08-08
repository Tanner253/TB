import { formatTokenBalance } from '@/lib/solana/tokenAmount'
import { formatUsd } from '@/lib/solana/price'

export type PayoutAmountAsset = 'sol' | 'token'

export function resolvePayoutAmountAsset(
  rank: number,
  amountTokens: number,
  amountUsd: number
): PayoutAmountAsset {
  if (rank === 0) return 'sol'
  if (amountTokens <= 0) return 'token'
  const impliedUnitPrice = amountUsd / amountTokens
  // Session tokens are far cheaper than SOL; SOL winner payouts imply ~$50+ per unit.
  return impliedUnitPrice < 0.05 ? 'token' : 'sol'
}

export function formatPayoutAmount(amount: number, asset: PayoutAmountAsset): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'

  if (asset === 'token') {
    return formatTokenBalance(amount)
  }

  if (amount >= 1) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
}

export function formatHistoryUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0.00'
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatHistoryUsdLabel(amount: number): string {
  return formatUsd(amount)
}
