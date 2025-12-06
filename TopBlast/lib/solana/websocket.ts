/**
 * Helius Enhanced WebSocket Service
 * Provides real-time data streaming for token holders and transactions
 */

import { EventEmitter } from 'events'

// WebSocket connection state
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface HeliusWebSocketConfig {
  apiKey: string
  onPriceUpdate?: (price: number) => void
  onHolderUpdate?: (wallet: string, balance: number) => void
  onTransaction?: (tx: TransactionEvent) => void
  onError?: (error: Error) => void
  onConnectionChange?: (state: ConnectionState) => void
}

interface TransactionEvent {
  signature: string
  timestamp: number
  type: 'BUY' | 'SELL' | 'TRANSFER'
  wallet: string
  amount: number
  usdValue?: number
}

interface SubscriptionRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: any[]
}

class HeliusWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null
  private apiKey: string
  private tokenMint: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private subscriptionId: number = 0
  private isConnecting = false

  constructor() {
    super()
    this.apiKey = ''
  }

  private getWebSocketUrl(): string {
    return `wss://atlas-mainnet.helius-rpc.com/?api-key=${this.apiKey}`
  }

  async connect(apiKey: string, tokenMint: string): Promise<void> {
    if (this.isConnecting || (this.ws?.readyState === WebSocket.OPEN)) {
      console.log('[WS] Already connected or connecting')
      return
    }

    this.apiKey = apiKey
    this.tokenMint = tokenMint
    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        console.log('[WS] Connecting to Helius WebSocket...')
        this.emit('connectionChange', 'connecting')

        this.ws = new WebSocket(this.getWebSocketUrl())

        this.ws.onopen = () => {
          console.log('[WS] Connected to Helius')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.emit('connectionChange', 'connected')
          this.startPingInterval()
          this.subscribeToToken(tokenMint)
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          console.error('[WS] WebSocket error:', error)
          this.emit('error', new Error('WebSocket connection error'))
          this.emit('connectionChange', 'error')
        }

        this.ws.onclose = () => {
          console.log('[WS] Connection closed')
          this.isConnecting = false
          this.emit('connectionChange', 'disconnected')
          this.stopPingInterval()
          this.attemptReconnect()
        }

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false
            reject(new Error('Connection timeout'))
          }
        }, 10000)
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  private subscribeToToken(mint: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    // Subscribe to transaction updates for the token
    const transactionSubscription: SubscriptionRequest = {
      jsonrpc: '2.0',
      id: ++this.subscriptionId,
      method: 'transactionSubscribe',
      params: [
        {
          accountInclude: [mint],
        },
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          transactionDetails: 'full',
          maxSupportedTransactionVersion: 0,
        },
      ],
    }

    this.ws.send(JSON.stringify(transactionSubscription))
    console.log('[WS] Subscribed to token transactions:', mint.slice(0, 8) + '...')
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      // Handle subscription confirmation
      if (message.result !== undefined && typeof message.result === 'number') {
        console.log('[WS] Subscription confirmed, ID:', message.result)
        return
      }

      // Handle transaction notification
      if (message.method === 'transactionNotification') {
        const txData = message.params?.result
        if (txData) {
          this.emit('transaction', this.parseTransaction(txData))
        }
        return
      }

      // Handle account notification
      if (message.method === 'accountNotification') {
        const accountData = message.params?.result
        if (accountData) {
          this.emit('accountUpdate', accountData)
        }
        return
      }

      // Handle pong response
      if (message.result === 'pong' || message.method === 'pong') {
        return
      }

    } catch (error) {
      console.error('[WS] Error parsing message:', error)
    }
  }

  private parseTransaction(txData: any): TransactionEvent {
    // Parse the transaction to extract relevant info
    const signature = txData.signature || txData.transaction?.signatures?.[0] || 'unknown'
    const timestamp = txData.blockTime ? txData.blockTime * 1000 : Date.now()

    return {
      signature,
      timestamp,
      type: 'BUY', // Will be refined based on actual tx data
      wallet: 'unknown',
      amount: 0,
    }
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.subscriptionId,
          method: 'ping',
        }))
      }
    }, 30000)
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached')
      this.emit('error', new Error('Max reconnection attempts reached'))
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      if (this.apiKey && this.tokenMint) {
        this.connect(this.apiKey, this.tokenMint)
      }
    }, delay)
  }

  disconnect(): void {
    this.stopPingInterval()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.emit('connectionChange', 'disconnected')
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getState(): ConnectionState {
    if (this.isConnecting) return 'connecting'
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected'
    if (this.ws?.readyState === WebSocket.CLOSING) return 'disconnected'
    return 'disconnected'
  }
}

// Singleton instance for server-side use
let wsManager: HeliusWebSocketManager | null = null

export function getWebSocketManager(): HeliusWebSocketManager {
  if (!wsManager) {
    wsManager = new HeliusWebSocketManager()
  }
  return wsManager
}

export { HeliusWebSocketManager, type ConnectionState, type TransactionEvent }

