/**
 * Debug Status Endpoint — Solana / Helius
 */

import { NextResponse } from 'next/server'
import { config } from '@/lib/config'
import connectDB from '@/lib/db'
import { getServiceStatus, loadRankingsFromDb } from '@/lib/tracker/holderService'
import { getTrackerStatus } from '@/lib/tracker/init'
import { checkRpcHealth, getHolderCount } from '@/lib/solana/indexer'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    chain: 'solana',
    network: config.solanaNetwork,
  }

  status.config = {
    tokenMint: config.tokenMint ? `${config.tokenMint.slice(0, 8)}...` : 'NOT SET',
    tokenSymbol: config.tokenSymbol,
    heliusApiKey: config.heliusApiKey ? 'SET' : 'NOT SET',
    heliusRpcUrl: config.heliusRpcUrl ? 'SET' : 'NOT SET',
    mongodbUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
    executePayouts: config.executePayouts,
  }

  try {
    const conn = await connectDB()
    status.mongodb = {
      connected: !!conn,
      readyState: conn?.connection?.readyState,
    }
  } catch (error: any) {
    status.mongodb = { connected: false, error: error.message }
  }

  try {
    const rpcHealth = await checkRpcHealth()
    status.helius = rpcHealth
  } catch (error: any) {
    status.helius = { healthy: false, error: error.message }
  }

  try {
    if (config.tokenMint) {
      status.holderCount = { total: await getHolderCount(config.tokenMint) }
    } else {
      status.holderCount = { error: 'No token mint configured' }
    }
  } catch (error: any) {
    status.holderCount = { error: error.message }
  }

  try {
    if (config.tokenMint) {
      status.prices = {
        token: await getTokenPrice(config.tokenMint),
        sol: await getSolPrice(),
      }
    } else {
      status.prices = { error: 'No token mint configured' }
    }
  } catch (error: any) {
    status.prices = { error: error.message }
  }

  status.holderService = getServiceStatus()
  status.tracker = getTrackerStatus()

  try {
    const livePool = await getLivePoolBalance()
    status.livePool = {
      payoutWalletAddress: livePool.payoutWalletAddress,
      walletSol: livePool.walletSol,
      poolSol: livePool.poolSol,
      poolUsd: livePool.poolUsdFormatted,
      available: livePool.available,
    }
  } catch (error: any) {
    status.livePool = { error: error.message }
  }

  try {
    const dbRankings = await loadRankingsFromDb()
    status.dbRankings = {
      hasData: !!dbRankings,
      totalHolders: dbRankings?.totalHolders || 0,
      eligibleCount: dbRankings?.eligibleCount || 0,
      holdersWithVwap: dbRankings?.holdersWithVwap || 0,
      rankingsCount: dbRankings?.rankings?.length || 0,
      lastCalculated: dbRankings?.lastCalculated?.toISOString() || null,
    }
  } catch (error: any) {
    status.dbRankings = { error: error.message }
  }

  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
