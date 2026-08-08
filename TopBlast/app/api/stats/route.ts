import { NextResponse } from 'next/server'
import { getTokenData, formatPrice, formatUsd, getResolvedTokenPrice } from '@/lib/solana/price'
import { formatWallet } from '@/lib/solana/holders'
import { getTokenMintExplorerUrl } from '@/lib/solana/explorer'
import { loadRankingsFromDb } from '@/lib/tracker/holderService'
import { config } from '@/lib/config'
import { formatHoldDuration } from '@/lib/eligibility/holdDuration'
import { formatPayoutInterval } from '@/lib/platform/payoutIntervals'
import { getPayoutSplitLabels } from '@/lib/payout/shares'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { fetchTenantPayoutStats } from '@/lib/payout/payoutStats'
import { buildSessionHolderStats } from '@/lib/stats/sessionStats'
import { getTenantDiagnostics } from '@/lib/tenant/getTenantDiagnostics'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!config.tokenMint) {
      return NextResponse.json(
        { success: false, error: 'Token mint is not configured for this listing' },
        { status: 500 }
      )
    }

    const [tokenData, resolvedPrice, livePool, payoutStats, diagnostics] = await Promise.all([
      getTokenData(config.tokenMint),
      getResolvedTokenPrice(config.tokenMint),
      getLivePoolBalance(),
      fetchTenantPayoutStats(),
      getTenantDiagnostics(),
    ])

    const tokenPrice = resolvedPrice?.price ?? tokenData?.price ?? null
    const holderStats = await buildSessionHolderStats(tokenPrice, livePool.poolUsd)
    const dbRankings = await loadRankingsFromDb()

    return NextResponse.json({
      success: true,
      data: {
        token: {
          symbol: config.tokenSymbol,
          mint: config.tokenMint,
          mint_explorer_url: getTokenMintExplorerUrl(config.tokenMint),
          price: tokenPrice ? formatPrice(tokenPrice) : 'N/A',
          price_raw: tokenPrice,
          price_change_24h: tokenData?.priceChange24h ?? null,
          market_cap: tokenData?.marketCap ? formatUsd(tokenData.marketCap) : 'N/A',
          market_cap_raw: tokenData?.marketCap ?? null,
          price_source: resolvedPrice?.source ?? null,
        },
        holders: {
          total: holderStats.total,
          tracked: holderStats.tracked,
          with_vwap: holderStats.with_vwap,
          eligible: holderStats.eligible,
          in_profit: holderStats.in_profit,
          in_loss: holderStats.in_loss,
        },
        protocol: {
          total_cycles: payoutStats.total_cycles,
          total_distributed_usd: formatUsd(payoutStats.total_distributed_usd),
          total_distributed_usd_raw: payoutStats.total_distributed_usd,
          total_distributed_sol: payoutStats.total_distributed_sol.toFixed(6),
          total_generated_volume_usd: formatUsd(payoutStats.total_generated_volume_usd),
          total_generated_volume_usd_raw: payoutStats.total_generated_volume_usd,
          total_generated_volume_sol: payoutStats.total_generated_volume_sol.toFixed(6),
          average_payout_usd: formatUsd(payoutStats.average_payout_usd),
          average_pool_size_usd: livePool.poolUsdFormatted,
          current_pool_usd: livePool.poolUsdFormatted,
          current_pool_usd_raw: livePool.poolUsd,
          payout_wallet_address: livePool.payoutWalletAddress,
          payout_split: getPayoutSplitLabels(),
          last_payout_at: payoutStats.last_payout_at?.toISOString() ?? null,
        },
        leaderboard: {
          deepest_drawdown: holderStats.deepest_drawdown,
          most_wins: payoutStats.most_wins
            ? {
                wallet_display: formatWallet(payoutStats.most_wins.wallet),
                win_count: payoutStats.most_wins.win_count,
              }
            : null,
        },
        thresholds: {
          min_balance: config.minTokenHolding.toLocaleString(),
          min_hold_minutes: config.minHoldDurationMinutes,
          min_hold_display: formatHoldDuration(config.minHoldDurationMinutes),
          min_loss_pct: config.minLossThresholdPct,
          payout_interval_minutes: config.payoutIntervalMinutes,
          payout_interval_display: formatPayoutInterval(config.payoutIntervalMinutes),
        },
        service: {
          initialized: holderStats.has_rankings,
          init_in_progress: false,
          last_refresh:
            holderStats.last_calculated ??
            (dbRankings?.lastCalculated
              ? new Date(dbRankings.lastCalculated).toISOString()
              : null),
        },
        diagnostics,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats'
    console.error('[Stats] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
