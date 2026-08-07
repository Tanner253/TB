import axios from 'axios'
import { config } from '@/lib/config'
import { getHeliusRpcUrl } from '@/lib/solana/rpcUrl'

function getHeliusUrl(): string {
  return getHeliusRpcUrl()
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
  const byOwner = new Map<string, number>()

  try {
    let page = 1
    const pageSize = 1000

    while (byOwner.size < limit) {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 'holders',
        method: 'getTokenAccounts',
        params: {
          mint,
          page,
          limit: pageSize,
        },
      }, { timeout: 30000 })

      const result = response.data.result
      const accounts = result?.token_accounts ?? []
      if (accounts.length === 0) break

      for (const account of accounts) {
        const amount = Number(account.amount)
        if (!Number.isFinite(amount) || amount <= 0) continue
        const owner = account.owner as string
        byOwner.set(owner, (byOwner.get(owner) ?? 0) + amount)
      }

      const total = result?.total ?? accounts.length
      if (page * pageSize >= total || accounts.length < pageSize) break
      page++
    }

    const holders = Array.from(byOwner.entries())
      .slice(0, limit)
      .map(([wallet, balance]) => ({ wallet, balance }))

    console.log(`[Helius] Fetched ${holders.length} holder wallet(s) for mint ${mint.slice(0, 8)}...`)
    return holders
  } catch (error: any) {
    console.error('[Helius] Error fetching holders:', error.message)
    return []
  }
}

/**
 * Get parsed transaction history for a wallet (to find buy transactions)
 * Uses Helius Enhanced Transactions API — all types (SWAP, TRANSFER, UNKNOWN/pump.fun).
 */
export async function getWalletTransactions(
  wallet: string,
  mint: string,
  limit: number = 100
): Promise<ParsedTransaction[]> {
  const apiKey = getHeliusApiKey()
  const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions`
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(url, {
        params: {
          'api-key': apiKey,
          limit: Math.min(limit, 100),
        },
        timeout: 15000,
        validateStatus: status => status === 200 || status === 429,
      })

      if (response.status === 429) {
        const delayMs = attempt * 400
        console.warn(
          `[Helius] Rate limited for ${wallet.slice(0, 8)}... retry ${attempt}/${maxAttempts} in ${delayMs}ms`
        )
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }

      return parseWalletMintTransactions(wallet, mint, response.data || [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (attempt === maxAttempts) {
        console.error(`[Helius] Error fetching transactions for ${wallet.slice(0, 8)}...:`, message)
        return []
      }
      await new Promise(r => setTimeout(r, attempt * 300))
    }
  }

  return []
}

/** SOL sent by wallet in this tx (Pump.fun buys often type TRANSFER, not SWAP). */
function walletSolOutflow(tx: Record<string, unknown>, wallet: string): number {
  const nativeTransfers = (tx.nativeTransfers as Array<Record<string, unknown>>) || []
  let total = 0
  for (const native of nativeTransfers) {
    if (String(native.fromUserAccount || '') !== wallet) continue
    total += Math.abs(Number(native.amount || 0)) / 1e9
  }
  return total
}

function walletSolInflow(tx: Record<string, unknown>, wallet: string): number {
  const nativeTransfers = (tx.nativeTransfers as Array<Record<string, unknown>>) || []
  let total = 0
  for (const native of nativeTransfers) {
    if (String(native.toUserAccount || '') !== wallet) continue
    total += Math.abs(Number(native.amount || 0)) / 1e9
  }
  return total
}

/** Parse Helius enhanced txs for mint-specific buys, sells, and transfers. */
export function parseWalletMintTransactions(
  wallet: string,
  mint: string,
  rawTxs: Array<Record<string, unknown>>
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const seen = new Set<string>()

  for (const tx of rawTxs) {
    const signature = String(tx.signature || '')
    const timestamp = Number(tx.timestamp || 0) * 1000
    const txType = String(tx.type || '')
    const tokenTransfers = (tx.tokenTransfers as Array<Record<string, unknown>>) || []
    const feePayer = String(tx.feePayer || '')

    for (const transfer of tokenTransfers) {
      if (String(transfer.mint || '') !== mint) continue

      const tokenAmount = Number(transfer.tokenAmount || 0)
      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) continue

      const from = String(transfer.fromUserAccount || '')
      const to = String(transfer.toUserAccount || '')

      if (to === wallet) {
        const solPaid = walletSolOutflow(tx, wallet)
        const isSwapBuy =
          txType === 'SWAP' &&
          (feePayer === wallet || from !== wallet)
        // Pump.fun / Raydium often arrive as TRANSFER or UNKNOWN with SOL leaving the buyer
        const isPaidAcquisition =
          from !== wallet &&
          solPaid >= 0.001 &&
          (txType === 'TRANSFER' || txType === 'UNKNOWN' || txType === '')

        if (isSwapBuy || isPaidAcquisition) {
          const key = `${signature}:BUY`
          if (!seen.has(key)) {
            seen.add(key)
            const value = estimateSwapValue(tx, transfer, wallet)
            transactions.push({
              signature,
              timestamp,
              type: 'BUY',
              tokenAmount,
              solAmount: value.solAmount > 0 ? value.solAmount : solPaid,
              usdValue: value.usdValue,
              pricePerToken: value.pricePerToken,
              isStablecoinSwap: value.isStablecoinSwap,
            })
          }
        } else if (from !== wallet) {
          const key = `${signature}:TRANSFER_IN`
          if (!seen.has(key)) {
            seen.add(key)
            transactions.push({
              signature,
              timestamp,
              type: 'TRANSFER_IN',
              tokenAmount,
              solAmount: 0,
              usdValue: 0,
              pricePerToken: 0,
              isStablecoinSwap: false,
            })
          }
        }
      }

      if (from === wallet && to !== wallet) {
        const solReceived = walletSolInflow(tx, wallet)
        const isSwapSell = txType === 'SWAP'
        const isPaidDisposal =
          solReceived >= 0.001 &&
          (txType === 'TRANSFER' || txType === 'UNKNOWN' || txType === '')
        const outType =
          isSwapSell || isPaidDisposal ? 'SELL' : 'TRANSFER_OUT'
        const key = `${signature}:${outType}`
        if (!seen.has(key)) {
          seen.add(key)
          const value = estimateSwapValue(tx, transfer, wallet)
          transactions.push({
            signature,
            timestamp,
            type: outType,
            tokenAmount,
            solAmount: value.solAmount > 0 ? value.solAmount : solReceived,
            usdValue: value.usdValue,
            pricePerToken: value.pricePerToken,
            isStablecoinSwap: value.isStablecoinSwap,
          })
        }
      }
    }
  }

  return transactions
}

/**
 * Estimate swap value from transaction data
 * Returns raw SOL amount so USD can be calculated at snapshot time using CURRENT SOL price
 * This is critical: We should NOT use historical SOL prices, only current prices matter
 */
function estimateSwapValue(
  tx: Record<string, unknown>,
  transfer: Record<string, unknown>,
  wallet?: string
): {
  solAmount: number
  usdValue: number 
  pricePerToken: number 
  isStablecoinSwap: boolean 
} {
  const tokenAmount = Number(transfer.tokenAmount || 0)
  if (tokenAmount === 0) return { solAmount: 0, usdValue: 0, pricePerToken: 0, isStablecoinSwap: false }

  const tokenTransfers = (tx.tokenTransfers as Array<Record<string, unknown>>) || []
  const nativeTransfers = (tx.nativeTransfers as Array<Record<string, unknown>>) || []
  const description = String(tx.description || '')

  // Method 1: Look for stablecoin transfers (most accurate - already in USD)
  for (const t of tokenTransfers) {
    if (String(t.mint || '') === String(transfer.mint || '')) continue

    const stableAmount = Number(t.tokenAmount || 0)
    if (stableAmount <= 0) continue

    // USDC mint
    if (String(t.mint || '') === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
      return { solAmount: 0, usdValue: stableAmount, pricePerToken: stableAmount / tokenAmount, isStablecoinSwap: true }
    }
    // USDT mint
    if (String(t.mint || '') === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
      return { solAmount: 0, usdValue: stableAmount, pricePerToken: stableAmount / tokenAmount, isStablecoinSwap: true }
    }
  }

  // Method 2: SOL spent by the buyer (fee payer / wallet) — not largest transfer in tx
  if (nativeTransfers.length > 0) {
    let totalSol = 0
    for (const native of nativeTransfers) {
      if (wallet && String(native.fromUserAccount || '') !== wallet) continue
      const solAmount = Math.abs(Number(native.amount || 0)) / 1e9
      if (solAmount > totalSol && solAmount > 0.001) {
        totalSol = solAmount
      }
    }
    if (totalSol > 0) {
      return { solAmount: totalSol, usdValue: 0, pricePerToken: 0, isStablecoinSwap: false }
    }
  }

  // Method 3: Use description if available (Helius sometimes includes USD value)
  if (description.includes('$')) {
    const match = description.match(/\$([0-9,]+\.?\d*)/)
    if (match) {
      const usd = parseFloat(match[1].replace(',', ''))
      if (usd > 0) {
        return { solAmount: 0, usdValue: usd, pricePerToken: usd / tokenAmount, isStablecoinSwap: true }
      }
    }
  }

  return { solAmount: 0, usdValue: 0, pricePerToken: 0, isStablecoinSwap: false }
}

export interface ParsedTransaction {
  signature: string
  timestamp: number
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  tokenAmount: number
  solAmount: number      // RAW SOL amount (for recalculating at snapshot time)
  usdValue: number       // USD value (for stablecoin swaps)
  pricePerToken: number  // The actual price paid per token
  isStablecoinSwap: boolean // Whether this was a direct stablecoin swap
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
    const holders = await getTokenHolders(mint, 1000)
    return holders.length
  } catch {
    return 0
  }
}
