import connectDB from '@/lib/db'
import { Payout } from '@/lib/db/models'
import { formatPayoutAmount, resolvePayoutAmountAsset } from '@/lib/payout/historyFormat'
import { nativeUnitForMint } from '@/lib/platform/chainShape'
import { getTxExplorerUrl } from '@/lib/solana/explorer'

export interface TokenPayoutHighlights {
  token_mint: string
  total_paid_usd: number
  winner_payouts: number
  wallets_paid: number
  cycles_paid: number
  last_paid_at: string | null
  largest: {
    wallet: string
    wallet_display: string
    amount_usd: number
    amount: string
    amount_unit: string
    cycle: number
    drawdown_pct: number | null
    paid_at: string
    explorer_url: string | null
  } | null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Winner payouts for one token: what the leaderboard's highlight strip shows.
 *
 * Keyed by mint rather than tenant, so a session that switched tokens shows
 * only what the current token paid, and the platform session (`_legacy`) needs
 * no special case. Dev fees (rank 0) are not rewards and are left out.
 */
export async function fetchTokenPayoutHighlights(mint: string): Promise<TokenPayoutHighlights> {
  await connectDB()
  const rows = await Payout.find({
    tokenMint: { $regex: `^${escapeRegex(mint.trim())}$`, $options: 'i' },
    status: 'success',
    rank: { $gt: 0 },
  })
    .select('wallet amount amountTokens rank cycle drawdownPct txHash createdAt')
    .lean()

  let total = 0
  let best: (typeof rows)[number] | null = null
  let last: Date | null = null
  const wallets = new Set<string>()
  const cycles = new Set<number>()

  for (const r of rows) {
    const usd = r.amount || 0
    total += usd
    wallets.add(r.wallet.toLowerCase())
    cycles.add(r.cycle)
    if (!best || usd > (best.amount || 0)) best = r
    if (!last || r.createdAt > last) last = r.createdAt
  }

  let largest: TokenPayoutHighlights['largest'] = null
  if (best) {
    const asset = resolvePayoutAmountAsset(best.rank, best.amountTokens || 0, best.amount || 0)
    largest = {
      wallet: best.wallet,
      wallet_display: `${best.wallet.slice(0, 6)}...${best.wallet.slice(-4)}`,
      amount_usd: best.amount || 0,
      amount: formatPayoutAmount(best.amountTokens || 0, asset),
      amount_unit: asset === 'sol' ? nativeUnitForMint(mint) : 'tokens',
      cycle: best.cycle,
      // stored signed (a loss is negative); the UI says "was down N%"
      drawdown_pct: Number.isFinite(best.drawdownPct) ? Math.abs(best.drawdownPct) : null,
      paid_at: new Date(best.createdAt).toISOString(),
      explorer_url: getTxExplorerUrl(best.txHash),
    }
  }

  return {
    token_mint: mint,
    total_paid_usd: total,
    winner_payouts: rows.length,
    wallets_paid: wallets.size,
    cycles_paid: cycles.size,
    last_paid_at: last ? new Date(last).toISOString() : null,
    largest,
  }
}
