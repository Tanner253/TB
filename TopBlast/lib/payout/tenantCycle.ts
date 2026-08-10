/**
 * Hands-off background cycle for a tenant: index rankings, advance timer, execute payout when due.
 * Used by multi-tenant cron — no leaderboard traffic required.
 *
 * Holder data: Birdeye batch snapshot (active ~1/min; idle ~15/min with price gate).
 * Does not change payout signing — only refreshes CurrentRankings in MongoDB.
 */

import { loadRankingsFromDb } from '@/lib/tracker/holderService'
import {
  isBirdeyeHolderSourceEnabled,
  refreshLiveHolderRankings,
} from '@/lib/tracker/birdeyeRankings'
import {
  ensureRankingsIndexed,
  payoutBlockedByPendingVwap,
} from '@/lib/tracker/holderService'
import { getTokenPrice } from '@/lib/solana/price'
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
import { isPoolFundedForPayout } from '@/lib/payout/poolMinimum'

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

  const useBirdeye = isBirdeyeHolderSourceEnabled()

  const timerEarly = getPayoutTimerInfo()
  const livePoolEarly = await getLivePoolBalance()
  let dbRankings = await loadRankingsFromDb()

  const holderSession = {
    timerStatus: timerEarly.timer_status,
    eligibleCount: dbRankings?.eligibleCount ?? 0,
    poolFunded: isPoolFundedForPayout(livePoolEarly),
  }

  let indexed = false
  if (useBirdeye) {
    const snap = await refreshLiveHolderRankings({ force: false, session: holderSession })
    indexed = snap.refreshed || snap.skipped === true
    dbRankings = (await loadRankingsFromDb()) ?? dbRankings
  } else {
    indexed = await ensureRankingsIndexed()
    dbRankings = (await loadRankingsFromDb()) ?? dbRankings
  }

  const liveTokenPrice =
    dbRankings?.tokenPrice ??
    (config.tokenMint ? await getTokenPrice(config.tokenMint) : null) ??
    0

  if (!useBirdeye && dbRankings?.rankings?.length) {
    const { ensureRankingsVwapProgress } = await import('@/lib/tracker/holderService')
    const {
      workerVwapHydrateMaxPerCycle,
      workerVwapHydrateConcurrency,
      workerVwapHydrateBatchesPerCycle,
    } = await import('@/lib/platform/heliusLimits')
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

  const livePool = livePoolEarly

  let eligibleCount = 0
  if (useBirdeye && dbRankings) {
    eligibleCount = dbRankings.eligibleCount ?? 0
  } else if (dbRankings?.rankings?.length) {
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
    if (useBirdeye) {
      await refreshLiveHolderRankings({
        force: true,
        session: {
          timerStatus: timer.timer_status,
          eligibleCount,
          poolFunded: isPoolFundedForPayout(livePool),
        },
      })
      dbRankings = (await loadRankingsFromDb()) ?? dbRankings
    }

    const blockPayout =
      !useBirdeye &&
      payoutBlockedByPendingVwap(dbRankings.rankings, config.winnerCount)
    if (blockPayout) {
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
      payoutSuccess: result?.success ?? false,
      payoutError: result?.error ?? null,
    }
  }

  return {
    indexed,
    eligibleCount,
    timerStatus: timer.timer_status,
    payoutAttempted: false,
  }
}
