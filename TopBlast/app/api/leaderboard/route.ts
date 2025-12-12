import { NextRequest, NextResponse } from 'next/server'
import { formatPrice, formatUsd, getSolPrice } from '@/lib/solana/price'
import { formatWallet } from '@/lib/solana/holders'
import { initializeTracker, getTrackerStatus } from '@/lib/tracker/init'
import { loadRankingsFromDb, saveRankingsToDb, getServiceStatus } from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { getPayoutWalletBalance } from '@/lib/solana/transfer'
import { executePayout, isPayoutDue, getSecondsUntilNextPayout, getCurrentPayoutCycle, ensureTimerStateSync } from '@/lib/payout/executor'

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

    if (!config.heliusApiKey) {
      return NextResponse.json({
        success: false,
        error: 'HELIUS_API_KEY not configured',
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
    const solPrice = await getSolPrice() || 200
    const walletBalance = await getPayoutWalletBalance()
    const walletSol = walletBalance?.sol || 0
    const poolSol = walletSol * config.poolPercentage
    const poolUsd = poolSol * solPrice

    // Auto-trigger payout when timer hits 0 AND service is ready
    // The executor has atomic locking to prevent duplicate concurrent payouts
    const serviceStatus = getServiceStatus()
    
    if (isPayoutDue() && serviceStatus.initialized && serviceStatus.holderCount > 0) {
      // Fire and forget - don't wait for payout to complete
      // The atomic lock in executePayout prevents duplicates
      executePayout()
        .then(result => {
          if (result.success) {
            console.log(`[Leaderboard] ✅ Payout triggered successfully`)
          } else if (result.error !== 'Payout already in progress') {
            console.log(`[Leaderboard] ❌ Payout failed: ${result.error}`)
          }
          // Don't log "already in progress" - that's expected for concurrent requests
        })
        .catch(err => console.error(`[Leaderboard] Payout error:`, err))
    }

    // CRITICAL: Load rankings from DATABASE (not in-memory)
    // This ensures all Vercel instances return the same data
    const dbRankings = await loadRankingsFromDb()
    
    const trackerStatus = getTrackerStatus()

    // If no data in DB at all, show initializing state
    // But if we have holders (even with no eligible losers), show "ready" with empty rankings
    if (!dbRankings) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'initializing',
          message: 'Loading holder data and calculating VWAPs...',
          cycle: getCurrentPayoutCycle() + 1,
          seconds_remaining: getSecondsUntilNextPayout(),
          pool_balance_sol: poolSol.toFixed(4),
          pool_balance_usd: formatUsd(poolUsd),
          pool_balance_tokens: `${poolSol.toFixed(4)} SOL`,
          sol_price: solPrice,
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
      payout_usd: holder.isEligible ? formatUsd(
        idx === 0 ? poolBal * 0.8 :
        idx === 1 ? poolBal * 0.15 :
        idx === 2 ? poolBal * 0.05 : 0
      ) : '$0.00',
    }))

    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        cycle: getCurrentPayoutCycle() + 1,
        seconds_remaining: getSecondsUntilNextPayout(),
        pool_balance_sol: poolSol.toFixed(4),
        pool_balance_usd: formatUsd(poolUsd),
        pool_balance_tokens: `${poolSol.toFixed(4)} SOL`,
        sol_price: solPrice,
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
