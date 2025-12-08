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
import { getServiceStatus, saveRankingsToDb, loadRankingsFromDb } from '@/lib/tracker/holderService'

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
    
    // Check if holder service has data
    const status = getServiceStatus()
    console.log(`[Payout] Service status: initialized=${status.initialized}, holders=${status.holderCount}`)
    
    if (!status.initialized || status.holderCount === 0) {
      // DON'T advance cycle - wait for service to be ready
      console.log(`[Payout] Service not ready - will retry when ready (NOT advancing cycle)`)
      return { success: false, error: 'Service not ready' }
    }

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

    // Get eligible winners FROM DATABASE (not in-memory!)
    const dbRankings = await loadRankingsFromDb()
    if (!dbRankings || dbRankings.rankings.length === 0) {
      console.log(`[Payout] No rankings in database - skipping (will retry)`)
      return { success: false, error: 'No rankings in database' }
    }
    
    const eligibleWinners = dbRankings.rankings.filter((h: any) => h.isEligible).slice(0, 3)
    console.log(`[Payout] Total in DB: ${dbRankings.rankings.length}, Eligible winners: ${eligibleWinners.length}`)

    if (eligibleWinners.length === 0) {
      console.log(`[Payout] No eligible winners - skipping`)
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

    // Pay dev fee (if above minimum)
    if (config.devWalletAddress && config.executePayouts && devFeeSol >= MIN_TRANSFER_SOL) {
      console.log(`[Payout] Sending dev fee: ${devFeeSol.toFixed(6)} SOL to ${config.devWalletAddress.slice(0, 8)}...`)
      
      const devResult = await transferSol(config.devWalletAddress, devFeeSol)
      console.log(`[Payout] Dev fee result: ${devResult.success ? '✅' : '❌'} ${devResult.txHash || devResult.error}`)
      
      await Payout.create({
        cycle: nextCycle,
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

      if (devResult.success) totalPaidSol += devFeeSol
      
      results.push({
        rank: 0,
        type: 'dev_fee',
        wallet: config.devWalletAddress,
        amount_sol: devFeeSol.toFixed(6),
        status: devResult.success ? 'success' : 'failed',
        tx_hash: devResult.txHash,
        error: devResult.error,
      })
    }

    // Pay winners
    for (let i = 0; i < eligibleWinners.length; i++) {
      const winner = eligibleWinners[i]
      const amountSol = payoutAmounts[i]

      if (amountSol < MIN_TRANSFER_SOL) {
        console.log(`[Payout] #${i + 1}: Skipped - ${amountSol.toFixed(6)} SOL below minimum`)
        continue
      }

      console.log(`[Payout] #${i + 1}: Sending ${amountSol.toFixed(6)} SOL to ${winner.wallet.slice(0, 8)}...`)
      
      const txResult = config.executePayouts 
        ? await transferSol(winner.wallet, amountSol)
        : { success: false, txHash: null, error: 'EXECUTE_PAYOUTS disabled' }
      
      console.log(`[Payout] #${i + 1} result: ${txResult.success ? '✅' : '❌'} ${txResult.txHash || txResult.error}`)

      await Payout.create({
        cycle: nextCycle,
        rank: i + 1,
        wallet: winner.wallet,
        amount: amountSol * solPrice,
        amountTokens: amountSol,
        drawdownPct: winner.drawdownPct,
        lossUsd: winner.lossUsd,
        txHash: txResult.txHash,
        status: txResult.success ? 'success' : 'failed',
        errorMessage: txResult.error,
      })

      if (txResult.success) {
        totalPaidSol += amountSol
        
        // Winner cooldown
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + config.payoutIntervalMinutes * 60 * 1000 * 2),
        }).catch(() => {})

        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { lastWinCycle: nextCycle, updatedAt: new Date() }
        ).catch(() => {})
      }

      results.push({
        rank: i + 1,
        wallet: winner.wallet,
        amount_sol: amountSol.toFixed(6),
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
