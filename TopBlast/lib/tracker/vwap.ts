import { getWalletTransactions, ParsedTransaction } from '../solana/helius'
import { getTokenPrice } from '../solana/price'

export interface VwapData {
  wallet: string
  vwap: number | null
  totalTokensBought: number
  totalCostBasis: number
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  hasSold: boolean
  hasTransferredOut: boolean
  buyCount: number
}

// Calculate VWAP from actual on-chain buy transactions
export async function calculateWalletVwap(
  wallet: string,
  mint: string,
  currentPrice: number
): Promise<VwapData> {
  const transactions = await getWalletTransactions(wallet, mint, 100)
  
  let totalTokensBought = 0
  let totalCostBasis = 0
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

      // Add to cost basis
      totalTokensBought += tx.tokenAmount
      
      // If we have USD value from the swap, use it
      if (tx.usdValue > 0) {
        totalCostBasis += tx.usdValue
      } else {
        // Estimate using current price (fallback)
        totalCostBasis += tx.tokenAmount * currentPrice
      }
      
      buyCount++
    } else if (tx.type === 'SELL') {
      hasSold = true
    } else if (tx.type === 'TRANSFER_OUT') {
      hasTransferredOut = true
    }
  }

  // Calculate VWAP
  const vwap = totalTokensBought > 0 ? totalCostBasis / totalTokensBought : null

  return {
    wallet,
    vwap,
    totalTokensBought,
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
  currentPrice: number,
  concurrency: number = 5
): Promise<Map<string, VwapData>> {
  const results = new Map<string, VwapData>()
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < wallets.length; i += concurrency) {
    const batch = wallets.slice(i, i + concurrency)
    
    const batchResults = await Promise.all(
      batch.map(wallet => calculateWalletVwap(wallet, mint, currentPrice))
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

