/**
 * Tracker Initialization
 * Initializes the holder service
 * NOTE: WebSockets are disabled for Vercel serverless compatibility
 */

import { 
  initializeHolderService, 
  isServiceInitialized, 
  getServiceStatus,
  updatePrice,
} from './holderService'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'

// Global state for tracker
declare global {
  var _trackerInitState: {
    initialized: boolean
    initializationPromise: Promise<void> | null
    lastPriceUpdate: number
  } | undefined
}

if (!global._trackerInitState) {
  global._trackerInitState = {
    initialized: false,
    initializationPromise: null,
    lastPriceUpdate: 0,
  }
}

const trackerState = global._trackerInitState

// Update price every 30 seconds max
const PRICE_UPDATE_INTERVAL = 30000

/**
 * Initialize the tracker system
 * This is designed to work in serverless environments
 */
export async function initializeTracker(): Promise<void> {
  // If already initializing, wait for it
  if (trackerState.initializationPromise) {
    return trackerState.initializationPromise
  }

  // If already initialized, just update price if needed
  if (trackerState.initialized && isServiceInitialized()) {
    await maybeUpdatePrice()
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
    // Pre-fetch SOL price for VWAP calculations
    const solPrice = await getSolPrice()
    if (solPrice) {
      console.log(`[Tracker] SOL price: $${solPrice.toFixed(2)}`)
    } else {
      console.warn('[Tracker] ⚠️ Could not fetch SOL price - USD values may be inaccurate')
    }

    // Initialize holder service (loads all existing holders with VWAPs)
    console.log('[Tracker] Initializing holder service...')
    const success = await initializeHolderService()
    
    if (!success) {
      console.error('[Tracker] Failed to initialize holder service')
      return
    }

    trackerState.initialized = true
    trackerState.lastPriceUpdate = Date.now()
    console.log('[Tracker] ✅ Initialization complete')
  } catch (error: any) {
    console.error('[Tracker] Initialization error:', error.message)
  }
}

/**
 * Update price if it's been more than 30 seconds
 */
async function maybeUpdatePrice(): Promise<void> {
  const now = Date.now()
  if (now - trackerState.lastPriceUpdate > PRICE_UPDATE_INTERVAL) {
    try {
      const newPrice = await getTokenPrice(config.tokenMint)
      if (newPrice) {
        updatePrice(newPrice)
        trackerState.lastPriceUpdate = now
      }
    } catch (error) {
      // Ignore price update errors
    }
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
  const serviceStatus = getServiceStatus()
  
  return {
    initialized: trackerState.initialized && serviceStatus.initialized,
    wsConnected: false, // WebSocket disabled for serverless
    trackedCount: serviceStatus.holderCount,
    eligibleCount: serviceStatus.eligibleCount,
    currentPrice: serviceStatus.currentPrice,
  }
}
