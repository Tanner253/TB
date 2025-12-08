/**
 * Real-time price endpoint with caching
 * Fetches price and market cap from Jupiter/Helius
 */

import { NextResponse } from 'next/server'
import axios from 'axios'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

// In-memory cache
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

const CACHE_TTL = 5000 // 5 seconds

async function fetchPriceAndSupply(): Promise<{
  price: number | null
  supply: number | null
  marketCap: number | null
}> {
  const tokenMint = config.tokenMint
  let price: number | null = null
  let supply: number | null = null

  // 1. Get price from Jupiter (most reliable)
  try {
    const jupResponse = await axios.get(
      `https://price.jup.ag/v6/price?ids=${tokenMint}`,
      { timeout: 5000 }
    )
    if (jupResponse.data?.data?.[tokenMint]?.price) {
      price = jupResponse.data.data[tokenMint].price
    }
  } catch {
    // Jupiter failed
  }

  // 2. Fallback: Try Helius DAS API for price
  if (price === null && config.heliusApiKey) {
    try {
      const dasResponse = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`,
        {
          jsonrpc: '2.0',
          id: 'price',
          method: 'getAsset',
          params: {
            id: tokenMint,
            displayOptions: { showFungible: true },
          },
        },
        { timeout: 5000 }
      )

      const asset = dasResponse.data?.result
      if (asset?.token_info?.price_info?.price_per_token) {
        price = asset.token_info.price_info.price_per_token
      }
    } catch {
      // DAS failed
    }
  }

  // 3. Get supply - try Helius RPC first
  if (config.heliusRpcUrl) {
    try {
      const response = await axios.post(
        config.heliusRpcUrl,
        {
          jsonrpc: '2.0',
          id: 'supply-rpc',
          method: 'getTokenSupply',
          params: [tokenMint],
        },
        { timeout: 5000 }
      )

      if (response.data?.result?.value) {
        const supplyData = response.data.result.value
        const decimals = supplyData.decimals
        supply = parseFloat(supplyData.amount) / Math.pow(10, decimals)
      }
    } catch {
      // RPC failed
    }
  }

  // 4. Fallback: Try standard RPC for supply
  if (supply === null && config.heliusApiKey) {
    try {
      const supplyResponse = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`,
        {
          jsonrpc: '2.0',
          id: 'supply',
          method: 'getTokenSupply',
          params: [tokenMint],
        },
        { timeout: 5000 }
      )

      if (supplyResponse.data?.result?.value) {
        const supplyData = supplyResponse.data.result.value
        const decimals = supplyData.decimals
        supply = parseFloat(supplyData.amount) / Math.pow(10, decimals)
      }
    } catch {
      // Supply fetch failed
    }
  }

  const marketCap = price && supply ? price * supply : null

  return { price, supply, marketCap }
}

export async function GET() {
  try {
    const now = Date.now()

    // Return cached data if fresh
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

    // Fetch fresh data
    const { price, supply, marketCap } = await fetchPriceAndSupply()

    // Update cache
    priceCache = {
      price,
      supply,
      marketCap,
      lastFetch: now,
    }

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
    // Return cached data on error if available
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
