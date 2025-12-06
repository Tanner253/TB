import { getWalletTransactions, ParsedTransaction } from '../solana/helius'
import { getTokenPrice, getSolPrice } from '../solana/price'

export interface VwapData {
  wallet: string
  vwap: number | null
  totalTokensBought: number
  totalSolSpent: number       // RAW SOL spent on buys
  totalStablecoinSpent: number // Direct USD spent (stablecoin swaps)
  totalCostBasis: number       // Calculated: (SOL × current_price) + stablecoins
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  hasSold: boolean
  hasTransferredOut: boolean
  buyCount: number
}

// Calculate VWAP from actual on-chain buy transactions
// CRITICAL: Uses CURRENT SOL price to calculate cost basis, not historical prices
export async function calculateWalletVwap(
  wallet: string,
  mint: string,
  currentTokenPrice: number,
  currentSolPrice?: number // Pass in current SOL price, or we'll fetch it
): Promise<VwapData> {
  const transactions = await getWalletTransactions(wallet, mint, 100)
  
  let totalTokensBought = 0
  let totalSolSpent = 0         // Raw SOL amount from swap transactions
  let totalStablecoinSpent = 0  // Direct USD from stablecoin swaps
  let firstBuyTimestamp: number | null = null
  let lastActivityTimestamp: number | null = null
  let hasSold = false
  let hasTransferredOut = false
  let buyCount = 0

  // Sort transactions by timestamp (oldest first)
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)

  for (const tx of sortedTxs) {
    lastActivityTimestamp = tx.timestamp

    if (tx.type === 'BUY') {
      // Track first buy
      if (!firstBuyTimestamp) {
        firstBuyTimestamp = tx.timestamp
      }

      totalTokensBought += tx.tokenAmount
      
      // Track SOL and stablecoin amounts separately
      if (tx.isStablecoinSwap && tx.usdValue > 0) {
        // Direct stablecoin swap - already in USD
        totalStablecoinSpent += tx.usdValue
      } else if (tx.solAmount > 0) {
        // SOL swap - store raw SOL amount
        totalSolSpent += tx.solAmount
      }
      // Note: If neither, we can't determine cost basis for this transaction
      
      buyCount++
    } else if (tx.type === 'SELL') {
      hasSold = true
    } else if (tx.type === 'TRANSFER_OUT') {
      hasTransferredOut = true
    }
  }

  // Get current SOL price for cost basis calculation
  const solPrice = currentSolPrice || (await getSolPrice()) || 220
  
  // Calculate total cost basis using CURRENT SOL price
  // This is how GMGN and other trackers do it - historical prices don't matter
  const totalCostBasis = (totalSolSpent * solPrice) + totalStablecoinSpent

  // Calculate VWAP
  const vwap = totalTokensBought > 0 ? totalCostBasis / totalTokensBought : null

  return {
    wallet,
    vwap,
    totalTokensBought,
    totalSolSpent,
    totalStablecoinSpent,
    totalCostBasis,
    firstBuyTimestamp,
    lastActivityTimestamp,
    hasSold,
    hasTransferredOut,
    buyCount,
  }
}

// Batch calculate VWAPs for multiple wallets
export async function calculateBatchVwaps(
  wallets: string[],
  mint: string,
  currentTokenPrice: number,
  concurrency: number = 5
): Promise<Map<string, VwapData>> {
  const results = new Map<string, VwapData>()
  
  // Fetch current SOL price ONCE at the start (not per wallet)
  // This ensures all wallets use the same SOL price for fair comparison
  const currentSolPrice = (await getSolPrice()) || 220
  console.log(`[VWAP] Using SOL price: $${currentSolPrice}`)
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < wallets.length; i += concurrency) {
    const batch = wallets.slice(i, i + concurrency)
    
    const batchResults = await Promise.all(
      batch.map(wallet => calculateWalletVwap(wallet, mint, currentTokenPrice, currentSolPrice))
    )
    
    for (const result of batchResults) {
      results.set(result.wallet, result)
    }
    
    // Small delay between batches to respect rate limits
    if (i + concurrency < wallets.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  console.log(`[VWAP] Calculated VWAPs for ${results.size} wallets`)
  return results
}

// Quick VWAP estimation when we don't have full transaction history
// Uses holder's current balance and recent price range
export async function estimateVwapFromPriceHistory(
  priceHistory: number[],
  currentPrice: number
): Promise<number> {
  if (priceHistory.length === 0) return currentPrice
  
  // Calculate average price over the period (simple estimation)
  const avgPrice = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length
  
  // Bias toward higher prices (assumes most buys happen during pumps)
  const biasedVwap = avgPrice + (Math.max(...priceHistory) - avgPrice) * 0.3
  
  return biasedVwap
}

