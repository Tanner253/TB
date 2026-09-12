import 'server-only'

/**
 * Public flywheel numbers.
 *
 * Fees collected come from the payout ledger (rank-0 rows that succeeded);
 * buybacks and burns come from the append-only flywheel records. They are
 * counted separately and never reconciled into one another, because they are
 * different claims: one is "the protocol earned this", the other is "the
 * protocol destroyed this much supply, and here is the transaction".
 *
 * Burned supply counts CONFIRMED burns only. A cycle can buy and then fail to
 * burn, and quietly folding that in would inflate the number that matters
 * most.
 */

import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import { getChainId } from '@/lib/pons/contracts'
import { FLYWHEEL_BUYBACKS_COLLECTION } from '@/lib/platform/platformBuyback'

export interface FlywheelStats
{
  /** Protocol fees successfully collected, in the native asset. */
  feesCollectedEth: number
  feesCollectedUsd: number
  /** Native asset spent buying the platform token. */
  spentEth: number
  /** Platform tokens burned — confirmed burns only. */
  tokensBurned: number
  /** Number of completed buy+burn rounds. */
  purchases: number
  /** Rounds that bought but could not burn yet. */
  pendingBurns: number
  lastPurchaseAt: string | null
  /** True once at least one burn has been confirmed on-chain. */
  live: boolean
}

const EMPTY: FlywheelStats = {
  feesCollectedEth: 0,
  feesCollectedUsd: 0,
  spentEth: 0,
  tokensBurned: 0,
  purchases: 0,
  pendingBurns: 0,
  lastPurchaseAt: null,
  live: false,
}

export async function getFlywheelStats(): Promise<FlywheelStats> {
  try {
    await connectDB()
    const db = mongoose.connection.db
    if (!db) return EMPTY

    const { Payout } = await import('@/lib/db/models')

    // rank 0 is the protocol fee transfer; only successful ones were collected.
    const [fees] = await Payout.aggregate([
      { $match: { rank: 0, status: 'success' } },
      { $group: { _id: null, eth: { $sum: '$amountTokens' }, usd: { $sum: '$amount' } } },
    ])

    const rounds = await db
      .collection(FLYWHEEL_BUYBACKS_COLLECTION)
      .find({ chainId: getChainId() })
      .toArray()

    const burned = rounds.filter(r => r.burned === true)
    const lastPurchase = rounds
      .map(r => (r.createdAt instanceof Date ? r.createdAt : null))
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0]

    return {
      feesCollectedEth: round6(fees?.eth ?? 0),
      feesCollectedUsd: round2(fees?.usd ?? 0),
      spentEth: round6(rounds.reduce((sum, r) => sum + (Number(r.spentEth) || 0), 0)),
      tokensBurned: round6(burned.reduce((sum, r) => sum + (Number(r.tokensBurned) || 0), 0)),
      purchases: burned.length,
      pendingBurns: rounds.length - burned.length,
      lastPurchaseAt: lastPurchase ? lastPurchase.toISOString() : null,
      live: burned.length > 0,
    }
  } catch (err) {
    console.warn('[Flywheel] Stats unavailable:', err instanceof Error ? err.message : err)
    return EMPTY
  }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6
const round2 = (n: number) => Math.round(n * 100) / 100
