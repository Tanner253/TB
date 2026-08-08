import { NextResponse } from 'next/server'
import { formatUsd } from '@/lib/solana/price'
import { getPayoutSplitLabels } from '@/lib/payout/shares'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { isPoolFundedForPayout } from '@/lib/payout/poolMinimum'
import { fetchTenantPayoutStats } from '@/lib/payout/payoutStats'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [livePool, payoutStats] = await Promise.all([
      getLivePoolBalance(),
      fetchTenantPayoutStats(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        balance_usd: livePool.poolUsdFormatted,
        balance_raw: livePool.poolUsd,
        balance_eth: livePool.poolEthFormatted,
        wallet_eth: livePool.walletEth,
        payout_wallet_address: livePool.payoutWalletAddress,
        balance_tokens: `${livePool.poolEthFormatted} SOL`,
        total_distributed_usd: formatUsd(payoutStats.total_distributed_usd),
        total_distributed_sol: payoutStats.total_distributed_sol.toFixed(6),
        total_cycles: payoutStats.total_cycles,
        average_payout_usd: formatUsd(payoutStats.average_payout_usd),
        last_deposit_at: null,
        last_payout_at: payoutStats.last_payout_at?.toISOString() ?? null,
        payout_enabled: isPoolFundedForPayout(livePool),
        minimum_pool_usd: formatUsd(config.minPoolForPayout),
        payout_split: getPayoutSplitLabels(),
        source: 'on-chain',
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pool'
    console.error('[Pool] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
