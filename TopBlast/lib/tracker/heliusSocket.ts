/**
 * Helius WebSocket Connection
 * Connects to Helius and watches for token transactions in real-time
 * Updates the HolderService with new buy/sell events
 */

import WebSocket from 'ws'
import { config } from '@/lib/config'
import { recordBuy, recordSell, updatePrice, getHolderCount } from './holderService'
import { getTokenPrice } from '@/lib/solana/price'

let ws: WebSocket | null = null
let reconnectAttempts = 0
let isConnecting = false
let currentPrice: number | null = null
let lastPriceUpdate = 0

// Price update throttle (10 seconds)
const PRICE_UPDATE_INTERVAL = 10000

/**
 * Update current price (called from price fetcher)
 */
export function updateCurrentPrice(price: number): void {
  currentPrice = price
  updatePrice(price)
}

/**
 * Start the Helius WebSocket connection
 */
export function startHeliusWebSocket(): void {
  if (isConnecting || ws?.readyState === WebSocket.OPEN) {
    console.log('[WS] Already connected or connecting')
    return
  }

  if (!config.heliusApiKey) {
    console.error('[WS] HELIUS_API_KEY not configured')
    return
  }

  if (!config.tokenMint) {
    console.error('[WS] TOKEN_MINT_ADDRESS not configured')
    return
  }

  isConnecting = true
  const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${config.heliusApiKey}`

  console.log('[WS] Connecting to Helius WebSocket...')

  try {
    ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      console.log('[WS] ✅ Connected to Helius')
      isConnecting = false
      reconnectAttempts = 0

      // Subscribe to token account changes for our mint
      const subscribeMsg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'programSubscribe',
        params: [
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
          {
            encoding: 'jsonParsed',
            filters: [
              {
                dataSize: 165, // Token account size
              },
              {
                memcmp: {
                  offset: 0, // Mint address offset
                  bytes: config.tokenMint,
                },
              },
            ],
          },
        ],
      }

      ws?.send(JSON.stringify(subscribeMsg))
      console.log(`[WS] Subscribed to token: ${config.tokenMint.slice(0, 8)}...`)
      
      // Fetch initial price
      updatePriceAsync()
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        
        // Subscription confirmation
        if (message.result !== undefined && !message.method) {
          console.log('[WS] Subscription confirmed, ID:', message.result)
          return
        }

        // Account notification
        if (message.method === 'programNotification') {
          handleAccountUpdate(message.params)
        }
      } catch (error) {
        // Ignore parse errors
      }
    })

    ws.on('error', (error) => {
      console.error('[WS] Error:', error.message)
      isConnecting = false
    })

    ws.on('close', () => {
      console.log('[WS] Connection closed')
      isConnecting = false
      ws = null

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      console.log(`[WS] Reconnecting in ${delay / 1000}s...`)
      setTimeout(startHeliusWebSocket, delay)
    })
  } catch (error: any) {
    console.error('[WS] Failed to connect:', error.message)
    isConnecting = false
  }
}

// Track account balances to detect changes
const accountBalances = new Map<string, number>()

/**
 * Handle account update from WebSocket
 */
function handleAccountUpdate(params: any): void {
  try {
    const { result } = params
    const accountData = result?.value?.account?.data?.parsed?.info

    if (!accountData) return

    const owner = accountData.owner
    const newBalance = parseInt(accountData.tokenAmount?.amount || '0')
    const decimals = accountData.tokenAmount?.decimals || config.tokenDecimals
    const humanBalance = newBalance / Math.pow(10, decimals)

    const previousBalance = accountBalances.get(owner) || 0
    accountBalances.set(owner, humanBalance)

    // Update price periodically
    const now = Date.now()
    if (now - lastPriceUpdate > PRICE_UPDATE_INTERVAL) {
      updatePriceAsync()
      lastPriceUpdate = now
    }

    // Determine transaction type based on balance change
    if (previousBalance === 0 && humanBalance > 0) {
      // New holder - this is likely a BUY
      const price = currentPrice || 0
      if (price > 0) {
        recordBuy(owner, humanBalance, price, humanBalance)
        console.log(`[WS] 🟢 New buy: ${owner.slice(0, 8)}... bought ${humanBalance.toLocaleString()} tokens`)
      }
    } else if (humanBalance > previousBalance) {
      // Balance increased - BUY
      const boughtAmount = humanBalance - previousBalance
      const price = currentPrice || 0
      if (price > 0) {
        recordBuy(owner, boughtAmount, price, humanBalance)
        console.log(`[WS] 🟢 Buy: ${owner.slice(0, 8)}... +${boughtAmount.toLocaleString()} tokens`)
      }
    } else if (humanBalance < previousBalance) {
      // Balance decreased - SELL (disqualify)
      recordSell(owner, humanBalance)
      console.log(`[WS] 🔴 Sell: ${owner.slice(0, 8)}... sold ${(previousBalance - humanBalance).toLocaleString()} tokens - DISQUALIFIED`)
    }
  } catch (error) {
    // Ignore processing errors silently
  }
}

/**
 * Async price update
 */
async function updatePriceAsync(): Promise<void> {
  try {
    const price = await getTokenPrice(config.tokenMint)
    if (price) {
      currentPrice = price
      updatePrice(price)
    }
  } catch {
    // Ignore price fetch errors
  }
}

/**
 * Stop the WebSocket connection
 */
export function stopHeliusWebSocket(): void {
  if (ws) {
    ws.close()
    ws = null
  }
}

/**
 * Get WebSocket status
 */
export function getWebSocketStatus(): { connected: boolean; trackedCount: number } {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    trackedCount: getHolderCount(),
  }
}

/**
 * Check if WebSocket is connected
 */
export function isWebSocketConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN
}
