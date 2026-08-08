import axios from 'axios'
import { config } from '@/lib/config'
import { resolveTokenPrice } from './priceProviders/resolve'
import type { ResolvedTokenPrice } from './priceProviders/types'

export type { ResolvedTokenPrice, PriceSource, PumpMigrationStage } from './priceProviders/types'
export { inferMigrationStage, selectBestSolanaPair } from './priceProviders/dexscreener'

export interface TokenPriceData {
  price: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  source?: string
  pair?: ResolvedTokenPrice['pair']
}

// SOL price cache - 1 hour TTL
let solPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 }
const SOL_PRICE_CACHE_TTL = 60 * 60 * 1000

export async function getTokenPrice(mint?: string): Promise<number | null> {
  const resolved = await getResolvedTokenPrice(mint)
  return resolved?.price ?? null
}

export async function getResolvedTokenPrice(mint?: string): Promise<ResolvedTokenPrice | null> {
  const tokenMint = (mint || config.tokenMint)?.trim()
  if (!tokenMint) return null
  return resolveTokenPrice(tokenMint)
}

export async function getTokenData(mint?: string): Promise<TokenPriceData | null> {
  const resolved = await getResolvedTokenPrice(mint)
  if (!resolved) return null

  return {
    price: resolved.price,
    marketCap: resolved.marketCap,
    volume24h: resolved.volume24h,
    priceChange24h: resolved.priceChange24h,
    source: resolved.source,
    pair: resolved.pair,
  }
}

export function formatPrice(price: number): string {
  if (price === 0) return '$0'

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

export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return '<$0.01'

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

/** One decimal for K/M/B; whole dollars below 1K — for catalog gen volume etc. */
export function formatCompactUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '$0'
  if (amount < 1) return '<$1'

  if (amount >= 1_000_000_000) {
    return `$${formatCompactUnit(amount / 1_000_000_000)}B`
  }
  if (amount >= 1_000_000) {
    return `$${formatCompactUnit(amount / 1_000_000)}M`
  }
  if (amount >= 1_000) {
    return `$${formatCompactUnit(amount / 1_000)}K`
  }

  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/** Compact SOL for catalog gen volume — K/M above 1K, coarse below. */
export function formatCompactSol(sol: number): string {
  if (!Number.isFinite(sol) || sol <= 0) return '0 SOL'

  if (sol >= 1_000_000) {
    return `${formatCompactUnit(sol / 1_000_000)}M SOL`
  }
  if (sol >= 1_000) {
    return `${formatCompactUnit(sol / 1_000)}K SOL`
  }
  if (sol >= 1) {
    return `${formatCompactUnit(sol)} SOL`
  }
  if (sol >= 0.01) {
    return `${sol.toFixed(2)} SOL`
  }
  return '<0.01 SOL'
}

function formatCompactUnit(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

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

export async function getSolPrice(): Promise<number | null> {
  const now = Date.now()

  if (solPriceCache.price !== null && now - solPriceCache.timestamp < SOL_PRICE_CACHE_TTL) {
    return solPriceCache.price
  }

  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { timeout: 10000 }
    )

    if (response.data?.solana?.usd) {
      const price = response.data.solana.usd
      solPriceCache = { price, timestamp: now }
      return price
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('[Price] CoinGecko failed:', message)
  }

  if (solPriceCache.price !== null) {
    return solPriceCache.price
  }

  console.warn('[Price] No SOL price available, using $220 fallback')
  return 220
}

export function getCachedSolPrice(): number | null {
  return solPriceCache.price
}
