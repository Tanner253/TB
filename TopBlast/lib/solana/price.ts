import axios from 'axios'
import { config } from '@/lib/config'

export interface TokenPriceData {
  price: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
}

// In-memory price cache to reduce logging
let priceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 }
const PRICE_CACHE_TTL = 10000 // 10 seconds

// SOL price cache - short TTL for accurate prize pool display
let solPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 }
const SOL_PRICE_CACHE_TTL = 10000 // 10 seconds - keep it fresh for accurate USD display

function getHeliusRpcUrl(): string {
  if (!config.heliusApiKey) {
    throw new Error('HELIUS_API_KEY is required')
  }
  return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`
}

// Get token price from Helius DAS API
export async function getTokenPrice(mint?: string): Promise<number | null> {
  const tokenMint = mint || config.tokenMint
  if (!tokenMint) return null

  // Return cached price if fresh
  const now = Date.now()
  if (priceCache.price !== null && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price
  }

  if (!config.heliusApiKey) {
    return null
  }

  try {
    const response = await axios.post(
      getHeliusRpcUrl(),
      {
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: tokenMint },
      },
      { timeout: 10000 }
    )

    const asset = response.data?.result
    if (asset?.token_info?.price_info?.price_per_token) {
      const price = asset.token_info.price_info.price_per_token
      
      // Only log if price changed significantly (>1%)
      if (priceCache.price === null || Math.abs(price - priceCache.price) / priceCache.price > 0.01) {
        console.log(`[Price] ${tokenMint.slice(0, 8)}... = $${price}`)
      }
      
      priceCache = { price, timestamp: now }
      return price
    }

    return null
  } catch (error: any) {
    // Return cached price on error
    if (priceCache.price !== null) {
      return priceCache.price
    }
    return null
  }
}

// Get extended token data including market cap
export async function getTokenData(mint?: string): Promise<TokenPriceData | null> {
  const tokenMint = mint || config.tokenMint
  if (!tokenMint || !config.heliusApiKey) return null

  try {
    // Get asset info (includes price)
    const assetResponse = await axios.post(
      getHeliusRpcUrl(),
      {
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: tokenMint },
      },
      { timeout: 10000 }
    )

    const asset = assetResponse.data?.result
    const price = asset?.token_info?.price_info?.price_per_token || null

    if (!price) {
      return null
    }

    // Get supply for market cap calculation
    let marketCap: number | null = null

    try {
      const supplyResponse = await axios.post(
        getHeliusRpcUrl(),
        {
          jsonrpc: '2.0',
          id: 'supply',
          method: 'getTokenSupply',
          params: [tokenMint],
        },
        { timeout: 10000 }
      )

      if (supplyResponse.data?.result?.value) {
        const supply = supplyResponse.data.result.value
        const totalSupply = parseFloat(supply.amount) / Math.pow(10, supply.decimals)
        marketCap = price * totalSupply
      }
    } catch {
      // Could not fetch supply
    }

    return {
      price,
      marketCap,
      volume24h: null,
      priceChange24h: null,
    }
  } catch {
    return null
  }
}

// Format price for display
export function formatPrice(price: number): string {
  if (price === 0) return '$0'

  // Very small prices (memecoins)
  if (price < 0.0000001) {
    return `$${price.toExponential(2)}`
  }
  if (price < 0.0001) {
    return `$${price.toFixed(10)}`
  }
  if (price < 0.01) {
    return `$${price.toFixed(8)}`
  }
  if (price < 1) {
    return `$${price.toFixed(6)}`
  }
  return `$${price.toFixed(4)}`
}

// Format USD for display
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return '<$0.01'

  // Format large numbers
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(2)}K`
  }

  return `$${amount.toFixed(2)}`
}

// Format large numbers (tokens)
export function formatTokens(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`
  }
  return amount.toFixed(0)
}

// Get current SOL price from Jupiter (primary) or CoinGecko (fallback)
export async function getSolPrice(): Promise<number | null> {
  const now = Date.now()
  
  // Return cached price if fresh
  if (solPriceCache.price !== null && now - solPriceCache.timestamp < SOL_PRICE_CACHE_TTL) {
    return solPriceCache.price
  }

  // Try Jupiter first
  try {
    const response = await axios.get(
      'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
      { timeout: 5000 }
    )
    
    const solData = response.data?.data?.['So11111111111111111111111111111111111111112']
    if (solData?.price) {
      const price = parseFloat(solData.price)
      console.log(`[Price] SOL = $${price.toFixed(2)} (Jupiter)`)
      solPriceCache = { price, timestamp: now }
      return price
    }
  } catch (error) {
    console.log('[Price] Jupiter failed, trying CoinGecko...')
  }

  // Fallback to CoinGecko
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { timeout: 5000 }
    )
    
    if (response.data?.solana?.usd) {
      const price = response.data.solana.usd
      console.log(`[Price] SOL = $${price.toFixed(2)} (CoinGecko)`)
      solPriceCache = { price, timestamp: now }
      return price
    }
  } catch (error) {
    console.error('[Price] CoinGecko also failed')
  }

  // Return stale cache if available
    if (solPriceCache.price !== null) {
    console.log(`[Price] Using stale SOL price: $${solPriceCache.price.toFixed(2)}`)
      return solPriceCache.price
  }
  
  return null
}

// Get cached SOL price (non-async, for quick access)
export function getCachedSolPrice(): number | null {
  return solPriceCache.price
}
