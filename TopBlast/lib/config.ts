// Environment configuration — Robinhood Chain (EVM)
// Env var names kept compatible with existing Vercel deployment

import { MIN_HOLD_DURATION_MINUTES } from '@/lib/eligibility/holdDuration'
import { getEvmChainId, getEvmRpcUrl } from '@/lib/evm/chain'

export const config = {
  // Token Configuration (ERC-20 contract address in TOKEN_MINT_ADDRESS)
  tokenMint: process.env.TOKEN_MINT_ADDRESS || '',
  tokenDecimals: parseInt(process.env.TOKEN_DECIMALS || '18'),
  tokenSymbol: process.env.TOKEN_SYMBOL || 'TOKEN',

  // EVM / Robinhood Chain
  evmChainId: getEvmChainId(),
  evmRpcUrl: getEvmRpcUrl(),

  // Legacy aliases (same env keys, repurposed for EVM)
  heliusApiKey: process.env.HELIUS_API_KEY || '',
  heliusRpcUrl: process.env.HELIUS_RPC_URL || getEvmRpcUrl(),

  // Pool Configuration — 99% of payout wallet ETH balance
  poolPercentage: 0.99,
  // Minimum pool (ETH) before executing a payout cycle (default = one min transfer)
  minPoolSol: parseFloat(process.env.MIN_POOL_ETH || process.env.MIN_POOL_SOL || '0.001'),
  minPoolEth: parseFloat(process.env.MIN_POOL_ETH || process.env.MIN_POOL_SOL || '0.001'),

  // @deprecated — not used for live pool. Pool = payout wallet ETH balance on-chain.
  poolBalanceUsd: parseFloat(process.env.POOL_BALANCE_USD || '500'),
  poolBalanceTokens: parseInt(process.env.POOL_BALANCE_TOKENS || '1000000000'),

  // Eligibility Thresholds
  minTokenHolding: parseInt(process.env.MIN_TOKEN_HOLDING || '1000'),
  minHoldDurationMinutes: MIN_HOLD_DURATION_MINUTES,
  minLossThresholdPct: parseFloat(process.env.MIN_LOSS_THRESHOLD_PCT || '10'),
  minPoolForPayout: parseFloat(process.env.MIN_POOL_FOR_PAYOUT || '50'),

  // Payout Timing
  payoutIntervalMinutes: parseInt(process.env.PAYOUT_INTERVAL_MINUTES || '5'),

  // Dev Fee
  devWalletAddress: process.env.DEV_WALLET_ADDRESS || '',
  devFeePct: 0.12,

  // Payout Distribution (of remaining 88% after dev fee)
  payoutSplit: {
    first: 0.60,
    second: 0.25,
    third: 0.15,
  },

  maxHoldersToProcess: parseInt(process.env.MAX_HOLDERS_TO_PROCESS || '50000'),

  cronSecret: process.env.CRON_SECRET || '',

  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  executePayouts: process.env.EXECUTE_PAYOUTS === 'true' && !!process.env.PAYOUT_WALLET_PRIVATE_KEY,
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.tokenMint) {
    errors.push('TOKEN_MINT_ADDRESS is required')
  } else if (!config.tokenMint.startsWith('0x')) {
    errors.push('TOKEN_MINT_ADDRESS must be an EVM contract address (0x...)')
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
