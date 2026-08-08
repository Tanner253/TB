import 'server-only'

import connectDB from '@/lib/db'
import { Payout } from '@/lib/db/models'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { getWalletSolBalance } from '@/lib/solana/transfer'
import { maxDistributableSol } from '@/lib/payout/payoutSecurity'
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

function distributablePotSol(walletSol: number): number {
  return maxDistributableSol(walletSol)
}

/** Attach live pot size and lifetime payout volume to catalog listings. */
export async function enrichCatalogTenants(
  tenants: PublicTenantSummary[]
): Promise<PublicTenantSummary[]> {
  if (tenants.length === 0) return tenants

  const [solPrice, volumeByKey] = await Promise.all([
    getSolPrice(),
    fetchPayoutVolumesByTenantKey(),
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

    const walletAddress = tenant.payoutWalletAddress?.trim()
    const walletSol = walletAddress ? balanceByAddress.get(walletAddress) : undefined
    const potSol = walletSol != null ? distributablePotSol(walletSol) : null
    const potUsd = potSol != null ? potSol * solPrice : null

    return {
      ...tenant,
      pot_sol: potSol,
      pot_usd: potUsd,
      pot_usd_formatted: potUsd != null ? formatUsd(potUsd) : null,
      total_distributed_sol: volume.total_sol,
      total_distributed_usd: volume.total_usd,
      total_distributed_usd_formatted: formatUsd(volume.total_usd),
    }
  })
}
