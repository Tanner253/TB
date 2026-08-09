import { Keypair } from '@solana/web3.js'
import { DEFAULT_WINNER_COUNT, validateWinnerCount } from '@/lib/payout/winnerCount'
import bs58 from 'bs58'
import 'server-only'
import type { PublicTenantSummary, TenantRuntimeConfig } from '@/lib/tenant/types'
import {
  getPlatformTenantSlug,
  getPlatformTokenMint,
  getPlatformTokenSymbol,
  isPlatformTenantSlug,
} from './config'
import { getPlatformDevWalletAddress } from './devWallet'

/** Platform token is live via server env (legacy deploy), not SaaS launch form. */
export function isPlatformEnvConfigured(): boolean {
  const mint = getPlatformTokenMint()
  const key = process.env.PAYOUT_WALLET_PRIVATE_KEY?.trim()
  return !!mint && !!key
}

export function getPlatformEnvPayoutAddress(): string {
  const key = process.env.PAYOUT_WALLET_PRIVATE_KEY?.trim()
  if (!key) return ''
  try {
    return Keypair.fromSecretKey(bs58.decode(key)).publicKey.toBase58()
  } catch {
    return ''
  }
}

export function getPlatformEnvPayoutIntervalMinutes(): number {
  return parseInt(process.env.PAYOUT_INTERVAL_MINUTES || '15', 10)
}

/** Platform mint configured in operator env (TOKEN_MINT_ADDRESS / PLATFORM_TOKEN_MINT). */
export function isPlatformMintConfigured(): boolean {
  return !!getPlatformTokenMint()
}

export function buildPlatformEnvCatalogEntry(): PublicTenantSummary {
  return {
    slug: getPlatformTenantSlug(),
    symbol: getPlatformTokenSymbol(),
    mint: getPlatformTokenMint(),
    status: 'active',
    createdAt: new Date(0).toISOString(),
    payoutWalletAddress: getPlatformEnvPayoutAddress(),
    payoutIntervalMinutes: getPlatformEnvPayoutIntervalMinutes(),
    winnerCount: validateWinnerCount(parseInt(process.env.WINNER_COUNT || String(DEFAULT_WINNER_COUNT), 10)),
    featured: true,
    isPlatformToken: true,
    runsFromEnv: true,
  }
}

/**
 * Runtime for PLATFORM_TENANT_SLUG when no Mongo tenant exists.
 * Uses _legacy Mongo scope so existing env-driven deploy data keeps working.
 */
export function resolvePlatformEnvRuntime(slug: string): TenantRuntimeConfig | null {
  if (!isPlatformTenantSlug(slug) || !isPlatformEnvConfigured()) return null

  const payoutWalletPrivateKey = process.env.PAYOUT_WALLET_PRIVATE_KEY!.trim()

  return {
    tenantSlug: '_legacy',
    tokenMint: getPlatformTokenMint(),
    tokenSymbol: getPlatformTokenSymbol(),
    tokenDecimals: parseInt(process.env.TOKEN_DECIMALS || '6', 10),
    devWalletAddress: getPlatformDevWalletAddress(),
    payoutIntervalMinutes: getPlatformEnvPayoutIntervalMinutes(),
    winnerCount: validateWinnerCount(parseInt(process.env.WINNER_COUNT || String(DEFAULT_WINNER_COUNT), 10)),
    minTokenHolding: parseInt(process.env.MIN_TOKEN_HOLDING || '1000', 10),
    minLossThresholdPct: parseFloat(process.env.MIN_LOSS_THRESHOLD_PCT || '10'),
    minPoolSol: parseFloat(process.env.MIN_POOL_SOL || process.env.MIN_POOL_ETH || '0.001'),
    minPoolEth: parseFloat(process.env.MIN_POOL_SOL || process.env.MIN_POOL_ETH || '0.001'),
    executePayouts: process.env.EXECUTE_PAYOUTS === 'true',
    payoutWalletPrivateKey,
  }
}

export function getPlatformEnvCatalogSlug(): string {
  return getPlatformTenantSlug()
}
