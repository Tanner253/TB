import { NextRequest, NextResponse } from 'next/server'
import { formatPrice, formatUsd, getResolvedTokenPrice } from '@/lib/solana/price'
import { formatWallet } from '@/lib/solana/holders'
import { initializeTracker } from '@/lib/tracker/init'
import {
  loadRankingsFromDb,
  getServiceStatus,
  ensureRankingsIndexed,
  ensureVwapCalculated,
  buildEphemeralRankingsFromChain,
  hydrateRankingsWithVwap,
  rankingNeedsVwapHydration,
} from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import {
  isPayoutDue,
  getPayoutTimerInfo,
  ensureTimerStateSync,
  syncPayoutTimerWithPayableWinners,
  getCurrentPayoutCycle,
  maybeExecuteDuePayout,
} from '@/lib/payout/executor'
import { getPayoutFailureRetryMinutes } from '@/lib/payout/payoutRetry'
import { getPayoutForEligibleRank } from '@/lib/payout/shares'
import { buildHoldTimeFields } from '@/lib/eligibility/holdDuration'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { isLiquidityPoolWallet } from '@/lib/eligibility/liquidityPools'
import { ensureLiquidityPoolAddresses } from '@/lib/eligibility/liquidityPools'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import { getTokenHolders } from '@/lib/solana/indexer'
import { normalizeTokenBalance, formatTokenBalance, rawToHumanTokenAmount, meetsMinTokenHoldingFromChain } from '@/lib/solana/tokenAmount'
import { getOnChainHolderStats } from '@/lib/solana/holderStats'
import { buildTenantDiagnostics } from '@/lib/tenant/diagnostics'
import { deriveSessionStatus } from '@/lib/tenant/sessionStatus'
import { buildSessionChecklist } from '@/lib/tenant/sessionChecklist'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import { sortLeaderboardEntries } from '@/lib/leaderboard/sortRankings'
import { getTokenMintExplorerUrl } from '@/lib/solana/explorer'
import { shouldThrottleFullReindex, markFullReindex } from '@/lib/solana/heliusCache'
import { getRankingsKey } from '@/lib/tenant/keys'
import { getPlatformTestBanner } from '@/lib/platform/testBanner'

/** DB rankings younger than this skip Helius DAS on public leaderboard polls. */
const RANKINGS_FRESH_MS = 2 * 60 * 1000
/** Max Enhanced-API wallet history fetches per leaderboard request (stagger rest across polls). */
const VWAP_HYDRATE_BUDGET = 2

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (!config.tokenMint) {
      return NextResponse.json({
        success: false,
        error: 'Token mint is not configured for this listing',
      }, { status: 500 })
    }

    if (config.tokenMint.startsWith('0x')) {
      return NextResponse.json({
        success: false,
        error: 'Token mint must be a valid Solana SPL address (base58)',
      }, { status: 500 })
    }

    await ensureTimerStateSync()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const livePool = await getLivePoolBalance()
    const { poolEth, poolUsd, ethPrice, poolUsdFormatted, poolEthFormatted, minLossUsdFormatted, payoutWalletAddress } = livePool

    const serviceStatus = getServiceStatus()

    let dbRankings = await loadRankingsFromDb()

    const rankingsAgeMs = dbRankings
      ? Date.now() - new Date(dbRankings.lastCalculated).getTime()
      : Infinity
    const rankingsFresh = rankingsAgeMs < RANKINGS_FRESH_MS

    let onChainStats = {
      raw: dbRankings?.totalHolders ?? 0,
      trackable: dbRankings?.totalHolders ?? 0,
      qualifying: dbRankings?.totalHolders ?? 0,
    }

    if (!rankingsFresh || !dbRankings) {
      onChainStats = await getOnChainHolderStats(config.tokenMint)
      if (
        onChainStats.qualifying > (dbRankings?.totalHolders ?? 0) &&
        !shouldThrottleFullReindex(getRankingsKey())
      ) {
        await ensureRankingsIndexed()
        markFullReindex(getRankingsKey())
        dbRankings = await loadRankingsFromDb()
      }
    }

    const needsReindex =
      !dbRankings ||
      dbRankings.totalHolders === 0 ||
      dbRankings.rankings.length === 0

    const needsVwapRefresh =
      dbRankings &&
      dbRankings.rankings.length > 0 &&
      dbRankings.holdersWithVwap === 0

    if (needsReindex) {
      if (!shouldThrottleFullReindex(getRankingsKey())) {
        initializeTracker().catch(err => console.error('[Leaderboard] Tracker init error:', err))
        await ensureRankingsIndexed()
        markFullReindex(getRankingsKey())
        dbRankings = await loadRankingsFromDb()
      }
    } else if (needsVwapRefresh) {
      if (!shouldThrottleFullReindex(getRankingsKey())) {
        initializeTracker().catch(err => console.error('[Leaderboard] Tracker init error:', err))
        await ensureVwapCalculated()
        markFullReindex(getRankingsKey())
        dbRankings = await loadRankingsFromDb()
      }
    }

    if (!dbRankings || dbRankings.rankings.length === 0 || dbRankings.totalHolders === 0) {
      if (!shouldThrottleFullReindex(getRankingsKey())) {
        const ephemeral = await buildEphemeralRankingsFromChain()
        if (ephemeral && ephemeral.rankings.length > 0) {
          dbRankings = ephemeral
          markFullReindex(getRankingsKey())
          initializeTracker().catch(err =>
            console.error('[Leaderboard] Background tracker init error:', err)
          )
        }
      }
    }

    const resolvedPrice = await getResolvedTokenPrice(config.tokenMint)
    const liveTokenPrice =
      resolvedPrice?.price ?? dbRankings?.tokenPrice ?? 0
    const priceMeta = {
      priceAvailable: !!resolvedPrice?.price,
      priceSource: resolvedPrice?.source ?? null,
      migrationStage: resolvedPrice?.pair?.migrationStage ?? null,
    }

    const poolFields = {
      pool_balance_eth: poolEthFormatted,
      pool_balance_usd: poolUsdFormatted,
      pool_balance_usd_raw: poolUsd,
      pool_balance_tokens: `${poolEthFormatted} SOL`,
      payout_wallet_address: payoutWalletAddress,
      eth_price: ethPrice,
      min_loss_threshold_usd: minLossUsdFormatted,
    }

    const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }
    const platformTestBanner = getPlatformTestBanner()

    if (!dbRankings) {
      await syncPayoutTimerWithPayableWinners()
      await ensureTimerStateSync()
      const timerAfterPayout = getPayoutTimerInfo()
      const diagnosticsInput = {
        pool: livePool,
        timer: timerAfterPayout,
        trackedHolders: 0,
        holdersWithVwap: 0,
        eligibleCount: 0,
        upcomingCount: 0,
        totalLosers: 0,
        trackerInitialized: serviceStatus.initialized,
        hasRankings: false,
        ...priceMeta,
      }
      const diagnostics = buildTenantDiagnostics(diagnosticsInput)
      const session_status = deriveSessionStatus(diagnosticsInput)
      const session_checklist = buildSessionChecklist({
        ...diagnosticsInput,
        minLossUsdFormatted: minLossUsdFormatted,
      })

      return NextResponse.json({
        success: true,
        data: {
          status: timerAfterPayout.timer_status === 'waiting' ? 'waiting' : 'initializing',
          message: diagnostics.headline,
          diagnostics,
          session_status,
          session_checklist,
          timer_status: timerAfterPayout.timer_status,
          cycle: timerAfterPayout.next_cycle,
          seconds_remaining: timerAfterPayout.seconds_remaining,
          last_payout_error: timerAfterPayout.last_payout_error,
          last_payout_error_at: timerAfterPayout.last_payout_error_at,
          payout_retry_mode: timerAfterPayout.payout_retry_mode,
          payout_retry_minutes: timerAfterPayout.payout_retry_mode
            ? getPayoutFailureRetryMinutes()
            : null,
          ...poolFields,
          token_price: 'Loading...',
          token_symbol: config.tokenSymbol,
          token_mint: config.tokenMint,
          token_mint_explorer_url: getTokenMintExplorerUrl(config.tokenMint),
          total_holders: 0,
          tracked_holders: 0,
          holders_with_real_vwap: 0,
          eligible_count: 0,
          ws_connected: false,
          tracker_initialized: serviceStatus.initialized,
          rankings: [],
          last_updated: new Date().toISOString(),
          platform_test_banner: platformTestBanner,
        },
      }, { headers: noStoreHeaders })
    }

    const poolBal = poolUsd

    await ensureLiquidityPoolAddresses(config.tokenMint)

    const rankingByWallet = new Map(
      dbRankings.rankings.map(h => [h.wallet, h] as const)
    )

    if (!rankingsFresh && onChainStats.qualifying > rankingByWallet.size) {
      const liveHolders = await getTokenHolders(
        config.tokenMint,
        Math.min(config.maxHoldersToProcess, 100)
      )
      for (const h of liveHolders) {
        if (rankingByWallet.has(h.wallet)) continue
        if (
          h.isContract ||
          isExcludedParticipantWallet(h.wallet) ||
          isLiquidityPoolWallet(h.wallet, config.tokenMint)
        ) {
          continue
        }
        if (
          !meetsMinTokenHoldingFromChain(
            h.balance,
            config.tokenDecimals,
            config.minTokenHolding
          )
        ) {
          continue
        }

        rankingByWallet.set(h.wallet, {
          wallet: h.wallet,
          balance: rawToHumanTokenAmount(h.balance, config.tokenDecimals),
          vwap: 0,
          drawdownPct: 0,
          lossUsd: 0,
          isEligible: false,
          ineligibleReason: 'Loading buy history...',
          firstBuyAt: null,
          hasSold: false,
          hasTransferredOut: false,
          totalTokensBought: 0,
          lastWinCycle: null,
          isContract: false,
        })
      }
    }

    const sourceRankings = Array.from(rankingByWallet.values()).filter(
      h =>
        !h.isContract &&
        !isExcludedParticipantWallet(h.wallet) &&
        !isLiquidityPoolWallet(h.wallet, config.tokenMint) &&
        normalizeTokenBalance(h.balance, config.tokenDecimals, config.minTokenHolding) >=
          config.minTokenHolding
    )

    const walletsNeedingVwap = sourceRankings.filter(rankingNeedsVwapHydration)
    if (walletsNeedingVwap.length > 0) {
      const hydrated = await hydrateRankingsWithVwap(walletsNeedingVwap, {
        maxWallets: VWAP_HYDRATE_BUDGET,
        tokenPrice: liveTokenPrice,
      })
      const hydratedByWallet = new Map(hydrated.rankings.map(h => [h.wallet, h]))
      for (let i = 0; i < sourceRankings.length; i++) {
        const row = hydratedByWallet.get(sourceRankings[i].wallet)
        if (row) sourceRankings[i] = row
      }
      dbRankings = (await loadRankingsFromDb()) ?? dbRankings
    }

    const walletsNeedingFirstBuy = sourceRankings
      .filter(h => !h.firstBuyAt)
      .map(h => h.wallet)

    const firstBuyByWallet = new Map<string, Date>()
    if (walletsNeedingFirstBuy.length > 0) {
      const { Holder } = await import('@/lib/db/models')
      const holderDocs = await Holder.find({
        wallet: { $in: walletsNeedingFirstBuy },
        firstBuyAt: { $ne: null },
      })
        .select('wallet firstBuyAt')
        .lean()
      for (const doc of holderDocs) {
        if (doc.firstBuyAt) {
          firstBuyByWallet.set(doc.wallet, doc.firstBuyAt)
        }
      }
    }

    let lastWinByWallet = await loadLastWinCycleByWallet(
      sourceRankings.map(h => h.wallet)
    )

    const liveEvaluated = sourceRankings.map(holder => {
      const firstBuyAt =
        holder.firstBuyAt ??
        firstBuyByWallet.get(holder.wallet) ??
        null
      const firstBuyMs = firstBuyAt ? new Date(firstBuyAt).getTime() : null
      const humanBalance = normalizeTokenBalance(
        holder.balance,
        config.tokenDecimals,
        config.minTokenHolding
      )
      const live = evaluateHolderEligibility({
        wallet: holder.wallet,
        balance: humanBalance,
        vwap: holder.vwap || null,
        tokenPrice: liveTokenPrice,
        firstBuyTimestamp: firstBuyMs,
        hasSold: holder.hasSold ?? false,
        hasTransferredOut: holder.hasTransferredOut ?? false,
        hasTransferIn: (holder as { hasTransferIn?: boolean }).hasTransferIn ?? false,
        lastWinCycle: lastWinByWallet.get(holder.wallet) ?? holder.lastWinCycle ?? null,
        totalTokensBought: holder.totalTokensBought ?? 0,
        poolUsd: poolBal,
        currentCycle: getCurrentPayoutCycle(),
      })
      const holdFields = buildHoldTimeFields(firstBuyAt, config.minHoldDurationMinutes)

      return {
        holder,
        firstBuyAt,
        live,
        holdFields,
      }
    })

    const eligibleSorted = liveEvaluated
      .filter(entry => entry.live.isEligible)
      .sort((a, b) => {
        if (a.live.drawdownPct !== b.live.drawdownPct) {
          return a.live.drawdownPct - b.live.drawdownPct
        }
        return b.live.lossUsd - a.live.lossUsd
      })

    const allRanked = sortLeaderboardEntries(liveEvaluated)

    const getPayoutForRank = (eligibleRank: number): number =>
      getPayoutForEligibleRank(poolBal, eligibleRank)

    const mapRankingRow = (
      entry: (typeof liveEvaluated)[number],
      displayRank: number,
      eligibleRank: number | null
    ) => {
      const { holder, live, holdFields } = entry
      const rowBalance = normalizeTokenBalance(
        holder.balance,
        config.tokenDecimals,
        config.minTokenHolding
      )

      return {
        rank: displayRank,
        wallet: holder.wallet,
        wallet_display: formatWallet(holder.wallet),
        balance: formatTokenBalance(rowBalance),
        balance_raw: rowBalance,
        vwap: holder.vwap ? formatPrice(holder.vwap) : 'N/A',
        vwap_raw: holder.vwap,
        vwap_source: (holder.vwap ?? 0) > 0 ? 'real' : 'none',
        drawdown_pct: Math.round(live.drawdownPct * 100) / 100,
        loss_usd: formatUsd(live.lossUsd),
        loss_usd_raw: live.lossUsd,
        is_eligible: live.isEligible,
        ineligible_reason: live.isEligible ? null : live.ineligibleReason,
        ...holdFields,
        payout_usd: eligibleRank != null ? formatUsd(getPayoutForRank(eligibleRank - 1)) : null,
        eligible_rank: eligibleRank,
      }
    }

    let eligibleRankCounter = 0
    const rankings = allRanked.slice(0, limit).map((entry, idx) => {
      const eligibleRank = entry.live.isEligible ? ++eligibleRankCounter : null
      return mapRankingRow(entry, idx + 1, eligibleRank)
    })

    const eligibleWinners = eligibleSorted.slice(0, 3).map((entry, idx) =>
      mapRankingRow(entry, idx + 1, idx + 1)
    )

    const eligibleCount = eligibleSorted.length

    const { verifiedPayableCount } = await syncPayoutTimerWithPayableWinners(eligibleCount)
    await ensureTimerStateSync()
    let timerAfterPayout = getPayoutTimerInfo()
    if (verifiedPayableCount > 0 && timerAfterPayout.timer_status === 'active' && isPayoutDue()) {
      try {
        const payoutResult = await maybeExecuteDuePayout(verifiedPayableCount)
        if (payoutResult && !payoutResult.success) {
          console.warn('[Leaderboard] Payout attempt:', payoutResult.error)
        }
        await ensureTimerStateSync()
        timerAfterPayout = getPayoutTimerInfo()
      } catch (err) {
        console.error('[Leaderboard] Payout error:', err)
      }
    }

    const upcomingCount = allRanked.filter(e => !e.live.isEligible && e.live.drawdownPct < 0).length
    const totalLosers = allRanked.filter(e => e.live.drawdownPct < 0).length

    const ineligibleReasons: Record<string, number> = {}
    for (const entry of allRanked) {
      if (entry.live.isEligible) continue
      const reason = entry.live.ineligibleReason || 'Ineligible'
      ineligibleReasons[reason] = (ineligibleReasons[reason] || 0) + 1
    }

    const diagnosticsInput = {
      pool: livePool,
      timer: timerAfterPayout,
      trackedHolders: sourceRankings.length,
      holdersWithVwap: dbRankings.holdersWithVwap,
      eligibleCount,
      upcomingCount,
      totalLosers,
      trackerInitialized: serviceStatus.initialized,
      hasRankings: true,
      ineligibleReasons,
      ...priceMeta,
    }

    const diagnostics = buildTenantDiagnostics(diagnosticsInput)
    const session_status = deriveSessionStatus(diagnosticsInput)
    const session_checklist = buildSessionChecklist({
      ...diagnosticsInput,
      minLossUsdFormatted: minLossUsdFormatted,
    })

    return NextResponse.json({
      success: true,
      data: {
        status: timerAfterPayout.timer_status === 'waiting' ? 'waiting' : 'ready',
        message: diagnostics.headline,
        diagnostics,
        session_status,
        session_checklist,
        timer_status: timerAfterPayout.timer_status,
        cycle: timerAfterPayout.next_cycle,
        seconds_remaining: timerAfterPayout.seconds_remaining,
        last_payout_error: timerAfterPayout.last_payout_error,
        last_payout_error_at: timerAfterPayout.last_payout_error_at,
        payout_retry_mode: timerAfterPayout.payout_retry_mode,
        payout_retry_minutes: timerAfterPayout.payout_retry_mode
          ? getPayoutFailureRetryMinutes()
          : null,
        ...poolFields,
        token_price: formatPrice(liveTokenPrice),
        token_price_raw: liveTokenPrice,
        token_symbol: config.tokenSymbol,
        token_mint: config.tokenMint,
        token_mint_explorer_url: getTokenMintExplorerUrl(config.tokenMint),
        total_holders: Math.max(dbRankings.totalHolders, onChainStats.qualifying),
        on_chain_holders: onChainStats.trackable,
        on_chain_raw_holders: onChainStats.raw,
        min_token_holding: config.minTokenHolding,
        tracked_holders: sourceRankings.length,
        holders_with_buy_history: sourceRankings.filter(h => (h.vwap ?? 0) > 0).length,
        holders_with_real_vwap: dbRankings.holdersWithVwap,
        eligible_count: eligibleCount,
        upcoming_count: upcomingCount,
        total_losers: allRanked.filter(e => e.live.drawdownPct < 0).length,
        ws_connected: false,
        tracker_initialized: serviceStatus.initialized,
        min_hold_minutes: config.minHoldDurationMinutes,
        payout_interval_minutes: config.payoutIntervalMinutes,
        payout_interval_display: formatPayoutInterval(config.payoutIntervalMinutes),
        rankings,
        eligible_winners: eligibleWinners,
        last_updated: dbRankings.lastCalculated.toISOString(),
        platform_test_banner: platformTestBanner,
      },
    }, { headers: noStoreHeaders })
  } catch (error: any) {
    console.error('[Leaderboard] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
