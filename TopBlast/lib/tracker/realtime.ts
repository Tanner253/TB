/**
 * Real-time transaction tracker
 * This is a compatibility layer that delegates to the HolderService
 */

import {
  recordBuy as hsRecordBuy,
  recordSell as hsRecordSell,
  getRankedLosers,
  getHolderCount,
  getCurrentPrice,
  isServiceInitialized,
} from './holderService'

// Re-export types and functions from holderService for backwards compatibility
export { getCurrentPrice, getHolderCount, isServiceInitialized }

// Server start timestamp
const serverStartTime = Date.now()

// Baseline price (set on first request)
let baselinePrice: number | null = null

export function getServerStartTime(): number {
  return serverStartTime
}

export function setBaselinePrice(price: number): void {
  if (!baselinePrice) {
    baselinePrice = price
  }
}

export function getBaselinePrice(): number | null {
  return baselinePrice || getCurrentPrice()
}

// Record a new buy transaction (delegates to HolderService)
export function recordBuy(wallet: string, tokenAmount: number, pricePerToken: number): void {
  hsRecordBuy(wallet, tokenAmount, pricePerToken, tokenAmount)
}

// Record a sell (delegates to HolderService)
export function recordSell(wallet: string): void {
  hsRecordSell(wallet, 0)
}

// Get count of tracked buyers
export function getTrackedCount(): number {
  return getHolderCount()
}

// Get buyers who are currently losing money
export function getLosers(currentPrice: number): Array<{
  wallet: string
  entryPrice: number
  tokenAmount: number
  totalCost: number
  timestamp: number
  drawdownPct: number
  lossUsd: number
}> {
  const rankedLosers = getRankedLosers()
  
  return rankedLosers.map(holder => ({
    wallet: holder.wallet,
    entryPrice: holder.vwap || 0,
    tokenAmount: holder.balance,
    totalCost: holder.totalCostBasis,
    timestamp: holder.firstBuyTimestamp || Date.now(),
    drawdownPct: holder.drawdownPct,
    lossUsd: holder.lossUsd,
  }))
}

// Clear all tracked data (for testing)
export function clearTrackedData(): void {
  // Not implemented in HolderService
  console.warn('[Realtime] clearTrackedData not implemented')
}
