/**
 * Payout Service - Manages payout cycles and history
 * Saves to MongoDB for persistence across serverless invocations
 */

import { config } from '@/lib/config'
import { getEligibleWinners, getCurrentPrice, getServiceStatus, markWinnersCooldown, resetWinnerVwap } from './holderService'
import { formatWallet } from '@/lib/solana/holders'
import connectDB from '@/lib/db'
import { Payout, Holder, Disqualification } from '@/lib/db/models'

// Types
export interface PayoutWinner {
  rank: number
  wallet: string
  wallet_display: string
  drawdown_pct: number
  loss_usd: number
  payout_usd: number
  payout_sol?: number
  payout_pct: number
  tx_hash?: string | null
  status?: string
}

export interface PayoutRecord {
  id: string
  cycle: number
  timestamp: number
  pool_balance_usd: number
  token_price: number
  winners: PayoutWinner[]
  total_distributed_usd: number
  status: 'completed' | 'no_winners' | 'pool_empty'
  message: string
}

// Global state for timing (reset each cold start, but that's OK)
declare global {
  var _payoutTimingState: {
    currentCycle: number
    lastPayoutTime: number | null
    nextPayoutTime: number
  } | undefined
}

// Initialize timing state
const timingState = global._payoutTimingState || (global._payoutTimingState = {
  currentCycle: 1,
  lastPayoutTime: null,
  nextPayoutTime: getNextPayoutTimestamp(),
})

/**
 * Calculate next payout timestamp based on interval
 */
function getNextPayoutTimestamp(): number {
  const intervalMs = config.payoutIntervalMinutes * 60 * 1000
  return Math.ceil(Date.now() / intervalMs) * intervalMs
}

/**
 * Check if it's time for a payout
 */
export function isPayoutDue(): boolean {
  return Date.now() >= timingState.nextPayoutTime
}

/**
 * Get seconds until next payout
 */
export function getSecondsUntilPayout(): number {
  return Math.max(0, Math.floor((timingState.nextPayoutTime - Date.now()) / 1000))
}

/**
 * Get next payout time as Date
 */
export function getNextPayoutTime(): Date {
  return new Date(timingState.nextPayoutTime)
}

/**
 * Reset the payout timer (call after successful payout)
 */
export function resetPayoutTimer(): void {
  timingState.lastPayoutTime = Date.now()
  timingState.nextPayoutTime = getNextPayoutTimestamp()
  timingState.currentCycle += 1
  console.log(`[PayoutService] Timer reset. Next payout at ${new Date(timingState.nextPayoutTime).toISOString()}`)
}

/**
 * Execute a payout cycle and save to database
 */
export async function executePayout(): Promise<PayoutRecord> {
  const now = Date.now()
  const tokenPrice = getCurrentPrice()
  const poolBalance = config.poolBalanceUsd
  const minLossRequired = poolBalance * (config.minLossThresholdPct / 100)
  
  // Get current cycle from database
  let currentCycle = timingState.currentCycle
  try {
    await connectDB()
    const lastPayout = await Payout.findOne().sort({ cycle: -1 }).lean()
    if (lastPayout) {
      currentCycle = lastPayout.cycle + 1
    }
  } catch (error) {
    console.error('[PayoutService] DB error getting cycle:', error)
  }
  
  // Get eligible winners
  const eligibleWinners = getEligibleWinners()
  const qualifiedWinners = eligibleWinners.filter(w => w.lossUsd >= minLossRequired)
  
  let record: PayoutRecord
  
  if (qualifiedWinners.length === 0) {
    record = {
      id: `payout_${currentCycle}_${now}`,
      cycle: currentCycle,
      timestamp: now,
      pool_balance_usd: poolBalance,
      token_price: tokenPrice || 0,
      winners: [],
      total_distributed_usd: 0,
      status: 'no_winners',
      message: `No eligible winners. Min loss: $${minLossRequired.toFixed(2)}`,
    }
  } else {
    const winners: PayoutWinner[] = []
    const payoutSplits = [config.payoutSplit.first, config.payoutSplit.second, config.payoutSplit.third]
    let totalDistributed = 0
    
    for (let i = 0; i < Math.min(3, qualifiedWinners.length); i++) {
      const winner = qualifiedWinners[i]
      const payoutPct = payoutSplits[i]
      const payoutUsd = poolBalance * payoutPct
      totalDistributed += payoutUsd
      
      winners.push({
        rank: i + 1,
        wallet: winner.wallet,
        wallet_display: formatWallet(winner.wallet),
        drawdown_pct: Math.round(winner.drawdownPct * 100) / 100,
        loss_usd: Math.round(winner.lossUsd * 100) / 100,
        payout_usd: Math.round(payoutUsd * 100) / 100,
        payout_pct: payoutPct * 100,
      })
      
      // Save to database
      try {
        await Payout.create({
          cycle: currentCycle,
          rank: i + 1,
          wallet: winner.wallet,
          amount: payoutUsd,
          amountTokens: tokenPrice ? payoutUsd / tokenPrice : 0,
          drawdownPct: winner.drawdownPct,
          lossUsd: winner.lossUsd,
          txHash: null, // Mock - no actual transfer yet
          status: 'mock',
        })

        // Update Holder's lastWinCycle for cooldown
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { 
            lastWinCycle: currentCycle,
            updatedAt: new Date()
          }
        )

        // ALWAYS reset VWAP - for demo and production
        // Game theory: Winner gets paid → their loss resets to 0% → they can only win
        // again if price drops BELOW their new cost basis (current price at win time)
        await Holder.findOneAndUpdate(
          { wallet: winner.wallet },
          { vwap: tokenPrice }
        )

        // Add short disqualification/cooldown
        await Disqualification.create({
          wallet: winner.wallet,
          reason: 'winner_cooldown',
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        })

      } catch (error) {
        console.error('[PayoutService] DB error saving winner:', error)
      }
    }
    
    record = {
      id: `payout_${currentCycle}_${now}`,
      cycle: currentCycle,
      timestamp: now,
      pool_balance_usd: poolBalance,
      token_price: tokenPrice || 0,
      winners,
      total_distributed_usd: Math.round(totalDistributed * 100) / 100,
      status: 'completed',
      message: `Payout completed! ${winners.length} winner(s).`,
    }
    
    // Mark winners with cooldown AND reset their VWAP in the in-memory holder service
    // This ensures: 1) They can't win next round (cooldown)
    //               2) Their loss resets to 0% (VWAP = current price)
    //               3) They can only win again if price drops below current price
    const winnerWallets = winners.map(w => w.wallet)
    markWinnersCooldown(winnerWallets, currentCycle)
    
    // Reset each winner's VWAP in memory
    for (const wallet of winnerWallets) {
      resetWinnerVwap(wallet)
    }
  }
  
  // Update timing state
  timingState.currentCycle = currentCycle + 1
  timingState.lastPayoutTime = now
  timingState.nextPayoutTime = getNextPayoutTimestamp()
  
  console.log(`[PayoutService] Cycle ${record.cycle}: ${record.status}`)
  if (record.winners.length > 0) {
    record.winners.forEach(w => {
      console.log(`  #${w.rank} ${w.wallet_display}: ${w.drawdown_pct}% → $${w.payout_usd}`)
    })
  }
  
  return record
}

/**
 * Check and execute payout if due
 */
export async function checkAndExecutePayout(): Promise<PayoutRecord | null> {
  if (!isPayoutDue()) {
    return null
  }
  
  const status = getServiceStatus()
  if (!status.initialized) {
    timingState.nextPayoutTime = getNextPayoutTimestamp()
    return null
  }
  
  return executePayout()
}

/**
 * Get payout history from database
 */
export async function getPayoutHistory(limit: number = 20): Promise<PayoutRecord[]> {
  try {
    await connectDB()
    
    // Get payouts grouped by cycle
    const payouts = await Payout.find()
      .sort({ cycle: -1, rank: 1 })
      .limit(limit * 3) // Get more to account for multiple winners per cycle
      .lean()
    
    // Group by cycle
    const cycleMap = new Map<number, PayoutRecord>()
    
    for (const p of payouts) {
      if (!cycleMap.has(p.cycle)) {
        cycleMap.set(p.cycle, {
          id: `payout_${p.cycle}`,
          cycle: p.cycle,
          timestamp: new Date(p.createdAt).getTime(),
          pool_balance_usd: config.poolBalanceUsd,
          token_price: 0,
          winners: [],
          total_distributed_usd: 0,
          status: 'completed',
          message: '',
        })
      }
      
      const record = cycleMap.get(p.cycle)!
      record.winners.push({
        rank: p.rank,
        wallet: p.wallet,
        wallet_display: formatWallet(p.wallet),
        drawdown_pct: p.drawdownPct,
        loss_usd: p.lossUsd,
        payout_usd: p.amount,
        payout_sol: p.amountTokens || 0, // amountTokens now stores SOL
        payout_pct: p.rank === 0 ? 5 : p.rank === 1 ? 76 : p.rank === 2 ? 14.25 : 4.75,
        tx_hash: p.txHash,
        status: p.status,
      })
      record.total_distributed_usd += p.amount
    }
    
    // Convert to array and sort
    const records = Array.from(cycleMap.values())
      .sort((a, b) => b.cycle - a.cycle)
      .slice(0, limit)
    
    // Update messages
    for (const r of records) {
      r.message = `${r.winners.length} winner(s) received rewards`
      r.total_distributed_usd = Math.round(r.total_distributed_usd * 100) / 100
    }
    
    return records
  } catch (error) {
    console.error('[PayoutService] Error fetching history:', error)
    return []
  }
}

/**
 * Get current cycle number
 */
export function getCurrentCycle(): number {
  return timingState.currentCycle
}

/**
 * Get last payout record from database
 */
export async function getLastPayout(): Promise<PayoutRecord | null> {
  const history = await getPayoutHistory(1)
  return history[0] || null
}

/**
 * Get payout stats from database
 */
export async function getPayoutStats() {
  try {
    await connectDB()
    
    const totalPayouts = await Payout.countDocuments()
    const uniqueCycles = await Payout.distinct('cycle')
    const totalDistributed = await Payout.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    
    return {
      total_cycles: uniqueCycles.length,
      completed_payouts: uniqueCycles.length,
      total_distributed_usd: totalDistributed[0]?.total || 0,
      total_winners: totalPayouts,
      current_cycle: timingState.currentCycle,
      last_payout_time: timingState.lastPayoutTime,
      next_payout_time: timingState.nextPayoutTime,
    }
  } catch (error) {
    console.error('[PayoutService] Error fetching stats:', error)
    return {
      total_cycles: 0,
      completed_payouts: 0,
      total_distributed_usd: 0,
      total_winners: 0,
      current_cycle: timingState.currentCycle,
      last_payout_time: timingState.lastPayoutTime,
      next_payout_time: timingState.nextPayoutTime,
    }
  }
}
