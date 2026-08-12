import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import 'server-only'
import type { PublicTenantSummary, TenantRuntimeConfig } from '@/lib/tenant/types'
import { getPlatformDevWalletAddress } from '@/lib/platform/devWallet'
import { isPlatformTenantSlug } from '@/lib/platform/config'

/**
 * Operator-only manual listing via env (not the platform token).
 * Renders like a normal catalog tenant — no PLATFORM badge / not featured.
 * Uses its real slug for Mongo payout/timer scope (never _legacy).
 *
 * Fixed session rules (requested):
 *   - 10 winners
 *   - 100,000 min token holding
 *   - 60 minute cycles
 */

export const MANUAL_WINNER_COUNT = 10
export const MANUAL_MIN_TOKEN_HOLDING = 100_000
export const MANUAL_PAYOUT_INTERVAL_MINUTES = 60

export function getManualTenantSlug(): string {
  return (process.env.MANUAL_TENANT_SLUG || '').trim().toLowerCase()
}

export function getManualTokenMint(): string {
  return (process.env.MANUAL_TOKEN_MINT || '').trim()
}

export function getManualTokenSymbol(): string {
  return (process.env.MANUAL_TOKEN_SYMBOL || 'TOKEN').trim() || 'TOKEN'
}

export function isManualTenantSlug(slug: string): boolean {
  const manual = getManualTenantSlug()
  return !!manual && slug.trim().toLowerCase() === manual
}

export function isManualEnvConfigured(): boolean {
  const slug = getManualTenantSlug()
  const mint = getManualTokenMint()
  const key = process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY?.trim()
  if (!slug || !mint || !key) return false
  if (isPlatformTenantSlug(slug) || slug === '_legacy') return false
  return true
}

/** Catalog can show the card once mint+slug exist; payouts need the key. */
export function isManualMintConfigured(): boolean {
  const slug = getManualTenantSlug()
  const mint = getManualTokenMint()
  if (!slug || !mint) return false
  if (isPlatformTenantSlug(slug) || slug === '_legacy') return false
  return true
}

export function getManualEnvPayoutAddress(): string {
  const key = process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY?.trim()
  if (!key) return ''
  try {
    return Keypair.fromSecretKey(bs58.decode(key)).publicKey.toBase58()
  } catch {
    return ''
  }
}

export function buildManualEnvCatalogEntry(): PublicTenantSummary {
  return {
    slug: getManualTenantSlug(),
    symbol: getManualTokenSymbol(),
    mint: getManualTokenMint(),
    status: 'active',
    createdAt: new Date(0).toISOString(),
    payoutWalletAddress: getManualEnvPayoutAddress(),
    payoutIntervalMinutes: MANUAL_PAYOUT_INTERVAL_MINUTES,
    winnerCount: MANUAL_WINNER_COUNT,
    featured: false,
    isPlatformToken: false,
    // Do NOT set runsFromEnv — that flag maps payout metrics to _legacy (platform only).
  }
}

export function resolveManualEnvRuntime(slug: string): TenantRuntimeConfig | null {
  if (!isManualTenantSlug(slug) || !isManualEnvConfigured()) return null

  const payoutWalletPrivateKey = process.env.MANUAL_PAYOUT_WALLET_PRIVATE_KEY!.trim()
  const manualSlug = getManualTenantSlug()

  return {
    tenantSlug: manualSlug,
    tokenMint: getManualTokenMint(),
    tokenSymbol: getManualTokenSymbol(),
    tokenDecimals: parseInt(process.env.MANUAL_TOKEN_DECIMALS || '6', 10),
    devWalletAddress: getPlatformDevWalletAddress(),
    payoutIntervalMinutes: MANUAL_PAYOUT_INTERVAL_MINUTES,
    winnerCount: MANUAL_WINNER_COUNT,
    minTokenHolding: MANUAL_MIN_TOKEN_HOLDING,
    minLossThresholdPct: parseFloat(process.env.MANUAL_MIN_LOSS_THRESHOLD_PCT || '10'),
    minPoolSol: parseFloat(process.env.MANUAL_MIN_POOL_SOL || '0.001'),
    minPoolEth: parseFloat(process.env.MANUAL_MIN_POOL_SOL || '0.001'),
    executePayouts: process.env.MANUAL_EXECUTE_PAYOUTS === 'true',
    payoutWalletPrivateKey,
  }
}
