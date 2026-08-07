// Environment configuration — Solana (Helius)
// When a tenant request is active (AsyncLocalStorage), values come from that tenant.

import { MIN_HOLD_DURATION_MINUTES } from '@/lib/eligibility/holdDuration'
import type { TenantRuntimeConfig } from '@/lib/tenant/types'

type ConfigShape = {
  tokenMint: string
  tokenDecimals: number
  tokenSymbol: string
  solanaNetwork: string
  heliusApiKey: string
  heliusRpcUrl: string
  poolPercentage: number
  minPoolSol: number
  minPoolEth: number
  poolBalanceUsd: number
  poolBalanceTokens: number
  minTokenHolding: number
  minHoldDurationMinutes: number
  minLossThresholdPct: number
  minPoolForPayout: number
  payoutIntervalMinutes: number
  devWalletAddress: string
  devFeePct: number
  payoutSplit: { first: number; second: number; third: number }
  maxHoldersToProcess: number
  cronSecret: string
  isDev: boolean
  isProd: boolean
  executePayouts: boolean
  tenantSlug: string
}

function envConfig(): ConfigShape {
  return {
    tokenMint: process.env.TOKEN_MINT_ADDRESS || '',
    tokenDecimals: parseInt(process.env.TOKEN_DECIMALS || '6'),
    tokenSymbol: process.env.TOKEN_SYMBOL || 'TopBlast',
    solanaNetwork: process.env.SOLANA_NETWORK || 'mainnet',
    heliusApiKey: process.env.HELIUS_API_KEY || '',
    heliusRpcUrl: process.env.HELIUS_RPC_URL || '',
    poolPercentage: 0.99,
    minPoolSol: parseFloat(process.env.MIN_POOL_SOL || process.env.MIN_POOL_ETH || '0.001'),
    minPoolEth: parseFloat(process.env.MIN_POOL_SOL || process.env.MIN_POOL_ETH || '0.001'),
    poolBalanceUsd: parseFloat(process.env.POOL_BALANCE_USD || '500'),
    poolBalanceTokens: parseInt(process.env.POOL_BALANCE_TOKENS || '1000000000'),
    minTokenHolding: parseInt(process.env.MIN_TOKEN_HOLDING || '1000'),
    minHoldDurationMinutes: MIN_HOLD_DURATION_MINUTES,
    minLossThresholdPct: parseFloat(process.env.MIN_LOSS_THRESHOLD_PCT || '10'),
    minPoolForPayout: parseFloat(process.env.MIN_POOL_FOR_PAYOUT || '50'),
    payoutIntervalMinutes: parseInt(process.env.PAYOUT_INTERVAL_MINUTES || '15'),
    devWalletAddress: process.env.DEV_WALLET_ADDRESS || '',
    devFeePct: 0.12,
    payoutSplit: { first: 0.60, second: 0.25, third: 0.15 },
    maxHoldersToProcess: parseInt(process.env.MAX_HOLDERS_TO_PROCESS || '50000'),
    cronSecret: process.env.CRON_SECRET || '',
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
    executePayouts:
      process.env.EXECUTE_PAYOUTS === 'true' && !!process.env.PAYOUT_WALLET_PRIVATE_KEY,
    tenantSlug: '_legacy',
  }
}

function getActiveTenant(): TenantRuntimeConfig | undefined {
  if (typeof window !== 'undefined') return undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getTenantRuntime } = require('@/lib/tenant/context') as typeof import('@/lib/tenant/context')
    return getTenantRuntime()
  } catch {
    return undefined
  }
}

function resolveConfig(): ConfigShape {
  const base = envConfig()
  const tenant = getActiveTenant()
  if (!tenant) return base

  return {
    ...base,
    tenantSlug: tenant.tenantSlug,
    tokenMint: tenant.tokenMint,
    tokenDecimals: tenant.tokenDecimals,
    tokenSymbol: tenant.tokenSymbol,
    devWalletAddress: tenant.devWalletAddress || process.env.DEV_WALLET_ADDRESS || '',
    payoutIntervalMinutes: tenant.payoutIntervalMinutes,
    minTokenHolding: tenant.minTokenHolding,
    minLossThresholdPct: tenant.minLossThresholdPct,
    minPoolSol: tenant.minPoolSol,
    minPoolEth: tenant.minPoolEth,
    executePayouts: tenant.executePayouts,
  }
}

export const config = new Proxy({} as ConfigShape, {
  get(_target, prop: string) {
    return resolveConfig()[prop as keyof ConfigShape]
  },
})

function isLikelySolanaMint(mint: string): boolean {
  if (!mint || mint.length < 32 || mint.length > 44) return false
  if (mint.startsWith('0x')) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(mint)
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.tokenMint) {
    errors.push('TOKEN_MINT_ADDRESS is required')
  } else if (!isLikelySolanaMint(config.tokenMint)) {
    errors.push('TOKEN_MINT_ADDRESS must be a Solana SPL mint (base58)')
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required')
  }

  if (!config.heliusApiKey) {
    errors.push('HELIUS_API_KEY is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
