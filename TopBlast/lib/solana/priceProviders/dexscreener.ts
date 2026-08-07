import axios from 'axios'
import type { ResolvedPricePair, ResolvedTokenPrice } from './types'
import {
  selectBestSolanaPair,
  snapshotFromDexPair,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

export { inferMigrationStage, selectBestSolanaPair } from '@/lib/solana/dexscreenerShared'

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex'

function toResolvedPair(pair: DexScreenerPairLike): ResolvedPricePair {
  const snap = snapshotFromDexPair('', pair, 'dexscreener-rest')!
  return {
    chainId: pair.chainId,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    priceUsd: snap.price,
    marketCap: snap.marketCap,
    volume24h: snap.volume24h,
    priceChange24h: snap.priceChange24h,
    liquidityUsd: pair.liquidity?.usd ?? null,
    migrationStage: snap.migrationStage!,
    url: pair.url ?? null,
  }
}

export async function fetchDexScreenerPrice(mint: string): Promise<ResolvedTokenPrice | null> {
  const normalizedMint = mint.trim()
  if (!normalizedMint) return null

  try {
    const response = await axios.get(`${DEXSCREENER_BASE}/tokens/${normalizedMint}`, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    })

    const pairs: DexScreenerPairLike[] = response.data?.pairs ?? []
    const best = selectBestSolanaPair(pairs, normalizedMint)
    if (!best) return null

    const resolvedPair = toResolvedPair(best)
    return {
      mint: normalizedMint,
      price: resolvedPair.priceUsd,
      marketCap: resolvedPair.marketCap,
      volume24h: resolvedPair.volume24h,
      priceChange24h: resolvedPair.priceChange24h,
      source: 'dexscreener',
      pair: resolvedPair,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}
