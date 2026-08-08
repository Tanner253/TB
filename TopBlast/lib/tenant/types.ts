export type TenantStatus = 'pending' | 'active' | 'paused'

export interface TenantRecord {
  slug: string
  mint: string
  symbol: string
  decimals: number
  devWalletAddress: string
  status: TenantStatus
  payoutIntervalMinutes: number
  minTokenHolding: number
  minLossThresholdPct: number
  minPoolSol: number
  executePayouts: boolean
  createdAt: Date
  updatedAt: Date
}

/** Runtime config merged into lib/config for the active request tenant */
export interface TenantRuntimeConfig {
  tenantSlug: string
  tokenMint: string
  tokenSymbol: string
  tokenDecimals: number
  devWalletAddress: string
  payoutIntervalMinutes: number
  minTokenHolding: number
  minLossThresholdPct: number
  minPoolSol: number
  minPoolEth: number
  executePayouts: boolean
  payoutWalletPrivateKey: string
}

export interface CreateTenantInput {
  slug: string
  mint: string
  symbol: string
  decimals?: number
  payoutWalletPrivateKey: string
  payoutIntervalMinutes?: number
  minTokenHolding?: number
}

export interface PublicTenantSummary {
  slug: string
  symbol: string
  mint: string
  status: TenantStatus
  createdAt: string
  payoutWalletAddress: string
  /** Pinned platform token — always first in catalog */
  featured?: boolean
  isPlatformToken?: boolean
  /** @deprecated Platform token never uses catalog-only setup UI */
  catalogOnly?: boolean
  /** Live session powered by TOKEN_MINT_ADDRESS + PAYOUT_WALLET_PRIVATE_KEY env */
  runsFromEnv?: boolean
  payoutIntervalMinutes?: number
  /** Live distributable SOL in the payout wallet (catalog). */
  pot_sol?: number | null
  pot_usd?: number | null
  pot_usd_formatted?: string | null
  /** Lifetime successful payout volume (winners + dev fees). */
  total_distributed_sol?: number | null
  total_distributed_usd?: number | null
  total_distributed_usd_formatted?: string | null
}
