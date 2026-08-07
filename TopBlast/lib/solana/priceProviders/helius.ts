import axios from 'axios'
import { config } from '@/lib/config'
import type { ResolvedTokenPrice } from './types'

function getHeliusRpcUrl(): string | null {
  if (!config.heliusApiKey) return null
  return `https://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`
}

/** Last-resort price source — uses Helius DAS (expensive; avoid for high-frequency polls). */
export async function fetchHeliusPrice(mint: string): Promise<ResolvedTokenPrice | null> {
  const rpcUrl = getHeliusRpcUrl()
  const normalizedMint = mint.trim()
  if (!rpcUrl || !normalizedMint) return null

  try {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: normalizedMint },
      },
      { timeout: 10000 }
    )

    const price = response.data?.result?.token_info?.price_info?.price_per_token
    if (!price || !Number.isFinite(price) || price <= 0) return null

    return {
      mint: normalizedMint,
      price,
      marketCap: null,
      volume24h: null,
      priceChange24h: null,
      source: 'helius',
      pair: null,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}
