/**
 * Wipe protocol state for a fresh token deployment / test run.
 */

import connectDB from '@/lib/db'
import {
  Holder,
  CurrentRankings,
  Disqualification,
  TimerState,
  Snapshot,
  Payout,
  PoolBalance,
} from '@/lib/db/models'
import { config } from '@/lib/config'
import { resetHolderServiceState } from '@/lib/tracker/holderService'

const TIMER_KEY = 'payout_timer'

export interface DeploymentResetResult {
  tokenMint: string
  cleared: Record<string, number>
  timerStatus: 'waiting'
}

/** Delete all runtime protocol data and reset timer to waiting for current TOKEN_MINT_ADDRESS. */
export async function resetDeploymentState(): Promise<DeploymentResetResult> {
  if (!config.tokenMint) {
    throw new Error('TOKEN_MINT_ADDRESS is not configured')
  }

  await connectDB()

  const [holders, rankings, disqualifications, snapshots, payouts, poolRows] = await Promise.all([
    Holder.deleteMany({}),
    CurrentRankings.deleteMany({}),
    Disqualification.deleteMany({}),
    Snapshot.deleteMany({}),
    Payout.deleteMany({}),
    PoolBalance.deleteMany({}),
  ])

  await TimerState.findOneAndUpdate(
    { key: TIMER_KEY },
    {
      $set: {
        tokenMint: config.tokenMint,
        timerStatus: 'waiting',
        lastPayoutTime: null,
        currentCycle: 0,
        failedAttempts: 0,
        isPayoutInProgress: false,
        lockAcquiredAt: null,
        lockCycle: null,
      },
    },
    { upsert: true }
  )

  resetHolderServiceState()

  return {
    tokenMint: config.tokenMint,
    cleared: {
      holders: holders.deletedCount,
      rankings: rankings.deletedCount,
      disqualifications: disqualifications.deletedCount,
      snapshots: snapshots.deletedCount,
      payouts: payouts.deletedCount,
      poolBalance: poolRows.deletedCount,
    },
    timerStatus: 'waiting',
  }
}
