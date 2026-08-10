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
import { getTenantSlug } from '@/lib/tenant/context'
import { holderIndexingUsesBirdeye } from '@/lib/platform/holderDataSource'

type TrackerInitState = {
  initialized: boolean
  initializationPromise: Promise<void> | null
  lastPriceUpdate: number
}

declare global {
  var _trackerInitStates: Map<string, TrackerInitState> | undefined
}

function getTrackerState(): TrackerInitState {
  if (!global._trackerInitStates) {
    global._trackerInitStates = new Map()
  }
  const slug = getTenantSlug()
  let state = global._trackerInitStates.get(slug)
  if (!state) {
    state = {
      initialized: false,
      initializationPromise: null,
      lastPriceUpdate: 0,
    }
    global._trackerInitStates.set(slug, state)
  }
  return state
}

// Update price every 30 seconds max
const PRICE_UPDATE_INTERVAL = 30000

/**
 * Initialize the tracker system
 * This is designed to work in serverless environments
 */
export async function initializeTracker(): Promise<void> {
  if (holderIndexingUsesBirdeye()) {
    getTrackerState().initialized = true
    return
  }

  // If already initializing, wait for it
  if (getTrackerState().initializationPromise) {
    return getTrackerState().initializationPromise
  }

  // If already initialized, just update price if needed
  if (getTrackerState().initialized && isServiceInitialized()) {
    await maybeUpdatePrice()
    return
  }

  getTrackerState().initializationPromise = doInitialize()
  await getTrackerState().initializationPromise
  getTrackerState().initializationPromise = null
}

async function doInitialize(): Promise<void> {
  console.log('[Tracker] Starting initialization...')
  console.log(`[Tracker] Token: ${config.tokenMint}`)
  console.log(`[Tracker] Symbol: ${config.tokenSymbol}`)

  try {
    const ethPrice = await getSolPrice()
    if (ethPrice) {
      console.log(`[Tracker] SOL price: $${ethPrice.toFixed(2)}`)
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

    getTrackerState().initialized = true
    getTrackerState().lastPriceUpdate = Date.now()
    console.log('[Tracker] ✅ Initialization complete')
  } catch (error: any) {
    console.error('[Tracker] Initialization error:', error.message)
  }
}

/**
 * Update price if it's been more than 30 seconds
 * Also saves to DB for cross-instance consistency
 */
async function maybeUpdatePrice(): Promise<void> {
  const now = Date.now()
  if (now - getTrackerState().lastPriceUpdate > PRICE_UPDATE_INTERVAL) {
    try {
      const newPrice = await getTokenPrice(config.tokenMint)
      if (newPrice) {
        // Save to DB so all instances see updated rankings
        await updatePrice(newPrice, true)
        getTrackerState().lastPriceUpdate = now
        console.log(`[Tracker] Price updated: $${newPrice.toFixed(8)} (saved to DB)`)
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
  return getTrackerState().initialized && isServiceInitialized()
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
    initialized: getTrackerState().initialized && serviceStatus.initialized,
    wsConnected: false, // WebSocket disabled for serverless
    trackedCount: serviceStatus.holderCount,
    eligibleCount: serviceStatus.eligibleCount,
    currentPrice: serviceStatus.currentPrice,
  }
}
