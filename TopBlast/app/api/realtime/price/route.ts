/**
 * Returns token mint for client-side live price stream bootstrap.
 * Price display uses browser WebSocket — this route does not serve cached prices.
 */

import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const mint = config.tokenMint?.trim()
  if (!mint) {
    return NextResponse.json({ success: false, error: 'Token mint not configured' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    data: {
      mint,
      symbol: config.tokenSymbol,
      stream: 'client',
      hint: 'Use useLiveTokenPrice hook — DexScreener WebSocket from browser',
    },
  })
}
