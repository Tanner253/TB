/**
 * Helius Webhook Endpoint
 * Receives real-time transaction notifications for the token
 * Records buys and sells to track losers
 */

import { NextRequest, NextResponse } from 'next/server'
import { recordBuy, recordSell, setBaselinePrice } from '@/lib/tracker/realtime'
import { getTokenPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Helius sends an array of transactions
    const transactions = Array.isArray(body) ? body : [body]
    
    // Get current price for recording
    const currentPrice = await getTokenPrice(config.tokenMint)
    if (currentPrice) {
      setBaselinePrice(currentPrice)
    }
    
    let buysProcessed = 0
    let sellsProcessed = 0

    for (const tx of transactions) {
      // Look for SWAP transactions involving our token
      if (tx.type === 'SWAP' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          // Check if this involves our token
          if (transfer.mint !== config.tokenMint) continue
          
          const tokenAmount = transfer.tokenAmount || 0
          if (tokenAmount <= 0) continue

          // Determine price from the swap
          let pricePerToken = currentPrice || 0
          
          // Try to calculate from SOL transfer
          if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
            const solAmount = tx.nativeTransfers[0].amount / 1e9
            const solPrice = 150 // Rough estimate, should use real SOL price
            const usdValue = solAmount * solPrice
            if (tokenAmount > 0) {
              pricePerToken = usdValue / tokenAmount
            }
          }

          // BUY: User received the token
          if (transfer.toUserAccount && transfer.toUserAccount !== config.tokenMint) {
            recordBuy(transfer.toUserAccount, tokenAmount, pricePerToken)
            buysProcessed++
          }
          
          // SELL: User sent the token
          if (transfer.fromUserAccount && transfer.fromUserAccount !== config.tokenMint) {
            recordSell(transfer.fromUserAccount)
            sellsProcessed++
          }
        }
      }
      
      // Also check for direct token transfers (not swaps)
      if (tx.type === 'TRANSFER' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          if (transfer.mint !== config.tokenMint) continue
          
          // If someone transfers tokens OUT, treat as sell (disqualify)
          if (transfer.fromUserAccount) {
            recordSell(transfer.fromUserAccount)
            sellsProcessed++
          }
        }
      }
    }

    console.log(`[Webhook] Processed ${transactions.length} txns: ${buysProcessed} buys, ${sellsProcessed} sells`)

    return NextResponse.json({
      success: true,
      processed: transactions.length,
      buys: buysProcessed,
      sells: sellsProcessed,
    })
  } catch (error: any) {
    console.error('[Webhook] Error:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Helius webhook endpoint active',
    token: config.tokenMint,
  })
}

