/**
 * Hands-off background cycle for a tenant: index rankings, advance timer, execute payout when due.
 * Used by multi-tenant cron — no leaderboard traffic required.
 */

import {
  ensureRankingsIndexed,
  loadRankingsFromDb,
} from '@/lib/tracker/holderService'
import { getTokenPrice } from '@/lib/solana/price'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import {
  ensureTimerStateSync,
  maybeStartPayoutTimer,
  syncPayoutTimerWithEligibility,
  isPayoutDue,
  maybeExecuteDuePayout,
  getPayoutTimerInfo,
  getCurrentPayoutCycle,
} from '@/lib/payout/executor'
import { config } from '@/lib/config'

export interface TenantCycleResult {
  indexed: boolean
  eligibleCount: number
  timerStatus: string
  payoutAttempted: boolean
  payoutSuccess?: boolean
  payoutError?: string | null
}

export async function runAutomatedTenantCycle(): Promise<TenantCycleResult> {
  await ensureTimerStateSync()

  const indexed = await ensureRankingsIndexed()
  const dbRankings = await loadRankingsFromDb()

  const liveTokenPrice =
    (config.tokenMint ? await getTokenPrice(config.tokenMint) : null) ??
    dbRankings?.tokenPrice ??
    0

  const livePool = await getLivePoolBalance()

  let eligibleCount = 0
  if (dbRankings?.rankings?.length) {
    const lastWinByWallet = await loadLastWinCycleByWallet(
      dbRankings.rankings.map(h => h.wallet)
    )
    eligibleCount = dbRankings.rankings.filter(h => {
      if (h.isContract || isExcludedParticipantWallet(h.wallet)) return false
      const firstBuyMs = h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null
      const lastWinCycle = lastWinByWallet.get(h.wallet) ?? h.lastWinCycle ?? null
      const live = evaluateHolderEligibility({
        wallet: h.wallet,
        balance: h.balance,
        vwap: h.vwap || null,
        tokenPrice: liveTokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: h.hasSold ?? false,
        hasTransferredOut: h.hasTransferredOut ?? false,
        lastWinCycle,
        totalTokensBought: h.totalTokensBought ?? 0,
        poolUsd: livePool.poolUsd,
        currentCycle: getCurrentPayoutCycle(),
      })
      return live.isEligible
    }).length
  }

  await maybeStartPayoutTimer(eligibleCount)
  await syncPayoutTimerWithEligibility(eligibleCount)
  await ensureTimerStateSync()

  const timer = getPayoutTimerInfo()

  if (
    isPayoutDue() &&
    timer.timer_status === 'active' &&
    dbRankings &&
    eligibleCount > 0
  ) {
    const result = await maybeExecuteDuePayout(eligibleCount)
    await ensureTimerStateSync()
    return {
      indexed,
      eligibleCount,
      timerStatus: getPayoutTimerInfo().timer_status,
      payoutAttempted: true,
      payoutSuccess: result.success,
      payoutError: result.error,
    }
  }

  return {
    indexed,
    eligibleCount,
    timerStatus: timer.timer_status,
    payoutAttempted: false,
  }
}
