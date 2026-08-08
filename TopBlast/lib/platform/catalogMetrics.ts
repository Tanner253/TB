import 'server-only'

import connectDB from '@/lib/db'
import { Payout, TimerState } from '@/lib/db/models'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { getWalletSolBalance } from '@/lib/solana/transfer'
import { buildLivePoolBalance } from '@/lib/payout/poolBalance'
import type { PublicTenantSummary } from '@/lib/tenant/types'

export interface CatalogPayoutVolume {
  total_sol: number
  total_usd: number
}

/** Mongo tenant key for payout history (env platform token uses _legacy). */
export function catalogPayoutTenantKey(tenant: PublicTenantSummary): string {
  if (tenant.runsFromEnv) return '_legacy'
  return tenant.slug
}

async function fetchPayoutVolumesByTenantKey(): Promise<Map<string, CatalogPayoutVolume>> {
  await connectDB()

  const rows = await Payout.aggregate<{ _id: string; total_sol: number; total_usd: number }>([
    { $match: { status: 'success' } },
    {
      $group: {
        _id: { $ifNull: ['$tenantSlug', '_legacy'] },
        total_sol: { $sum: { $ifNull: ['$amountTokens', 0] } },
        total_usd: { $sum: { $ifNull: ['$amount', 0] } },
      },
    },
  ])

  const map = new Map<string, CatalogPayoutVolume>()
  for (const row of rows) {
    map.set(row._id, { total_sol: row.total_sol, total_usd: row.total_usd })
  }
  return map
}

async function fetchPayoutTimerStatusByTenantKey(): Promise<Map<string, 'waiting' | 'active'>> {
  await connectDB()

  const docs = await TimerState.find({ key: /payout_timer$/ })
    .select('key timerStatus')
    .lean()

  const map = new Map<string, 'waiting' | 'active'>()
  for (const doc of docs) {
    const status: 'waiting' | 'active' =
      doc.timerStatus === 'active' ? 'active' : 'waiting'
    if (doc.key === 'payout_timer') {
      map.set('_legacy', status)
    } else if (doc.key.endsWith(':payout_timer')) {
      map.set(doc.key.replace(':payout_timer', ''), status)
    }
  }
  return map
}

/** Attach live pot size and lifetime payout volume to catalog listings. */
export async function enrichCatalogTenants(
  tenants: PublicTenantSummary[]
): Promise<PublicTenantSummary[]> {
  if (tenants.length === 0) return tenants

  const [solPrice, volumeByKey, timerByKey] = await Promise.all([
    getSolPrice(),
    fetchPayoutVolumesByTenantKey(),
    fetchPayoutTimerStatusByTenantKey(),
  ])

  const uniqueAddresses = [
    ...new Set(tenants.map(t => t.payoutWalletAddress?.trim()).filter(Boolean) as string[]),
  ]

  const balanceResults = await Promise.all(
    uniqueAddresses.map(async address => {
      const result = await getWalletSolBalance(address)
      return { address, result }
    })
  )

  const balanceByAddress = new Map<string, number>()
  for (const { address, result } of balanceResults) {
    if (result && !result.rpcError) {
      balanceByAddress.set(address, result.sol)
    }
  }

  return tenants.map(tenant => {
    const payoutKey = catalogPayoutTenantKey(tenant)
    const volume = volumeByKey.get(payoutKey) ?? { total_sol: 0, total_usd: 0 }
    const payoutTimerStatus = timerByKey.get(payoutKey) ?? 'waiting'

    const walletAddress = tenant.payoutWalletAddress?.trim()
    const walletSol = walletAddress ? balanceByAddress.get(walletAddress) : undefined
    const pool =
      walletSol != null && walletAddress
        ? buildLivePoolBalance(walletSol, walletAddress, solPrice)
        : null

    return {
      ...tenant,
      pot_sol: pool?.poolSol ?? null,
      pot_usd: pool?.poolUsd ?? null,
      pot_usd_formatted: pool?.poolUsdFormatted ?? null,
      total_distributed_sol: volume.total_sol,
      total_distributed_usd: volume.total_usd,
      total_distributed_usd_formatted: formatUsd(volume.total_usd),
      payout_timer_status: payoutTimerStatus,
    }
  })
}
