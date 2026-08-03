import axios from 'axios'
import { createPublicClient, http, parseAbi, formatUnits, isAddress } from 'viem'
import { config } from '@/lib/config'
import { getChainConfig, getEvmRpcUrl } from './chain'
import { getTokenMetadata } from './indexer'

export interface TokenPriceData {
  price: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
}

const ERC20_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
])

let priceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 }
const PRICE_CACHE_TTL = 10000

let ethPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 }
const ETH_PRICE_CACHE_TTL = 60 * 60 * 1000

function getPublicClient() {
  return createPublicClient({
    chain: getChainConfig() as any,
    transport: http(getEvmRpcUrl()),
  })
}

export async function getTokenPrice(tokenAddress?: string): Promise<number | null> {
  const address = tokenAddress || config.tokenMint
  if (!address || !isAddress(address)) return null

  const now = Date.now()
  if (priceCache.price !== null && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price
  }

  // 1. Blockscout exchange rate
  try {
    const meta = await getTokenMetadata(address)
    if (meta?.price && meta.price > 0) {
      priceCache = { price: meta.price, timestamp: now }
      console.log(`[Price] ${address.slice(0, 10)}... = $${meta.price}`)
      return meta.price
    }
  } catch {
    // continue
  }

  // 2. CoinGecko by contract (if listed)
  try {
    const chainId = config.evmChainId
    const platform = chainId === 46630 ? 'robinhood-testnet' : 'robinhood'
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address.toLowerCase()}&vs_currencies=usd`,
      { timeout: 10000 }
    )
    const price = response.data?.[address.toLowerCase()]?.usd
    if (price && price > 0) {
      priceCache = { price, timestamp: now }
      return price
    }
  } catch {
    // not listed on coingecko
  }

  if (priceCache.price !== null) return priceCache.price
  return null
}

export async function getTokenData(tokenAddress?: string): Promise<TokenPriceData | null> {
  const address = tokenAddress || config.tokenMint
  if (!address) return null

  const price = await getTokenPrice(address)
  if (!price) return null

  let marketCap: number | null = null
  try {
    const client = getPublicClient()
    const [supply, decimals] = await Promise.all([
      client.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      }),
      client.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ])
    const totalSupply = parseFloat(formatUnits(supply, decimals))
    marketCap = price * totalSupply
  } catch {
    const meta = await getTokenMetadata(address)
    if (meta?.supply) marketCap = price * meta.supply
  }

  return { price, marketCap, volume24h: null, priceChange24h: null }
}

export function formatPrice(price: number): string {
  if (price === 0) return '$0'
  if (price < 0.0000001) return `$${price.toExponential(2)}`
  if (price < 0.0001) return `$${price.toFixed(10)}`
  if (price < 0.01) return `$${price.toFixed(8)}`
  if (price < 1) return `$${price.toFixed(6)}`
  return `$${price.toFixed(4)}`
}

export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return '<$0.01'
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`
  return `$${amount.toFixed(2)}`
}

export function formatTokens(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`
  return amount.toFixed(0)
}

/** ETH/USD price — replaces getSolPrice for pool calculations */
export async function getEthPrice(): Promise<number | null> {
  const now = Date.now()
  if (ethPriceCache.price !== null && now - ethPriceCache.timestamp < ETH_PRICE_CACHE_TTL) {
    return ethPriceCache.price
  }

  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { timeout: 10000 }
    )
    if (response.data?.ethereum?.usd) {
      const price = response.data.ethereum.usd
      console.log(`[Price] ETH = $${price.toFixed(2)} (CoinGecko)`)
      ethPriceCache = { price, timestamp: now }
      return price
    }
  } catch (error: any) {
    console.error('[Price] CoinGecko ETH failed:', error.message)
  }

  if (ethPriceCache.price !== null) return ethPriceCache.price
  console.warn('[Price] No ETH price available, using $3500 fallback')
  return 3500
}

/** @deprecated Use getEthPrice — kept for minimal diff during migration */
export const getSolPrice = getEthPrice

export function getCachedEthPrice(): number | null {
  return ethPriceCache.price
}

export const getCachedSolPrice = getCachedEthPrice
