/**
 * EVM webhook endpoint — Alchemy/Blockscout transfer notifications
 * Records buys and sells to track losers (same role as Helius webhook on Solana)
 */

import { NextRequest, NextResponse } from 'next/server'
import { recordBuy, recordSell, setBaselinePrice } from '@/lib/tracker/realtime'
import { getTokenPrice, getEthPrice } from '@/lib/evm/price'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events = Array.isArray(body) ? body : [body]

    const currentPrice = await getTokenPrice(config.tokenMint)
    if (currentPrice) {
      setBaselinePrice(currentPrice)
    }

    let buysProcessed = 0
    let sellsProcessed = 0

    for (const event of events) {
      // Alchemy-style: activity array with erc20 transfers
      const transfers = event.activity || event.tokenTransfers || [event]

      for (const transfer of transfers) {
        const tokenAddress = (
          transfer.rawContract?.address ||
          transfer.mint ||
          transfer.tokenAddress ||
          ''
        ).toLowerCase()

        if (tokenAddress !== config.tokenMint.toLowerCase()) continue

        const tokenAmount = parseFloat(
          transfer.value ||
          transfer.tokenAmount ||
          transfer.rawContract?.rawValue ||
          '0'
        )
        if (tokenAmount <= 0) continue

        const to = (transfer.toAddress || transfer.to || '').toLowerCase()
        const from = (transfer.fromAddress || transfer.from || '').toLowerCase()

        let pricePerToken = currentPrice || 0
        const ethPrice = (await getEthPrice()) || 3500

        if (transfer.value && transfer.rawContract?.decimals) {
          const decimals = transfer.rawContract.decimals
          const amount = parseFloat(transfer.value) / Math.pow(10, decimals)
          if (amount > 0 && event.value) {
            const ethSpent = parseFloat(event.value) / 1e18
            pricePerToken = (ethSpent * ethPrice) / amount
          }
        }

        if (to && to !== from) {
          recordBuy(to, tokenAmount, pricePerToken, tokenAmount)
          buysProcessed++
        }
        if (from && from !== to) {
          recordSell(from, 0)
          sellsProcessed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: { buys: buysProcessed, sells: sellsProcessed },
    })
  } catch (error: any) {
    console.error('[Webhook/EVM] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', chain: 'robinhood-evm' })
}
