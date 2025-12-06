/**
 * Tracker Initialization
 * Initializes the holder service and WebSocket connection
 */

import { startHeliusWebSocket, getWebSocketStatus } from './heliusSocket'
import { 
  initializeHolderService, 
  isServiceInitialized, 
  getServiceStatus,
  updatePrice,
  needsRefresh,
  refreshHolders,
} from './holderService'
import { getTokenPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'

// Global state for tracker
declare global {
  var _trackerInitState: {
    initialized: boolean
    priceUpdateInterval: NodeJS.Timeout | null
    refreshInterval: NodeJS.Timeout | null
    initializationPromise: Promise<void> | null
  } | undefined
}

if (!global._trackerInitState) {
  global._trackerInitState = {
    initialized: false,
    priceUpdateInterval: null,
    refreshInterval: null,
    initializationPromise: null,
  }
}

const trackerState = global._trackerInitState

/**
 * Initialize the tracker system
 * This should be called once on server start
 */
export async function initializeTracker(): Promise<void> {
  // If already initializing, wait for it
  if (trackerState.initializationPromise) {
    return trackerState.initializationPromise
  }

  // If already initialized, just return
  if (trackerState.initialized && isServiceInitialized()) {
    return
  }

  trackerState.initializationPromise = doInitialize()
  await trackerState.initializationPromise
  trackerState.initializationPromise = null
}

async function doInitialize(): Promise<void> {
  console.log('[Tracker] Starting initialization...')
  console.log(`[Tracker] Token: ${config.tokenMint}`)
  console.log(`[Tracker] Symbol: ${config.tokenSymbol}`)

  try {
    // Step 1: Initialize holder service (loads all existing holders with VWAPs)
    console.log('[Tracker] Initializing holder service...')
    const success = await initializeHolderService()
    
    if (!success) {
      console.error('[Tracker] Failed to initialize holder service')
      // Don't throw - try again on next request
      return
    }

    // Step 2: Start WebSocket for live transaction tracking
    console.log('[Tracker] Starting WebSocket connection...')
    startHeliusWebSocket()

    // Step 3: Start price update interval (every 10 seconds)
    if (trackerState.priceUpdateInterval) {
      clearInterval(trackerState.priceUpdateInterval)
    }
    trackerState.priceUpdateInterval = setInterval(async () => {
      const newPrice = await getTokenPrice(config.tokenMint)
      if (newPrice) {
        updatePrice(newPrice)
      }
    }, 10000)

    // Step 4: Start refresh interval (check every 5 minutes, refresh if needed)
    if (trackerState.refreshInterval) {
      clearInterval(trackerState.refreshInterval)
    }
    trackerState.refreshInterval = setInterval(async () => {
      if (needsRefresh()) {
        console.log('[Tracker] Running scheduled refresh...')
        await refreshHolders()
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    trackerState.initialized = true
    console.log('[Tracker] ✅ Initialization complete')
  } catch (error: any) {
    console.error('[Tracker] Initialization error:', error.message)
    throw error
  }
}

/**
 * Check if tracker is initialized
 */
export function isTrackerInitialized(): boolean {
  return trackerState.initialized && isServiceInitialized()
}

/**
 * Get tracker status
 */
export function getTrackerStatus(): {
  initialized: boolean
  wsConnected: boolean
  trackedCount: number
  eligibleCount: number
  currentPrice: number | null
} {
  const wsStatus = getWebSocketStatus()
  const serviceStatus = getServiceStatus()
  
  return {
    initialized: trackerState.initialized && serviceStatus.initialized,
    wsConnected: wsStatus.connected,
    trackedCount: serviceStatus.holderCount,
    eligibleCount: serviceStatus.eligibleCount,
    currentPrice: serviceStatus.currentPrice,
  }
}

/**
 * Force a refresh of holder data
 */
export async function forceRefresh(): Promise<boolean> {
  if (!trackerState.initialized) {
    return false
  }
  return refreshHolders()
}
