import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'

export const dynamic = 'force-dynamic'

function verifyAdminSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === config.cronSecret
}

/** Read live pool from payout wallet on-chain — the only source of truth. */
export async function GET(request: NextRequest) {
  if (!verifyAdminSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const livePool = await getLivePoolBalance()
  return NextResponse.json({
    success: true,
    data: {
      source: 'on-chain',
      payout_wallet_address: livePool.payoutWalletAddress,
      wallet_eth: livePool.walletEth,
      pool_eth: livePool.poolEthFormatted,
      pool_usd: livePool.poolUsdFormatted,
      pool_usd_raw: livePool.poolUsd,
      note: 'Fund the payout wallet with ETH on Robinhood Chain. MongoDB pool records are not used.',
    },
  })
}

/** Pool size is not set via API — deposit ETH to the payout wallet on-chain. */
export async function POST(request: NextRequest) {
  if (!verifyAdminSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const livePool = await getLivePoolBalance()
  return NextResponse.json({
    success: false,
    error: 'Pool balance is read from the payout wallet on-chain only. Send ETH to the payout wallet instead of using this endpoint.',
    data: {
      payout_wallet_address: livePool.payoutWalletAddress,
      current_pool_usd: livePool.poolUsdFormatted,
    },
  }, { status: 400 })
}
