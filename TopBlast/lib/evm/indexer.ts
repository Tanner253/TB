/**
 * EVM indexer — Blockscout API + viem RPC
 * Replaces Helius for Robinhood Chain holder/transaction data
 */

import axios from 'axios'
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  decodeEventLog,
  isAddress,
} from 'viem'
import { config } from '@/lib/config'
import { getBlockscoutApiBase, getChainConfig, getEvmRpcUrl } from './chain'

const ERC20_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Wrapped native asset on Robinhood Chain (used to parse swap ETH in/out from receipts). */
const ROBINHOOD_WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73'

let _publicClient: ReturnType<typeof createPublicClient> | null = null

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: getChainConfig() as any,
      transport: http(getEvmRpcUrl()),
    })
  }
  return _publicClient
}

export interface ParsedTransaction {
  signature: string
  timestamp: number
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  tokenAmount: number
  ethAmount: number
  usdValue: number
  pricePerToken: number
  isStablecoinSwap: boolean
}

/**
 * Get ERC-20 token holders via Blockscout API
 */
export async function getTokenHolders(
  tokenAddress: string,
  limit: number = 1000
): Promise<{ wallet: string; balance: number; isContract: boolean }[]> {
  if (!isAddress(tokenAddress)) {
    console.error('[EVM] Invalid token address')
    return []
  }

  const holders: { wallet: string; balance: number; isContract: boolean }[] = []
  const base = getBlockscoutApiBase()
  let nextPage: string | null = `${base}/tokens/${tokenAddress.toLowerCase()}/holders`

  try {
    while (nextPage && holders.length < limit) {
      const response = await axios.get(nextPage, {
        timeout: 30000,
        headers: { Accept: 'application/json' },
      })

      const items = response.data?.items || []
      for (const item of items) {
        const wallet = item.address?.hash
        const rawValue = item.value
        if (!wallet || rawValue === undefined || rawValue === null) continue

        const balance = typeof rawValue === 'string' ? BigInt(rawValue) : BigInt(Math.floor(Number(rawValue)))
        if (balance > 0n) {
          holders.push({
            wallet,
            balance: Number(balance),
            isContract: item.address?.is_contract === true,
          })
        }
        if (holders.length >= limit) break
      }

      nextPage = response.data?.next_page_params
        ? `${base}/tokens/${tokenAddress.toLowerCase()}/holders?${new URLSearchParams(
            Object.entries(response.data.next_page_params).map(([k, v]) => [k, String(v)])
          ).toString()}`
        : null
    }

    console.log(`[EVM] Fetched ${holders.length} holders for ${tokenAddress.slice(0, 10)}...`)
    return holders
  } catch (error: any) {
    console.error('[EVM] Blockscout holders failed, trying RPC fallback:', error.message)
    return getTokenHoldersViaRpc(tokenAddress, limit)
  }
}

/**
 * Fallback: scan recent Transfer logs and aggregate balances (limited)
 */
async function getTokenHoldersViaRpc(
  tokenAddress: string,
  limit: number
): Promise<{ wallet: string; balance: number; isContract: boolean }[]> {
  try {
    const client = getPublicClient()
    const decimals = await getTokenDecimals(tokenAddress)
    const latestBlock = await client.getBlockNumber()
    const fromBlock = latestBlock > 500_000n ? latestBlock - 500_000n : 0n

    const logs = await client.getLogs({
      address: tokenAddress as `0x${string}`,
      event: ERC20_ABI[3],
      fromBlock,
      toBlock: latestBlock,
    })

    const balances = new Map<string, bigint>()
    for (const log of logs) {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'Transfer') continue
      const { from, to, value } = decoded.args as { from: string; to: string; value: bigint }

      if (from.toLowerCase() !== ZERO_ADDRESS) {
        const prev = balances.get(from.toLowerCase()) || 0n
        balances.set(from.toLowerCase(), prev - value)
      }
      if (to.toLowerCase() !== ZERO_ADDRESS) {
        const prev = balances.get(to.toLowerCase()) || 0n
        balances.set(to.toLowerCase(), prev + value)
      }
    }

    return Array.from(balances.entries())
      .filter(([, bal]) => bal > 0n)
      .sort((a, b) => (a[1] > b[1] ? -1 : 1))
      .slice(0, limit)
      .map(([wallet, bal]) => ({
        wallet,
        balance: Number(bal),
        isContract: false,
      }))
      .filter(h => h.balance > 0)
  } catch (error: any) {
    console.error('[EVM] RPC holder fallback failed:', error.message)
    return []
  }
}

async function getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    const client = getPublicClient()
    const decimals = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'decimals',
    })
    return Number(decimals)
  } catch {
    return config.tokenDecimals
  }
}

/**
 * Earliest on-chain buy timestamp for hold-time display (no RPC swap estimation).
 */
export async function getEarliestBuyTimestamp(
  wallet: string,
  tokenAddress: string,
  limit: number = 100
): Promise<number | null> {
  if (!isAddress(wallet) || !isAddress(tokenAddress)) {
    return null
  }

  const base = getBlockscoutApiBase()
  const walletLower = wallet.toLowerCase()
  let earliest: number | null = null

  try {
    const response = await axios.get(
      `${base}/addresses/${walletLower}/token-transfers`,
      {
        params: { token: tokenAddress.toLowerCase() },
        timeout: 15000,
        headers: { Accept: 'application/json' },
      }
    )

    if (response.data?.errors?.length) {
      return null
    }

    const items = (response.data?.items || []).slice(0, Math.min(limit, 100))
    for (const item of items) {
      if (classifyIncomingTokenTransfer(item, walletLower) !== 'BUY') continue
      const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : null
      if (!timestamp) continue
      if (earliest === null || timestamp < earliest) {
        earliest = timestamp
      }
    }
  } catch {
    return null
  }

  return earliest
}

/**
 * Get wallet token transfer history for VWAP calculation
 */
export async function getWalletTransactions(
  wallet: string,
  tokenAddress: string,
  limit: number = 100
): Promise<ParsedTransaction[]> {
  if (!isAddress(wallet) || !isAddress(tokenAddress)) {
    return []
  }

  const base = getBlockscoutApiBase()
  const transactions: ParsedTransaction[] = []
  const seen = new Set<string>()

  try {
    const url = `${base}/addresses/${wallet.toLowerCase()}/token-transfers`
    const response = await axios.get(url, {
      params: {
        token: tokenAddress.toLowerCase(),
      },
      timeout: 15000,
      headers: { Accept: 'application/json' },
    })

    if (response.data?.errors?.length) {
      console.error(`[EVM] Blockscout token-transfers error for ${wallet.slice(0, 8)}:`, response.data.errors[0]?.detail)
      return []
    }

    const items = (response.data?.items || []).slice(0, Math.min(limit, 100))

    for (const item of items) {
      const txHash = item.transaction_hash
      if (!txHash || seen.has(txHash)) continue

      const from = item.from?.hash?.toLowerCase()
      const to = item.to?.hash?.toLowerCase()
      const walletLower = wallet.toLowerCase()
      const rawAmount = item.total?.value || item.amount || '0'
      const decimals = Number(item.total?.decimals ?? config.tokenDecimals)
      const tokenAmount = parseFloat(formatUnits(BigInt(rawAmount), decimals))
      if (tokenAmount <= 0) continue

      const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : Date.now()

      let type: ParsedTransaction['type']
      const incoming = classifyIncomingTokenTransfer(item, walletLower)
      const outgoing = classifyOutgoingTokenTransfer(item, walletLower)

      if (incoming === 'BUY') {
        type = 'BUY'
      } else if (incoming === 'TRANSFER_IN') {
        type = 'TRANSFER_IN'
      } else if (outgoing === 'SELL') {
        type = 'SELL'
      } else if (outgoing === 'TRANSFER_OUT') {
        type = 'TRANSFER_OUT'
      } else {
        continue
      }

      // Only count buys/sells/transfers out for eligibility (skip transfer in for vwap buys)
      if (type === 'TRANSFER_IN') {
        seen.add(txHash)
        transactions.push({
          signature: txHash,
          timestamp,
          type,
          tokenAmount,
          ethAmount: 0,
          usdValue: 0,
          pricePerToken: 0,
          isStablecoinSwap: false,
        })
        continue
      }

      const { ethAmount, usdValue, pricePerToken, isStablecoinSwap } = await estimateSwapValue(
        txHash,
        tokenAmount,
        wallet,
        type === 'BUY'
      )

      seen.add(txHash)
      transactions.push({
        signature: txHash,
        timestamp,
        type,
        tokenAmount,
        ethAmount,
        usdValue,
        pricePerToken,
        isStablecoinSwap,
      })
    }

    return transactions
  } catch (error: any) {
    console.error(`[EVM] Error fetching transactions for ${wallet.slice(0, 8)}:`, error.message)
    return []
  }
}

async function estimateSwapValue(
  txHash: string,
  tokenAmount: number,
  wallet: string,
  isBuy: boolean
): Promise<{ ethAmount: number; usdValue: number; pricePerToken: number; isStablecoinSwap: boolean }> {
  if (tokenAmount <= 0) {
    return { ethAmount: 0, usdValue: 0, pricePerToken: 0, isStablecoinSwap: false }
  }

  try {
    const client = getPublicClient()
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` })
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    const walletLower = wallet.toLowerCase()
    const { getEthPrice } = await import('./price')
    const ethPrice = (await getEthPrice()) || 3500

    if (isBuy && tx.from.toLowerCase() === walletLower && tx.value > 0n) {
      const ethAmount = parseFloat(formatUnits(tx.value, 18))
      if (ethAmount > 0.00001) {
        const usdValue = ethAmount * ethPrice
        return {
          ethAmount,
          usdValue,
          pricePerToken: usdValue / tokenAmount,
          isStablecoinSwap: false,
        }
      }
    }

    // Sells often route through WETH (tx.value = 0) — parse pool/router WETH out
    if (!isBuy && tx.from.toLowerCase() === walletLower) {
      const wethOut = parseWethSwapEthFromReceipt(receipt, walletLower)
      if (wethOut > 0.0000001) {
        const usdValue = wethOut * ethPrice
        return {
          ethAmount: wethOut,
          usdValue,
          pricePerToken: usdValue / tokenAmount,
          isStablecoinSwap: false,
        }
      }
    }

    // Buys may also pay via WETH when tx.value is zero
    if (isBuy && tx.from.toLowerCase() === walletLower) {
      const wethIn = parseWethPaidByWallet(receipt, walletLower)
      if (wethIn > 0.0000001) {
        const usdValue = wethIn * ethPrice
        return {
          ethAmount: wethIn,
          usdValue,
          pricePerToken: usdValue / tokenAmount,
          isStablecoinSwap: false,
        }
      }
    }

    // Check for stablecoin transfers in receipt logs
    const stablecoins = [
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC mainnet-style
      '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    ]

    for (const log of receipt.logs) {
      if (stablecoins.includes(log.address.toLowerCase())) {
        try {
          const decoded = decodeEventLog({
            abi: ERC20_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'Transfer') {
            const { from, value } = decoded.args as { from: string; value: bigint }
            if (from.toLowerCase() === walletLower) {
              const usd = parseFloat(formatUnits(value, 6))
              if (usd > 0) {
                return {
                  ethAmount: 0,
                  usdValue: usd,
                  pricePerToken: usd / tokenAmount,
                  isStablecoinSwap: true,
                }
              }
            }
          }
        } catch {
          // not a transfer log
        }
      }
    }
  } catch {
    // tx fetch failed
  }

  return { ethAmount: 0, usdValue: 0, pricePerToken: 0, isStablecoinSwap: false }
}

/** Largest WETH leg in a swap receipt not sent by the trader (pool/router → user path). */
function parseWethSwapEthFromReceipt(
  receipt: { logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[] },
  walletLower: string
): number {
  let maxOut = 0
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ROBINHOOD_WETH.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'Transfer') continue
      const { from, value } = decoded.args as { from: string; value: bigint }
      const fromLower = from.toLowerCase()
      if (fromLower === walletLower || fromLower === ZERO_ADDRESS) continue
      const amt = parseFloat(formatUnits(value, 18))
      if (amt > maxOut) maxOut = amt
    } catch {
      // skip
    }
  }
  return maxOut
}

/** WETH spent by wallet in a buy (when native ETH is not attached to tx). */
function parseWethPaidByWallet(
  receipt: { logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[] },
  walletLower: string
): number {
  let totalIn = 0
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ROBINHOOD_WETH.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'Transfer') continue
      const { from, value } = decoded.args as { from: string; value: bigint }
      if (from.toLowerCase() !== walletLower) continue
      totalIn += parseFloat(formatUnits(value, 18))
    } catch {
      // skip
    }
  }
  return totalIn
}

const SWAP_METHODS = new Set([
  'exactinputsingle',
  'exactinput',
  'swapexactethfortokens',
  'swap',
  'execute',
  'buy',
  'launchtoken',
  // Pons / Robinhood DEX router selector
  '0x4d819a2a',
])

/** Classify an incoming token transfer for a wallet (used by VWAP indexer). */
export function classifyIncomingTokenTransfer(
  item: {
    from?: { hash?: string; is_contract?: boolean }
    to?: { hash?: string; is_contract?: boolean }
    method?: string
    transaction?: { to?: { is_contract?: boolean } }
  },
  walletLower: string
): 'BUY' | 'TRANSFER_IN' | 'SKIP' {
  const from = item.from?.hash?.toLowerCase()
  const to = item.to?.hash?.toLowerCase()
  if (!from || !to || to !== walletLower || from === walletLower) {
    return 'SKIP'
  }

  const fromIsContract = item.from?.is_contract === true
  const txToIsContract = item.transaction?.to?.is_contract === true
  const method = (item.method || '').toLowerCase()
  const methodIsSwap = SWAP_METHODS.has(method)

  if (
    from === ZERO_ADDRESS ||
    fromIsContract ||
    txToIsContract ||
    methodIsSwap
  ) {
    return 'BUY'
  }

  return 'TRANSFER_IN'
}

/** Classify an outgoing token transfer for a wallet. */
export function classifyOutgoingTokenTransfer(
  item: {
    from?: { hash?: string }
    to?: { hash?: string; is_contract?: boolean }
    transaction?: { to?: { is_contract?: boolean } }
  },
  walletLower: string
): 'SELL' | 'TRANSFER_OUT' | 'SKIP' {
  const from = item.from?.hash?.toLowerCase()
  const to = item.to?.hash?.toLowerCase()
  if (!from || !to || from !== walletLower || to === walletLower) {
    return 'SKIP'
  }

  const toIsContract = item.to?.is_contract === true
  const txToIsContract = item.transaction?.to?.is_contract === true

  if (toIsContract || txToIsContract) {
    return 'SELL'
  }

  return 'TRANSFER_OUT'
}

/**
 * Derive spot price from recent DEX swaps when Blockscout has no exchange_rate.
 * Uses the most recent buy OR sell so price reflects post-trade pool state.
 */
export async function deriveTokenPriceFromRecentSwaps(
  tokenAddress: string
): Promise<number | null> {
  if (!isAddress(tokenAddress)) return null

  const base = getBlockscoutApiBase()
  try {
    const response = await axios.get(
      `${base}/tokens/${tokenAddress.toLowerCase()}/transfers`,
      { timeout: 15000, headers: { Accept: 'application/json' } }
    )

    const items = response.data?.items || []
    const seenTx = new Set<string>()
    const candidates: { timestamp: number; price: number }[] = []

    for (const item of items) {
      const txHash = item.transaction_hash
      const method = (item.method || '').toLowerCase()
      if (!txHash || seenTx.has(txHash)) continue
      if (!SWAP_METHODS.has(method)) continue

      const fromWallet = item.from?.hash
      const toWallet = item.to?.hash
      const tokensToEoa = item.to?.is_contract === false
      const tokensFromEoa = item.from?.is_contract === false
      const tokensFromContract = item.from?.is_contract === true
      const tokensToContract = item.to?.is_contract === true

      const rawAmount = item.total?.value || '0'
      const decimals = Number(item.total?.decimals ?? config.tokenDecimals)
      const tokenAmount = parseFloat(formatUnits(BigInt(rawAmount), decimals))
      if (tokenAmount <= 0) continue

      const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : 0
      seenTx.add(txHash)

      // Buy: LP/router → EOA
      if (toWallet && tokensToEoa && tokensFromContract) {
        const { pricePerToken } = await estimateSwapValue(txHash, tokenAmount, toWallet, true)
        if (pricePerToken > 0) {
          candidates.push({ timestamp, price: pricePerToken })
        }
        continue
      }

      // Sell: EOA → LP/router
      if (fromWallet && tokensFromEoa && tokensToContract) {
        const { pricePerToken } = await estimateSwapValue(txHash, tokenAmount, fromWallet, false)
        if (pricePerToken > 0) {
          candidates.push({ timestamp, price: pricePerToken })
        }
      }
    }

    if (candidates.length === 0) return null

    candidates.sort((a, b) => b.timestamp - a.timestamp)
    const spot = candidates[0].price
    console.log(
      `[EVM] Derived spot price from ${candidates[0].timestamp ? 'recent swap' : 'swap'} = $${spot}`
    )
    return spot
  } catch (error: any) {
    console.error('[EVM] deriveTokenPriceFromRecentSwaps failed:', error.message)
  }

  return null
}

export async function getTokenMetadata(tokenAddress: string): Promise<{
  name: string | null
  symbol: string | null
  decimals: number
  price: number | null
  supply: number | null
} | null> {
  if (!isAddress(tokenAddress)) return null

  try {
    const base = getBlockscoutApiBase()
    const response = await axios.get(`${base}/tokens/${tokenAddress.toLowerCase()}`, {
      timeout: 10000,
    })
    const token = response.data
    const decimals = token.decimals ?? config.tokenDecimals
    const supply = token.total_supply
      ? parseFloat(formatUnits(BigInt(token.total_supply), decimals))
      : null

    return {
      name: token.name || null,
      symbol: token.symbol || null,
      decimals,
      price: token.exchange_rate ? parseFloat(token.exchange_rate) : null,
      supply,
    }
  } catch {
    return null
  }
}

export async function checkRpcHealth(): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now()
  try {
    const client = getPublicClient()
    await client.getBlockNumber()
    return { healthy: true, latency: Date.now() - start }
  } catch {
    return { healthy: false, latency: -1 }
  }
}

export async function getHolderCount(tokenAddress: string): Promise<number> {
  try {
    const base = getBlockscoutApiBase()
    const response = await axios.get(`${base}/tokens/${tokenAddress.toLowerCase()}`, {
      timeout: 10000,
    })
    return parseInt(response.data?.holders_count || '0', 10)
  } catch {
    const holders = await getTokenHolders(tokenAddress, 1)
    return holders.length > 0 ? -1 : 0
  }
}

// Legacy alias for debug route
export const checkHeliusHealth = checkRpcHealth
