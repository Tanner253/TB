export type PriceSource = 'dexscreener' | 'jupiter' | 'helius'

export type PumpMigrationStage = 'bonding_curve' | 'migrated' | 'standard'

export interface ResolvedPricePair {
  chainId: string
  dexId: string
  pairAddress: string
  priceUsd: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  liquidityUsd: number | null
  migrationStage: PumpMigrationStage
  url: string | null
}

export interface ResolvedTokenPrice {
  mint: string
  price: number
  marketCap: number | null
  volume24h: number | null
  priceChange24h: number | null
  source: PriceSource
  pair: ResolvedPricePair | null
  fetchedAt: number
}
