import { resolvePayoutAmountAsset } from '@/lib/payout/historyFormat'

export interface PayoutTotals {
  total_usd: number
  total_sol: number
}

type PayoutRow = {
  rank: number
  amount: number
  amountTokens: number
  status: string
}

/** Sum successful payout records — source of truth for paid out; gen volume mirrors this. */
export function aggregateSuccessfulPayoutTotals(
  payouts: PayoutRow[],
  options: { winnersOnly?: boolean } = {}
): PayoutTotals {
  const { winnersOnly = false } = options
  let total_usd = 0
  let total_sol = 0

  for (const p of payouts) {
    if (p.status !== 'success') continue
    if (winnersOnly && p.rank <= 0) continue

    const amountUsd = p.amount || 0
    const amountTokens = p.amountTokens || 0
    total_usd += amountUsd

    const asset = resolvePayoutAmountAsset(p.rank, amountTokens, amountUsd)
    if (asset === 'sol') {
      total_sol += amountTokens
    }
  }

  return { total_usd, total_sol }
}
