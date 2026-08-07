import axios from 'axios'
import type { ResolvedTokenPrice } from './types'

const JUPITER_LITE_PRICE = 'https://lite-api.jup.ag/price/v3'

interface JupiterPriceEntry {
  usdPrice?: number
  liquidity?: number
  priceChange24h?: number
}

export async function fetchJupiterPrice(mint: string): Promise<ResolvedTokenPrice | null> {
  const normalizedMint = mint.trim()
  if (!normalizedMint) return null

  try {
    const response = await axios.get(JUPITER_LITE_PRICE, {
      params: { ids: normalizedMint },
      timeout: 10000,
    })

    const entry: JupiterPriceEntry | undefined = response.data?.[normalizedMint]
    const price = entry?.usdPrice
    if (!price || !Number.isFinite(price) || price <= 0) return null

    return {
      mint: normalizedMint,
      price,
      marketCap: null,
      volume24h: null,
      priceChange24h: entry.priceChange24h ?? null,
      source: 'jupiter',
      pair: null,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}
