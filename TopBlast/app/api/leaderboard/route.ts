import { NextRequest, NextResponse } from 'next/server'
import { formatPrice, formatUsd, getEthPrice } from '@/lib/evm/price'
import { formatWallet } from '@/lib/evm/holders'
import { initializeTracker, getTrackerStatus } from '@/lib/tracker/init'
import { loadRankingsFromDb, saveRankingsToDb, getServiceStatus } from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { getPayoutWalletBalance } from '@/lib/evm/transfer'
import { executePayout, isPayoutDue, getPayoutTimerInfo, maybeStartPayoutTimer, ensureTimerStateSync } from '@/lib/payout/executor'
import { getPayoutForEligibleRank } from '@/lib/payout/shares'

export const dynamic = 'force-dynamic'

// Track initialization state (per-instance, but that's OK - just prevents double init)
let initStarted = false

export async function GET(request: NextRequest) {
  try {
    // Validate configuration
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

    // CRITICAL: Sync timer state from database for cross-instance consistency
    await ensureTimerStateSync()

    // Start tracker initialization in background (if not already started on this instance)
    // This populates the rankings in the database
    if (!initStarted) {
      initStarted = true
      initializeTracker().catch(err => {
        console.error('[Leaderboard] Tracker init error:', err)
        initStarted = false
      })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Get pool balance = 99% of wallet balance
    const ethPrice = await getEthPrice() || 3500
    const walletBalance = await getPayoutWalletBalance()
    const walletEth = walletBalance?.eth || walletBalance?.sol || 0
    const poolEth = walletEth * config.poolPercentage
    const poolUsd = poolEth * ethPrice

    // Auto-trigger payout when timer hits 0 AND service is ready
    // The executor has atomic locking to prevent duplicate concurrent payouts
    const serviceStatus = getServiceStatus()

    const dbRankings = await loadRankingsFromDb()

    if (dbRankings) {
      await maybeStartPayoutTimer(dbRankings.eligibleCount)
    }
    await ensureTimerStateSync()

    const timer = getPayoutTimerInfo()

    // Trigger payout from DB state — do not require in-memory tracker (serverless cold starts)
    if (
      isPayoutDue() &&
      timer.timer_status === 'active' &&
      dbRankings &&
      dbRankings.eligibleCount > 0
    ) {
      try {
        const result = await executePayout()
        if (result.success) {
          console.log('[Leaderboard] ✅ Payout cycle processed')
        } else if (result.error !== 'Payout already in progress') {
          console.log(`[Leaderboard] ❌ Payout failed: ${result.error}`)
        }
      } catch (err) {
        console.error('[Leaderboard] Payout error:', err)
      }
      await ensureTimerStateSync()
    }

    const timerAfterPayout = getPayoutTimerInfo()

    // If no data in DB at all, show initializing state
    // But if we have holders (even with no eligible losers), show "ready" with empty rankings
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
          pool_balance_eth: poolEth.toFixed(4),
          pool_balance_usd: formatUsd(poolUsd),
          pool_balance_tokens: `${poolEth.toFixed(4)} ETH`,
          eth_price: ethPrice,
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
      })
    }

    // Format rankings from database
    const poolBal = poolUsd
    const minLoss = poolBal * (config.minLossThresholdPct / 100)

    // Get eligible holders to calculate their payout rank (not overall rank)
    const eligibleWallets = dbRankings.rankings
      .filter(h => h.isEligible)
      .map(h => h.wallet)
    
    // Calculate payout based on position among ELIGIBLE holders, not overall rank
    const getPayoutForWallet = (wallet: string): number => {
      const eligibleRank = eligibleWallets.indexOf(wallet)
      return getPayoutForEligibleRank(poolBal, eligibleRank)
    }

    const rankings = dbRankings.rankings.slice(0, limit).map((holder, idx) => ({
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
      // Show payout based on eligible rank, not overall rank
      payout_usd: formatUsd(getPayoutForWallet(holder.wallet)),
      eligible_rank: holder.isEligible ? eligibleWallets.indexOf(holder.wallet) + 1 : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        status: timerAfterPayout.timer_status === 'waiting' ? 'waiting' : 'ready',
        timer_status: timerAfterPayout.timer_status,
        cycle: timerAfterPayout.next_cycle,
        seconds_remaining: timerAfterPayout.seconds_remaining,
        pool_balance_eth: poolEth.toFixed(4),
        pool_balance_usd: formatUsd(poolUsd),
        pool_balance_tokens: `${poolEth.toFixed(4)} ETH`,
        eth_price: ethPrice,
        token_price: formatPrice(dbRankings.tokenPrice),
        token_price_raw: dbRankings.tokenPrice,
        token_symbol: config.tokenSymbol,
        token_mint: config.tokenMint,
        total_holders: dbRankings.totalHolders,
        tracked_holders: dbRankings.totalHolders,
        holders_with_real_vwap: dbRankings.holdersWithVwap,
        eligible_count: dbRankings.eligibleCount,
        total_losers: dbRankings.rankings.length,
        min_loss_threshold_usd: formatUsd(minLoss),
        ws_connected: false,
        tracker_initialized: true,
        rankings,
        // Convenience: pre-filtered eligible winners (top 3)
        eligible_winners: rankings.filter(r => r.is_eligible).slice(0, 3),
        last_updated: dbRankings.lastCalculated.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[Leaderboard] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
