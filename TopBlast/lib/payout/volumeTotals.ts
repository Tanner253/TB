import connectDB from '@/lib/db'
import { PayoutVolumeSwap } from '@/lib/db/models'
import { tenantFilter } from '@/lib/tenant/scope'
import type { PayoutTotals } from '@/lib/payout/payoutTotals'

export interface VolumeSwapTotals {
  total_sol: number
  total_usd: number
}

/** Sum Jupiter payout buybacks (ledger kept for ops; catalog gen volume mirrors paid out). */
export async function fetchVolumeSwapTotals(
  extra: Record<string, unknown> = {}
): Promise<VolumeSwapTotals> {
  await connectDB()
  const rows = await PayoutVolumeSwap.find(tenantFilter(extra))
    .select('swapSol swapUsd')
    .lean()

  let total_sol = 0
  let total_usd = 0
  for (const row of rows) {
    total_sol += row.swapSol || 0
    total_usd += row.swapUsd || 0
  }
  return { total_sol, total_usd }
}

export async function fetchVolumeSwapTotalsByTenantKey(): Promise<
  Map<string, VolumeSwapTotals>
> {
  await connectDB()
  const rows = await PayoutVolumeSwap.find()
    .select('tenantSlug swapSol swapUsd')
    .lean()

  const map = new Map<string, VolumeSwapTotals>()
  for (const row of rows) {
    const key = row.tenantSlug || '_legacy'
    const entry = map.get(key) ?? { total_sol: 0, total_usd: 0 }
    entry.total_sol += row.swapSol || 0
    entry.total_usd += row.swapUsd || 0
    map.set(key, entry)
  }
  return map
}

/**
 * Gen volume mirrors paid out USD (same payout history source).
 * SOL secondary line = USD / current SOL price so the pair stays consistent.
 */
export function resolveGeneratedVolume(input: {
  paidOut: PayoutTotals
  solPrice: number | null
}): VolumeSwapTotals {
  const total_usd = input.paidOut.total_usd > 0 ? input.paidOut.total_usd : 0
  if (!(total_usd > 0)) return { total_sol: 0, total_usd: 0 }
  const solPrice = input.solPrice ?? 0
  return {
    total_usd,
    total_sol: solPrice > 0 ? total_usd / solPrice : 0,
  }
}
