/**
 * Holder Service - Manages all holder data with VWAP calculations
 * Loads existing holders on startup and keeps data live via WebSocket
 */

import { config } from '@/lib/config'
import { getTokenHolders, getWalletTransactions, ParsedTransaction } from '@/lib/solana/helius'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'

// Types
export interface HolderData {
  wallet: string
  balance: number           // Human-readable balance
  balanceRaw: number        // Raw balance with decimals
  vwap: number | null       // Volume-weighted average price
  vwapSource: 'real' | 'none' // Whether VWAP is from real transaction data
  totalCostBasis: number    // Total USD spent
  totalTokensBought: number // Total tokens bought
  firstBuyTimestamp: number | null
  lastActivityTimestamp: number | null
  buyCount: number
  hasSold: boolean
  hasTransferredOut: boolean // Added: track transfer out
  lastWinCycle: number | null // Added: track winner cooldown
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
    currentCycle: number // Added: track current cycle for cooldown checking
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
    currentCycle: 1,
  }
}

// Reference to global state
const state = global._holderServiceState
const holders = state.holders

// Constants - OPTIMIZED FOR SPEED
const FULL_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes between refreshes
const VWAP_BATCH_SIZE = 30 // Process 30 wallets at a time (more parallel)
const VWAP_BATCH_DELAY = 50 // 50ms between batches (faster)
const MAX_INITIAL_HOLDERS = 200 // Process top 200 holders first (sorted by balance)
const PRIORITY_HOLDER_COUNT = 50 // Process top 50 holders FIRST for instant results

/**
 * Initialize the holder service
 * Returns immediately with basic data, fetches VWAPs in background
 */
export async function initializeHolderService(): Promise<boolean> {
  if (state.serviceInitialized) {
    return true
  }

  if (state.initializationInProgress) {
    // Already initializing - that's fine, return true so API can serve partial data
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

    // Sort by balance descending - process biggest holders first (most likely to have big losses)
    const sortedHolders = [...rawHolders].sort((a, b) => b.balance - a.balance)
    
    // Immediately add all holders with basic data (no VWAP yet)
    for (const h of sortedHolders) {
      const balance = h.balance / Math.pow(10, config.tokenDecimals)
      holders.set(h.wallet, createBasicHolder(h.wallet, balance, h.balance))
    }

    // Mark as initialized so API can return data
    state.serviceInitialized = true
    console.log(`[HolderService] ✅ Quick init: ${holders.size} holders loaded (sorted by balance)`)

    // Fetch real VWAPs in background - priority holders first
    fetchVwapsInBackground(sortedHolders)

    state.initializationInProgress = false
    return true
  } catch (error: any) {
    console.error('[HolderService] Initialization error:', error.message)
    state.initializationInProgress = false
    return false
  }
}

/**
 * Fetch VWAPs in background without blocking
 * Processes PRIORITY holders first (top by balance) with no delay
 */
async function fetchVwapsInBackground(sortedHolders: Array<{ wallet: string; balance: number }>): Promise<void> {
  if (!state.currentTokenPrice) return
  
  console.log(`[HolderService] Background: fetching VWAPs for ${sortedHolders.length} holders...`)
  
  // Fetch current SOL price ONCE at the start for consistent calculations
  const currentSolPrice = (await getSolPrice()) || 220
  console.log(`[HolderService] Using SOL price: $${currentSolPrice}`)
  
  // PHASE 1: Priority holders (top 50) - fast, no delay between batches
  const priorityHolders = sortedHolders.slice(0, PRIORITY_HOLDER_COUNT)
  const remainingHolders = sortedHolders.slice(PRIORITY_HOLDER_COUNT)
  
  console.log(`[HolderService] PRIORITY: Processing top ${priorityHolders.length} holders first...`)
  
  for (let i = 0; i < priorityHolders.length; i += VWAP_BATCH_SIZE) {
    const batch = priorityHolders.slice(i, i + VWAP_BATCH_SIZE)
    
    await Promise.all(
      batch.map(async (h) => {
        try {
          const balance = h.balance / Math.pow(10, config.tokenDecimals)
          const holderData = await calculateHolderData(
            h.wallet,
            balance,
            h.balance,
            state.currentTokenPrice!,
            currentSolPrice
          )
          holders.set(h.wallet, holderData)
        } catch {
          // Keep basic data on error
        }
      })
    )
    // NO delay for priority holders - go as fast as possible
  }
  
  const priorityEligible = Array.from(holders.values()).filter(h => h.isEligible).length
  const priorityWithVwap = Array.from(holders.values()).filter(h => h.vwapSource === 'real').length
  console.log(`[HolderService] ✅ PRIORITY complete: ${priorityWithVwap} with VWAP, ${priorityEligible} eligible`)
  
  // PHASE 2: Remaining holders - with small delays to not overwhelm API
  if (remainingHolders.length > 0) {
    console.log(`[HolderService] Processing remaining ${remainingHolders.length} holders...`)
    
    for (let i = 0; i < remainingHolders.length; i += VWAP_BATCH_SIZE) {
      const batch = remainingHolders.slice(i, i + VWAP_BATCH_SIZE)
      
      await Promise.all(
        batch.map(async (h) => {
          try {
            const balance = h.balance / Math.pow(10, config.tokenDecimals)
            const holderData = await calculateHolderData(
              h.wallet,
              balance,
              h.balance,
              state.currentTokenPrice!,
              currentSolPrice
            )
            holders.set(h.wallet, holderData)
          } catch {
            // Keep basic data on error
          }
        })
      )
      
      const total = PRIORITY_HOLDER_COUNT + i + batch.length
      if (total % 50 === 0) {
        console.log(`[HolderService] Background: ${total}/${sortedHolders.length} VWAPs`)
      }
      
      await sleep(VWAP_BATCH_DELAY) // Small delay for remaining
    }
  }
  
  state.lastFullRefresh = Date.now()
  const eligible = Array.from(holders.values()).filter(h => h.isEligible).length
  const withVwap = Array.from(holders.values()).filter(h => h.vwapSource === 'real').length
  console.log(`[HolderService] ✅ Background complete: ${withVwap} with VWAP, ${eligible} eligible`)
}

/**
 * Calculate full holder data including VWAP from transaction history
 * CRITICAL: Uses CURRENT SOL price to calculate cost basis, not historical prices
 */
async function calculateHolderData(
  wallet: string,
  balance: number,
  balanceRaw: number,
  tokenPrice: number,
  currentSolPrice?: number // Optional: pass in SOL price for batch consistency
): Promise<HolderData> {
  // Fetch transaction history
  const transactions = await getWalletTransactions(wallet, config.tokenMint, 100)

  let totalTokensBought = 0
  let totalSolSpent = 0         // Raw SOL amount
  let totalStablecoinSpent = 0  // Direct USD from stablecoin swaps
  let firstBuyTimestamp: number | null = null
  let lastActivityTimestamp: number | null = null
  let buyCount = 0
  let hasSold = false
  let hasTransferredOut = false

  // Sort transactions by timestamp (oldest first)
  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp)

  for (const tx of sortedTxs) {
    lastActivityTimestamp = tx.timestamp

    if (tx.type === 'BUY') {
      if (!firstBuyTimestamp) {
        firstBuyTimestamp = tx.timestamp
      }
      
      totalTokensBought += tx.tokenAmount
      
      // Track SOL and stablecoin amounts separately
      if (tx.isStablecoinSwap && tx.usdValue > 0) {
        // Direct stablecoin swap - already in USD
        totalStablecoinSpent += tx.usdValue
      } else if (tx.solAmount > 0) {
        // SOL swap - store raw SOL amount
        totalSolSpent += tx.solAmount
      }
      // Note: If neither, we can't determine cost basis for this transaction
      
      buyCount++
    } else if (tx.type === 'SELL') {
      hasSold = true
    } else if (tx.type === 'TRANSFER_OUT') {
      hasTransferredOut = true
    }
  }

  // Get current SOL price for cost basis calculation
  // This is how GMGN calculates it - historical prices don't matter, only current price
  const solPrice = currentSolPrice || (await getTokenPrice('So11111111111111111111111111111111111111112')) || 220
  
  // Calculate total cost basis using CURRENT SOL price
  const totalCostBasis = (totalSolSpent * solPrice) + totalStablecoinSpent

  // Calculate VWAP - only if we have real cost basis data
  const vwap = (totalTokensBought > 0 && totalCostBasis > 0) 
    ? totalCostBasis / totalTokensBought 
    : null
  
  // vwapSource is 'real' only if we have actual transaction data
  const vwapSource: 'real' | 'none' = (vwap !== null && totalCostBasis > 0) ? 'real' : 'none'

  // Preserve lastWinCycle from existing holder data if it exists
  const existingHolder = holders.get(wallet)
  const lastWinCycle = existingHolder?.lastWinCycle || null

  // Check eligibility and calculate drawdown
  const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
    wallet,
    balance,
    vwap,
    tokenPrice,
    firstBuyTimestamp,
    hasSold,
    hasTransferredOut,
    lastWinCycle,
    totalTokensBought
  )

  return {
    wallet,
    balance,
    balanceRaw,
    vwap,
    vwapSource,
    totalCostBasis,
    totalTokensBought,
    firstBuyTimestamp,
    lastActivityTimestamp,
    buyCount,
    hasSold,
    hasTransferredOut,
    lastWinCycle,
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
    vwapSource: 'none',
    totalCostBasis: 0,
    totalTokensBought: 0,
    firstBuyTimestamp: null,
    lastActivityTimestamp: null,
    buyCount: 0,
    hasSold: false,
    hasTransferredOut: false,
    lastWinCycle: null,
    isEligible: false,
    ineligibleReason: 'Loading transaction history...',
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
  hasSold: boolean,
  hasTransferredOut: boolean = false,
  lastWinCycle: number | null = null,
  totalTokensBought: number = 0
): { isEligible: boolean; reason: string | null; drawdownPct: number; lossUsd: number } {
  // Calculate drawdown using eligible balance (min of current balance and tokens actually bought)
  let drawdownPct = 0
  let lossUsd = 0
  const eligibleBalance = totalTokensBought > 0 ? Math.min(balance, totalTokensBought) : balance

  if (vwap && vwap > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
    if (tokenPrice < vwap) {
      lossUsd = (vwap - tokenPrice) * eligibleBalance
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

  // Check if transferred out (disqualified)
  if (hasTransferredOut) {
    return { isEligible: false, reason: 'Transferred out', drawdownPct, lossUsd }
  }

  // Check winner cooldown - cannot win if won in the previous cycle
  if (lastWinCycle !== null && lastWinCycle >= state.currentCycle - 1) {
    return { isEligible: false, reason: 'Winner cooldown', drawdownPct, lossUsd }
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
      const eligibleBalance = holder.totalTokensBought > 0 
        ? Math.min(holder.balance, holder.totalTokensBought) 
        : holder.balance
      const lossUsd = newPrice < holder.vwap ? (holder.vwap - newPrice) * eligibleBalance : 0
      
      const { isEligible, reason } = checkEligibility(
        wallet,
        holder.balance,
        holder.vwap,
        newPrice,
        holder.firstBuyTimestamp,
        holder.hasSold,
        holder.hasTransferredOut,
        holder.lastWinCycle,
        holder.totalTokensBought
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
    existing.vwapSource = 'real'
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
        existing.hasSold,
        existing.hasTransferredOut,
        existing.lastWinCycle,
        newTotalTokens
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
      vwapSource: 'real',
      totalCostBasis: tokenAmount * pricePerToken,
      totalTokensBought: tokenAmount,
      firstBuyTimestamp: Date.now(),
      lastActivityTimestamp: Date.now(),
      buyCount: 1,
      hasSold: false,
      hasTransferredOut: false,
      lastWinCycle: null,
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
        false,
        false,
        null,
        tokenAmount
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
 * Record a transfer out transaction (disqualifies holder)
 */
export function recordTransferOut(wallet: string, balanceAfter: number): void {
  const existing = holders.get(wallet)
  
  if (existing) {
    existing.hasTransferredOut = true
    existing.isEligible = false
    existing.ineligibleReason = 'Transferred out'
    existing.balance = balanceAfter
    existing.lastActivityTimestamp = Date.now()
    existing.updatedAt = Date.now()
  }
  
  console.log(`[HolderService] Transfer out recorded: ${wallet.slice(0, 8)}... - disqualified`)
}

/**
 * Mark winners after a payout - sets cooldown so they can't win next round
 * Does NOT reset VWAP - that only happens on successful transfer
 */
export function markWinnersCooldown(winnerWallets: string[], cycle: number): void {
  for (const wallet of winnerWallets) {
    const holder = holders.get(wallet)
    if (holder) {
      // Set winner cooldown - they can't win next round
      holder.lastWinCycle = cycle
      holder.isEligible = false
      holder.ineligibleReason = 'Winner cooldown'
      holder.updatedAt = Date.now()
      
      console.log(`[HolderService] Winner cooldown set: ${wallet.slice(0, 8)}... - cycle ${cycle}`)
    }
  }
  
  // Advance cycle
  state.currentCycle = cycle + 1
}

/**
 * Reset a winner's VWAP after successful payout transfer
 * This should ONLY be called when tokens are actually transferred
 */
export function resetWinnerVwap(wallet: string): void {
  const holder = holders.get(wallet)
  const currentPrice = state.currentTokenPrice
  
  if (holder && currentPrice) {
    // Reset VWAP to current price (so their loss becomes 0)
    holder.vwap = currentPrice
    holder.totalCostBasis = holder.balance * currentPrice
    holder.totalTokensBought = holder.balance // Reset to current balance
    
    // Recalculate drawdown (should be 0% now)
    holder.drawdownPct = 0
    holder.lossUsd = 0
    holder.updatedAt = Date.now()
    
    console.log(`[HolderService] VWAP reset for ${wallet.slice(0, 8)}... after successful transfer`)
  }
}

/**
 * Mark winners after a payout - resets their VWAP and sets cooldown
 * @deprecated Use markWinnersCooldown() for cooldown only, resetWinnerVwap() for VWAP reset on successful transfer
 */
export function markWinners(winnerWallets: string[], cycle: number): void {
  // For backward compatibility, just set cooldown (don't reset VWAP)
  markWinnersCooldown(winnerWallets, cycle)
}

/**
 * Set the current cycle number (should be called on startup from DB)
 */
export function setCurrentCycle(cycle: number): void {
  state.currentCycle = cycle
  console.log(`[HolderService] Current cycle set to ${cycle}`)
}

/**
 * Get the current cycle number
 */
export function getHolderServiceCycle(): number {
  return state.currentCycle
}

/**
 * Get ranked losers sorted by drawdown %
 * Only returns holders with REAL VWAP data and who meet the minimum loss threshold
 */
export function getRankedLosers(): HolderData[] {
  const minLossRequired = config.poolBalanceUsd * (config.minLossThresholdPct / 100)
  
  const losers = Array.from(holders.values())
    .filter(h => 
      h.vwap && 
      h.vwap > 0 && 
      h.vwapSource === 'real' && // CRITICAL: Only real VWAP data
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
 * Only includes holders with real VWAP data
 */
export function getEligibleWinners(): HolderData[] {
  return Array.from(holders.values())
    .filter(h => h.isEligible && h.drawdownPct < 0 && h.vwapSource === 'real')
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
 * Get count of holders with real VWAP data
 */
export function getHoldersWithRealVwapCount(): number {
  return Array.from(holders.values()).filter(h => h.vwapSource === 'real').length
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
    
    // Get current SOL price for consistent calculations
    const currentSolPrice = (await getSolPrice()) || 220
    console.log(`[HolderService] Refresh using SOL price: $${currentSolPrice}`)
    
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
                state.currentTokenPrice!,
                currentSolPrice
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

