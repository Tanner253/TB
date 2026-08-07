import connectDB from '@/lib/db'
import { Payout } from '@/lib/db/models'
import { tenantFilter } from '@/lib/tenant/scope'

export interface TenantPayoutStats {
  total_cycles: number
  total_distributed_usd: number
  total_distributed_sol: number
  successful_winner_payouts: number
  average_payout_usd: number
  last_payout_at: Date | null
  most_wins: { wallet: string; win_count: number } | null
}

/** Tenant-scoped payout metrics from MongoDB (serverless-safe). */
export async function fetchTenantPayoutStats(): Promise<TenantPayoutStats> {
  await connectDB()

  const payouts = await Payout.find(tenantFilter()).sort({ createdAt: -1 }).lean()
  const successful = payouts.filter(p => p.status === 'success')
  const winnerPayouts = successful.filter(p => p.rank > 0)

  const cycleSet = new Set<number>()
  for (const p of winnerPayouts) {
    cycleSet.add(p.cycle)
  }

  const totalDistributedUsd = winnerPayouts.reduce((sum, p) => sum + (p.amount || 0), 0)
  const totalDistributedSol = winnerPayouts.reduce((sum, p) => sum + (p.amountTokens || 0), 0)
  const winnerCount = winnerPayouts.length

  const winCountByWallet = new Map<string, number>()
  for (const p of winnerPayouts) {
    winCountByWallet.set(p.wallet, (winCountByWallet.get(p.wallet) ?? 0) + 1)
  }

  let mostWins: { wallet: string; win_count: number } | null = null
  for (const [wallet, win_count] of winCountByWallet) {
    if (!mostWins || win_count > mostWins.win_count) {
      mostWins = { wallet, win_count }
    }
  }

  const lastPayoutAt =
    successful.length > 0
      ? successful.reduce(
          (latest, p) => (p.createdAt > latest ? p.createdAt : latest),
          successful[0].createdAt
        )
      : null

  return {
    total_cycles: cycleSet.size,
    total_distributed_usd: totalDistributedUsd,
    total_distributed_sol: totalDistributedSol,
    successful_winner_payouts: winnerCount,
    average_payout_usd: winnerCount > 0 ? totalDistributedUsd / winnerCount : 0,
    last_payout_at: lastPayoutAt,
    most_wins: mostWins,
  }
}
