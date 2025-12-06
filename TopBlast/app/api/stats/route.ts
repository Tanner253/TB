import { NextResponse } from 'next/server'
import { getTokenData, formatPrice, formatUsd } from '@/lib/solana/price'
import { formatWallet } from '@/lib/solana/holders'
import { getHolderCount } from '@/lib/solana/helius'
import { 
  getAllHolders, 
  getEligibleCount, 
  getCurrentPrice, 
  isServiceInitialized,
  getServiceStatus,
} from '@/lib/tracker/holderService'
import { initializeTracker, isTrackerInitialized } from '@/lib/tracker/init'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

// Track initialization
let initStarted = false

export async function GET() {
  try {
    // Start initialization if not already
    if (!initStarted && !isServiceInitialized()) {
      initStarted = true
      initializeTracker().catch(err => {
        console.error('[Stats] Tracker init error:', err)
        initStarted = false
      })
    }

    // Get current price and market data
    const tokenData = await getTokenData(config.tokenMint)
    const tokenPrice = tokenData?.price || getCurrentPrice()

    // Get holder count from Helius
    const totalHolders = await getHolderCount(config.tokenMint)

    // Get tracked holders data
    const serviceStatus = getServiceStatus()
    const allHolders = getAllHolders()
    
    // Count profit/loss
    let holdersInProfit = 0
    let holdersInLoss = 0
    let holdersWithVwap = 0
    let deepestDrawdown: { wallet: string; pct: number } | null = null

    if (tokenPrice) {
      for (const h of allHolders) {
        if (h.vwap && h.vwap > 0) {
          holdersWithVwap++
          if (tokenPrice >= h.vwap) {
            holdersInProfit++
          } else {
            holdersInLoss++
            // Track deepest drawdown
            if (!deepestDrawdown || h.drawdownPct < deepestDrawdown.pct) {
              deepestDrawdown = {
                wallet: h.wallet,
                pct: h.drawdownPct,
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        token: {
          symbol: config.tokenSymbol,
          mint: config.tokenMint,
          price: tokenPrice ? formatPrice(tokenPrice) : 'N/A',
          price_raw: tokenPrice,
          price_change_24h: tokenData?.priceChange24h || null,
          market_cap: tokenData?.marketCap ? formatUsd(tokenData.marketCap) : 'N/A',
          market_cap_raw: tokenData?.marketCap || null,
        },
        holders: {
          total: totalHolders,
          tracked: serviceStatus.holderCount,
          with_vwap: holdersWithVwap,
          eligible: getEligibleCount(),
          in_profit: holdersInProfit,
          in_loss: holdersInLoss,
        },
        protocol: {
          total_cycles: 0, // Will be populated from DB in production
          total_distributed_usd: formatUsd(0),
          average_pool_size_usd: formatUsd(config.poolBalanceUsd),
          current_pool_usd: formatUsd(config.poolBalanceUsd),
          payout_split: {
            first: '80%',
            second: '15%',
            third: '5%',
          },
        },
        leaderboard: {
          deepest_drawdown: deepestDrawdown ? {
            wallet_display: formatWallet(deepestDrawdown.wallet),
            drawdown_pct: Math.round(deepestDrawdown.pct * 100) / 100,
          } : null,
          most_wins: null, // Will be populated from DB in production
        },
        thresholds: {
          min_balance: config.minTokenHolding.toLocaleString(),
          min_hold_hours: config.minHoldDurationHours,
          min_loss_pct: config.minLossThresholdPct,
        },
        service: {
          initialized: serviceStatus.initialized,
          init_in_progress: serviceStatus.initInProgress,
          last_refresh: serviceStatus.lastRefresh 
            ? new Date(serviceStatus.lastRefresh).toISOString() 
            : null,
        },
      },
    })
  } catch (error: any) {
    console.error('[Stats] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
