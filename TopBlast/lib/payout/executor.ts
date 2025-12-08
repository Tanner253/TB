/**
 * Payout Executor - Simple, direct payout logic
 * 
 * SIMPLIFIED: No locks, no retry attempts, no complex state
 * Either the payout works or it doesn't - move to next cycle either way
 */

import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification, TimerState } from '@/lib/db/models'
import { transferSol, getPayoutWalletBalance } from '@/lib/solana/transfer'
import { getSolPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { saveRankingsToDb, loadRankingsFromDb, getRankedLosers } from '@/lib/tracker/holderService'

// Minimum SOL for transfer (rent exemption requirement)
const MIN_TRANSFER_SOL = 0.001

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
 * Execute a payout - SIMPLE VERSION
 * No locks, no retry tracking - just try once and move on
 */
export async function executePayout(): Promise<PayoutResult> {
  const now = Date.now()
  const nextCycle = timerCache.currentCycle + 1
  
  console.log(``)
  console.log(`[Payout] ╔════════════════════════════════════════════════════════╗`)
  console.log(`[Payout] ║           STARTING PAYOUT CYCLE ${nextCycle}                      ║`)
  console.log(`[Payout] ╚════════════════════════════════════════════════════════╝`)
  
  try {
    await connectDB()

    // Get SOL price
    const solPrice = await getSolPrice() || 220
    console.log(`[Payout] SOL price: $${solPrice}`)

    // Get wallet balance
    const walletBalance = await getPayoutWalletBalance()
    const walletSol = walletBalance?.sol || 0
    console.log(`[Payout] Wallet balance: ${walletSol.toFixed(6)} SOL`)
    
    if (walletSol <= 0) {
      console.log(`[Payout] No balance - skipping`)
      await saveTimerState(now, nextCycle)
      return { success: false, error: 'No wallet balance' }
    }

    // Calculate pool (99% of wallet)
    const poolSol = walletSol * config.poolPercentage
    const poolUsd = poolSol * solPrice
    console.log(`[Payout] Pool: ${poolSol.toFixed(6)} SOL ($${poolUsd.toFixed(2)})`)

    // Check minimum pool
    if (poolSol < config.minPoolSol) {
      console.log(`[Payout] Pool below minimum ${config.minPoolSol} SOL - skipping`)
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
    const devFeeSol = poolSol * config.devFeePct
    const winnersPoolSol = poolSol - devFeeSol
    const payoutAmounts = [
      winnersPoolSol * config.payoutSplit.first,
      winnersPoolSol * config.payoutSplit.second,
      winnersPoolSol * config.payoutSplit.third,
    ]

    const results: any[] = []
    let totalPaidSol = 0

    // STEP 3: Create PENDING payout records BEFORE sending money
    // This ensures we have a record even if DB fails after transfer
    console.log(`[Payout] Creating pending payout records in database...`)
    
    const pendingPayouts: { id: any; rank: number; wallet: string; amountSol: number }[] = []
    
    // Dev fee record
    if (config.devWalletAddress && config.executePayouts && devFeeSol >= MIN_TRANSFER_SOL) {
      const devPayout = await Payout.create({
        cycle: nextCycle,
        rank: 0,
        wallet: config.devWalletAddress,
        amount: devFeeSol * solPrice,
        amountTokens: devFeeSol,
        drawdownPct: 0,
        lossUsd: 0,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: devPayout._id, rank: 0, wallet: config.devWalletAddress, amountSol: devFeeSol })
    }
    
    // Winner records
    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountSol = payoutAmounts[i]
      
      if (amountSol < MIN_TRANSFER_SOL) continue
      
      const winnerPayout = await Payout.create({
        cycle: nextCycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountSol * solPrice,
        amountTokens: amountSol,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: null,
        status: 'pending',
        errorMessage: null,
      })
      pendingPayouts.push({ id: winnerPayout._id, rank: i + 1, wallet: winner.wallet, amountSol })
    }
    
    console.log(`[Payout] Created ${pendingPayouts.length} pending payout records`)
    
    // STEP 4: Execute transfers and update records
    for (const pending of pendingPayouts) {
      const isDevFee = pending.rank === 0
      const label = isDevFee ? 'Dev fee' : `#${pending.rank}`
      
      console.log(`[Payout] ${label}: Sending ${pending.amountSol.toFixed(6)} SOL to ${pending.wallet.slice(0, 8)}...`)
      
      const txResult = config.executePayouts
        ? await transferSol(pending.wallet, pending.amountSol)
        : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }
      
      console.log(`[Payout] ${label} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`)
      
      // Update the payout record with result
      await Payout.findByIdAndUpdate(pending.id, {
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })
      
      if (txResult.success) {
        totalPaidSol += pending.amountSol
        
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
        amount_sol: pending.amountSol.toFixed(6),
        status: txResult.success ? 'success' : 'failed',
        tx_hash: txResult.txHash,
        error: txResult.error,
      })
    }

    // Save timer state (always move to next cycle)
    await saveTimerState(now, nextCycle)
    
    // Save updated rankings
    await saveRankingsToDb()

    console.log(``)
    console.log(`[Payout] ╔════════════════════════════════════════════════════════╗`)
    console.log(`[Payout] ║  ✅ CYCLE ${nextCycle} COMPLETE - ${totalPaidSol.toFixed(6)} SOL PAID              ║`)
    console.log(`[Payout] ╚════════════════════════════════════════════════════════╝`)

    return {
      success: true,
      cycle: nextCycle,
      data: {
        cycle: nextCycle,
        total_paid_sol: totalPaidSol.toFixed(6),
        total_paid_usd: (totalPaidSol * solPrice).toFixed(2),
        payouts: results,
      },
    }
  } catch (error: any) {
    console.error(`[Payout] ERROR:`, error)
    // Still advance the cycle on error
    await saveTimerState(now, nextCycle)
    return { success: false, error: error.message }
  }
}

// Legacy exports for compatibility
export function canExecutePayout(): boolean {
  return isPayoutDue()
}
