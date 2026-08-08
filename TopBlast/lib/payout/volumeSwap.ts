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

/** Persist chart buy volume from a Jupiter SOL → session token swap. */
export async function recordPayoutVolumeSwap(input: RecordPayoutVolumeSwapInput): Promise<void> {
  if (input.swapSol <= 0) return

  await connectDB()

  await PayoutVolumeSwap.findOneAndUpdate(
    { ...tenantFields(), cycle: input.cycle },
    {
      $set: {
        tokenMint: config.tokenMint,
        tokenSymbol: config.tokenSymbol,
        swapSol: input.swapSol,
        swapUsd: input.swapUsd,
        txHash: input.txHash,
      },
    },
    { upsert: true }
  )
}
