import { NextRequest, NextResponse } from 'next/server'
import { formatPrice, formatUsd } from '@/lib/evm/price'
import { formatWallet } from '@/lib/evm/holders'
import { initializeTracker } from '@/lib/tracker/init'
import {
  loadRankingsFromDb,
  getServiceStatus,
  ensureRankingsIndexed,
} from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import {
  executePayout,
  isPayoutDue,
  getPayoutTimerInfo,
  maybeStartPayoutTimer,
  ensureTimerStateSync,
  pausePayoutTimerToWaiting,
} from '@/lib/payout/executor'
import { getPayoutForEligibleRank } from '@/lib/payout/shares'
import { getHoldSecondsRemaining } from '@/lib/eligibility/holdDuration'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (!config.tokenMint) {
      return NextResponse.json({
        success: false,
        error: 'TOKEN_MINT_ADDRESS not configured',
      }, { status: 500 })
    }

    if (!config.tokenMint.startsWith('0x')) {
      return NextResponse.json({
        success: false,
        error: 'TOKEN_MINT_ADDRESS must be an EVM contract address (0x...)',
      }, { status: 500 })
    }

    await ensureTimerStateSync()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const livePool = await getLivePoolBalance()
    const { poolEth, poolUsd, ethPrice, poolUsdFormatted, poolEthFormatted, minLossUsdFormatted, payoutWalletAddress } = livePool

    const serviceStatus = getServiceStatus()

    let dbRankings = await loadRankingsFromDb()

    const needsReindex =
      !dbRankings ||
      dbRankings.totalHolders === 0 ||
      dbRankings.rankings.length === 0

    if (needsReindex) {
      initializeTracker().catch(err => console.error('[Leaderboard] Tracker init error:', err))
      await ensureRankingsIndexed()
      dbRankings = await loadRankingsFromDb()
    }

    if (dbRankings) {
      await maybeStartPayoutTimer(dbRankings.eligibleCount)
    }
    await ensureTimerStateSync()

    const timer = getPayoutTimerInfo()
    const eligibleCount = dbRankings?.eligibleCount ?? 0

    // Unstick timer when due but nobody is eligible (e.g. after accidental DB wipe)
    if (
      timer.timer_status === 'active' &&
      isPayoutDue() &&
      eligibleCount === 0
    ) {
      await pausePayoutTimerToWaiting()
      await ensureTimerStateSync()
    }

    const timerAfterPause = getPayoutTimerInfo()

    if (
      isPayoutDue() &&
      timerAfterPause.timer_status === 'active' &&
      dbRankings &&
      eligibleCount > 0
    ) {
      try {
        const result = await executePayout()
        if (result.success) {
          console.log('[Leaderboard] ✅ Payout cycle processed')
        } else if (result.error !== 'Payout already in progress') {
          console.log(`[Leaderboard] ❌ Payout failed: ${result.error}`)
        }
        dbRankings = (await loadRankingsFromDb()) ?? dbRankings
      } catch (err) {
        console.error('[Leaderboard] Payout error:', err)
      }
      await ensureTimerStateSync()
    }

    const timerAfterPayout = getPayoutTimerInfo()

    const poolFields = {
      pool_balance_eth: poolEthFormatted,
      pool_balance_usd: poolUsdFormatted,
      pool_balance_usd_raw: poolUsd,
      pool_balance_tokens: `${poolEthFormatted} ETH`,
      payout_wallet_address: payoutWalletAddress,
      eth_price: ethPrice,
      min_loss_threshold_usd: minLossUsdFormatted,
    }

    const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' }

    if (!dbRankings) {
      return NextResponse.json({
        success: true,
        data: {
          status: timerAfterPayout.timer_status === 'waiting' ? 'waiting' : 'initializing',
          message: timerAfterPayout.timer_status === 'waiting'
            ? 'Waiting for the first eligible holder (15 min hold + in loss)...'
            : 'Loading holder data and calculating VWAPs...',
          timer_status: timerAfterPayout.timer_status,
          cycle: timerAfterPayout.next_cycle,
          seconds_remaining: timerAfterPayout.seconds_remaining,
          ...poolFields,
          token_price: 'Loading...',
          token_symbol: config.tokenSymbol,
          token_mint: config.tokenMint,
          total_holders: 0,
          tracked_holders: 0,
          holders_with_real_vwap: 0,
          eligible_count: 0,
          ws_connected: false,
          tracker_initialized: serviceStatus.initialized,
          rankings: [],
          last_updated: new Date().toISOString(),
        },
      }, { headers: noStoreHeaders })
    }

    const poolBal = poolUsd

    const eligibleWallets = dbRankings.rankings
      .filter(h => h.isEligible)
      .map(h => h.wallet)

    const getPayoutForWallet = (wallet: string): number => {
      const eligibleRank = eligibleWallets.indexOf(wallet)
      return getPayoutForEligibleRank(poolBal, eligibleRank)
    }

    const walletsNeedingFirstBuy = dbRankings.rankings
      .slice(0, limit)
      .filter(h => !h.firstBuyAt)
      .map(h => h.wallet.toLowerCase())

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
          firstBuyByWallet.set(doc.wallet.toLowerCase(), doc.firstBuyAt)
        }
      }
    }

    const rankings = dbRankings.rankings.slice(0, limit).map((holder, idx) => {
      const firstBuyAt =
        holder.firstBuyAt ??
        firstBuyByWallet.get(holder.wallet.toLowerCase()) ??
        null
      const firstBuyMs = firstBuyAt ? new Date(firstBuyAt).getTime() : null
      const holdSecondsRemaining = getHoldSecondsRemaining(
        firstBuyMs,
        config.minHoldDurationMinutes
      )

      return {
        rank: idx + 1,
        wallet: holder.wallet,
        wallet_display: formatWallet(holder.wallet),
        balance: holder.balance.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        balance_raw: holder.balance,
        vwap: holder.vwap ? formatPrice(holder.vwap) : 'N/A',
        vwap_raw: holder.vwap,
        vwap_source: 'real',
        drawdown_pct: Math.round(holder.drawdownPct * 100) / 100,
        loss_usd: formatUsd(holder.lossUsd),
        loss_usd_raw: holder.lossUsd,
        is_eligible: holder.isEligible,
        ineligible_reason: holder.ineligibleReason,
        hold_seconds_remaining: holdSecondsRemaining,
        hold_eligible_at:
          firstBuyMs && holdSecondsRemaining && holdSecondsRemaining > 0
            ? new Date(firstBuyMs + config.minHoldDurationMinutes * 60 * 1000).toISOString()
            : null,
        payout_usd: formatUsd(getPayoutForWallet(holder.wallet)),
        eligible_rank: holder.isEligible ? eligibleWallets.indexOf(holder.wallet) + 1 : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        status: timerAfterPayout.timer_status === 'waiting' ? 'waiting' : 'ready',
        timer_status: timerAfterPayout.timer_status,
        cycle: timerAfterPayout.next_cycle,
        seconds_remaining: timerAfterPayout.seconds_remaining,
        ...poolFields,
        token_price: formatPrice(dbRankings.tokenPrice),
        token_price_raw: dbRankings.tokenPrice,
        token_symbol: config.tokenSymbol,
        token_mint: config.tokenMint,
        total_holders: dbRankings.totalHolders,
        tracked_holders: dbRankings.totalHolders,
        holders_with_real_vwap: dbRankings.holdersWithVwap,
        eligible_count: dbRankings.eligibleCount,
        total_losers: dbRankings.rankings.length,
        ws_connected: false,
        tracker_initialized: serviceStatus.initialized,
        min_hold_minutes: config.minHoldDurationMinutes,
        rankings,
        eligible_winners: rankings.filter(r => r.is_eligible).slice(0, 3),
        last_updated: dbRankings.lastCalculated.toISOString(),
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
