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
import { getTimerKey, getRankingsKey } from '@/lib/tenant/keys'
import { tenantFilter } from '@/lib/tenant/scope'

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
    Holder.deleteMany(tenantFilter()),
    CurrentRankings.deleteMany({ key: getRankingsKey() }),
    Disqualification.deleteMany(tenantFilter()),
    Snapshot.deleteMany(tenantFilter()),
    Payout.deleteMany(tenantFilter()),
    PoolBalance.deleteMany(tenantFilter()),
  ])

  await TimerState.findOneAndUpdate(
    { key: getTimerKey() },
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
        accruedDevFeeEth: 0,
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
