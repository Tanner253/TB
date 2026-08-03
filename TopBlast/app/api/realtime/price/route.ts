/**
 * Real-time price endpoint — Robinhood Chain ERC-20
 */

import { NextResponse } from 'next/server'
import { getTokenData } from '@/lib/evm/price'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

let priceCache: {
  price: number | null
  supply: number | null
  marketCap: number | null
  lastFetch: number
} = {
  price: null,
  supply: null,
  marketCap: null,
  lastFetch: 0,
}

const CACHE_TTL = 5000

export async function GET() {
  try {
    const now = Date.now()

    if (priceCache.lastFetch > 0 && now - priceCache.lastFetch < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: {
          price: priceCache.price,
          supply: priceCache.supply,
          market_cap: priceCache.marketCap,
          cached: true,
          ttl_remaining: CACHE_TTL - (now - priceCache.lastFetch),
        },
      })
    }

    const tokenData = await getTokenData(config.tokenMint)
    const price = tokenData?.price ?? null
    const supply = tokenData?.marketCap && price ? tokenData.marketCap / price : null
    const marketCap = tokenData?.marketCap ?? null

    priceCache = { price, supply, marketCap, lastFetch: now }

    return NextResponse.json({
      success: true,
      data: {
        price,
        supply,
        market_cap: marketCap,
        cached: false,
      },
    })
  } catch (error: any) {
    if (priceCache.price !== null) {
      return NextResponse.json({
        success: true,
        data: {
          price: priceCache.price,
          supply: priceCache.supply,
          market_cap: priceCache.marketCap,
          cached: true,
          stale: true,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch price' },
      { status: 500 }
    )
  }
}
