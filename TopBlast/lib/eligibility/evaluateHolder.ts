import { config } from '@/lib/config'
import {
  getProtocolWalletExclusionReason,
  isExcludedParticipantWallet,
} from '@/lib/eligibility/excludedWallets'
import {
  getLiquidityPoolExclusionReason,
  isLiquidityPoolWallet,
} from '@/lib/eligibility/liquidityPools'

export interface HolderEligibilityInput {
  wallet?: string
  balance: number
  vwap: number | null
  tokenPrice: number
  firstBuyTimestamp: number | null
  hasSold?: boolean
  hasTransferredOut?: boolean
  hasTransferIn?: boolean
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
    wallet,
    balance,
    vwap,
    tokenPrice,
    firstBuyTimestamp,
    hasSold = false,
    hasTransferredOut = false,
    hasTransferIn = false,
    lastWinCycle = null,
    totalTokensBought = 0,
    poolUsd,
    currentCycle = 1,
  } = input

  if (wallet && isExcludedParticipantWallet(wallet)) {
    const reason = isLiquidityPoolWallet(wallet, config.tokenMint)
      ? getLiquidityPoolExclusionReason()
      : getProtocolWalletExclusionReason()
    return {
      isEligible: false,
      ineligibleReason: reason,
      drawdownPct: 0,
      lossUsd: 0,
    }
  }

  const eligibleBalance =
    totalTokensBought > 0 ? Math.min(balance, totalTokensBought) : balance

  if (!tokenPrice || tokenPrice <= 0) {
    return { isEligible: false, ineligibleReason: 'Price loading', drawdownPct: 0, lossUsd: 0 }
  }

  if (balance < config.minTokenHolding) {
    return { isEligible: false, ineligibleReason: 'Insufficient balance', drawdownPct: 0, lossUsd: 0 }
  }

  if (!vwap || vwap === 0) {
    if (hasTransferIn && buyCountWouldBeZero(totalTokensBought, hasTransferIn)) {
      return { isEligible: false, ineligibleReason: 'Received via transfer', drawdownPct: 0, lossUsd: 0 }
    }
    return { isEligible: false, ineligibleReason: 'No buy history', drawdownPct: 0, lossUsd: 0 }
  }

  if (!firstBuyTimestamp) {
    return {
      isEligible: false,
      ineligibleReason: 'Buy history pending',
      drawdownPct: 0,
      lossUsd: 0,
    }
  }

  let drawdownPct = ((tokenPrice - vwap) / vwap) * 100
  let lossUsd = 0
  if (tokenPrice < vwap) {
    lossUsd = (vwap - tokenPrice) * eligibleBalance
  }

  const holdMs = Date.now() - firstBuyTimestamp
  const minHoldMs = config.minHoldDurationMinutes * 60 * 1000
  if (holdMs < minHoldMs) {
    return { isEligible: false, ineligibleReason: 'Hold duration not met', drawdownPct, lossUsd }
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

function buyCountWouldBeZero(totalTokensBought: number, hasTransferIn: boolean): boolean {
  return hasTransferIn && totalTokensBought <= 0
}
