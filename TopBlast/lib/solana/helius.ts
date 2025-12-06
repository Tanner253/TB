import axios from 'axios'
import { config } from '@/lib/config'

// Helius API configuration
function getHeliusUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY || config.heliusApiKey
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is required')
  }
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
}

function getHeliusApiKey(): string {
  const apiKey = process.env.HELIUS_API_KEY || config.heliusApiKey
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is required')
  }
  return apiKey
}

/**
 * Get all token holders for a mint using Helius DAS API
 */
export async function getTokenHolders(mint: string, limit: number = 1000): Promise<{
  wallet: string
  balance: number
}[]> {
  const rpcUrl = getHeliusUrl()
  const holders: { wallet: string; balance: number }[] = []
  let cursor: string | undefined

  try {
    do {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 'holders',
        method: 'getTokenAccounts',
        params: {
          mint,
          limit: Math.min(1000, limit - holders.length),
          cursor,
        },
      }, { timeout: 30000 })

      const result = response.data.result
      if (!result?.token_accounts) break

      for (const account of result.token_accounts) {
        if (account.amount > 0) {
          holders.push({
            wallet: account.owner,
            balance: account.amount,
          })
        }
        if (holders.length >= limit) break
      }

      cursor = result.cursor
    } while (cursor && holders.length < limit)

    console.log(`[Helius] Fetched ${holders.length} holders for mint ${mint.slice(0, 8)}...`)
    return holders
  } catch (error: any) {
    console.error('[Helius] Error fetching holders:', error.message)
    return []
  }
}

/**
 * Get parsed transaction history for a wallet (to find buy transactions)
 * Uses Helius Enhanced Transactions API
 */
export async function getWalletTransactions(
  wallet: string,
  mint: string,
  limit: number = 100
): Promise<ParsedTransaction[]> {
  const apiKey = getHeliusApiKey()

  try {
    // Use Helius Enhanced Transactions API for SWAP transactions
    // Timeout at 8s to fail fast on slow wallets
    const response = await axios.get(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions`,
      {
        params: {
          'api-key': apiKey,
          type: 'SWAP',
          limit: Math.min(limit, 50), // Reduced limit for faster response
        },
        timeout: 8000,
      }
    )

    const transactions: ParsedTransaction[] = []
    
    for (const tx of response.data || []) {
      // Look for swaps involving our token
      if (tx.type === 'SWAP' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          // User received the token (this is a BUY)
          if (transfer.mint === mint && transfer.toUserAccount === wallet) {
            const { usdValue, pricePerToken } = estimateSwapValue(tx, transfer)
            transactions.push({
              signature: tx.signature,
              timestamp: tx.timestamp * 1000, // Convert to ms
              type: 'BUY',
              tokenAmount: transfer.tokenAmount || 0,
              usdValue,
              pricePerToken,
            })
          }
          // User sent the token (this is a SELL)
          if (transfer.mint === mint && transfer.fromUserAccount === wallet) {
            const { usdValue, pricePerToken } = estimateSwapValue(tx, transfer)
            transactions.push({
              signature: tx.signature,
              timestamp: tx.timestamp * 1000,
              type: 'SELL',
              tokenAmount: transfer.tokenAmount || 0,
              usdValue,
              pricePerToken,
            })
          }
        }
      }
    }

    // Also check for direct transfers (non-swap) - shorter timeout
    try {
      const transferResponse = await axios.get(
        `https://api.helius.xyz/v0/addresses/${wallet}/transactions`,
        {
          params: {
            'api-key': apiKey,
            type: 'TRANSFER',
            limit: 20, // Only need recent transfers
          },
          timeout: 5000, // Fast timeout
        }
      )

      for (const tx of transferResponse.data || []) {
        if (tx.tokenTransfers) {
          for (const transfer of tx.tokenTransfers) {
            if (transfer.mint === mint) {
              // Received transfer
              if (transfer.toUserAccount === wallet && !transactions.find(t => t.signature === tx.signature)) {
                transactions.push({
                  signature: tx.signature,
                  timestamp: tx.timestamp * 1000,
                  type: 'TRANSFER_IN',
                  tokenAmount: transfer.tokenAmount || 0,
                  usdValue: 0,
                  pricePerToken: 0,
                })
              }
              // Sent transfer
              if (transfer.fromUserAccount === wallet && !transactions.find(t => t.signature === tx.signature)) {
                transactions.push({
                  signature: tx.signature,
                  timestamp: tx.timestamp * 1000,
                  type: 'TRANSFER_OUT',
                  tokenAmount: transfer.tokenAmount || 0,
                  usdValue: 0,
                  pricePerToken: 0,
                })
              }
            }
          }
        }
      }
    } catch {
      // Transfer fetch failed, continue with swap data
    }

    return transactions
  } catch (error: any) {
    // Don't log for every wallet - too noisy
    if (Math.random() < 0.01) {
      console.error(`[Helius] Error fetching transactions:`, error.message)
    }
    return []
  }
}

/**
 * Estimate USD value of a swap from the transaction data
 * Returns { usdValue, pricePerToken } to get accurate VWAP
 */
function estimateSwapValue(tx: any, transfer: any): { usdValue: number; pricePerToken: number } {
  const tokenAmount = transfer.tokenAmount || 0
  if (tokenAmount === 0) return { usdValue: 0, pricePerToken: 0 }
  
  // Method 1: Look for stablecoin transfers (most accurate)
  if (tx.tokenTransfers) {
    for (const t of tx.tokenTransfers) {
      // Skip the token we're tracking
      if (t.mint === transfer.mint) continue
      
      // USDC mint
      if (t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' && t.tokenAmount > 0) {
        const usd = t.tokenAmount
        return { usdValue: usd, pricePerToken: usd / tokenAmount }
      }
      // USDT mint
      if (t.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' && t.tokenAmount > 0) {
        const usd = t.tokenAmount
        return { usdValue: usd, pricePerToken: usd / tokenAmount }
      }
    }
  }
  
  // Method 2: Look for SOL in native transfers
  if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
    let totalSol = 0
    for (const native of tx.nativeTransfers) {
      // Take the largest SOL transfer as the swap value
      const solAmount = Math.abs(native.amount) / 1e9
      if (solAmount > totalSol && solAmount > 0.001) { // Ignore tiny amounts (fees)
        totalSol = solAmount
      }
    }
    if (totalSol > 0) {
      // Use current SOL price from CoinGecko-cached value or estimate
      // For historical accuracy, we should fetch historical SOL price
      // For now, estimate: older txs at lower prices, recent at higher
      const txDate = new Date(tx.timestamp * 1000)
      const now = new Date()
      const daysAgo = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
      
      // Rough SOL price history estimation (better than hardcoded $150)
      // Dec 2024: ~$220, Nov 2024: ~$180, Oct 2024: ~$150, etc
      let solPrice = 220 // Current estimate
      if (daysAgo > 7) solPrice = 200
      if (daysAgo > 30) solPrice = 180
      if (daysAgo > 60) solPrice = 150
      if (daysAgo > 90) solPrice = 130
      if (daysAgo > 180) solPrice = 100
      
      const usd = totalSol * solPrice
      return { usdValue: usd, pricePerToken: usd / tokenAmount }
    }
  }
  
  // Method 3: Use description if available
  if (tx.description && tx.description.includes('$')) {
    const match = tx.description.match(/\$([0-9,]+\.?\d*)/);
    if (match) {
      const usd = parseFloat(match[1].replace(',', ''))
      return { usdValue: usd, pricePerToken: usd / tokenAmount }
    }
  }
  
  return { usdValue: 0, pricePerToken: 0 }
}

export interface ParsedTransaction {
  signature: string
  timestamp: number
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  tokenAmount: number
  usdValue: number
  pricePerToken: number // The actual price paid per token
}

/**
 * Get recent transactions for the token (to track all activity)
 */
export async function getTokenTransactions(
  mint: string,
  limit: number = 100
): Promise<any[]> {
  const apiKey = getHeliusApiKey()

  try {
    const response = await axios.get(
      `https://api.helius.xyz/v0/tokens/${mint}/transactions`,
      {
        params: {
          'api-key': apiKey,
          limit: Math.min(limit, 100),
        },
        timeout: 15000,
      }
    )
    return response.data || []
  } catch (error: any) {
    console.error('[Helius] Error fetching token transactions:', error.message)
    return []
  }
}

/**
 * Get token metadata and price info
 */
export async function getTokenMetadata(mint: string): Promise<{
  name: string | null
  symbol: string | null
  decimals: number
  price: number | null
  supply: number | null
} | null> {
  try {
    const rpcUrl = getHeliusUrl()
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: 'asset',
        method: 'getAsset',
        params: {
          id: mint,
          displayOptions: { showFungible: true },
        },
      },
      { timeout: 10000 }
    )

    const asset = response.data?.result
    if (!asset) return null

    return {
      name: asset.content?.metadata?.name || null,
      symbol: asset.content?.metadata?.symbol || asset.token_info?.symbol || null,
      decimals: asset.token_info?.decimals || 9,
      price: asset.token_info?.price_info?.price_per_token || null,
      supply: asset.token_info?.supply ? parseFloat(asset.token_info.supply) : null,
    }
  } catch (error: any) {
    console.error('[Helius] Error fetching token metadata:', error.message)
    return null
  }
}

/**
 * Check RPC health
 */
export async function checkHeliusHealth(): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now()
  try {
    const rpcUrl = getHeliusUrl()
    await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 'health',
      method: 'getHealth',
      params: [],
    }, { timeout: 5000 })
    return { healthy: true, latency: Date.now() - start }
  } catch {
    return { healthy: false, latency: -1 }
  }
}

/**
 * Get holder count for a token
 */
export async function getHolderCount(mint: string): Promise<number> {
  try {
    const rpcUrl = getHeliusUrl()
    const response = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 'holders-count',
      method: 'getTokenAccounts',
      params: {
        mint,
        limit: 1,
      },
    }, { timeout: 10000 })

    return response.data?.result?.total || 0
  } catch {
    return 0
  }
}
