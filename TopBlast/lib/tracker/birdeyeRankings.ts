/**
 * Live holder rankings from Birdeye — replaces per-wallet Helius VWAP hydration.
 * Writes CurrentRankings only; does not execute payouts or mutate in-memory holder state.
 */

import { config } from '@/lib/config'
import connectDB from '@/lib/db'
import { evaluateHolderEligibility } from '@/lib/eligibility/evaluateHolder'
import { isExcludedParticipantWallet } from '@/lib/eligibility/excludedWallets'
import {
  ensureLiquidityPoolAddresses,
  isLiquidityPoolWallet,
} from '@/lib/eligibility/liquidityPools'
import {
  holderRefreshKey,
  markHolderRefresh,
  shouldSkipHolderRefresh,
} from '@/lib/platform/holderRefresh'
import {
  fetchBirdeyeTokenHolders,
  isBirdeyeHolderSourceEnabled,
} from '@/lib/solana/birdeyeHolders'
import { normalizeTokenBalance } from '@/lib/solana/tokenAmount'
import { getTokenPrice } from '@/lib/solana/price'
import { getRankingsKey } from '@/lib/tenant/keys'
import { loadLastWinCycleByWallet } from '@/lib/payout/winnerPersistence'
import { getLivePoolBalance } from '@/lib/payout/poolBalance'

export { isBirdeyeHolderSourceEnabled }

export interface RefreshLiveHolderRankingsResult {
  refreshed: boolean
  skipped?: boolean
  holderCount: number
  holdersWithVwap: number
  eligibleCount: number
  apiCalls: number
}

export interface RankingRow {
  wallet: string
  balance: number
  vwap: number
  drawdownPct: number
  lossUsd: number
  isEligible: boolean
  ineligibleReason: string | null
  firstBuyAt: Date | null
  hasSold: boolean
  hasTransferredOut: boolean
  totalTokensBought: number
  lastWinCycle: number | null
  isContract: boolean
  vwapFetchedAt: Date
}

export function buildRankingRowsFromBirdeye(
  snapshots: Array<{
    wallet: string
    balance: number
    vwap: number | null
    firstBuyTimestamp: number | null
    hasSold: boolean
    hasTransferIn: boolean
  }>,
  ctx: {
    mint: string
    tokenPrice: number
    poolUsd: number
    currentCycle: number
    lastWinByWallet: Map<string, number | null>
    minTokenHolding: number
    tokenDecimals: number
  }
): RankingRow[] {
  const now = new Date()
  const rows: RankingRow[] = []

  for (const snap of snapshots) {
    const isContract = isLiquidityPoolWallet(snap.wallet, ctx.mint)
    if (isContract || isExcludedParticipantWallet(snap.wallet)) continue

    const balance = normalizeTokenBalance(
      snap.balance,
      ctx.tokenDecimals,
      ctx.minTokenHolding
    )
    if (balance < ctx.minTokenHolding) continue

    const totalTokensBought = snap.vwap && snap.vwap > 0 ? balance : 0
    const lastWinCycle = ctx.lastWinByWallet.get(snap.wallet) ?? null

    const eligibility = evaluateHolderEligibility({
      wallet: snap.wallet,
      balance,
      vwap: snap.vwap,
      tokenPrice: ctx.tokenPrice,
      firstBuyTimestamp: snap.firstBuyTimestamp,
      hasSold: snap.hasSold,
      hasTransferredOut: false,
      hasTransferIn: snap.hasTransferIn,
      lastWinCycle,
      totalTokensBought,
      poolUsd: ctx.poolUsd,
      currentCycle: ctx.currentCycle,
    })

    rows.push({
      wallet: snap.wallet,
      balance,
      vwap: snap.vwap ?? 0,
      drawdownPct: eligibility.drawdownPct,
      lossUsd: eligibility.lossUsd,
      isEligible: eligibility.isEligible,
      ineligibleReason: eligibility.ineligibleReason,
      firstBuyAt: snap.firstBuyTimestamp ? new Date(snap.firstBuyTimestamp) : null,
      hasSold: snap.hasSold,
      hasTransferredOut: false,
      totalTokensBought,
      lastWinCycle,
      isContract: false,
      vwapFetchedAt: now,
    })
  }

  return rows.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1
    if (a.drawdownPct !== b.drawdownPct) return a.drawdownPct - b.drawdownPct
    return b.lossUsd - a.lossUsd
  })
}

/** Persist rankings snapshot — no payout side effects. */
export async function persistRankingsSnapshot(
  rows: RankingRow[],
  tokenPrice: number
): Promise<{ eligibleCount: number; holdersWithVwap: number }> {
  const { CurrentRankings } = await import('@/lib/db/models')
  await connectDB()

  const eligibleCount = rows.filter(r => r.isEligible).length
  const holdersWithVwap = rows.filter(r => r.vwap > 0).length
  const top = rows.slice(0, 50)

  await CurrentRankings.findOneAndUpdate(
    { key: getRankingsKey() },
    {
      $set: {
        tokenMint: config.tokenMint,
        rankings: top,
        totalHolders: rows.length,
        eligibleCount,
        holdersWithVwap,
        tokenPrice,
        lastCalculated: new Date(),
      },
    },
    { upsert: true }
  )

  console.log(
    `[BirdeyeRankings] Saved ${rows.length} holder(s), ${holdersWithVwap} with entry price, ${eligibleCount} eligible (${top.length} in leaderboard)`
  )

  return { eligibleCount, holdersWithVwap }
}

/**
 * Fetch Birdeye holder snapshot and write rankings to MongoDB.
 * Throttled to ~1/min per tenant unless `force` (e.g. before settlement).
 */
export async function refreshLiveHolderRankings(options?: {
  force?: boolean
}): Promise<RefreshLiveHolderRankingsResult> {
  if (!isBirdeyeHolderSourceEnabled() || !config.tokenMint) {
    return { refreshed: false, holderCount: 0, holdersWithVwap: 0, eligibleCount: 0, apiCalls: 0 }
  }

  const tenantKey = getRankingsKey()
  if (shouldSkipHolderRefresh(tenantKey, options?.force)) {
    return {
      refreshed: false,
      skipped: true,
      holderCount: 0,
      holdersWithVwap: 0,
      eligibleCount: 0,
      apiCalls: 0,
    }
  }

  await ensureLiquidityPoolAddresses(config.tokenMint)

  const [tokenPrice, pool] = await Promise.all([
    getTokenPrice(config.tokenMint),
    getLivePoolBalance(),
  ])
  const price = tokenPrice ?? 0

  const { holders, apiCalls } = await fetchBirdeyeTokenHolders(config.tokenMint, {
    maxHolders: Math.min(config.maxHoldersToProcess, 1000),
    tokenPrice: price > 0 ? price : null,
    pageDelayMs: 1100,
  })

  if (holders.length === 0) {
    console.warn('[BirdeyeRankings] No holders returned — keeping existing rankings')
    return { refreshed: false, holderCount: 0, holdersWithVwap: 0, eligibleCount: 0, apiCalls }
  }

  const lastWinByWallet = await loadLastWinCycleByWallet(holders.map(h => h.wallet))
  const { getCurrentPayoutCycle } = await import('@/lib/payout/executor')

  const rows = buildRankingRowsFromBirdeye(holders, {
    mint: config.tokenMint,
    tokenPrice: price,
    poolUsd: pool.poolUsd,
    currentCycle: getCurrentPayoutCycle(),
    lastWinByWallet,
    minTokenHolding: config.minTokenHolding,
    tokenDecimals: config.tokenDecimals,
  })

  const { eligibleCount, holdersWithVwap } = await persistRankingsSnapshot(rows, price)
  markHolderRefresh(tenantKey)

  return {
    refreshed: true,
    holderCount: rows.length,
    holdersWithVwap,
    eligibleCount,
    apiCalls,
  }
}
