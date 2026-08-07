/**
 * Helius Webhook Endpoint
 * Receives real-time transaction notifications for the token
 * Records buys and sells to track losers
 */

import { NextRequest, NextResponse } from 'next/server'
import { recordBuy, recordSell, setBaselinePrice } from '@/lib/tracker/realtime'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const transactions = Array.isArray(body) ? body : [body]

    const currentPrice = await getTokenPrice(config.tokenMint)
    if (currentPrice) {
      setBaselinePrice(currentPrice)
    }

    let buysProcessed = 0
    let sellsProcessed = 0

    const solPrice = (await getSolPrice()) || 150

    for (const tx of transactions) {
      if (tx.type === 'SWAP' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          if (transfer.mint !== config.tokenMint) continue

          const tokenAmount = transfer.tokenAmount || 0
          if (tokenAmount <= 0) continue

          let pricePerToken = currentPrice || 0

          if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
            const solAmount = tx.nativeTransfers[0].amount / 1e9
            const usdValue = solAmount * solPrice
            if (tokenAmount > 0) {
              pricePerToken = usdValue / tokenAmount
            }
          }

          if (transfer.toUserAccount && transfer.toUserAccount !== config.tokenMint) {
            recordBuy(transfer.toUserAccount, tokenAmount, pricePerToken)
            buysProcessed++
          }

          if (transfer.fromUserAccount && transfer.fromUserAccount !== config.tokenMint) {
            recordSell(transfer.fromUserAccount)
            sellsProcessed++
          }
        }
      }

      if (tx.type === 'TRANSFER' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          if (transfer.mint !== config.tokenMint) continue

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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Helius webhook endpoint active',
    token: config.tokenMint,
  })
}
