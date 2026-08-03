/**
 * Payout Executor - Simple, direct payout logic
 * 
 * SIMPLIFIED: No locks, no retry attempts, no complex state
 * Either the payout works or it doesn't - move to next cycle either way
 */

import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification, TimerState } from '@/lib/db/models'
import { transferEth, getPayoutWalletBalance } from '@/lib/evm/transfer'
import { getEthPrice } from '@/lib/evm/price'
import { getTxExplorerUrl } from '@/lib/evm/explorer'
import { config } from '@/lib/config'
import { saveRankingsToDb, loadRankingsFromDb, getRankedLosers, markWinnersCooldown } from '@/lib/tracker/holderService'

// Minimum ETH for transfer
const MIN_TRANSFER_ETH = 0.001

// Helper to generate Blockscout link
function getExplorerLink(txHash: string | null): string | null {
  return getTxExplorerUrl(txHash)
}

export interface PayoutResult {
  success: boolean
  cycle?: number
  error?: string
  data?: any
}

// Timer state from database
let timerCache: {
  lastPayoutTime: number
  currentCycle: number
  lastSync: number
} = {
  lastPayoutTime: 0,
  currentCycle: 0,
  lastSync: 0,
}

/**
 * Load timer state from database
 */
async function loadTimerState(): Promise<void> {
  try {
    await connectDB()
    
    let state = await TimerState.findOne({ key: 'payout_timer' }).lean()
    
    if (!state) {
      // Create initial state
      const now = Date.now()
      await TimerState.create({
        key: 'payout_timer',
        lastPayoutTime: new Date(now),
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
      })
      timerCache = { lastPayoutTime: now, currentCycle: 0, lastSync: now }
      console.log(`[Payout] Timer initialized: ${config.payoutIntervalMinutes} min until first payout`)
    } else {
      timerCache = {
        lastPayoutTime: new Date(state.lastPayoutTime).getTime(),
        currentCycle: state.currentCycle || 0,
        lastSync: Date.now(),
      }
    }
  } catch (error) {
    console.error('[Payout] Failed to load timer state:', error)
  }
}

/**
 * Save timer state to database
 */
async function saveTimerState(lastPayoutTime: number, currentCycle: number): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      { 
        $set: { 
          lastPayoutTime: new Date(lastPayoutTime),
          currentCycle: currentCycle,
          failedAttempts: 0,
          isPayoutInProgress: false,
        } 
      },
      { upsert: true }
    )
    timerCache = { lastPayoutTime, currentCycle, lastSync: Date.now() }
  } catch (error) {
    console.error('[Payout] Failed to save timer state:', error)
  }
}

/**
 * Get seconds until next payout
 */
export function getSecondsUntilNextPayout(): number {
  if (timerCache.lastPayoutTime === 0) {
    return config.payoutIntervalMinutes * 60
  }
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = Date.now() - timerCache.lastPayoutTime
  return Math.max(0, Math.floor((intervalMs - elapsed) / 1000))
}

/**
 * Get current cycle number
 */
export function getCurrentPayoutCycle(): number {
  return timerCache.currentCycle
}

/**
 * Sync timer state from database
 */
export async function ensureTimerStateSync(): Promise<void> {
  // Only sync every 5 seconds
  if (Date.now() - timerCache.lastSync < 5000 && timerCache.lastSync > 0) {
    return
  }
  await loadTimerState()
}

/**
 * Reset timer for next interval
 */
export async function resetTimerForNextInterval(): Promise<void> {
  const now = Date.now()
  await saveTimerState(now, timerCache.currentCycle)
  console.log(`[Payout] Timer reset for next interval (${config.payoutIntervalMinutes} min)`)
}

/**
 * Check if timer has elapsed (simple check, no locks)
 */
export function isPayoutDue(): boolean {
  const secondsUntil = getSecondsUntilNextPayout()
  return secondsUntil <= 0
}

/**
 * Acquire atomic lock for payout execution
 * Prevents multiple concurrent payout attempts
 */
async function acquirePayoutLock(cycle: number): Promise<boolean> {
  try {
    // Atomically set isPayoutInProgress=true ONLY if it's currently false
    // This prevents race conditions where multiple requests try to start payout
    const result = await TimerState.findOneAndUpdate(
      { 
        key: 'payout_timer',
        $or: [
          { isPayoutInProgress: false },
          { isPayoutInProgress: { $exists: false } },
          // Also allow if lock is stale (>2 minutes old) - recover from crashes
          { lockAcquiredAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) } }
        ]
      },
      { 
        $set: { 
          isPayoutInProgress: true,
          lockAcquiredAt: new Date(),
          lockCycle: cycle 
        } 
      },
      { new: true }
    )
    
    return result !== null
  } catch (error) {
    console.error('[Payout] Failed to acquire lock:', error)
    return false
  }
}

/**
 * Release payout lock
 */
async function releasePayoutLock(): Promise<void> {
  try {
    await TimerState.findOneAndUpdate(
      { key: 'payout_timer' },
      { $set: { isPayoutInProgress: false, lockAcquiredAt: null } }
    )
  } catch (error) {
    console.error('[Payout] Failed to release lock:', error)
  }
}

/**
 * Execute a payout - WITH ATOMIC LOCKING
 * Prevents duplicate payouts from concurrent requests
 */
export async function executePayout(): Promise<PayoutResult> {
  const now = Date.now()
  const nextCycle = timerCache.currentCycle + 1
  
  try {
    await connectDB()
    
    // CRITICAL: Acquire atomic lock to prevent duplicate payouts
    const lockAcquired = await acquirePayoutLock(nextCycle)
    if (!lockAcquired) {
      console.log(`[Payout] ⏳ Payout already in progress - skipping duplicate request`)
      return { success: false, error: 'Payout already in progress' }
    }
    
    console.log(``)
    console.log(`[Payout] ╔════════════════════════════════════════════════════════╗`)
    console.log(`[Payout] ║           STARTING PAYOUT CYCLE ${nextCycle}                      ║`)
    console.log(`[Payout] ╚════════════════════════════════════════════════════════╝`)

    // Get SOL price
    const ethPrice = await getEthPrice() || 3500
    console.log(`[Payout] ETH price: $${ethPrice}`)

    // Get wallet balance
    const walletBalance = await getPayoutWalletBalance()
    const walletEth = walletBalance?.eth || walletBalance?.sol || 0
    console.log(`[Payout] Wallet balance: ${walletEth.toFixed(6)} ETH`)
    
    if (walletEth <= 0) {
      console.log(`[Payout] No balance - skipping`)
      await saveTimerState(now, nextCycle)
      return { success: false, error: 'No wallet balance' }
    }

    // Calculate pool (99% of wallet)
    const poolEth = walletEth * config.poolPercentage
    const poolUsd = poolEth * ethPrice
    console.log(`[Payout] Pool: ${poolEth.toFixed(6)} ETH ($${poolUsd.toFixed(2)})`)

    // Check minimum pool
    if (poolEth < config.minPoolEth) {
      console.log(`[Payout] Pool below minimum ${config.minPoolEth} ETH - skipping`)
      await saveTimerState(now, nextCycle)
      return { success: false, error: `Pool below minimum` }
    }

    // STEP 1: Save current rankings to DB (ensures DB is fresh)
    console.log(`[Payout] Saving rankings to database...`)
    await saveRankingsToDb()
    
    // STEP 2: Get eligible winners - try in-memory first, fall back to DB
    let eligibleWinners: any[] = []
    
    // Try in-memory (fastest, already loaded since service is ready)
    const inMemoryRankings = getRankedLosers()
    if (inMemoryRankings.length > 0) {
      eligibleWinners = inMemoryRankings.filter(h => h.isEligible).slice(0, 3)
      console.log(`[Payout] Using in-memory: ${inMemoryRankings.length} total, ${eligibleWinners.length} eligible`)
    } else {
      // Fall back to DB
      const dbRankings = await loadRankingsFromDb()
      if (dbRankings && dbRankings.rankings.length > 0) {
        eligibleWinners = dbRankings.rankings.filter((h: any) => h.isEligible).slice(0, 3)
        console.log(`[Payout] Using database: ${dbRankings.rankings.length} total, ${eligibleWinners.length} eligible`)
      }
    }
    
    if (eligibleWinners.length === 0) {
      console.log(`[Payout] No eligible winners - skipping (advancing to next cycle)`)
      await saveTimerState(now, nextCycle)
      return { success: true, cycle: nextCycle, data: { skipped: true, reason: 'No eligible winners' } }
    }

    // Log winners
    console.log(`[Payout] Winners to pay:`)
    eligibleWinners.forEach((w: any, i: number) => {
      console.log(`[Payout]   #${i + 1}: ${w.wallet.slice(0, 8)}... (${w.drawdownPct.toFixed(1)}% loss, $${w.lossUsd.toFixed(2)})`)
    })

    // Calculate amounts
    const devFeeEth = poolEth * config.devFeePct
    const winnersPoolEth = poolEth - devFeeEth
    const payoutAmounts = [
      winnersPoolEth * config.payoutSplit.first,
      winnersPoolEth * config.payoutSplit.second,
      winnersPoolEth * config.payoutSplit.third,
    ]

    const results: any[] = []
    let totalPaidEth = 0

    // STEP 3: Create PENDING payout records BEFORE sending money
    console.log(`[Payout] Creating pending payout records in database...`)
    
    const pendingPayouts: { id: any; rank: number; wallet: string; amountEth: number }[] = []
    
    // Dev fee record
    if (config.devWalletAddress && config.executePayouts && devFeeEth >= MIN_TRANSFER_ETH) {
      const devPayout = await Payout.create({
        cycle: nextCycle,
        rank: 0,
        wallet: config.devWalletAddress,
        amount: devFeeEth * ethPrice,
        amountTokens: devFeeEth,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: devPayout._id, rank: 0, wallet: config.devWalletAddress, amountEth: devFeeEth })
    }
    
    // Winner records
    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountEth = payoutAmounts[i]
      
      if (amountEth < MIN_TRANSFER_ETH) continue
      
      const winnerPayout = await Payout.create({
        cycle: nextCycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountEth * ethPrice,
        amountTokens: amountEth,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: winnerPayout._id, rank: i + 1, wallet: winner.wallet, amountEth })
    }
    
    console.log(`[Payout] Created ${pendingPayouts.length} pending payout records`)
    
    // STEP 4: Execute transfers and update records
    for (const pending of pendingPayouts) {
      const isDevFee = pending.rank === 0
      const label = isDevFee ? 'Dev fee' : `#${pending.rank}`
      
      // Check current balance before each transfer to avoid 0x1 errors
      const currentBalance = await getPayoutWalletBalance()
      const availableEth = currentBalance?.eth || currentBalance?.sol || 0
      const requiredEth = pending.amountEth + 0.001
      
      if (availableEth < requiredEth) {
        console.log(`[Payout] ${label}: ⚠️ Insufficient balance (have ${availableEth.toFixed(6)}, need ${requiredEth.toFixed(6)}) - skipping`)
        await Payout.findByIdAndUpdate(pending.id, {
          status: 'skipped',
          errorMessage: `Insufficient balance: ${availableEth.toFixed(6)} ETH < ${requiredEth.toFixed(6)} ETH needed`,
        })
        continue
      }
      
      console.log(`[Payout] ${label}: Sending ${pending.amountEth.toFixed(6)} ETH to ${pending.wallet.slice(0, 10)}...`)
      
      const txResult = config.executePayouts
        ? await transferEth(pending.wallet, pending.amountEth)
        : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }
      
      console.log(`[Payout] ${label} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`)
      
      // Update the payout record with result
      await Payout.findByIdAndUpdate(pending.id, {
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })
      
      if (txResult.success) {
        totalPaidEth += pending.amountEth
        
        // Winner cooldown (only for winners, not dev fee)
        if (!isDevFee) {
          await Disqualification.create({
            wallet: pending.wallet,
            reason: 'winner_cooldown',
            expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
          }).catch(() => {})

          await Holder.findOneAndUpdate(
            { wallet: pending.wallet },
            { lastWinCycle: nextCycle, updatedAt: new Date() },
            { upsert: true }
          ).catch(() => {})
        }
      }
      
      results.push({
        rank: pending.rank,
        type: isDevFee ? 'dev_fee' : 'winner',
        wallet: pending.wallet,
        amount_eth: pending.amountEth.toFixed(6),
        status: txResult.success ? 'success' : 'failed',
        tx_hash: txResult.txHash,
        error: txResult.error,
      })
    }

    // Save timer state (always move to next cycle)
    await saveTimerState(now, nextCycle)
    
    // CRITICAL: Update in-memory holder state with winner cooldowns
    // This ensures rankings saved to DB reflect the cooldown
    const successfulWinnerWallets = results
      .filter(r => r.type === 'winner' && r.status === 'success')
      .map(r => r.wallet)
    
    if (successfulWinnerWallets.length > 0) {
      markWinnersCooldown(successfulWinnerWallets, nextCycle)
      console.log(`[Payout] Updated ${successfulWinnerWallets.length} winners with cooldown in memory`)
    }
    
    // Save updated rankings (now includes cooldown status)
    await saveRankingsToDb()

    console.log(``)
    console.log(`[Payout] ╔════════════════════════════════════════════════════════╗`)
    console.log(`[Payout] ║  ✅ CYCLE ${nextCycle} COMPLETE - ${totalPaidEth.toFixed(6)} ETH PAID              ║`)
    console.log(`[Payout] ╚════════════════════════════════════════════════════════╝`)

    // Release the lock
    await releasePayoutLock()

    return {
      success: true,
      cycle: nextCycle,
      data: {
        cycle: nextCycle,
        total_paid_eth: totalPaidEth.toFixed(6),
        total_paid_usd: (totalPaidEth * ethPrice).toFixed(2),
        payouts: results,
      },
    }
  } catch (error: any) {
    console.error(`[Payout] ERROR:`, error)
    // Release lock and advance the cycle on error
    await releasePayoutLock()
    await saveTimerState(now, nextCycle)
    return { success: false, error: error.message }
  }
}

// Legacy exports for compatibility
export function canExecutePayout(): boolean {
  return isPayoutDue()
}
