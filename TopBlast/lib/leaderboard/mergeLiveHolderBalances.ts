import { config } from '@/lib/config'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import { isLiquidityPoolWallet } from '@/lib/eligibility/liquidityPools'
import type { OnChainHolderStats } from '@/lib/solana/holderStats'
import { meetsMinTokenHoldingFromChain, rawToHumanTokenAmount } from '@/lib/solana/tokenAmount'

export interface LeaderboardRankingRow {
  wallet: string
  balance: number
  vwap: number
  drawdownPct: number
  lossUsd: number
  isEligible: boolean
  ineligibleReason: string | null
  firstBuyAt?: Date | string | null
  hasSold?: boolean
  hasTransferredOut?: boolean
  totalTokensBought?: number
  lastWinCycle?: number | null
  isContract?: boolean
}

function isTrackableWallet(wallet: string, mint: string, isContract: boolean): boolean {
  if (isContract) return false
  if (isExcludedParticipantWallet(wallet)) return false
  if (isLiquidityPoolWallet(wallet, mint)) return false
  return true
}

function newStubRanking(wallet: string, balance: number): LeaderboardRankingRow {
  return {
    wallet,
    balance,
    vwap: 0,
    drawdownPct: 0,
    lossUsd: 0,
    isEligible: false,
    ineligibleReason: 'Loading buy history...',
    firstBuyAt: null,
    hasSold: false,
    hasTransferredOut: false,
    totalTokensBought: 0,
    lastWinCycle: null,
    isContract: false,
  }
}

/**
 * Overlay live SPL balances onto DB rankings: update balances, drop wallets that sold out,
 * add newly qualifying holders. Returns fresh on-chain holder counts from the same fetch.
 */
export function mergeLiveHolderBalances(
  rankingByWallet: Map<string, LeaderboardRankingRow>,
  liveHolders: Array<{ wallet: string; balance: number; isContract: boolean }>,
  mint: string
): OnChainHolderStats {
  const liveQualifying = new Map<string, number>()
  let raw = 0
  let trackable = 0
  let qualifying = 0

  for (const h of liveHolders) {
    raw++
    if (!isTrackableWallet(h.wallet, mint, h.isContract)) continue

    trackable++
    if (
      !meetsMinTokenHoldingFromChain(h.balance, config.tokenDecimals, config.minTokenHolding)
    ) {
      continue
    }

    qualifying++
    liveQualifying.set(
      h.wallet,
      rawToHumanTokenAmount(h.balance, config.tokenDecimals)
    )
  }

  for (const wallet of [...rankingByWallet.keys()]) {
    const liveBalance = liveQualifying.get(wallet)
    if (liveBalance == null) {
      rankingByWallet.delete(wallet)
      continue
    }
    rankingByWallet.get(wallet)!.balance = liveBalance
  }

  for (const [wallet, balance] of liveQualifying) {
    if (rankingByWallet.has(wallet)) continue
    rankingByWallet.set(wallet, newStubRanking(wallet, balance))
  }

  return { raw, trackable, qualifying }
}
