// Environment configuration - ALL DATA IS REAL
// The only thing not implemented is actual token transfers

export const config = {
  // Token Configuration
  tokenMint: process.env.TOKEN_MINT_ADDRESS || '',
  tokenDecimals: parseInt(process.env.TOKEN_DECIMALS || '6'),
  tokenSymbol: process.env.TOKEN_SYMBOL || 'TOKEN',

  // Helius Configuration
  heliusApiKey: process.env.HELIUS_API_KEY || '',
  heliusRpcUrl: process.env.HELIUS_RPC_URL || '',

  // Pool Configuration
  // Pool = 99% of payout wallet balance (keeps 1% for rent/fees)
  // This ensures we never zero out the wallet
  poolPercentage: 0.99, // Use 99% of wallet balance
  // Minimum pool to trigger payouts (ensures all transfers are above 0.001 SOL minimum)
  // 0.025 SOL ensures even 3rd place (4.75%) gets 0.00119 SOL
  // Default ~$5.50 at $220/SOL - low for testing, set MIN_POOL_SOL higher for production
  minPoolSol: parseFloat(process.env.MIN_POOL_SOL || '0.025'),
  
  poolBalanceUsd: parseFloat(process.env.POOL_BALANCE_USD || '500'),
  poolBalanceTokens: parseInt(process.env.POOL_BALANCE_TOKENS || '1000000000'),

  // Eligibility Thresholds
  minTokenHolding: parseInt(process.env.MIN_TOKEN_HOLDING || '1000'), // Minimum tokens to hold
  minHoldDurationHours: parseFloat(process.env.MIN_HOLD_DURATION_HOURS || '0'), // Hours required to hold
  minLossThresholdPct: parseFloat(process.env.MIN_LOSS_THRESHOLD_PCT || '10'), // Loss must be >= 10% of pool
  minPoolForPayout: parseFloat(process.env.MIN_POOL_FOR_PAYOUT || '50'),

  // Payout Timing
  payoutIntervalMinutes: parseInt(process.env.PAYOUT_INTERVAL_MINUTES || '5'), // 5 minutes for testing

  // Dev Fee (taken off the top before winner split)
  devWalletAddress: process.env.DEV_WALLET_ADDRESS || '',
  devFeePct: 0.05, // 5% to dev wallet

  // Payout Distribution (of remaining 95% after dev fee)
  payoutSplit: {
    first: 0.80,
    second: 0.15,
    third: 0.05,
  },

  // Processing Limits - fetch ALL holders
  maxHoldersToProcess: parseInt(process.env.MAX_HOLDERS_TO_PROCESS || '50000'),

  // Security
  cronSecret: process.env.CRON_SECRET || '',

  // Environment
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Payout execution (only this is "not live")
  // When false, winners are identified and logged but no actual transfer happens
  executePayouts: process.env.EXECUTE_PAYOUTS === 'true' && !!process.env.PAYOUT_WALLET_PRIVATE_KEY,
}

// Validate required configuration
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.tokenMint) {
    errors.push('TOKEN_MINT_ADDRESS is required')
  }

  if (!config.heliusApiKey) {
    errors.push('HELIUS_API_KEY is required')
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
