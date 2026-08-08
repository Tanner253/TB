import 'server-only'

import connectDB from '@/lib/db'
import { PayoutVolumeSwap } from '@/lib/db/models'
import { config } from '@/lib/config'
import { tenantFields } from '@/lib/tenant/scope'

export interface RecordPayoutVolumeSwapInput {
  cycle: number
  swapSol: number
  swapUsd: number
  txHash: string | null
}

let volumeSwapIndexesEnsured = false

/** Drop legacy per-cycle unique index so retries record separate swap txs. */
async function ensurePayoutVolumeSwapIndexes(): Promise<void> {
  if (volumeSwapIndexesEnsured) return
  await connectDB()
  try {
    await PayoutVolumeSwap.collection.dropIndex('tenantSlug_1_cycle_1')
  } catch {
    /* legacy index may not exist */
  }
  await PayoutVolumeSwap.syncIndexes()
  volumeSwapIndexesEnsured = true
}

/** Persist chart buy volume from a Jupiter SOL → session token swap. */
export async function recordPayoutVolumeSwap(input: RecordPayoutVolumeSwapInput): Promise<void> {
  if (input.swapSol <= 0 || !input.txHash) return

  await ensurePayoutVolumeSwapIndexes()

  await PayoutVolumeSwap.findOneAndUpdate(
    { ...tenantFields(), txHash: input.txHash },
    {
      $setOnInsert: {
        tokenMint: config.tokenMint,
        tokenSymbol: config.tokenSymbol,
        cycle: input.cycle,
        swapSol: input.swapSol,
        swapUsd: input.swapUsd,
        txHash: input.txHash,
      },
    },
    { upsert: true }
  )
}
