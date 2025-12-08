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
 */

import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification } from '@/lib/db/models'
import { transferSol, getPayoutWalletBalance } from '@/lib/solana/transfer'
import { getSolPrice } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { getRankedLosers, getServiceStatus } from '@/lib/tracker/holderService'

// Prevent duplicate execution
let lastPayoutTime = Date.now() // Start with current time to prevent insta-fire
let isPayoutInProgress = false
let currentCycle = 0
let failedAttempts = 0
let dbInitialized = false
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
 * Initialize cycle from database (call once on startup)
 */
async function initFromDatabase(): Promise<void> {
  if (dbInitialized) return
  
  try {
    await connectDB()
    
    // Get the last payout from database
    const lastPayout = await Payout.findOne().sort({ createdAt: -1 }).lean()
    
    if (lastPayout) {
      currentCycle = lastPayout.cycle
      lastPayoutTime = new Date(lastPayout.createdAt).getTime()
      console.log(`[Payout] Loaded from DB: cycle ${currentCycle}, last payout ${new Date(lastPayoutTime).toISOString()}`)
    }
    
    dbInitialized = true
  } catch (error) {
    console.error('[Payout] Failed to init from DB:', error)
  }
}

/**
 * Execute a payout - calculates winners in real-time and sends SOL
 */
export async function executePayout(): Promise<PayoutResult> {
  // MUTEX LOCK
  if (isPayoutInProgress) {
    return { success: false, error: 'Payout already in progress' }
  }
  
  isPayoutInProgress = true
  
  try {
    await connectDB()
    
    // Initialize from database on first run
    await initFromDatabase()
    
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
      isPayoutInProgress = false
      return { success: false, error: 'Already paid this interval' }
    }
    
    // If a full interval has passed, reset attempt counter
    if (now - lastPayoutTime >= intervalMs) {
      failedAttempts = 0
    }
    
    // RETRY LIMIT - max 3 attempts per interval
    if (failedAttempts >= MAX_ATTEMPTS_PER_INTERVAL) {
      isPayoutInProgress = false
      return { success: false, error: `Max ${MAX_ATTEMPTS_PER_INTERVAL} attempts reached. Waiting for next interval.` }
    }
    
    failedAttempts++
    
    // Check if service has holder data
    const status = getServiceStatus()
    if (!status.initialized || status.holderCount === 0) {
      isPayoutInProgress = false
      return { success: false, error: 'Holder service not ready. Waiting for data...' }
    }
    
    console.log(`[Payout] Starting payout cycle ${currentCycle + 1} (attempt ${failedAttempts}/${MAX_ATTEMPTS_PER_INTERVAL})`)
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
      currentCycle++
      lastPayoutTime = now
      isPayoutInProgress = false
      return { 
        success: true, 
        cycle: currentCycle,
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
    const cycle = currentCycle + 1

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

    // Update state - success resets everything
    currentCycle = cycle
    lastPayoutTime = now
    failedAttempts = 0 // Reset on success
    isPayoutInProgress = false

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
    isPayoutInProgress = false
    return { success: false, error: error.message || 'Payout failed' }
  }
}

/**
 * Can we execute a payout now?
 */
export function canExecutePayout(): boolean {
  if (isPayoutInProgress) return false
  
  const now = Date.now()
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = now - lastPayoutTime
  
  // Must wait for full interval to pass
  if (elapsed < intervalMs - 5000) { // 5 second buffer
    return false
  }
  
  // Check if we've maxed out attempts this interval
  if (failedAttempts >= MAX_ATTEMPTS_PER_INTERVAL) return false
  
  return true
}

/**
 * Get current cycle number
 */
export function getCurrentPayoutCycle(): number {
  return currentCycle
}

/**
 * Get seconds until next payout allowed
 */
export function getSecondsUntilNextPayout(): number {
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  const elapsed = Date.now() - lastPayoutTime
  return Math.max(0, Math.floor((intervalMs - elapsed) / 1000))
}
