import { formatWallet } from '@/lib/solana/holders'
import { calculateDrawdown } from '@/lib/engine/calculations'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import { getCurrentPayoutCycle } from '@/lib/payout/executor'
import { loadRankingsFromDb } from '@/lib/tracker/holderService'

export interface SessionHolderStats {
  total: number
  tracked: number
  with_vwap: number
  eligible: number
  in_profit: number
  in_loss: number
  deepest_drawdown: {
    wallet_display: string
    drawdown_pct: number
  } | null
  last_calculated: string | null
  has_rankings: boolean
}

/** Holder breakdown from CurrentRankings + live eligibility (no in-memory cache). */
export async function buildSessionHolderStats(
  tokenPrice: number | null,
  poolUsd: number
): Promise<SessionHolderStats> {
  const dbRankings = await loadRankingsFromDb()
  const sourceRankings =
    dbRankings?.rankings.filter(
      h => !h.isContract && !isExcludedParticipantWallet(h.wallet)
    ) ?? []

  let withVwap = 0
  let eligible = 0
  let inProfit = 0
  let inLoss = 0
  let deepestDrawdown: { wallet: string; pct: number } | null = null

  if (sourceRankings.length > 0 && tokenPrice && tokenPrice > 0) {
    const lastWinByWallet = await loadLastWinCycleByWallet(
      sourceRankings.map(h => h.wallet)
    )
    const currentCycle = getCurrentPayoutCycle()

    for (const h of sourceRankings) {
      const vwap = h.vwap ?? 0
      if (vwap > 0) {
        withVwap++
        if (tokenPrice >= vwap) {
          inProfit++
        } else {
          inLoss++
          const drawdownPct = calculateDrawdown(vwap, tokenPrice)
          if (!deepestDrawdown || drawdownPct < deepestDrawdown.pct) {
            deepestDrawdown = { wallet: h.wallet, pct: drawdownPct }
          }
        }
      }

      const firstBuyMs = h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null
      const live = evaluateHolderEligibility({
        wallet: h.wallet,
        balance: h.balance,
        vwap: vwap || null,
        tokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: h.hasSold ?? false,
        hasTransferredOut: h.hasTransferredOut ?? false,
        lastWinCycle: lastWinByWallet.get(h.wallet) ?? h.lastWinCycle ?? null,
        totalTokensBought: h.totalTokensBought ?? 0,
        poolUsd,
        currentCycle,
      })
      if (live.isEligible) eligible++
    }
  }

  return {
    total: dbRankings?.reportedHolderCount ?? dbRankings?.totalHolders ?? sourceRankings.length,
    tracked: sourceRankings.length,
    with_vwap: withVwap,
    eligible,
    in_profit: inProfit,
    in_loss: inLoss,
    deepest_drawdown: deepestDrawdown
      ? {
          wallet_display: formatWallet(deepestDrawdown.wallet),
          drawdown_pct: Math.round(deepestDrawdown.pct * 100) / 100,
        }
      : null,
    last_calculated: dbRankings?.lastCalculated
      ? new Date(dbRankings.lastCalculated).toISOString()
      : null,
    has_rankings: sourceRankings.length > 0,
  }
}
