import { NextRequest, NextResponse } from 'next/server'
import { formatUsd } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { getPayoutHistory, getPayoutStats, PayoutRecord } from '@/lib/tracker/payoutService'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Get payout history from database
    const payoutRecords = await getPayoutHistory(limit)
    const stats = await getPayoutStats()

    // Format the history for the response
    const cycles = payoutRecords.map((record: PayoutRecord) => ({
      id: record.id,
      cycle: record.cycle,
      timestamp: new Date(record.timestamp).toISOString(),
      pool_balance_usd: formatUsd(record.pool_balance_usd),
      token_price: record.token_price,
      status: record.status,
      message: record.message,
      total_distributed_usd: formatUsd(record.total_distributed_usd),
      winners: record.winners.map(w => ({
        rank: w.rank,
        wallet: w.wallet,
        wallet_display: w.wallet_display,
        drawdown_pct: w.drawdown_pct,
        loss_usd: formatUsd(w.loss_usd),
        payout_usd: formatUsd(w.payout_usd),
        payout_pct: `${w.payout_pct}%`,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: {
        token_symbol: config.tokenSymbol,
        stats: {
          total_cycles: stats.total_cycles,
          completed_payouts: stats.completed_payouts,
          total_distributed_usd: formatUsd(stats.total_distributed_usd),
          total_winners: stats.total_winners,
          current_cycle: stats.current_cycle,
          next_payout_at: stats.next_payout_time 
            ? new Date(stats.next_payout_time).toISOString() 
            : null,
        },
        cycles,
      },
    })
  } catch (error: any) {
    console.error('[History] Error:', error)
    return NextResponse.json({
      success: true,
      data: {
        token_symbol: config.tokenSymbol,
        stats: {
          total_cycles: 0,
          completed_payouts: 0,
          total_distributed_usd: '$0.00',
          total_winners: 0,
          current_cycle: 1,
          next_payout_at: null,
        },
        cycles: [],
      },
    })
  }
}
