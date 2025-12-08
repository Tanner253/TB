/**
 * Payout Executor - Simple, direct payout logic
 * NO snapshots, NO cron, NO mock data
 * 
 * Flow:
 * 1. Timer hits 0
 * 2. Fetch holders from blockchain
 * 3. Calculate VWAPs and rankings in real-time
 * 4. Send SOL to top 3 losers + dev fee
 * 5. Save results to DB with real tx hashes
 * 
 * IMPORTANT: All timer state is stored in MongoDB to ensure consistency
 * across Vercel serverless function instances (no in-memory state drift)
 */

import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification, TimerState } from '@/lib/db/models'
import { transferSol, getPayoutWalletBalance } from '@/lib/solana/transfer'
import { getSolPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { getRankedLosers, getServiceStatus } from '@/lib/tracker/holderService'

// In-memory cache for timer state (refreshed from DB on each request)
// These are ONLY used as a cache - database is the source of truth
let cachedTimerState: {
  lastPayoutTime: number
  currentCycle: number
  failedAttempts: number
  isPayoutInProgress: boolean
  lastDbSync: number
} = {
  lastPayoutTime: Date.now(),
  currentCycle: 0,
  failedAttempts: 0,
  isPayoutInProgress: false,
  lastDbSync: 0,
}

// How often to refresh from DB (5 seconds - balance between consistency and performance)
const DB_SYNC_INTERVAL = 5000
const MAX_ATTEMPTS_PER_INTERVAL = 3

// Helper to generate Solscan link
function getSolscanLink(txHash: string | null): string | null {
  if (!txHash) return null
  const network = process.env.SOLANA_NETWORK || 'mainnet'
  const cluster = network === 'devnet' ? '?cluster=devnet' : ''
  return `https://solscan.io/tx/${txHash}${cluster}`
}

export interface PayoutResult {
  success: boolean
  cycle?: number
  error?: string
  data?: any
}

/**
 * Sync timer state from MongoDB (source of truth for serverless consistency)
 * This ensures all Vercel instances see the same timer state
 */
async function syncTimerStateFromDb(): Promise<void> {
  const now = Date.now()
  
  // Only sync if we haven't synced recently (performance optimization)
  if (now - cachedTimerState.lastDbSync < DB_SYNC_INTERVAL) {
    return
  }
  
  try {
    await connectDB()
    
    // Get or create timer state
    let timerState = await TimerState.findOne({ key: 'payout_timer' }).lean()
    
    if (!timerState) {
      // First time - initialize from last payout or current time
      const lastPayout = await Payout.findOne().sort({ createdAt: -1 }).lean()
      
      const initialLastPayoutTime = lastPayout 
        ? new Date(lastPayout.createdAt).getTime() 
        : now
      const initialCycle = lastPayout?.cycle || 0
      
      // Create the timer state document
      await TimerState.create({
        key: 'payout_timer',
        lastPayoutTime: new Date(initialLastPayoutTime),
        currentCycle: initialCycle,
        failedAttempts: 0,
        isPayoutInProgress: false,
      })
      
      cachedTimerState = {
        lastPayoutTime: initialLastPayoutTime,
        currentCycle: initialCycle,
        failedAttempts: 0,
        isPayoutInProgress: false,
        lastDbSync: now,
      }
      
      console.log(`[Payout] Timer state initialized: cycle ${initialCycle}, last payout ${new Date(initialLastPayoutTime).toISOString()}`)
    } else {
      // Load from existing timer state
      cachedTimerState = {
        lastPayoutTime: new Date(timerState.lastPayoutTime).getTime(),
        currentCycle: timerState.currentCycle,
        failedAttempts: timerState.failedAttempts,
        isPayoutInProgress: timerState.isPayoutInProgress,
        lastDbSync: now,
      }
    }
  } catch (error) {
    console.error('[Payout] Failed to sync timer state from DB:', error)
    // Keep using cached state if DB sync fails
  }
}

/**
 * Update timer state in MongoDB
 */
async function updateTimerStateInDb(updates: {
  lastPayoutTime?: number
  currentCycle?: number
  failedAttempts?: number
  isPayoutInProgress?: boolean
}): Promise<void> {
  try {
    const dbUpdates: any = { updatedAt: new Date() }
    
    if (updates.lastPayoutTime !== undefined) {
      dbUpdates.lastPayoutTime = new Date(updates.lastPayoutTime)
      cachedTimerState.lastPayoutTime = updates.lastPayoutTime
    }
    if (updates.currentCycle !== undefined) {
      dbUpdates.currentCycle = updates.currentCycle
      cachedTimerState.currentCycle = updates.currentCycle
    }
    if (updates.failedAttempts !== undefined) {
      dbUpdates.failedAttempts = updates.failedAttempts
      cachedTimerState.failedAttempts = updates.failedAttempts
    }
    if (updates.isPayoutInProgress !== undefined) {
      dbUpdates.isPayoutInProgress = updates.isPayoutInProgress
      cachedTimerState.isPayoutInProgress = updates.isPayoutInProgress
    }
    
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      { $set: dbUpdates },
      { upsert: true }
    )
    
    cachedTimerState.lastDbSync = Date.now()
  } catch (error) {
    console.error('[Payout] Failed to update timer state in DB:', error)
  }
}

/**
 * Execute a payout - calculates winners in real-time and sends SOL
 */
export async function executePayout(): Promise<PayoutResult> {
  try {
    await connectDB()
    
    // Sync timer state from DB FIRST (source of truth)
    await syncTimerStateFromDb()
    
    // MUTEX LOCK using DB state
    if (cachedTimerState.isPayoutInProgress) {
      return { success: false, error: 'Payout already in progress' }
    }
    
    // Mark as in progress in DB (prevents other instances from starting)
    await updateTimerStateInDb({ isPayoutInProgress: true })
    
    const now = Date.now()
    const intervalMs = config.payoutIntervalMinutes * 60 * 1000
    
    // Calculate the current interval window
    const intervalStart = Math.floor(now / intervalMs) * intervalMs
    
    // CHECK DATABASE for existing payout in this interval
    const existingPayout = await Payout.findOne({
      createdAt: { $gte: new Date(intervalStart) }
    }).lean()
    
    if (existingPayout) {
      console.log(`[Payout] Already paid this interval (cycle ${existingPayout.cycle})`)
      await updateTimerStateInDb({ isPayoutInProgress: false })
      return { success: false, error: 'Already paid this interval' }
    }
    
    // If a full interval has passed, reset attempt counter
    if (now - cachedTimerState.lastPayoutTime >= intervalMs) {
      await updateTimerStateInDb({ failedAttempts: 0 })
    }
    
    // RETRY LIMIT - max 3 attempts per interval
    if (cachedTimerState.failedAttempts >= MAX_ATTEMPTS_PER_INTERVAL) {
      await updateTimerStateInDb({ isPayoutInProgress: false })
      return { success: false, error: `Max ${MAX_ATTEMPTS_PER_INTERVAL} attempts reached. Waiting for next interval.` }
    }
    
    await updateTimerStateInDb({ failedAttempts: cachedTimerState.failedAttempts + 1 })
    
    // Check if service has holder data
    const status = getServiceStatus()
    if (!status.initialized || status.holderCount === 0) {
      await updateTimerStateInDb({ isPayoutInProgress: false })
      return { success: false, error: 'Holder service not ready. Waiting for data...' }
    }
    
    console.log(`[Payout] Starting payout cycle ${cachedTimerState.currentCycle + 1} (attempt ${cachedTimerState.failedAttempts}/${MAX_ATTEMPTS_PER_INTERVAL})`)
    console.log(`[Payout] Execute transfers: ${config.executePayouts}`)

    // 1. Get SOL price
    const solPrice = await getSolPrice() || 200
    console.log(`[Payout] SOL Price: $${solPrice}`)

    // 2. Get wallet balance and calculate pool (99% of balance)
    const walletBalance = await getPayoutWalletBalance()
    if (!walletBalance || walletBalance.sol <= 0) {
      isPayoutInProgress = false
      return { success: false, error: 'Payout wallet has no balance' }
    }
    
    // Pool = 99% of wallet balance (keep 1% for rent/fees)
    const poolSol = walletBalance.sol * config.poolPercentage
    const poolUsd = poolSol * solPrice
    
    console.log(`[Payout] Wallet: ${walletBalance.sol.toFixed(6)} SOL`)
    console.log(`[Payout] Pool (${config.poolPercentage * 100}%): ${poolSol.toFixed(6)} SOL ($${poolUsd.toFixed(2)})`)
    
    // Check minimum pool threshold
    if (poolSol < config.minPoolSol) {
      isPayoutInProgress = false
      return { 
        success: false, 
        error: `Pool ${poolSol.toFixed(6)} SOL below minimum ${config.minPoolSol} SOL` 
      }
    }

    // 3. Get ranked losers IN REAL-TIME (no snapshots!)
    const rankedLosers = getRankedLosers()
    const eligibleWinners = rankedLosers.filter(h => h.isEligible).slice(0, 3)

    if (eligibleWinners.length === 0) {
      console.log('[Payout] No eligible winners')
      const newCycle = cachedTimerState.currentCycle + 1
      await updateTimerStateInDb({ 
        currentCycle: newCycle, 
        lastPayoutTime: now, 
        isPayoutInProgress: false,
        failedAttempts: 0 
      })
      return { 
        success: true, 
        cycle: newCycle,
        data: { skipped: true, reason: 'No eligible winners', eligible_count: 0 } 
      }
    }

    console.log(`[Payout] Found ${eligibleWinners.length} eligible winners`)

    // 5. Calculate amounts
    const devFeeSol = poolSol * config.devFeePct
    const winnersPoolSol = poolSol - devFeeSol
    const payoutAmounts = [
      winnersPoolSol * config.payoutSplit.first,
      winnersPoolSol * config.payoutSplit.second,
      winnersPoolSol * config.payoutSplit.third,
    ]

    const results: any[] = []
    let totalPaidSol = 0
    const cycle = cachedTimerState.currentCycle + 1

    // 6. Pay dev fee FIRST
    if (config.devWalletAddress && config.executePayouts) {
      console.log(`[Payout] Dev fee: ${devFeeSol.toFixed(6)} SOL -> ${config.devWalletAddress.slice(0, 8)}...`)
      
      const devResult = await transferSol(config.devWalletAddress, devFeeSol)
      
      await Payout.create({
        cycle,
        rank: 0,
        wallet: config.devWalletAddress,
        amount: devFeeSol * solPrice,
        amountTokens: devFeeSol,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: devResult.txHash,
        status: devResult.success ? 'success' : 'failed',
        errorMessage: devResult.error,
      })

      results.push({
        rank: 0,
        type: 'dev_fee',
        wallet: config.devWalletAddress,
        wallet_display: `${config.devWalletAddress.slice(0, 4)}...${config.devWalletAddress.slice(-4)}`,
        amount_sol: devFeeSol.toFixed(6),
        amount_usd: (devFeeSol * solPrice).toFixed(2),
        tx_hash: devResult.txHash,
        solscan_url: getSolscanLink(devResult.txHash),
        status: devResult.success ? 'success' : 'failed',
        error: devResult.error,
      })

      if (devResult.success) {
        totalPaidSol += devFeeSol
        console.log(`[Payout] Dev fee: ✅ ${devResult.txHash}`)
      } else {
        console.log(`[Payout] Dev fee: ❌ ${devResult.error}`)
      }
    }

    // 7. Pay winners
    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountSol = payoutAmounts[i]
      const amountUsd = amountSol * solPrice

      console.log(`[Payout] #${i + 1}: ${winner.wallet.slice(0, 8)}... | ${amountSol.toFixed(6)} SOL | ${winner.drawdownPct.toFixed(1)}% down`)

      let txResult: { success: boolean; txHash: string | null; error: string | null }

      if (config.executePayouts) {
        txResult = await transferSol(winner.wallet, amountSol)
      } else {
        // NOT executing - this should NOT happen in production
        console.warn('[Payout] ⚠️ EXECUTE_PAYOUTS is false - no transfer made')
        txResult = { success: false, txHash: null, error: 'EXECUTE_PAYOUTS is false' }
      }

      // Save to DB with REAL data
      await Payout.create({
        cycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountUsd,
        amountTokens: amountSol,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })

      results.push({
        rank: i + 1,
        wallet: winner.wallet,
        wallet_display: `${winner.wallet.slice(0, 4)}...${winner.wallet.slice(-4)}`,
        amount_sol: amountSol.toFixed(6),
        amount_usd: amountUsd.toFixed(2),
        drawdown_pct: winner.drawdownPct.toFixed(2),
        loss_usd: winner.lossUsd.toFixed(2),
        tx_hash: txResult.txHash,
        solscan_url: getSolscanLink(txResult.txHash),
        status: txResult.success ? 'success' : 'failed',
        error: txResult.error,
      })

      if (txResult.success) {
        totalPaidSol += amountSol
        console.log(`[Payout] #${i + 1}: ✅ ${txResult.txHash}`)

        // Winner cooldown
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
        })

        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { lastWinCycle: cycle, updatedAt: new Date() }
        )
      } else {
        console.log(`[Payout] #${i + 1}: ❌ ${txResult.error}`)
      }
    }

    // Update state in DB - success resets everything
    await updateTimerStateInDb({ 
      currentCycle: cycle, 
      lastPayoutTime: now, 
      failedAttempts: 0, 
      isPayoutInProgress: false 
    })

    const totalPaidUsd = totalPaidSol * solPrice
    console.log(`[Payout] ✅ Cycle ${cycle} complete | ${totalPaidSol.toFixed(6)} SOL ($${totalPaidUsd.toFixed(2)})`)

    return {
      success: true,
      cycle,
      data: {
        cycle,
        network: process.env.SOLANA_NETWORK || 'mainnet',
        sol_price: solPrice,
        pool_sol: poolSol.toFixed(6),
        pool_usd: poolUsd.toFixed(2),
        total_paid_sol: totalPaidSol.toFixed(6),
        total_paid_usd: totalPaidUsd.toFixed(2),
        winners_count: eligibleWinners.length,
        payouts: results,
      },
    }
  } catch (error: any) {
    console.error('[Payout] Error:', error)
    // Make sure to release the lock on error
    await updateTimerStateInDb({ isPayoutInProgress: false }).catch(() => {})
    return { success: false, error: error.message || 'Payout failed' }
  }
}

/**
 * Can we execute a payout now?
 * Note: This uses cached state - call syncTimerStateFromDb() first for accuracy
 */
export function canExecutePayout(): boolean {
  if (cachedTimerState.isPayoutInProgress) return false
  
  const now = Date.now()
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = now - cachedTimerState.lastPayoutTime
  
  // Must wait for full interval to pass
  if (elapsed < intervalMs - 5000) { // 5 second buffer
    return false
  }
  
  // Check if we've maxed out attempts this interval
  if (cachedTimerState.failedAttempts >= MAX_ATTEMPTS_PER_INTERVAL) return false
  
  return true
}

/**
 * Get current cycle number
 * Note: This uses cached state - call syncTimerStateFromDb() first for accuracy
 */
export function getCurrentPayoutCycle(): number {
  return cachedTimerState.currentCycle
}

/**
 * Get seconds until next payout allowed
 * Note: This uses cached state - call syncTimerStateFromDb() first for accuracy
 */
export function getSecondsUntilNextPayout(): number {
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = Date.now() - cachedTimerState.lastPayoutTime
  return Math.max(0, Math.floor((intervalMs - elapsed) / 1000))
}

/**
 * Sync timer state from database
 * Call this before using getSecondsUntilNextPayout or getCurrentPayoutCycle
 * for accurate cross-instance consistency
 */
export async function ensureTimerStateSync(): Promise<void> {
  await syncTimerStateFromDb()
}
