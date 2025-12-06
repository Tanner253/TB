import { config } from '@/lib/config'

export interface WalletActivity {
  timestamp: Date
  amount: number
  priceUsd: number
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out'
}

export interface RankedHolder {
  wallet: string
  balance: number
  vwap: number
  currentPrice: number
  drawdownPct: number
  lossUsd: number
  rank: number
  isEligible: boolean
  ineligibleReason: string | null
}

// Calculate VWAP from buy transactions
export function calculateVwap(buys: WalletActivity[]): number | null {
  const buyOnly = buys.filter(b => b.type === 'buy' && b.amount > 0)
  if (buyOnly.length === 0) return null

  let totalCost = 0
  let totalTokens = 0

  for (const buy of buyOnly) {
    totalCost += buy.amount * buy.priceUsd
    totalTokens += buy.amount
  }

  if (totalTokens === 0) return null
  return totalCost / totalTokens
}

// Calculate drawdown percentage
// Returns negative number when in loss (e.g., -50 means 50% loss)
export function calculateDrawdown(vwap: number, currentPrice: number): number {
  if (!vwap || vwap === 0) return 0
  return ((currentPrice - vwap) / vwap) * 100
}

// Calculate USD loss amount
export function calculateLossUsd(vwap: number, currentPrice: number, balance: number): number {
  if (!vwap || vwap === 0) return 0
  if (currentPrice >= vwap) return 0 // In profit
  return (vwap - currentPrice) * balance
}

// Check holder eligibility
export function checkEligibility(
  holder: {
    wallet: string
    balance: number
    vwap: number | null
    lastWinCycle?: number | null
    cooldownUntil?: Date | null
  },
  currentPrice: number,
  poolBalance: number,
  currentCycle: number
): { eligible: boolean; reason: string | null } {
  // Minimum balance
  if (holder.balance < config.minTokenHolding) {
    return { eligible: false, reason: 'Insufficient balance' }
  }

  // Must have VWAP
  if (!holder.vwap || holder.vwap === 0) {
    return { eligible: false, reason: 'No buy history' }
  }

  // Must be in loss position
  const drawdown = calculateDrawdown(holder.vwap, currentPrice)
  if (drawdown >= 0) {
    return { eligible: false, reason: 'In profit' }
  }

  // Minimum loss threshold
  const lossUsd = calculateLossUsd(holder.vwap, currentPrice, holder.balance)
  const minLoss = poolBalance * (config.minLossThresholdPct / 100)
  if (lossUsd < minLoss) {
    return { eligible: false, reason: 'Loss below threshold' }
  }

  // Winner cooldown (1 cycle)
  if (holder.lastWinCycle && holder.lastWinCycle >= currentCycle - 1) {
    return { eligible: false, reason: 'Winner cooldown' }
  }

  // Transfer/disqualification cooldown
  if (holder.cooldownUntil && new Date(holder.cooldownUntil) > new Date()) {
    return { eligible: false, reason: 'Cooldown active' }
  }

  return { eligible: true, reason: null }
}

// Rank holders by drawdown (most negative first), tiebreaker by USD loss
export function rankHolders(holders: RankedHolder[]): RankedHolder[] {
  const eligible = holders.filter(h => h.isEligible)

  const sorted = [...eligible].sort((a, b) => {
    // Most negative drawdown first
    if (a.drawdownPct !== b.drawdownPct) {
      return a.drawdownPct - b.drawdownPct
    }
    // Tiebreaker: highest USD loss
    return b.lossUsd - a.lossUsd
  })

  return sorted.map((holder, index) => ({
    ...holder,
    rank: index + 1,
  }))
}

// Calculate payout amounts
export function calculatePayouts(poolBalance: number): { first: number; second: number; third: number } {
  return {
    first: poolBalance * config.payoutSplit.first,
    second: poolBalance * config.payoutSplit.second,
    third: poolBalance * config.payoutSplit.third,
  }
}
