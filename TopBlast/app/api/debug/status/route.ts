/**
 * Debug Status Endpoint
 * Shows the status of all services for troubleshooting
 */

import { NextResponse } from 'next/server'
import { config } from '@/lib/config'
import connectDB from '@/lib/db'
import { getServiceStatus, loadRankingsFromDb } from '@/lib/tracker/holderService'
import { getTrackerStatus } from '@/lib/tracker/init'
import { checkHeliusHealth, getHolderCount } from '@/lib/solana/helius'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  }

  // 1. Check config
  status.config = {
    tokenMint: config.tokenMint ? `${config.tokenMint.slice(0, 8)}...` : 'NOT SET',
    tokenSymbol: config.tokenSymbol,
    heliusApiKey: config.heliusApiKey ? 'SET' : 'NOT SET',
    heliusRpcUrl: config.heliusRpcUrl ? 'SET' : 'NOT SET',
    mongodbUri: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
  }

  // 2. Check MongoDB connection
  try {
    const conn = await connectDB()
    status.mongodb = {
      connected: !!conn,
      readyState: conn?.connection?.readyState,
    }
  } catch (error: any) {
    status.mongodb = {
      connected: false,
      error: error.message,
    }
  }

  // 3. Check Helius RPC health
  try {
    const heliusHealth = await checkHeliusHealth()
    status.helius = {
      healthy: heliusHealth.healthy,
      latency: heliusHealth.latency,
    }
  } catch (error: any) {
    status.helius = {
      healthy: false,
      error: error.message,
    }
  }

  // 4. Check token holders count
  try {
    if (config.tokenMint) {
      const holderCount = await getHolderCount(config.tokenMint)
      status.holderCount = {
        total: holderCount,
      }
    } else {
      status.holderCount = { error: 'No token mint configured' }
    }
  } catch (error: any) {
    status.holderCount = {
      error: error.message,
    }
  }

  // 5. Check token price
  try {
    if (config.tokenMint) {
      const tokenPrice = await getTokenPrice(config.tokenMint)
      const solPrice = await getSolPrice()
      status.prices = {
        token: tokenPrice,
        sol: solPrice,
      }
    } else {
      status.prices = { error: 'No token mint configured' }
    }
  } catch (error: any) {
    status.prices = {
      error: error.message,
    }
  }

  // 6. Check holder service status
  status.holderService = getServiceStatus()
  status.tracker = getTrackerStatus()

  // 7. Check database rankings
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
    status.dbRankings = {
      error: error.message,
    }
  }

  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

