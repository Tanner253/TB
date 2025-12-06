/**
 * Payout Service - Manages payout cycles and history
 * NOTE: This is a mock implementation - no actual token transfers
 */

import { config } from '@/lib/config'
import { getEligibleWinners, getCurrentPrice, getServiceStatus } from './holderService'
import { formatWallet } from '@/lib/solana/holders'

// Types
export interface PayoutWinner {
  rank: number
  wallet: string
  wallet_display: string
  drawdown_pct: number
  loss_usd: number
  payout_usd: number
  payout_pct: number
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

// Global state for payout history
declare global {
  var _payoutServiceState: {
    history: PayoutRecord[]
    currentCycle: number
    lastPayoutTime: number | null
    nextPayoutTime: number
  } | undefined
}

// Initialize global state
const payoutState = global._payoutServiceState || (global._payoutServiceState = {
  history: [],
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
  return Date.now() >= payoutState.nextPayoutTime
}

/**
 * Get seconds until next payout
 */
export function getSecondsUntilPayout(): number {
  return Math.max(0, Math.floor((payoutState.nextPayoutTime - Date.now()) / 1000))
}

/**
 * Get next payout time as Date
 */
export function getNextPayoutTime(): Date {
  return new Date(payoutState.nextPayoutTime)
}

/**
 * Execute a payout cycle (mock - no actual transfers)
 */
export function executePayout(): PayoutRecord {
  const now = Date.now()
  const tokenPrice = getCurrentPrice()
  const poolBalance = config.poolBalanceUsd
  const minLossRequired = poolBalance * (config.minLossThresholdPct / 100)
  
  // Get eligible winners (those meeting ALL criteria including min loss)
  const eligibleWinners = getEligibleWinners()
  
  // Filter to only those with loss >= 10% of pool
  const qualifiedWinners = eligibleWinners.filter(w => w.lossUsd >= minLossRequired)
  
  let record: PayoutRecord
  
  if (qualifiedWinners.length === 0) {
    // No eligible winners
    record = {
      id: `payout_${payoutState.currentCycle}_${now}`,
      cycle: payoutState.currentCycle,
      timestamp: now,
      pool_balance_usd: poolBalance,
      token_price: tokenPrice || 0,
      winners: [],
      total_distributed_usd: 0,
      status: 'no_winners',
      message: `No eligible winners. Minimum loss required: $${minLossRequired.toFixed(2)} (10% of pool)`,
    }
  } else {
    // Calculate payouts for top 3
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
    }
    
    record = {
      id: `payout_${payoutState.currentCycle}_${now}`,
      cycle: payoutState.currentCycle,
      timestamp: now,
      pool_balance_usd: poolBalance,
      token_price: tokenPrice || 0,
      winners,
      total_distributed_usd: Math.round(totalDistributed * 100) / 100,
      status: 'completed',
      message: `Payout completed! ${winners.length} winner(s) received rewards.`,
    }
  }
  
  // Add to history (keep last 100)
  payoutState.history.unshift(record)
  if (payoutState.history.length > 100) {
    payoutState.history = payoutState.history.slice(0, 100)
  }
  
  // Update state for next cycle
  payoutState.currentCycle++
  payoutState.lastPayoutTime = now
  payoutState.nextPayoutTime = getNextPayoutTimestamp()
  
  console.log(`[PayoutService] Cycle ${record.cycle} completed: ${record.status}`)
  if (record.winners.length > 0) {
    record.winners.forEach(w => {
      console.log(`  - #${w.rank} ${w.wallet_display}: ${w.drawdown_pct}% drawdown, $${w.payout_usd} payout`)
    })
  }
  
  return record
}

/**
 * Check and execute payout if due
 */
export function checkAndExecutePayout(): PayoutRecord | null {
  if (!isPayoutDue()) {
    return null
  }
  
  // Only execute if service is initialized
  const status = getServiceStatus()
  if (!status.initialized) {
    // Reschedule for next interval
    payoutState.nextPayoutTime = getNextPayoutTimestamp()
    return null
  }
  
  return executePayout()
}

/**
 * Get payout history
 */
export function getPayoutHistory(limit: number = 20): PayoutRecord[] {
  return payoutState.history.slice(0, limit)
}

/**
 * Get current cycle number
 */
export function getCurrentCycle(): number {
  return payoutState.currentCycle
}

/**
 * Get last payout record
 */
export function getLastPayout(): PayoutRecord | null {
  return payoutState.history[0] || null
}

/**
 * Get payout stats
 */
export function getPayoutStats() {
  const completedPayouts = payoutState.history.filter(p => p.status === 'completed')
  const totalDistributed = completedPayouts.reduce((sum, p) => sum + p.total_distributed_usd, 0)
  const totalWinners = completedPayouts.reduce((sum, p) => sum + p.winners.length, 0)
  
  return {
    total_cycles: payoutState.history.length,
    completed_payouts: completedPayouts.length,
    total_distributed_usd: totalDistributed,
    total_winners: totalWinners,
    current_cycle: payoutState.currentCycle,
    last_payout_time: payoutState.lastPayoutTime,
    next_payout_time: payoutState.nextPayoutTime,
  }
}

