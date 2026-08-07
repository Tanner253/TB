/** Shared DexScreener pair logic (client + server safe). */

export type PumpMigrationStage = 'bonding_curve' | 'migrated' | 'standard'

export interface DexScreenerPairLike {
  chainId: string
  dexId: string
  url?: string
  pairAddress: string
  priceUsd?: string | number
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  liquidity?: { usd?: number }
  baseToken: { address: string }
  quoteToken: { address: string }
}

export interface LivePriceSnapshot {
  mint: string
  price: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  dexId: string | null
  pairAddress: string | null
  migrationStage: PumpMigrationStage | null
  source: 'dexscreener-ws' | 'dexscreener-rest' | 'jupiter-rest'
}

const PUMP_BONDING_DEX_IDS = new Set(['pumpfun', 'pump'])
const PUMP_MIGRATED_DEX_IDS = new Set(['pumpswap'])

export function parseUsd(value: string | number | undefined): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function inferMigrationStage(dexId: string): PumpMigrationStage {
  const id = dexId.toLowerCase()
  if (PUMP_BONDING_DEX_IDS.has(id)) return 'bonding_curve'
  if (PUMP_MIGRATED_DEX_IDS.has(id)) return 'migrated'
  return 'standard'
}

export function selectBestSolanaPair(
  pairs: DexScreenerPairLike[],
  mint: string
): DexScreenerPairLike | null {
  const normalizedMint = mint.trim()
  const eligible = pairs.filter(pair => {
    if (pair.chainId !== 'solana') return false
    if (!parseUsd(pair.priceUsd)) return false
    return (
      pair.baseToken.address === normalizedMint ||
      pair.quoteToken.address === normalizedMint
    )
  })

  if (eligible.length === 0) return null

  return eligible.sort((a, b) => {
    const liqA = a.liquidity?.usd ?? 0
    const liqB = b.liquidity?.usd ?? 0
    if (liqB !== liqA) return liqB - liqA
    return (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0)
  })[0]
}

export function snapshotFromDexPair(
  mint: string,
  pair: DexScreenerPairLike,
  source: LivePriceSnapshot['source']
): LivePriceSnapshot | null {
  const price = parseUsd(pair.priceUsd)
  if (!price) return null

  return {
    mint,
    price,
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    volume24h: pair.volume?.h24 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    migrationStage: inferMigrationStage(pair.dexId),
    source,
  }
}

export function extractPairFromWsPayload(
  data: unknown,
  mint: string
): DexScreenerPairLike | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  if (record.type === 'pair' && record.pair && typeof record.pair === 'object') {
    return record.pair as DexScreenerPairLike
  }

  if (Array.isArray(record.pairs) && record.pairs.length > 0) {
    return selectBestSolanaPair(record.pairs as DexScreenerPairLike[], mint)
  }

  if (record.pairAddress && record.priceUsd != null) {
    return record as DexScreenerPairLike
  }

  return null
}

export const DEXSCREENER_TOKEN_API = 'https://api.dexscreener.com/latest/dex/tokens'
export const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v3'

export function dexScreenerPairWsUrl(pairAddress: string): string {
  return `wss://io.dexscreener.com/dex/screener/pair/solana/${pairAddress.toLowerCase()}`
}
