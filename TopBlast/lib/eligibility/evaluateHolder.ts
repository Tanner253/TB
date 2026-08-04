import { config } from '@/lib/config'

export interface HolderEligibilityInput {
  balance: number
  vwap: number | null
  tokenPrice: number
  firstBuyTimestamp: number | null
  hasSold?: boolean
  hasTransferredOut?: boolean
  lastWinCycle?: number | null
  totalTokensBought?: number
  poolUsd: number
  currentCycle?: number
}

export interface HolderEligibilityResult {
  isEligible: boolean
  ineligibleReason: string | null
  drawdownPct: number
  lossUsd: number
}

export function evaluateHolderEligibility(
  input: HolderEligibilityInput
): HolderEligibilityResult {
  const {
    balance,
    vwap,
    tokenPrice,
    firstBuyTimestamp,
    hasSold = false,
    hasTransferredOut = false,
    lastWinCycle = null,
    totalTokensBought = 0,
    poolUsd,
    currentCycle = 1,
  } = input

  let drawdownPct = 0
  let lossUsd = 0
  const eligibleBalance =
    totalTokensBought > 0 ? Math.min(balance, totalTokensBought) : balance

  if (vwap && vwap > 0) {
    drawdownPct = ((tokenPrice - vwap) / vwap) * 100
    if (tokenPrice < vwap) {
      lossUsd = (vwap - tokenPrice) * eligibleBalance
    }
  }

  if (!tokenPrice || tokenPrice <= 0) {
    return { isEligible: false, ineligibleReason: 'Price loading', drawdownPct, lossUsd }
  }

  if (balance < config.minTokenHolding) {
    return { isEligible: false, ineligibleReason: 'Insufficient balance', drawdownPct, lossUsd }
  }

  if (!vwap || vwap === 0) {
    return { isEligible: false, ineligibleReason: 'No buy history', drawdownPct, lossUsd }
  }

  if (firstBuyTimestamp) {
    const holdMs = Date.now() - firstBuyTimestamp
    const minHoldMs = config.minHoldDurationMinutes * 60 * 1000
    if (holdMs < minHoldMs) {
      return { isEligible: false, ineligibleReason: 'Hold duration not met', drawdownPct, lossUsd }
    }
  } else {
    return { isEligible: false, ineligibleReason: 'No buy history', drawdownPct, lossUsd }
  }

  if (hasSold) {
    return { isEligible: false, ineligibleReason: 'Sold tokens', drawdownPct, lossUsd }
  }

  if (hasTransferredOut) {
    return { isEligible: false, ineligibleReason: 'Transferred out', drawdownPct, lossUsd }
  }

  if (lastWinCycle !== null && lastWinCycle >= currentCycle - 1) {
    return { isEligible: false, ineligibleReason: 'Winner cooldown', drawdownPct, lossUsd }
  }

  if (drawdownPct >= 0) {
    return {
      isEligible: false,
      ineligibleReason: drawdownPct === 0 ? 'At break-even' : 'In profit',
      drawdownPct,
      lossUsd,
    }
  }

  const minLoss = poolUsd * (config.minLossThresholdPct / 100)
  if (lossUsd < minLoss) {
    return { isEligible: false, ineligibleReason: 'Loss below threshold', drawdownPct, lossUsd }
  }

  return { isEligible: true, ineligibleReason: null, drawdownPct, lossUsd }
}
