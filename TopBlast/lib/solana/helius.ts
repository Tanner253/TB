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
    const response = await axios.get(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions`,
      {
        params: {
          'api-key': apiKey,
          type: 'SWAP',
          limit: Math.min(limit, 100),
        },
        timeout: 15000,
      }
    )

    const transactions: ParsedTransaction[] = []
    
    for (const tx of response.data || []) {
      // Look for swaps involving our token
      if (tx.type === 'SWAP' && tx.tokenTransfers) {
        for (const transfer of tx.tokenTransfers) {
          // User received the token (this is a BUY)
          if (transfer.mint === mint && transfer.toUserAccount === wallet) {
            const usdValue = estimateSwapValue(tx, transfer)
            transactions.push({
              signature: tx.signature,
              timestamp: tx.timestamp * 1000, // Convert to ms
              type: 'BUY',
              tokenAmount: transfer.tokenAmount || 0,
              usdValue,
            })
          }
          // User sent the token (this is a SELL)
          if (transfer.mint === mint && transfer.fromUserAccount === wallet) {
            const usdValue = estimateSwapValue(tx, transfer)
            transactions.push({
              signature: tx.signature,
              timestamp: tx.timestamp * 1000,
              type: 'SELL',
              tokenAmount: transfer.tokenAmount || 0,
              usdValue,
            })
          }
        }
      }
    }

    // Also check for direct transfers (non-swap)
    try {
      const transferResponse = await axios.get(
        `https://api.helius.xyz/v0/addresses/${wallet}/transactions`,
        {
          params: {
            'api-key': apiKey,
            type: 'TRANSFER',
            limit: Math.min(limit, 100),
          },
          timeout: 15000,
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
 */
function estimateSwapValue(tx: any, transfer: any): number {
  // Method 1: Look for SOL in native transfers
  if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
    let totalSol = 0
    for (const native of tx.nativeTransfers) {
      if (native.amount > 0) {
        totalSol += native.amount / 1e9
      }
    }
    if (totalSol > 0) {
      // Get SOL price at time of transaction (estimate: use $150 as baseline)
      // In production, you'd want to fetch historical SOL price
      const solPrice = 150
      return totalSol * solPrice
    }
  }
  
  // Method 2: Look for stablecoin transfers
  if (tx.tokenTransfers) {
    for (const t of tx.tokenTransfers) {
      // USDC mint
      if (t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
        return t.tokenAmount || 0
      }
      // USDT mint
      if (t.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
        return t.tokenAmount || 0
      }
    }
  }
  
  // Method 3: Use description if available
  if (tx.description && tx.description.includes('$')) {
    const match = tx.description.match(/\$([0-9,]+\.?\d*)/);
    if (match) {
      return parseFloat(match[1].replace(',', ''))
    }
  }
  
  return 0
}

export interface ParsedTransaction {
  signature: string
  timestamp: number
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  tokenAmount: number
  usdValue: number
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
