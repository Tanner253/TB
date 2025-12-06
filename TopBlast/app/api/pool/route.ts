import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { PoolBalance } from '@/lib/db/models'
import { formatUsd } from '@/lib/solana/price'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try to connect to DB, but fallback to config values if not available
    let pool: any = null
    
    try {
      const conn = await connectDB()
      if (conn) {
        pool = await PoolBalance.findOne()
      }
    } catch {
      // DB not available, use config values
    }

    // Use DB values if available, otherwise fall back to config
    const balance = pool?.balance || config.poolBalanceUsd
    const balanceTokens = pool?.balanceTokens || config.poolBalanceTokens
    const totalDistributed = pool?.totalDistributed || 0
    const totalCycles = pool?.totalCycles || 0
    const averagePayout = totalCycles > 0 ? totalDistributed / totalCycles : 0

    return NextResponse.json({
      success: true,
      data: {
        balance_usd: formatUsd(balance),
        balance_raw: balance,
        balance_tokens: balanceTokens.toLocaleString(),
        total_distributed_usd: formatUsd(totalDistributed),
        total_cycles: totalCycles,
        average_payout_usd: formatUsd(averagePayout),
        last_deposit_at: pool?.lastDepositAt?.toISOString() || null,
        last_payout_at: pool?.lastPayoutAt?.toISOString() || null,
        payout_enabled: balance >= config.minPoolForPayout,
        minimum_pool_usd: formatUsd(config.minPoolForPayout),
        payout_split: {
          first: '80%',
          second: '15%',
          third: '5%',
        },
      },
    })
  } catch (error: any) {
    console.error('[Pool] Error:', error)
    
    // Return config values on error
    return NextResponse.json({
      success: true,
      data: {
        balance_usd: formatUsd(config.poolBalanceUsd),
        balance_raw: config.poolBalanceUsd,
        balance_tokens: config.poolBalanceTokens.toLocaleString(),
        total_distributed_usd: formatUsd(0),
        total_cycles: 0,
        average_payout_usd: formatUsd(0),
        last_deposit_at: null,
        last_payout_at: null,
        payout_enabled: config.poolBalanceUsd >= config.minPoolForPayout,
        minimum_pool_usd: formatUsd(config.minPoolForPayout),
        payout_split: {
          first: '80%',
          second: '15%',
          third: '5%',
        },
      },
    })
  }
}
