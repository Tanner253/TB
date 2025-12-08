import { NextRequest, NextResponse } from 'next/server'
import { formatPrice, formatUsd, getSolPrice } from '@/lib/solana/price'
import { formatWallet } from '@/lib/solana/holders'
import { 
  initializeTracker, 
  getTrackerStatus, 
} from '@/lib/tracker/init'
import {
  getRankedLosers,
  getHolderCount as getTrackedHolderCount,
  getEligibleCount,
  getCurrentPrice,
  getServiceStatus,
  getHoldersWithRealVwapCount,
} from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { getPayoutWalletBalance } from '@/lib/solana/transfer'
import { executePayout, canExecutePayout, getSecondsUntilNextPayout, getCurrentPayoutCycle, ensureTimerStateSync, resetTimerForNextInterval } from '@/lib/payout/executor'

export const dynamic = 'force-dynamic'

// Track initialization state
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

    if (!config.heliusApiKey) {
      return NextResponse.json({
        success: false,
        error: 'HELIUS_API_KEY not configured',
      }, { status: 500 })
    }

    // CRITICAL: Sync timer state from database for cross-instance consistency
    // This ensures all Vercel serverless instances show the same countdown
    await ensureTimerStateSync()

    // Initialize tracker on first request
    if (!initStarted) {
      initStarted = true
      initializeTracker().catch(err => {
        console.error('[Leaderboard] Tracker init error:', err)
        initStarted = false // Allow retry
      })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Get service status
    const serviceStatus = getServiceStatus()
    const trackerStatus = getTrackerStatus()

    // Get pool balance = 99% of wallet balance
    const solPrice = await getSolPrice() || 200
    const walletBalance = await getPayoutWalletBalance()
    const walletSol = walletBalance?.sol || 0
    const poolSol = walletSol * config.poolPercentage // 99% of wallet
    const poolUsd = poolSol * solPrice

    // If service not initialized yet, return loading state with basic info
    if (!serviceStatus.initialized) {
      // During initialization, use the tracked count as estimate
      // The service is processing holders, so show progress
      const totalEstimate = serviceStatus.holderCount > 0 ? 500 : 0 // We're processing up to 500
      
      return NextResponse.json({
        success: true,
        data: {
          status: 'initializing',
          message: serviceStatus.initInProgress 
            ? 'Loading holder data and calculating VWAPs...' 
            : 'Starting initialization...',
          cycle: getCurrentPayoutCycle() + 1,
          seconds_remaining: getSecondsUntilNextPayout(),
          pool_balance_sol: poolSol.toFixed(4),
          pool_balance_usd: formatUsd(poolUsd),
          pool_balance_tokens: `${poolSol.toFixed(4)} SOL`,
          sol_price: solPrice,
          token_price: serviceStatus.currentPrice ? formatPrice(serviceStatus.currentPrice) : 'Loading...',
          token_symbol: config.tokenSymbol,
          token_mint: config.tokenMint,
          total_holders: totalEstimate,
          tracked_holders: serviceStatus.holderCount,
          eligible_count: serviceStatus.eligibleCount,
          ws_connected: trackerStatus.wsConnected,
          tracker_initialized: trackerStatus.initialized,
          rankings: [],
          last_updated: new Date().toISOString(),
        },
      })
    }

    // Auto-trigger payout when timer hits 0
    const secondsUntil = getSecondsUntilNextPayout()
    if (secondsUntil <= 0) {
      if (canExecutePayout()) {
        const payoutResult = await executePayout()
        if (payoutResult.success) {
          console.log(`[Leaderboard] ✅ Payout executed: cycle ${payoutResult.cycle}`)
        } else if (!payoutResult.error?.includes('Max')) {
          // Only log non-retry-limit errors
          console.log(`[Leaderboard] ❌ Payout failed: ${payoutResult.error}`)
        }
      } else {
        // Can't execute payout (max attempts or already in progress)
        // Reset timer for next interval so UI doesn't stay at 0:00
        await resetTimerForNextInterval()
      }
    }

    // Get current price from service
    const tokenPrice = getCurrentPrice()
    if (!tokenPrice) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch token price',
      }, { status: 500 })
    }

    // Get ranked losers from holder service
    const rankedLosers = getRankedLosers()
    // Pool is now in SOL, converted to USD above
    const poolBal = poolUsd // USD value of the SOL pool
    const minLoss = poolBal * (config.minLossThresholdPct / 100)

    // Use the tracked holder count
    const totalHolderCount = getTrackedHolderCount()

    // Format rankings for response - show top losers with eligibility status
    // Note: Only holders with vwapSource === 'real' are returned by getRankedLosers()
    const rankings = rankedLosers.slice(0, limit).map((holder, idx) => ({
      rank: idx + 1,
      wallet: holder.wallet,
      wallet_display: formatWallet(holder.wallet),
      balance: holder.balance.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      balance_raw: holder.balance,
      vwap: holder.vwap ? formatPrice(holder.vwap) : 'N/A',
      vwap_raw: holder.vwap,
      vwap_source: holder.vwapSource, // 'real' = from actual transaction data
      drawdown_pct: Math.round(holder.drawdownPct * 100) / 100,
      loss_usd: formatUsd(holder.lossUsd),
      loss_usd_raw: holder.lossUsd,
      is_eligible: holder.isEligible,
      ineligible_reason: holder.ineligibleReason,
      payout_usd: holder.isEligible ? formatUsd(
        idx === 0 ? poolBal * 0.8 :
        idx === 1 ? poolBal * 0.15 :
        idx === 2 ? poolBal * 0.05 : 0
      ) : '$0.00',
      first_buy_at: holder.firstBuyTimestamp 
        ? new Date(holder.firstBuyTimestamp).toISOString() 
        : null,
      buy_count: holder.buyCount,
    }))

    // Get payout timing - simple, no snapshots
    const secondsRemaining = getSecondsUntilNextPayout()
    const cycle = getCurrentPayoutCycle()

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        cycle: cycle + 1, // Next cycle to be paid
        seconds_remaining: secondsRemaining,
        pool_balance_sol: poolSol.toFixed(4),
        pool_balance_usd: formatUsd(poolUsd),
        pool_balance_tokens: `${poolSol.toFixed(4)} SOL`,
        sol_price: solPrice,
        token_price: formatPrice(tokenPrice),
        token_price_raw: tokenPrice,
        token_symbol: config.tokenSymbol,
        token_mint: config.tokenMint,
        total_holders: totalHolderCount,
        tracked_holders: getTrackedHolderCount(),
        holders_with_real_vwap: getHoldersWithRealVwapCount(),
        eligible_count: getEligibleCount(),
        total_losers: rankedLosers.length,
        min_loss_threshold_usd: formatUsd(minLoss),
        ws_connected: trackerStatus.wsConnected,
        tracker_initialized: trackerStatus.initialized,
        rankings,
        last_updated: new Date().toISOString(),
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

// Helper functions
function formatTokenAmount(usdValue: number, tokenPrice: number | null): string {
  if (!tokenPrice || tokenPrice === 0) return '0'
  const tokens = usdValue / tokenPrice
  if (tokens >= 1_000_000_000_000) return `${(tokens / 1_000_000_000_000).toFixed(0)}T`
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(0)}B`
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`
  return tokens.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
