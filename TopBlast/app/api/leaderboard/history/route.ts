/**
 * Payout History API - Shows REAL transaction data from database
 * No mock data, only actual blockchain transactions
 */

import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { Payout } from '@/lib/db/models'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

// Generate Solscan link
function getSolscanLink(txHash: string | null | undefined): string | null {
  if (!txHash) return null
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://solscan.io/tx/${txHash}${cluster}`
}

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const network = process.env.SOLANA_NETWORK || 'mainnet'

    // Get REAL payouts from database - grouped by cycle
    const payouts = await Payout.find()
      .sort({ cycle: -1, rank: 1 })
      .limit(limit * 4) // 4 payouts per cycle max (dev + 3 winners)
      .lean()

    // Group by cycle
    const cycleMap = new Map<number, any>()
    
    for (const p of payouts) {
      if (!cycleMap.has(p.cycle)) {
        cycleMap.set(p.cycle, {
          cycle: p.cycle,
          timestamp: p.createdAt,
          payouts: [],
          total_sol: 0,
          total_usd: 0,
          success_count: 0,
          failed_count: 0,
        })
      }
      
      const cycle = cycleMap.get(p.cycle)!
      
      cycle.payouts.push({
        rank: p.rank,
        type: p.rank === 0 ? 'dev_fee' : 'winner',
        wallet: p.wallet,
        wallet_display: `${p.wallet.slice(0, 4)}...${p.wallet.slice(-4)}`,
        amount_sol: (p.amountTokens || 0).toFixed(6),
        amount_usd: (p.amount || 0).toFixed(2),
        drawdown_pct: p.rank > 0 ? p.drawdownPct?.toFixed(2) : null,
        loss_usd: p.rank > 0 ? p.lossUsd?.toFixed(2) : null,
        tx_hash: p.txHash,
        solscan_url: getSolscanLink(p.txHash),
        status: p.status,
        error: p.errorMessage,
      })
      
      if (p.status === 'success') {
        cycle.total_sol += p.amountTokens || 0
        cycle.total_usd += p.amount || 0
        cycle.success_count++
      } else {
        cycle.failed_count++
      }
    }

    // Convert to array - ensure payouts is always an array
    const cycles = Array.from(cycleMap.values())
      .sort((a, b) => b.cycle - a.cycle)
      .slice(0, limit)
      .map(c => ({
        ...c,
        payouts: c.payouts || [], // Ensure payouts is always an array
        timestamp: new Date(c.timestamp).toISOString(),
        total_sol: c.total_sol.toFixed(6),
        total_usd: c.total_usd.toFixed(2),
        status: c.failed_count === 0 ? 'success' : c.success_count === 0 ? 'failed' : 'partial',
      }))

    // Calculate stats
    const allPayouts = await Payout.find().lean()
    const successfulPayouts = allPayouts.filter(p => p.status === 'success')
    const totalDistributed = successfulPayouts.reduce((sum, p) => sum + (p.amountTokens || 0), 0)
    const uniqueCycles = new Set(allPayouts.map(p => p.cycle))

    return NextResponse.json({
      success: true,
      data: {
        network,
        token_symbol: config.tokenSymbol,
        stats: {
          total_cycles: uniqueCycles.size,
          total_payouts: successfulPayouts.length,
          total_distributed_sol: totalDistributed.toFixed(6),
          failed_payouts: allPayouts.length - successfulPayouts.length,
        },
        cycles,
      },
    })
  } catch (error: any) {
    console.error('[History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch history',
    }, { status: 500 })
  }
}
