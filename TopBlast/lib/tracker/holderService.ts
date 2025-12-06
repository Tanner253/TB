/**
 * Holder Service - Manages all holder data with VWAP calculations
 * Loads existing holders on startup and keeps data live via WebSocket
 */

import { config } from '@/lib/config'
import { getTokenHolders, getWalletTransactions, ParsedTransaction } from '@/lib/solana/helius'
import { getTokenPrice } from '@/lib/solana/price'

// Types
export interface HolderData {
  wallet: string
  balance: number           // Human-readable balance
  balanceRaw: number        // Raw balance with decimals
  vwap: number | null       // Volume-weighted average price
  totalCostBasis: number    // Total USD spent
  totalTokensBought: number // Total tokens bought
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  buyCount: number
  hasSold: boolean
  isEligible: boolean
  ineligibleReason: string | null
  drawdownPct: number       // Current drawdown percentage
  lossUsd: number           // Current loss in USD
  updatedAt: number
}

// Global state (shared across API routes via module caching)
declare global {
  var _holderServiceState: {
    holders: Map<string, HolderData>
    serviceInitialized: boolean
    lastFullRefresh: number
    currentTokenPrice: number | null
    initializationInProgress: boolean
  } | undefined
}

// Initialize global state if needed
if (!global._holderServiceState) {
  global._holderServiceState = {
    holders: new Map<string, HolderData>(),
    serviceInitialized: false,
    lastFullRefresh: 0,
    currentTokenPrice: null,
    initializationInProgress: false,
  }
}

// Reference to global state
const state = global._holderServiceState
const holders = state.holders

// Constants
const FULL_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes between refreshes
const VWAP_BATCH_SIZE = 20 // Process 20 wallets at a time
const VWAP_BATCH_DELAY = 300 // 300ms between batches
const MAX_INITIAL_HOLDERS = 500 // Limit initial processing for faster startup

/**
 * Initialize the holder service
 * Fetches real VWAPs for top holders by balance
 */
export async function initializeHolderService(): Promise<boolean> {
  if (state.initializationInProgress) {
    console.log('[HolderService] Initialization already in progress')
    return false
  }

  if (state.serviceInitialized) {
    console.log('[HolderService] Already initialized')
    return true
  }

  state.initializationInProgress = true
  console.log('[HolderService] Starting initialization...')

  try {
    // Get current token price
    state.currentTokenPrice = await getTokenPrice(config.tokenMint)
    if (!state.currentTokenPrice) {
      console.error('[HolderService] Failed to fetch token price')
      state.initializationInProgress = false
      return false
    }
    console.log(`[HolderService] Current price: $${state.currentTokenPrice}`)

    // Fetch token holders
    const limit = Math.min(config.maxHoldersToProcess, MAX_INITIAL_HOLDERS)
    const rawHolders = await getTokenHolders(config.tokenMint, limit)
    console.log(`[HolderService] Found ${rawHolders.length} holders`)

    if (rawHolders.length === 0) {
      console.warn('[HolderService] No holders found')
      state.initializationInProgress = false
      return false
    }

    // Sort by balance (biggest holders first) and take top 30 for real VWAP calculation
    const sortedHolders = [...rawHolders].sort((a, b) => b.balance - a.balance)
    const topHolders = sortedHolders.slice(0, 30)
    
    console.log(`[HolderService] Fetching real VWAPs for top ${topHolders.length} holders...`)

    // Fetch real VWAPs for top holders (parallel, small batches)
    for (let i = 0; i < topHolders.length; i += 5) {
      const batch = topHolders.slice(i, i + 5)
      
      await Promise.all(
        batch.map(async (h) => {
          const balance = h.balance / Math.pow(10, config.tokenDecimals)
          try {
            const holderData = await calculateHolderData(
              h.wallet,
              balance,
              h.balance,
              state.currentTokenPrice!
            )
            holders.set(h.wallet, holderData)
          } catch {
            // Skip on error
          }
        })
      )
      
      // Small delay between batches
      if (i + 5 < topHolders.length) {
        await sleep(100)
      }
    }

    // For remaining holders, just store basic info without VWAP
    for (const h of sortedHolders.slice(30)) {
      const balance = h.balance / Math.pow(10, config.tokenDecimals)
      if (balance >= config.minTokenHolding) {
        holders.set(h.wallet, createBasicHolder(h.wallet, balance, h.balance))
      }
    }

    state.lastFullRefresh = Date.now()
    state.serviceInitialized = true
    state.initializationInProgress = false

    const eligible = Array.from(holders.values()).filter(h => h.isEligible).length
    console.log(`[HolderService] ✅ Init complete: ${holders.size} holders, ${eligible} eligible`)

    return true
  } catch (error: any) {
    console.error('[HolderService] Initialization error:', error.message)
    state.initializationInProgress = false
    return false
  }
}

/**
 * Calculate full holder data including VWAP from transaction history
 */
async function calculateHolderData(
  wallet: string,
  balance: number,
  balanceRaw: number,
  tokenPrice: number
): Promise<HolderData> {
  // Fetch transaction history
  const transactions = await getWalletTransactions(wallet, config.tokenMint, 100)

  let totalTokensBought = 0
  let totalCostBasis = 0
  let firstBuyTimestamp: number | null = null
  let lastActivityTimestamp: number | null = null
  let buyCount = 0
  let hasSold = false

  // Sort transactions by timestamp (oldest first)
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)

  for (const tx of sortedTxs) {
    lastActivityTimestamp = tx.timestamp

    if (tx.type === 'BUY') {
      if (!firstBuyTimestamp) {
        firstBuyTimestamp = tx.timestamp
      }
      
      totalTokensBought += tx.tokenAmount
      
      // Use USD value from swap if available, otherwise estimate
      if (tx.usdValue > 0) {
        totalCostBasis += tx.usdValue
      } else {
        // Estimate using current price as fallback
        totalCostBasis += tx.tokenAmount * tokenPrice
      }
      
      buyCount++
    } else if (tx.type === 'SELL') {
      hasSold = true
    }
  }

  // Calculate VWAP
  const vwap = totalTokensBought > 0 ? totalCostBasis / totalTokensBought : null

  // Check eligibility and calculate drawdown
  const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
    wallet,
    balance,
    vwap,
    tokenPrice,
    firstBuyTimestamp,
    hasSold
  )

  return {
    wallet,
    balance,
    balanceRaw,
    vwap,
    totalCostBasis,
    totalTokensBought,
    firstBuyTimestamp,
    lastActivityTimestamp,
    buyCount,
    hasSold,
    isEligible,
    ineligibleReason: reason,
    drawdownPct,
    lossUsd,
    updatedAt: Date.now(),
  }
}

/**
 * Create basic holder entry without VWAP data
 */
function createBasicHolder(wallet: string, balance: number, balanceRaw: number): HolderData {
  return {
    wallet,
    balance,
    balanceRaw,
    vwap: null,
    totalCostBasis: 0,
    totalTokensBought: 0,
    firstBuyTimestamp: null,
    lastActivityTimestamp: null,
    buyCount: 0,
    hasSold: false,
    isEligible: false,
    ineligibleReason: 'No transaction history',
    drawdownPct: 0,
    lossUsd: 0,
    updatedAt: Date.now(),
  }
}

/**
 * Check holder eligibility
 */
function checkEligibility(
  wallet: string,
  balance: number,
  vwap: number | null,
  tokenPrice: number,
  firstBuyTimestamp: number | null,
  hasSold: boolean
): { isEligible: boolean; reason: string | null; drawdownPct: number; lossUsd: number } {
  // Calculate drawdown
  let drawdownPct = 0
  let lossUsd = 0

  if (vwap && vwap > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
    if (tokenPrice < vwap) {
      lossUsd = (vwap - tokenPrice) * balance
    }
  }

  // Check minimum balance
  if (balance < config.minTokenHolding) {
    return { isEligible: false, reason: 'Insufficient balance', drawdownPct, lossUsd }
  }

  // Must have VWAP (bought tokens)
  if (!vwap || vwap === 0) {
    return { isEligible: false, reason: 'No buy history', drawdownPct, lossUsd }
  }

  // Check hold duration
  if (firstBuyTimestamp) {
    const holdMs = Date.now() - firstBuyTimestamp
    const minHoldMs = config.minHoldDurationHours * 60 * 60 * 1000
    if (holdMs < minHoldMs) {
      return { isEligible: false, reason: 'Hold duration not met', drawdownPct, lossUsd }
    }
  } else {
    return { isEligible: false, reason: 'No buy history', drawdownPct, lossUsd }
  }

  // Check if sold (disqualified)
  if (hasSold) {
    return { isEligible: false, reason: 'Sold tokens', drawdownPct, lossUsd }
  }

  // Must be in loss position
  if (drawdownPct >= 0) {
    return { isEligible: false, reason: 'In profit', drawdownPct, lossUsd }
  }

  // Check minimum loss threshold
  const poolBal = config.poolBalanceUsd
  const minLoss = poolBal * (config.minLossThresholdPct / 100)
  if (lossUsd < minLoss) {
    return { isEligible: false, reason: 'Loss below threshold', drawdownPct, lossUsd }
  }

  return { isEligible: true, reason: null, drawdownPct, lossUsd }
}

/**
 * Update price and recalculate all holder eligibility
 */
export function updatePrice(newPrice: number): void {
  state.currentTokenPrice = newPrice
  
  // Recalculate drawdown and eligibility for all holders
  for (const [wallet, holder] of holders) {
    if (holder.vwap && holder.vwap > 0) {
      const drawdownPct = ((newPrice - holder.vwap) / holder.vwap) * 100
      const lossUsd = newPrice < holder.vwap ? (holder.vwap - newPrice) * holder.balance : 0
      
      const { isEligible, reason } = checkEligibility(
        wallet,
        holder.balance,
        holder.vwap,
        newPrice,
        holder.firstBuyTimestamp,
        holder.hasSold
      )
      
      holder.drawdownPct = drawdownPct
      holder.lossUsd = lossUsd
      holder.isEligible = isEligible
      holder.ineligibleReason = reason
      holder.updatedAt = Date.now()
    }
  }
}

/**
 * Record a new buy transaction (from WebSocket)
 */
export function recordBuy(wallet: string, tokenAmount: number, pricePerToken: number, balanceAfter: number): void {
  const existing = holders.get(wallet)
  
  if (existing) {
    // Update existing holder
    const newTotalTokens = existing.totalTokensBought + tokenAmount
    const newTotalCost = existing.totalCostBasis + (tokenAmount * pricePerToken)
    const newVwap = newTotalCost / newTotalTokens
    
    existing.vwap = newVwap
    existing.totalTokensBought = newTotalTokens
    existing.totalCostBasis = newTotalCost
    existing.buyCount++
    existing.balance = balanceAfter
    existing.lastActivityTimestamp = Date.now()
    
    if (!existing.firstBuyTimestamp) {
      existing.firstBuyTimestamp = Date.now()
    }
    
    // Recalculate eligibility
    if (state.currentTokenPrice) {
      const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
        wallet,
        balanceAfter,
        newVwap,
        state.currentTokenPrice,
        existing.firstBuyTimestamp,
        existing.hasSold
      )
      existing.isEligible = isEligible
      existing.ineligibleReason = reason
      existing.drawdownPct = drawdownPct
      existing.lossUsd = lossUsd
    }
    
    existing.updatedAt = Date.now()
  } else {
    // New holder
    const newHolder: HolderData = {
      wallet,
      balance: balanceAfter,
      balanceRaw: Math.round(balanceAfter * Math.pow(10, config.tokenDecimals)),
      vwap: pricePerToken,
      totalCostBasis: tokenAmount * pricePerToken,
      totalTokensBought: tokenAmount,
      firstBuyTimestamp: Date.now(),
      lastActivityTimestamp: Date.now(),
      buyCount: 1,
      hasSold: false,
      isEligible: false,
      ineligibleReason: 'Hold duration not met',
      drawdownPct: 0,
      lossUsd: 0,
      updatedAt: Date.now(),
    }
    
    // Check eligibility
    if (state.currentTokenPrice) {
      const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
        wallet,
        balanceAfter,
        pricePerToken,
        state.currentTokenPrice,
        newHolder.firstBuyTimestamp,
        false
      )
      newHolder.isEligible = isEligible
      newHolder.ineligibleReason = reason
      newHolder.drawdownPct = drawdownPct
      newHolder.lossUsd = lossUsd
    }
    
    holders.set(wallet, newHolder)
  }
  
  console.log(`[HolderService] Buy recorded: ${wallet.slice(0, 8)}... bought ${tokenAmount.toLocaleString()} tokens`)
}

/**
 * Record a sell transaction (disqualifies holder)
 */
export function recordSell(wallet: string, balanceAfter: number): void {
  const existing = holders.get(wallet)
  
  if (existing) {
    existing.hasSold = true
    existing.isEligible = false
    existing.ineligibleReason = 'Sold tokens'
    existing.balance = balanceAfter
    existing.lastActivityTimestamp = Date.now()
    existing.updatedAt = Date.now()
  }
  
  console.log(`[HolderService] Sell recorded: ${wallet.slice(0, 8)}... - disqualified`)
}

/**
 * Get ranked losers sorted by drawdown %
 * Only returns holders who meet the minimum loss threshold (10% of pool)
 */
export function getRankedLosers(): HolderData[] {
  const minLossRequired = config.poolBalanceUsd * (config.minLossThresholdPct / 100)
  
  const losers = Array.from(holders.values())
    // Only include holders who meet the minimum loss threshold
    .filter(h => 
      h.vwap && 
      h.vwap > 0 && 
      h.drawdownPct < 0 && 
      h.balance >= config.minTokenHolding &&
      h.lossUsd >= minLossRequired // Must have at least $50 loss (10% of $500 pool)
    )
    .sort((a, b) => {
      // Sort by drawdown % (most negative first)
      if (a.drawdownPct !== b.drawdownPct) {
        return a.drawdownPct - b.drawdownPct
      }
      // Tiebreaker: highest USD loss
      return b.lossUsd - a.lossUsd
    })
  
  return losers
}

/**
 * Get strictly eligible winners (for actual payout)
 */
export function getEligibleWinners(): HolderData[] {
  return Array.from(holders.values())
    .filter(h => h.isEligible && h.drawdownPct < 0)
    .sort((a, b) => {
      if (a.drawdownPct !== b.drawdownPct) {
        return a.drawdownPct - b.drawdownPct
      }
      return b.lossUsd - a.lossUsd
    })
}

/**
 * Get all holders (for stats)
 */
export function getAllHolders(): HolderData[] {
  return Array.from(holders.values())
}

/**
 * Get holder count
 */
export function getHolderCount(): number {
  return holders.size
}

/**
 * Get eligible holder count
 */
export function getEligibleCount(): number {
  return Array.from(holders.values()).filter(h => h.isEligible).length
}

/**
 * Get current token price
 */
export function getCurrentPrice(): number | null {
  return state.currentTokenPrice
}

/**
 * Check if service is initialized
 */
export function isServiceInitialized(): boolean {
  return state.serviceInitialized
}

/**
 * Check if refresh is needed
 */
export function needsRefresh(): boolean {
  return Date.now() - state.lastFullRefresh > FULL_REFRESH_INTERVAL
}

/**
 * Get service status
 */
export function getServiceStatus(): {
  initialized: boolean
  holderCount: number
  eligibleCount: number
  currentPrice: number | null
  lastRefresh: number
  initInProgress: boolean
} {
  return {
    initialized: state.serviceInitialized,
    holderCount: holders.size,
    eligibleCount: getEligibleCount(),
    currentPrice: state.currentTokenPrice,
    lastRefresh: state.lastFullRefresh,
    initInProgress: state.initializationInProgress,
  }
}

/**
 * Force a full refresh of holder data
 * Note: This does NOT reset the initialized state - we keep serving data during refresh
 */
export async function refreshHolders(): Promise<boolean> {
  if (state.initializationInProgress) {
    console.log('[HolderService] Refresh skipped - initialization in progress')
    return false
  }
  
  // Don't reset serviceInitialized - keep serving existing data during refresh
  console.log('[HolderService] Starting background refresh...')
  
  state.initializationInProgress = true
  
  try {
    // Get current token price
    const price = await getTokenPrice(config.tokenMint)
    if (price) {
      state.currentTokenPrice = price
    }
    
    // Fetch new holder list
    const limit = Math.min(config.maxHoldersToProcess, MAX_INITIAL_HOLDERS)
    const rawHolders = await getTokenHolders(config.tokenMint, limit)
    
    if (rawHolders.length > 0) {
      console.log(`[HolderService] Refresh: found ${rawHolders.length} holders`)
      
      // Process holders in batches (smaller batches for refresh)
      const wallets = rawHolders.map(h => ({
        wallet: h.wallet,
        balance: h.balance / Math.pow(10, config.tokenDecimals),
        balanceRaw: h.balance,
      }))
      
      for (let i = 0; i < wallets.length; i += VWAP_BATCH_SIZE) {
        const batch = wallets.slice(i, i + VWAP_BATCH_SIZE)
        
        await Promise.all(
          batch.map(async (holder) => {
            try {
              const holderData = await calculateHolderData(
                holder.wallet,
                holder.balance,
                holder.balanceRaw,
                state.currentTokenPrice!
              )
              holders.set(holder.wallet, holderData)
            } catch (error) {
              // Keep existing data on error
            }
          })
        )
        
        if (i + VWAP_BATCH_SIZE < wallets.length) {
          await sleep(VWAP_BATCH_DELAY)
        }
      }
      
      state.lastFullRefresh = Date.now()
    }
    
    state.initializationInProgress = false
    console.log(`[HolderService] ✅ Refresh complete: ${holders.size} holders`)
    return true
  } catch (error: any) {
    console.error('[HolderService] Refresh error:', error.message)
    state.initializationInProgress = false
    return false
  }
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

