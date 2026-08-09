/**
 * Hands-off background cycle for a tenant: index rankings, advance timer, execute payout when due.
 * Used by multi-tenant cron — no leaderboard traffic required.
 */

import {
  ensureRankingsIndexed,
  loadRankingsFromDb,
  ensureRankingsVwapProgress,
  payoutBlockedByPendingVwap,
} from '@/lib/tracker/holderService'
import { getTokenPrice } from '@/lib/solana/price'
import {
  workerVwapHydrateMaxPerCycle,
  workerVwapHydrateConcurrency,
  workerVwapHydrateBatchesPerCycle,
} from '@/lib/platform/heliusLimits'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import {
  ensureTimerStateSync,
  syncPayoutTimerWithPayableWinners,
  isPayoutDue,
  maybeExecuteDuePayout,
  getPayoutTimerInfo,
  getCurrentPayoutCycle,
  resolveLivePayableWinners,
} from '@/lib/payout/executor'
import { config } from '@/lib/config'
import { collectPumpCreatorFeesForActiveTenant } from '@/lib/pump/maybeCollectOnPoll'
import { isPumpAutoCollectEnabled } from '@/lib/pump/config'

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

  if (isPumpAutoCollectEnabled()) {
    try {
      await collectPumpCreatorFeesForActiveTenant()
    } catch (err) {
      console.warn('[TenantCycle] Pump creator fee collect:', err)
    }
  }

  const indexed = await ensureRankingsIndexed()
  let dbRankings = await loadRankingsFromDb()

  const liveTokenPrice =
    (config.tokenMint ? await getTokenPrice(config.tokenMint) : null) ??
    dbRankings?.tokenPrice ??
    0

  if (dbRankings?.rankings?.length) {
    const hydrateOpts = {
      maxWallets: workerVwapHydrateMaxPerCycle(),
      tokenPrice: liveTokenPrice,
      concurrency: workerVwapHydrateConcurrency(),
    }
    for (let batch = 0; batch < workerVwapHydrateBatchesPerCycle(); batch++) {
      const progress = await ensureRankingsVwapProgress(hydrateOpts)
      dbRankings = (await loadRankingsFromDb()) ?? dbRankings
      if (progress.stillPending === 0) break
    }
  }

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

  const { verifiedPayableCount } = await syncPayoutTimerWithPayableWinners(eligibleCount)
  await ensureTimerStateSync()

  const timer = getPayoutTimerInfo()

  if (isPayoutDue() && timer.timer_status === 'active' && dbRankings) {
    if (payoutBlockedByPendingVwap(dbRankings.rankings, config.winnerCount)) {
      console.warn(
        '[TenantCycle] Payout deferred — buy history still loading for top-ranked holders'
      )
      return {
        indexed,
        eligibleCount,
        timerStatus: timer.timer_status,
        payoutAttempted: false,
      }
    }

    const payableCount = Math.max(verifiedPayableCount, eligibleCount)
    const liveWinners =
      payableCount > 0 ? null : await resolveLivePayableWinners(config.winnerCount)
    const result = await maybeExecuteDuePayout(
      Math.max(payableCount, liveWinners?.length ?? 0, 1),
      liveWinners && liveWinners.length > 0 ? liveWinners : undefined
    )
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
