import { NextResponse } from 'next/server'
import { formatUsd } from '@/lib/solana/price'
import { getPayoutSplitLabels } from '@/lib/payout/shares'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const livePool = await getLivePoolBalance()

    return NextResponse.json({
      success: true,
      data: {
        balance_usd: livePool.poolUsdFormatted,
        balance_raw: livePool.poolUsd,
        balance_eth: livePool.poolEthFormatted,
        wallet_eth: livePool.walletEth,
        payout_wallet_address: livePool.payoutWalletAddress,
        balance_tokens: `${livePool.poolEthFormatted} SOL`,
        total_distributed_usd: formatUsd(0),
        total_cycles: 0,
        average_payout_usd: formatUsd(0),
        last_deposit_at: null,
        last_payout_at: null,
        payout_enabled: livePool.poolUsd >= config.minPoolForPayout,
        minimum_pool_usd: formatUsd(config.minPoolForPayout),
        payout_split: getPayoutSplitLabels(),
        source: 'on-chain',
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error: any) {
    console.error('[Pool] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch pool' },
      { status: 500 }
    )
  }
}
