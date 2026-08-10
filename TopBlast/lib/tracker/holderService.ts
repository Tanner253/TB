/**
 * Holder Service - Manages all holder data with VWAP calculations
 * Uses MongoDB as cache for serverless compatibility (Vercel)
 * Loads from DB first, then fetches fresh data in background
 */

import { config } from '@/lib/config'
import { getTokenHolders, getWalletTransactions } from '@/lib/solana/indexer'
import { heliusWalletTxMaxPages } from '@/lib/platform/heliusLimits'
import { normalizeTokenBalance, meetsMinTokenHoldingFromChain, rawToHumanTokenAmount } from '@/lib/solana/tokenAmount'
import { calculateBatchVwaps } from '@/lib/tracker/vwap'
import { getTokenPrice, getSolPrice } from '@/lib/solana/price'
import connectDB from '@/lib/db'
import { Holder } from '@/lib/db/models'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { isLiquidityPoolWallet, ensureLiquidityPoolAddresses } from '@/lib/eligibility/liquidityPools'
import { getTenantSlug } from '@/lib/tenant/context'
import { getRankingsKey } from '@/lib/tenant/keys'
import { tenantFilter } from '@/lib/tenant/scope'
import {
  shouldThrottleFullReindex,
  markFullReindex,
} from '@/lib/solana/heliusCache'

/** VWAP lookup finished — do not re-hit Helius on every leaderboard poll. */
const RESOLVED_VWAP_REASONS = new Set([
  'Received via transfer',
  'Cost basis unavailable',
  'Liquidity pool excluded',
  'No buy history',
])

/** Retry inconclusive lookups (pending buys) — not used for permanent "No buy history". */
export const VWAP_HYDRATION_RETRY_MS = 30 * 60 * 1000

/** Worker cron: only wallets never scanned by Helius (avoids re-hitting resolved rows). */
export function rankingNeedsInitialVwapFetch(row: {
  vwap?: number | null
  ineligibleReason?: string | null
  vwapFetchedAt?: Date | string | number | null
  firstBuyAt?: Date | string | number | null
}): boolean {
  if (row.vwapFetchedAt) return false
  if ((row.vwap ?? 0) > 0 && row.firstBuyAt) return false
  return rankingNeedsVwapHydration(row)
}

export function rankingNeedsVwapHydration(row: {
  vwap?: number | null
  ineligibleReason?: string | null
  vwapFetchedAt?: Date | string | number | null
  firstBuyAt?: Date | string | number | null
}): boolean {
  const hasVwap = (row.vwap ?? 0) > 0
  const hasFirstBuy = !!row.firstBuyAt
  const reason = (row.ineligibleReason ?? '').trim()

  /** Partial/stale row: VWAP cached without a confirmed first buy — re-fetch from Helius. */
  if (
    hasVwap &&
    (!hasFirstBuy ||
      reason === 'No buy history' ||
      reason === 'Buy history pending')
  ) {
    const fetchedAt = row.vwapFetchedAt ? new Date(row.vwapFetchedAt).getTime() : 0
    if (fetchedAt > 0 && Date.now() - fetchedAt < VWAP_HYDRATION_RETRY_MS) {
      return false
    }
    return true
  }

  if (hasVwap) return false
  if (!reason || reason === 'Loading buy history...' || reason === 'Buy history pending') {
    return true
  }
  if (reason === 'No buy history') {
    // Permanent once Helius returned empty — do not re-fetch transfer-only wallets.
    if (row.vwapFetchedAt) return false
    return true
  }
  if (RESOLVED_VWAP_REASONS.has(reason)) {
    return false
  }
  return true
}

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
  isContract: boolean       // LP / pool contracts excluded from leaderboard
  updatedAt: number
}

// Global state (per-tenant, shared across API routes via module caching)
type HolderServiceState = {
  holders: Map<string, HolderData>
  serviceInitialized: boolean
  lastFullRefresh: number
  currentTokenPrice: number | null
  currentPoolUsd: number | null
  initializationInProgress: boolean
  currentCycle: number
}

declare global {
  var _holderServiceStates: Map<string, HolderServiceState> | undefined
}

function createEmptyState(): HolderServiceState {
  return {
    holders: new Map<string, HolderData>(),
    serviceInitialized: false,
    lastFullRefresh: 0,
    currentTokenPrice: null,
    currentPoolUsd: null,
    initializationInProgress: false,
    currentCycle: 1,
  }
}

function getState(): HolderServiceState {
  if (!global._holderServiceStates) {
    global._holderServiceStates = new Map()
  }
  const slug = getTenantSlug()
  let state = global._holderServiceStates.get(slug)
  if (!state) {
    state = createEmptyState()
    global._holderServiceStates.set(slug, state)
  }
  return state
}

function holders(): Map<string, HolderData> {
  return getState().holders
}

// Constants - OPTIMIZED FOR SPEED
const FULL_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes between refreshes
const VWAP_BATCH_SIZE = 30 // Process 30 wallets at a time (more parallel)
const VWAP_BATCH_DELAY = 50 // 50ms between batches (faster)
const MAX_INITIAL_HOLDERS = 200 // Process top 200 holders first (sorted by balance)
const PRIORITY_HOLDER_COUNT = 50 // Process top 50 holders FIRST for instant results

async function resolvePoolUsd(): Promise<number> {
  const { getLivePoolBalance } = await import('@/lib/payout/poolBalance')
  const live = await getLivePoolBalance()
  return live.poolUsd
}

/** Sync eligibility/min-loss calculations to the latest on-chain pool (single source of truth). */
export async function refreshPoolUsdCache(poolUsd?: number): Promise<number> {
  const resolved = poolUsd ?? (await resolvePoolUsd())
  getState().currentPoolUsd = resolved
  return resolved
}

function getEffectivePoolUsd(): number {
  return getState().currentPoolUsd ?? 0
}

/**
 * Initialize the holder service
 * STEP 1: Load cached data from MongoDB (instant)
 * STEP 2: Fetch fresh holders from blockchain
 * STEP 3: Calculate VWAPs in background, save to DB
 */
export async function initializeHolderService(): Promise<boolean> {
  if (getState().serviceInitialized) {
    return true
  }

  if (getState().initializationInProgress) {
    return true
  }

  getState().initializationInProgress = true
  console.log('[HolderService] Starting initialization...')

  try {
    // Connect to MongoDB
    await connectDB()

    getState().currentPoolUsd = await resolvePoolUsd()
    await ensureLiquidityPoolAddresses(config.tokenMint)

    // Get current token price (Blockscout, CoinGecko, or recent swap)
    getState().currentTokenPrice = await getTokenPrice(config.tokenMint)
    if (!getState().currentTokenPrice) {
      console.warn('[HolderService] No market price yet — indexing holders; price will update from swap history')
    } else {
      console.log(`[HolderService] Current price: $${getState().currentTokenPrice}`)
    }

    // STEP 1: Load cached holders from MongoDB (instant results!)
    const cachedHolders = await Holder.find(tenantFilter({ isEligible: true }))
      .sort({ lossUsd: -1 })
      .limit(100)
      .lean()
    
    if (cachedHolders.length > 0) {
      console.log(`[HolderService] Loading ${cachedHolders.length} cached holders from DB...`)
      
      for (const h of cachedHolders) {
        if (!h.vwap || !h.balance) continue
        if (isExcludedParticipantWallet(h.wallet)) continue
        
        // Recalculate eligibility with current price
        const poolUsd = getEffectivePoolUsd()
        const eligibility = evaluateHolderEligibility({
          wallet: h.wallet,
          balance: h.balance,
          vwap: h.vwap,
          tokenPrice: getState().currentTokenPrice!,
          firstBuyTimestamp: h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null,
          hasSold: h.hasSold || false,
          lastWinCycle: h.lastWinCycle || null,
          totalTokensBought: h.totalBought || 0,
          poolUsd,
        })
        const isEligible = eligibility.isEligible
        
        holders().set(h.wallet, {
          wallet: h.wallet,
          balance: h.balance,
          balanceRaw: h.balance * Math.pow(10, config.tokenDecimals),
          vwap: h.vwap,
          vwapSource: 'real',
          totalCostBasis: h.totalCostBasis || 0,
          totalTokensBought: h.totalBought || 0,
          firstBuyTimestamp: h.firstBuyAt ? new Date(h.firstBuyAt).getTime() : null,
          lastActivityTimestamp: h.lastActivityAt ? new Date(h.lastActivityAt).getTime() : null,
          buyCount: 1,
          hasSold: h.hasSold || false,
          hasTransferredOut: false,
          lastWinCycle: h.lastWinCycle || null,
          isEligible,
          ineligibleReason: eligibility.ineligibleReason,
          drawdownPct: eligibility.drawdownPct,
          lossUsd: eligibility.lossUsd,
          isContract: false,
          updatedAt: Date.now(),
        })
      }
      
      const eligibleFromCache = Array.from(holders().values()).filter(h => h.isEligible).length
      console.log(`[HolderService] ✅ Loaded ${holders().size} from cache, ${eligibleFromCache} eligible`)
    }

    // STEP 2: Fetch fresh holders from blockchain
    const limit = Math.min(config.maxHoldersToProcess, MAX_INITIAL_HOLDERS)
    const rawHolders = await getTokenHolders(config.tokenMint, limit)
    console.log(`[HolderService] Found ${rawHolders.length} holders on-chain`)

    if (rawHolders.length === 0 && holders().size === 0) {
      console.warn('[HolderService] No holders found')
      getState().initializationInProgress = false
      return false
    }

    // Sort by balance descending
    const sortedHolders = [...rawHolders].sort((a, b) => b.balance - a.balance)
    
    // Add holders not already in cache (skip LP/contracts and protocol wallets)
    for (const h of sortedHolders) {
      if (h.isContract) {
        console.log(`[HolderService] Skip contract holder ${h.wallet.slice(0, 10)}...`)
        continue
      }
      if (isExcludedParticipantWallet(h.wallet)) {
        console.log(`[HolderService] Skip protocol wallet ${h.wallet.slice(0, 10)}...`)
        continue
      }
      const balance = h.balance / Math.pow(10, config.tokenDecimals)
      if (!holders().has(h.wallet)) {
        holders().set(h.wallet, createBasicHolder(h.wallet, balance, h.balance, h.isContract))
      } else {
        // Update balance for cached holder
        const existing = holders().get(h.wallet)!
        existing.balance = balance
        existing.balanceRaw = h.balance
      }
    }

    // Mark as initialized
    getState().serviceInitialized = true
    console.log(`[HolderService] ✅ Quick init: ${holders().size} holders (${cachedHolders.length} from cache)`)

    // STEP 3: Fetch VWAPs for holders not in cache
    const holdersNeedingVwap = sortedHolders.filter(h => {
      if (h.isContract || isExcludedParticipantWallet(h.wallet)) return false
      const cached = holders().get(h.wallet)
      return !cached?.vwap || cached.vwapSource !== 'real'
    })
    
    if (holdersNeedingVwap.length > 0) {
      console.log(`[HolderService] Need to fetch ${holdersNeedingVwap.length} VWAPs...`)
      const sortedForVwap = sortedHolders.filter(h =>
        holdersNeedingVwap.some(n => n.wallet.toLowerCase() === h.wallet.toLowerCase())
      )
      await fetchPriorityVwaps(sortedForVwap)
      await saveRankingsToDb()
      fetchRemainingVwapsInBackground(sortedForVwap.slice(PRIORITY_HOLDER_COUNT))
    } else {
      console.log(`[HolderService] All VWAPs loaded from cache!`)
    }

    getState().initializationInProgress = false
    return true
  } catch (error: any) {
    console.error('[HolderService] Initialization error:', error.message)
    getState().initializationInProgress = false
    return false
  }
}

/**
 * Fetch VWAPs for top holders synchronously (leaderboard-critical path).
 */
async function fetchPriorityVwaps(
  sortedHolders: Array<{ wallet: string; balance: number; isContract?: boolean }>
): Promise<void> {
  if (!getState().currentTokenPrice) {
    getState().currentTokenPrice = await getTokenPrice(config.tokenMint)
  }
  if (!getState().currentTokenPrice) {
    console.warn('[HolderService] Priority VWAP: no token price yet')
    return
  }

  const currentEthPrice = (await getSolPrice()) || 220
  const priorityHolders = sortedHolders
    .filter(h => !h.isContract && !isExcludedParticipantWallet(h.wallet))
    .slice(0, PRIORITY_HOLDER_COUNT)
  console.log(`[HolderService] PRIORITY: Processing top ${priorityHolders.length} holders()...`)

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
            getState().currentTokenPrice!,
            currentEthPrice
          )
          holders().set(h.wallet, holderData)
        } catch {
          // Keep basic data on error
        }
      })
    )
  }

  const withVwap = Array.from(holders().values()).filter(h => h.vwapSource === 'real').length
  const eligible = Array.from(holders().values()).filter(h => h.isEligible).length
  console.log(`[HolderService] ✅ PRIORITY complete: ${withVwap} with VWAP, ${eligible} eligible`)
}

/**
 * Fetch remaining VWAPs in background without blocking API responses.
 */
async function fetchRemainingVwapsInBackground(
  remainingHolders: Array<{ wallet: string; balance: number }>
): Promise<void> {
  if (remainingHolders.length === 0) return

  if (!getState().currentTokenPrice) {
    getState().currentTokenPrice = await getTokenPrice(config.tokenMint)
  }
  if (!getState().currentTokenPrice) return

  const currentEthPrice = (await getSolPrice()) || 220
  console.log(`[HolderService] Background: fetching ${remainingHolders.length} remaining VWAPs...`)

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
            getState().currentTokenPrice!,
            currentEthPrice
          )
          holders().set(h.wallet, holderData)
        } catch {
          // Keep basic data on error
        }
      })
    )
    await sleep(VWAP_BATCH_DELAY)
  }

  getState().lastFullRefresh = Date.now()
  await saveRankingsToDb()
  const withVwap = Array.from(holders().values()).filter(h => h.vwapSource === 'real').length
  console.log(`[HolderService] ✅ Background VWAP complete: ${withVwap} with real VWAP`)
}

/** @deprecated use fetchPriorityVwaps + fetchRemainingVwapsInBackground */
async function fetchVwapsInBackground(sortedHolders: Array<{ wallet: string; balance: number }>): Promise<void> {
  await fetchPriorityVwaps(sortedHolders)
  await saveRankingsToDb()
  await fetchRemainingVwapsInBackground(sortedHolders.slice(PRIORITY_HOLDER_COUNT))
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
  const transactions = await getWalletTransactions(
    wallet,
    config.tokenMint,
    heliusWalletTxMaxPages()
  )

  let totalTokensBought = 0
  let totalEthSpent = 0         // Raw SOL amount
  let totalStablecoinSpent = 0  // Direct USD from stablecoin swaps
  let firstBuyTimestamp: number | null = null
  let lastActivityTimestamp: number | null = null
  let buyCount = 0
  let transferInCount = 0
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
      
      if (tx.usdValue > 0) {
        totalStablecoinSpent += tx.usdValue
      } else if (tx.solAmount > 0) {
        totalEthSpent += tx.solAmount
      } else if (tx.pricePerToken > 0 && tx.tokenAmount > 0) {
        totalStablecoinSpent += tx.pricePerToken * tx.tokenAmount
      }
      buyCount++
    } else if (tx.type === 'TRANSFER_IN') {
      transferInCount++
    } else if (tx.type === 'SELL') {
      hasSold = true
    } else if (tx.type === 'TRANSFER_OUT') {
      hasTransferredOut = true
    }
  }

  const ethPrice = currentSolPrice || (await getSolPrice()) || 3500
  
  // Calculate total cost basis using CURRENT ETH price
  const totalCostBasis = (totalEthSpent * ethPrice) + totalStablecoinSpent

  // Calculate VWAP - only if we have real cost basis data
  const vwap = (totalTokensBought > 0 && totalCostBasis > 0) 
    ? totalCostBasis / totalTokensBought 
    : null
  
  // vwapSource is 'real' only if we have actual transaction data
  const vwapSource: 'real' | 'none' = (vwap !== null && totalCostBasis > 0) ? 'real' : 'none'

  // Preserve lastWinCycle from existing holder data if it exists
  const existingHolder = holders().get(wallet)
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

  let ineligibleReason = reason
  if (!isEligible) {
    if (buyCount > 0 && !vwap) {
      ineligibleReason = 'Cost basis unavailable'
    } else if (buyCount === 0 && transferInCount > 0) {
      ineligibleReason = 'Received via transfer'
    } else if (reason === 'No buy history' && transactions.length === 0) {
      ineligibleReason = 'No on-chain activity'
    } else if (reason === 'Hold duration not met') {
      ineligibleReason = 'Hold duration not met'
    }
  }

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
    ineligibleReason,
    drawdownPct,
    lossUsd,
    isContract: isLiquidityPoolWallet(wallet, config.tokenMint),
    updatedAt: Date.now(),
  }
}

/**
 * Create basic holder entry without VWAP data
 */
function createBasicHolder(
  wallet: string,
  balance: number,
  balanceRaw: number,
  isContract = false
): HolderData {
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
    ineligibleReason: isContract ? 'Liquidity pool excluded' : 'Loading transaction history...',
    drawdownPct: 0,
    lossUsd: 0,
    isContract,
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
  const result = evaluateHolderEligibility({
    wallet,
    balance,
    vwap,
    tokenPrice,
    firstBuyTimestamp,
    hasSold,
    hasTransferredOut,
    lastWinCycle,
    totalTokensBought,
    poolUsd: getEffectivePoolUsd(),
    currentCycle: getHolderServiceCycle(),
  })

  return {
    isEligible: result.isEligible,
    reason: result.ineligibleReason,
    drawdownPct: result.drawdownPct,
    lossUsd: result.lossUsd,
  }
}

/**
 * Update price and recalculate all holder eligibility
 * Optionally saves to DB for cross-instance consistency
 */
export async function updatePrice(newPrice: number, saveToDb: boolean = false): Promise<void> {
  getState().currentTokenPrice = newPrice
  
  // Recalculate drawdown and eligibility for all holders
  for (const [wallet, holder] of holders()) {
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
  
  // Save to DB if requested (for cross-instance consistency)
  if (saveToDb && holders().size > 0) {
    await saveRankingsToDb()
  }
}

/**
 * Record a new buy transaction (from WebSocket)
 */
export function recordBuy(wallet: string, tokenAmount: number, pricePerToken: number, balanceAfter: number): void {
  const existing = holders().get(wallet)
  
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
    if (getState().currentTokenPrice) {
      const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
        wallet,
        balanceAfter,
        newVwap,
        getState().currentTokenPrice,
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
    if (getState().currentTokenPrice) {
      const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
        wallet,
        balanceAfter,
        pricePerToken,
        getState().currentTokenPrice,
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
    
    holders().set(wallet, newHolder)
  }
  
  console.log(`[HolderService] Buy recorded: ${wallet.slice(0, 8)}... bought ${tokenAmount.toLocaleString()} tokens`)
}

/**
 * Record a sell transaction (disqualifies holder)
 */
export function recordSell(wallet: string, balanceAfter: number): void {
  const existing = holders().get(wallet)
  
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
  const existing = holders().get(wallet)
  
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
    const holder = holders().get(wallet)
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
  getState().currentCycle = cycle + 1
}

/**
 * Reset a winner's VWAP after successful payout transfer
 * This should ONLY be called when tokens are actually transferred
 */
export function resetWinnerVwap(wallet: string): void {
  const holder = holders().get(wallet)
  const currentPrice = getState().currentTokenPrice
  
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
  getState().currentCycle = cycle
  console.log(`[HolderService] Current cycle set to ${cycle}`)
}

/**
 * Get the current cycle number
 */
export function getHolderServiceCycle(): number {
  return getState().currentCycle
}

/**
 * Get ranked losers sorted by drawdown %
 * Only returns holders with REAL VWAP data and who meet the minimum loss threshold
 */
export function getRankedLosers(): HolderData[] {
  const minLossRequired = getEffectivePoolUsd() * (config.minLossThresholdPct / 100)
  
  const losers = Array.from(holders().values())
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
  return Array.from(holders().values())
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
  return Array.from(holders().values())
}

/**
 * Get holder count
 */
export function getHolderCount(): number {
  return holders().size
}

/**
 * Get eligible holder count
 */
export function getEligibleCount(): number {
  return Array.from(holders().values()).filter(h => h.isEligible).length
}

/**
 * Get count of holders with real VWAP data
 */
export function getHoldersWithRealVwapCount(): number {
  return Array.from(holders().values()).filter(h => h.vwapSource === 'real').length
}

/**
 * Get current token price
 */
export function getCurrentPrice(): number | null {
  return getState().currentTokenPrice
}

/**
 * Check if service is initialized
 */
export function isServiceInitialized(): boolean {
  return getState().serviceInitialized
}

/**
 * Check if refresh is needed
 */
export function needsRefresh(): boolean {
  return Date.now() - getState().lastFullRefresh > FULL_REFRESH_INTERVAL
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
    initialized: getState().serviceInitialized,
    holderCount: holders().size,
    eligibleCount: getEligibleCount(),
    currentPrice: getState().currentTokenPrice,
    lastRefresh: getState().lastFullRefresh,
    initInProgress: getState().initializationInProgress,
  }
}

/**
 * Force a full refresh of holder data
 * Note: This does NOT reset the initialized state - we keep serving data during refresh
 */
export async function refreshHolders(): Promise<boolean> {
  if (getState().initializationInProgress) {
    console.log('[HolderService] Refresh skipped - initialization in progress')
    return false
  }
  
  // Don't reset serviceInitialized - keep serving existing data during refresh
  console.log('[HolderService] Starting background refresh...')
  
  getState().initializationInProgress = true
  
  try {
    // Get current token price
    const price = await getTokenPrice(config.tokenMint)
    if (price) {
      getState().currentTokenPrice = price
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
                getState().currentTokenPrice!,
                currentSolPrice
              )
              holders().set(holder.wallet, holderData)
            } catch (error) {
              // Keep existing data on error
            }
          })
        )
        
        if (i + VWAP_BATCH_SIZE < wallets.length) {
          await sleep(VWAP_BATCH_DELAY)
        }
      }
      
      getState().lastFullRefresh = Date.now()
    }
    
    getState().initializationInProgress = false
    console.log(`[HolderService] ✅ Refresh complete: ${holders().size} holders`)
    return true
  } catch (error: any) {
    console.error('[HolderService] Refresh error:', error.message)
    getState().initializationInProgress = false
    return false
  }
}

/**
 * Save current rankings to database for cross-instance consistency
 * This ensures all Vercel serverless instances show the same rankings
 * Saves ALL holders (not just losers) so leaderboard can show everyone's position
 */
export async function saveRankingsToDb(): Promise<void> {
  try {
    if (holders().size === 0) {
      console.log('[HolderService] Skip rankings save — in-memory holders empty (avoid wiping DB)')
      return
    }

    await refreshPoolUsdCache()

    const { CurrentRankings } = await import('@/lib/db/models')
    await connectDB()
    
    // Include EOA holders only; leaderboard ranks eligible losers by drawdown
    const eoaHolders = Array.from(holders().values()).filter(
      h =>
        !h.isContract &&
        !isExcludedParticipantWallet(h.wallet) &&
        h.balance >= config.minTokenHolding
    )

    for (const h of eoaHolders) {
      if (!getState().currentTokenPrice) continue
      const { isEligible, reason, drawdownPct, lossUsd } = checkEligibility(
        h.wallet,
        h.balance,
        h.vwap,
        getState().currentTokenPrice,
        h.firstBuyTimestamp,
        h.hasSold,
        h.hasTransferredOut,
        h.lastWinCycle,
        h.totalTokensBought
      )
      h.isEligible = isEligible
      h.ineligibleReason = reason
      h.drawdownPct = drawdownPct
      h.lossUsd = lossUsd
    }

    const rankedHolders = [...eoaHolders].sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1
      }
      if (a.drawdownPct !== b.drawdownPct) {
        return a.drawdownPct - b.drawdownPct
      }
      return b.lossUsd - a.lossUsd
    })

    const rankings = rankedHolders.slice(0, 50).map(h => ({
      wallet: h.wallet,
      balance: h.balance,
      vwap: h.vwap || 0,
      drawdownPct: h.drawdownPct,
      lossUsd: h.lossUsd,
      isEligible: h.isEligible,
      ineligibleReason: h.ineligibleReason,
      firstBuyAt: h.firstBuyTimestamp ? new Date(h.firstBuyTimestamp) : null,
      hasSold: h.hasSold,
      hasTransferredOut: h.hasTransferredOut,
      totalTokensBought: h.totalTokensBought,
      lastWinCycle: h.lastWinCycle,
      isContract: false,
    }))
    
    const eligibleCount = eoaHolders.filter(h => h.isEligible).length

    await CurrentRankings.findOneAndUpdate(
      { key: getRankingsKey() },
      {
        $set: {
          tokenMint: config.tokenMint,
          rankings,
          totalHolders: eoaHolders.length,
          eligibleCount,
          holdersWithVwap: eoaHolders.filter(h => h.vwapSource === 'real').length,
          tokenPrice: getState().currentTokenPrice || 0,
          lastCalculated: new Date(),
        }
      },
      { upsert: true }
    )

    const { syncPayoutTimerWithPayableWinners } = await import('@/lib/payout/executor')
    await syncPayoutTimerWithPayableWinners(eligibleCount)
    
    console.log(`[HolderService] Rankings saved to DB: ${rankings.length} entries, ${eligibleCount} eligible`)
  } catch (error: any) {
    console.error('[HolderService] Failed to save rankings to DB:', error.message)
  }
}

/**
 * Load rankings from database
 * Returns null if no rankings exist yet
 */
export async function loadRankingsFromDb(): Promise<{
  rankings: Array<{
    wallet: string
    balance: number
    vwap: number
    drawdownPct: number
    lossUsd: number
    isEligible: boolean
    ineligibleReason: string | null
    firstBuyAt?: Date | string | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
    lastWinCycle?: number | null
    isContract?: boolean
  }>
  totalHolders: number
  eligibleCount: number
  holdersWithVwap: number
  tokenPrice: number
  lastCalculated: Date
} | null> {
  try {
    const { CurrentRankings } = await import('@/lib/db/models')
    await connectDB()
    
    const data = await CurrentRankings.findOne({ key: getRankingsKey() }).lean()
    
    if (!data) {
      return null
    }
    
    return {
      rankings: (data.rankings || []).map(r => ({
        ...r,
        balance: normalizeTokenBalance(
          r.balance,
          config.tokenDecimals,
          config.minTokenHolding
        ),
      })),
      totalHolders: data.totalHolders || 0,
      eligibleCount: data.eligibleCount || 0,
      holdersWithVwap: data.holdersWithVwap || 0,
      tokenPrice: data.tokenPrice || 0,
      lastCalculated: data.lastCalculated || new Date(),
    }
  } catch (error: any) {
    console.error('[HolderService] Failed to load rankings from DB:', error.message)
    return null
  }
}

/** Merge hydrated rows into CurrentRankings so later polls skip Helius for those wallets. */
export async function patchRankingsInDb(
  patches: Array<{
    wallet: string
    balance?: number
    vwap?: number
    drawdownPct?: number
    lossUsd?: number
    isEligible?: boolean
    ineligibleReason?: string | null
    firstBuyAt?: Date | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
  }>
): Promise<void> {
  if (patches.length === 0) return

  try {
    const { CurrentRankings } = await import('@/lib/db/models')
    await connectDB()

    const doc = await CurrentRankings.findOne({ key: getRankingsKey() })
    if (!doc?.rankings?.length) return

    const patchByWallet = new Map(patches.map(p => [p.wallet, p]))
    const updated = doc.rankings.map((row: Record<string, unknown>) => {
      const patch = patchByWallet.get(String(row.wallet))
      return patch ? { ...row, ...patch } : row
    })

    doc.rankings = updated
    doc.holdersWithVwap = updated.filter(r => (Number(r.vwap) || 0) > 0).length
    doc.lastCalculated = new Date()
    await doc.save()

    console.log(
      `[HolderService] Patched ${patches.length} ranking(s) in DB (${doc.holdersWithVwap} with VWAP)`
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[HolderService] patchRankingsInDb failed:', message)
  }
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Clear in-memory holder cache (after deployment reset or token change). */
export function resetHolderServiceState(): void {
  holders().clear()
  getState().serviceInitialized = false
  getState().initializationInProgress = false
  getState().lastFullRefresh = 0
  getState().currentTokenPrice = null
  getState().currentPoolUsd = null
}

/** Count trackable holders saved for leaderboard (excludes LP / protocol wallets). */
function countTrackableRankings(
  rankings: Array<{ wallet: string; isContract?: boolean }>
): number {
  return rankings.filter(h => !h.isContract && !isExcludedParticipantWallet(h.wallet)).length
}

async function countQualifyingOnChain(): Promise<number> {
  const { getOnChainHolderStats } = await import('@/lib/solana/holderStats')
  const stats = await getOnChainHolderStats(config.tokenMint)
  return stats.qualifying
}

/** Re-index from chain when DB rankings are missing, empty, stale, or have no VWAP data. */
export async function ensureRankingsIndexed(): Promise<boolean> {
  const existing = await loadRankingsFromDb()
  const tenantKey = getRankingsKey()

  if (
    existing &&
    existing.totalHolders > 0 &&
    existing.rankings.length > 0 &&
    existing.holdersWithVwap > 0 &&
    shouldThrottleFullReindex(tenantKey)
  ) {
    return true
  }

  const trackableInDb = existing ? countTrackableRankings(existing.rankings) : 0

  const looksComplete =
    existing &&
    existing.totalHolders > 0 &&
    existing.rankings.length > 0 &&
    existing.holdersWithVwap > 0 &&
    trackableInDb > 0

  if (looksComplete && shouldThrottleFullReindex(tenantKey)) {
    return true
  }

  const qualifyingOnChain = await countQualifyingOnChain()

  const isStale =
    qualifyingOnChain > 0 &&
    (existing?.totalHolders ?? 0) < qualifyingOnChain

  if (looksComplete && !isStale) {
    return true
  }

  if (isStale && existing) {
    console.log(
      `[HolderService] Stale rankings (${existing.totalHolders} in DB, ${qualifyingOnChain} qualifying on-chain) — re-indexing...`
    )
  }

  if (existing && existing.rankings.length > 0 && existing.holdersWithVwap === 0 && !isStale) {
    console.log('[HolderService] Rankings stale (0 VWAP) — refreshing buy history...')
    return ensureVwapCalculated()
  }

  console.log('[HolderService] Rankings missing/empty — re-indexing from chain...')
  resetHolderServiceState()
  getState().currentPoolUsd = await resolvePoolUsd()
  const ok = await initializeHolderService()
  if (!ok || holders().size === 0) {
    return false
  }

  await saveRankingsToDb()
  markFullReindex(tenantKey)
  return true
}

/**
 * Calculate VWAP for tracked holders when rankings exist but buy history was never resolved.
 */
export async function ensureVwapCalculated(): Promise<boolean> {
  try {
    await connectDB()
    getState().currentPoolUsd = await resolvePoolUsd()
    if (!getState().currentTokenPrice) {
      getState().currentTokenPrice = await getTokenPrice(config.tokenMint)
    }

    if (!getState().serviceInitialized) {
      const ok = await initializeHolderService()
      if (!ok) return false
    }

    if (getHoldersWithRealVwapCount() > 0) {
      return true
    }

    const rawHolders = await getTokenHolders(
      config.tokenMint,
      Math.min(config.maxHoldersToProcess, MAX_INITIAL_HOLDERS)
    )
    if (rawHolders.length === 0) {
      return false
    }

    const sortedHolders = [...rawHolders].sort((a, b) => b.balance - a.balance)
    for (const h of sortedHolders) {
      if (h.isContract) continue
      if (isExcludedParticipantWallet(h.wallet)) continue
      const balance = h.balance / Math.pow(10, config.tokenDecimals)
      if (!holders().has(h.wallet)) {
        holders().set(h.wallet, createBasicHolder(h.wallet, balance, h.balance, h.isContract))
      }
    }

    await fetchPriorityVwaps(sortedHolders)
    await saveRankingsToDb()
    fetchRemainingVwapsInBackground(sortedHolders.slice(PRIORITY_HOLDER_COUNT))

    return getHoldersWithRealVwapCount() > 0
  } catch (error: any) {
    console.error('[HolderService] ensureVwapCalculated failed:', error.message)
    return false
  }
}

/**
 * Fetch Helius buy history for holders missing VWAP (leaderboard-critical path).
 */
export async function hydrateRankingsWithVwap<
  T extends {
    wallet: string
    balance: number
    vwap?: number
    firstBuyAt?: Date | string | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
    ineligibleReason?: string | null
    isEligible?: boolean
    isContract?: boolean
    hasTransferIn?: boolean
  },
>(rankings: T[], options?: { maxWallets?: number; tokenPrice?: number; concurrency?: number }): Promise<{
  rankings: T[]
  holdersWithVwap: number
}> {
  if (!config.tokenMint || rankings.length === 0) {
    return { rankings, holdersWithVwap: 0 }
  }

  await ensureLiquidityPoolAddresses(config.tokenMint)

  const isTrackable = (h: T) =>
    !h.isContract &&
    !isExcludedParticipantWallet(h.wallet) &&
    !isLiquidityPoolWallet(h.wallet, config.tokenMint)

  const needsVwap = rankings
    .filter(h => isTrackable(h) && rankingNeedsVwapHydration(h))
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
    .slice(0, options?.maxWallets ?? 25)

  if (needsVwap.length === 0) {
    return {
      rankings,
      holdersWithVwap: rankings.filter(h => isTrackable(h) && (h.vwap ?? 0) > 0).length,
    }
  }

  await connectDB()
  const { Holder } = await import('@/lib/db/models')
  const dbRows = await Holder.find(
    tenantFilter({
      wallet: { $in: needsVwap.map(h => h.wallet) },
      vwap: { $gt: 0 },
    })
  )
    .select('wallet vwap firstBuyAt totalBought hasSold')
    .lean()

  const dbByWallet = new Map(dbRows.map(r => [r.wallet, r]))
  let rankingsWithDb = rankings.map(row => {
    const doc = dbByWallet.get(row.wallet)
    if (!doc?.vwap || !doc.firstBuyAt) return row
    return {
      ...row,
      vwap: doc.vwap,
      firstBuyAt: doc.firstBuyAt ?? row.firstBuyAt ?? null,
      totalTokensBought: doc.totalBought ?? row.totalTokensBought ?? 0,
      hasSold: doc.hasSold ?? row.hasSold ?? false,
    }
  }) as T[]

  const stillNeedingHelius = needsVwap.filter(h => {
    const doc = dbByWallet.get(h.wallet)
    const row = rankingsWithDb.find(r => r.wallet === h.wallet) ?? h
    const hasCompleteDbVwap = !!(doc?.vwap && doc.vwap > 0 && doc.firstBuyAt)
    const hasCompleteRowVwap =
      (row.vwap ?? 0) > 0 && !!(row.firstBuyAt ?? doc?.firstBuyAt)
    return !hasCompleteDbVwap && !hasCompleteRowVwap
  })

  if (stillNeedingHelius.length === 0) {
    return {
      rankings: rankingsWithDb,
      holdersWithVwap: rankingsWithDb.filter(h => isTrackable(h) && (h.vwap ?? 0) > 0).length,
    }
  }

  const tokenPrice = options?.tokenPrice ?? (await getTokenPrice(config.tokenMint)) ?? 0
  const concurrency = options?.concurrency ?? Math.min(6, stillNeedingHelius.length)
  const vwapMap = await calculateBatchVwaps(
    stillNeedingHelius.map(h => h.wallet),
    config.tokenMint,
    tokenPrice,
    concurrency
  )

  const now = new Date()
  const patchedRows: Array<{
    wallet: string
    balance?: number
    vwap?: number
    ineligibleReason?: string | null
    firstBuyAt?: Date | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
    vwapFetchedAt?: Date
  }> = []

  const updated = rankingsWithDb.map(row => {
    const v = vwapMap.get(row.wallet)
    if (!v) return row

    const humanBalance = normalizeTokenBalance(row.balance, config.tokenDecimals, config.minTokenHolding)
    let ineligibleReason = row.ineligibleReason ?? null

    if (v.txCount === 0) {
      ineligibleReason = 'Buy history pending'
    } else if (v.buyCount === 0 && v.hasTransferIn) {
      ineligibleReason = 'Received via transfer'
    } else if (!v.vwap && v.buyCount > 0) {
      ineligibleReason = 'Cost basis unavailable'
    } else if (!v.vwap) {
      ineligibleReason = 'No buy history'
    } else {
      ineligibleReason = null
    }

    const merged = {
      ...row,
      balance: humanBalance,
      vwap: v.vwap ?? 0,
      firstBuyAt: v.firstBuyTimestamp ? new Date(v.firstBuyTimestamp) : row.firstBuyAt ?? null,
      hasSold: v.hasSold,
      hasTransferredOut: v.hasTransferredOut,
      hasTransferIn: v.hasTransferIn,
      totalTokensBought: v.totalTokensBought,
      ineligibleReason,
      isEligible: false,
      vwapFetchedAt: now,
    } as T

    patchedRows.push({
      wallet: row.wallet,
      balance: humanBalance,
      vwap: v.vwap ?? 0,
      ineligibleReason,
      firstBuyAt: merged.firstBuyAt ?? null,
      hasSold: v.hasSold,
      hasTransferredOut: v.hasTransferredOut,
      totalTokensBought: v.totalTokensBought,
      vwapFetchedAt: now,
    })

    return merged
  }) as T[]

  if (patchedRows.length > 0) {
    await patchRankingsInDb(patchedRows)
  }

  return {
    rankings: updated,
    holdersWithVwap: updated.filter(h => isTrackable(h) && (h.vwap ?? 0) > 0).length,
  }
}

/** Continue buy-history hydration for rankings that still need VWAP (worker/cron path). */
export async function ensureRankingsVwapProgress(options?: {
  maxWallets?: number
  tokenPrice?: number
  concurrency?: number
}): Promise<{ hydrated: number; holdersWithVwap: number; stillPending: number }> {
  const dbRankings = await loadRankingsFromDb()
  if (!dbRankings?.rankings?.length) {
    return { hydrated: 0, holdersWithVwap: 0, stillPending: 0 }
  }

  const needing = dbRankings.rankings.filter(rankingNeedsInitialVwapFetch)
  if (needing.length === 0) {
    return { hydrated: 0, holdersWithVwap: dbRankings.holdersWithVwap, stillPending: 0 }
  }

  const before = dbRankings.rankings.filter(h => (h.vwap ?? 0) > 0).length
  const result = await hydrateRankingsWithVwap(dbRankings.rankings, {
    maxWallets: options?.maxWallets,
    tokenPrice: options?.tokenPrice,
    concurrency: options?.concurrency,
  })
  const stillPending = result.rankings.filter(rankingNeedsInitialVwapFetch).length
  return {
    hydrated: Math.max(0, result.holdersWithVwap - before),
    holdersWithVwap: result.holdersWithVwap,
    stillPending,
  }
}

/** Block payout until top-ranked wallets have resolved buy history (avoids wrong winners). */
export function payoutBlockedByPendingVwap(
  rankings: Array<{ wallet: string; balance: number; vwap?: number; ineligibleReason?: string | null; isContract?: boolean }>,
  winnerCount: number
): boolean {
  const trackable = rankings
    .filter(
      h =>
        !h.isContract &&
        !isExcludedParticipantWallet(h.wallet) &&
        !isLiquidityPoolWallet(h.wallet, config.tokenMint)
    )
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))

  const criticalCount = Math.max(winnerCount * 5, 20)
  const critical = trackable.slice(0, Math.min(criticalCount, trackable.length))
  return critical.some(h => {
    const hasCostBasis = (h.vwap ?? 0) > 0 && !!h.firstBuyAt
    if (hasCostBasis) return false
    return rankingNeedsVwapHydration(h)
  })
}

/**
 * Build display-only rankings from on-chain holder balances when MongoDB is empty
 * (common on cold serverless starts or after a failed re-index). Does not persist.
 */
export async function buildEphemeralRankingsFromChain(): Promise<{
  rankings: Array<{
    wallet: string
    balance: number
    vwap: number
    drawdownPct: number
    lossUsd: number
    isEligible: boolean
    ineligibleReason: string | null
    firstBuyAt?: Date | null
    hasSold?: boolean
    hasTransferredOut?: boolean
    totalTokensBought?: number
    lastWinCycle?: number | null
    isContract?: boolean
  }>
  totalHolders: number
  eligibleCount: number
  holdersWithVwap: number
  tokenPrice: number
  lastCalculated: Date
} | null> {
  try {
    if (!config.tokenMint) return null

    const raw = await getTokenHolders(
      config.tokenMint,
      Math.min(config.maxHoldersToProcess, MAX_INITIAL_HOLDERS)
    )

    await ensureLiquidityPoolAddresses(config.tokenMint)

    const trackable = raw.filter(
      h =>
        !h.isContract &&
        !isExcludedParticipantWallet(h.wallet) &&
        !isLiquidityPoolWallet(h.wallet, config.tokenMint) &&
        meetsMinTokenHoldingFromChain(h.balance, config.tokenDecimals, config.minTokenHolding)
    )

    if (trackable.length === 0) return null

    let tokenPrice = getState().currentTokenPrice
    if (!tokenPrice) {
      tokenPrice = await getTokenPrice(config.tokenMint)
      if (tokenPrice) getState().currentTokenPrice = tokenPrice
    }

    let rankings = trackable
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 50)
      .map(h => ({
        wallet: h.wallet,
        balance: rawToHumanTokenAmount(h.balance, config.tokenDecimals),
        vwap: 0,
        drawdownPct: 0,
        lossUsd: 0,
        isEligible: false,
        ineligibleReason: 'Loading buy history...',
        firstBuyAt: null as Date | null,
        hasSold: false,
        hasTransferredOut: false,
        hasTransferIn: false,
        totalTokensBought: 0,
        lastWinCycle: null as number | null,
        isContract: false,
      }))

    const hydrated = await hydrateRankingsWithVwap(rankings, {
      maxWallets: 2,
      tokenPrice: tokenPrice || 0,
    })
    rankings = hydrated.rankings

    console.log(
      `[HolderService] Ephemeral rankings from chain: ${rankings.length} holder(s), ${hydrated.holdersWithVwap} with VWAP`
    )

    return {
      rankings,
      totalHolders: trackable.length,
      eligibleCount: 0,
      holdersWithVwap: hydrated.holdersWithVwap,
      tokenPrice: tokenPrice || 0,
      lastCalculated: new Date(),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[HolderService] Ephemeral rankings failed:', message)
    return null
  }
}

