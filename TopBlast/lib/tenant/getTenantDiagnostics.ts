import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import {
  getPayoutTimerInfo,
  ensureTimerStateSync,
} from '@/lib/payout/executor'
import { loadRankingsFromDb, getServiceStatus } from '@/lib/tracker/holderService'
import { buildTenantDiagnostics, type TenantDiagnostics } from '@/lib/tenant/diagnostics'
import { config } from '@/lib/config'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import { getResolvedTokenPrice } from '@/lib/solana/price'
import { getCurrentPayoutCycle } from '@/lib/payout/executor'

export async function getTenantDiagnostics(): Promise<TenantDiagnostics> {
  await ensureTimerStateSync()

  const [pool, dbRankings, timer] = await Promise.all([
    getLivePoolBalance(),
    loadRankingsFromDb(),
    Promise.resolve(getPayoutTimerInfo()),
  ])

  const serviceStatus = getServiceStatus()
  const resolvedPrice = config.tokenMint ? await getResolvedTokenPrice(config.tokenMint) : null
  const liveTokenPrice =
    resolvedPrice?.price ?? dbRankings?.tokenPrice ?? 0

  let eligibleCount = 0
  let upcomingCount = 0
  let totalLosers = 0
  const ineligibleReasons: Record<string, number> = {}

  const sourceRankings =
    dbRankings?.rankings.filter(
      h => !h.isContract && !isExcludedParticipantWallet(h.wallet)
    ) ?? []

  if (sourceRankings.length > 0 && liveTokenPrice) {
    const lastWinByWallet = await loadLastWinCycleByWallet(
      sourceRankings.map(h => h.wallet)
    )
    const currentCycle = getCurrentPayoutCycle()

    for (const h of sourceRankings) {
      const firstBuyMs = h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null
      const live = evaluateHolderEligibility({
        wallet: h.wallet,
        balance: h.balance,
        vwap: h.vwap || null,
        tokenPrice: liveTokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: h.hasSold ?? false,
        hasTransferredOut: h.hasTransferredOut ?? false,
        lastWinCycle: lastWinByWallet.get(h.wallet) ?? h.lastWinCycle ?? null,
        totalTokensBought: h.totalTokensBought ?? 0,
        poolUsd: pool.poolUsd,
        currentCycle,
      })

      if (live.drawdownPct < 0) totalLosers++
      if (live.isEligible) {
        eligibleCount++
      } else {
        if (live.drawdownPct < 0 && !live.isEligible) upcomingCount++
        const reason = live.ineligibleReason || 'Ineligible'
        ineligibleReasons[reason] = (ineligibleReasons[reason] || 0) + 1
      }
    }
  }

  return buildTenantDiagnostics({
    pool,
    timer,
    trackedHolders: sourceRankings.length,
    holdersWithVwap: dbRankings?.holdersWithVwap ?? 0,
    eligibleCount,
    upcomingCount,
    totalLosers,
    trackerInitialized: serviceStatus.initialized,
    hasRankings: !!dbRankings && dbRankings.rankings.length > 0,
    ineligibleReasons,
    priceSource: resolvedPrice?.source ?? null,
    migrationStage: resolvedPrice?.pair?.migrationStage ?? null,
    priceAvailable: !!resolvedPrice?.price,
  })
}
