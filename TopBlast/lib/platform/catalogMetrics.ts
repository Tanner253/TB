import 'server-only'

import connectDB from '@/lib/db'
import { Payout, PayoutVolumeSwap, TimerState } from '@/lib/db/models'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { getWalletSolBalance } from '@/lib/solana/transfer'
import { buildLivePoolBalance } from '@/lib/payout/poolBalance'
import { computePayoutSecondsRemaining } from '@/lib/payout/timerMath'
import { getEffectivePayoutIntervalMinutes } from '@/lib/payout/payoutRetry'
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

async function fetchGeneratedVolumesByTenantKey(): Promise<Map<string, CatalogPayoutVolume>> {
  await connectDB()

  const rows = await PayoutVolumeSwap.aggregate<{ _id: string; total_sol: number; total_usd: number }>([
    {
      $group: {
        _id: { $ifNull: ['$tenantSlug', '_legacy'] },
        total_sol: { $sum: { $ifNull: ['$swapSol', 0] } },
        total_usd: { $sum: { $ifNull: ['$swapUsd', 0] } },
      },
    },
  ])

  const map = new Map<string, CatalogPayoutVolume>()
  for (const row of rows) {
    map.set(row._id, { total_sol: row.total_sol, total_usd: row.total_usd })
  }
  return map
}

async function fetchPayoutTimerByTenantKey(): Promise<
  Map<
    string,
    {
      timerStatus: 'waiting' | 'active'
      lastPayoutTime: Date | null
      currentCycle: number
      failedAttempts: number
      lastPayoutError: string | null
    }
  >
> {
  await connectDB()

  const docs = await TimerState.find({ key: /payout_timer$/ })
    .select('key timerStatus lastPayoutTime currentCycle failedAttempts lastPayoutError')
    .lean()

  const map = new Map<
    string,
    {
      timerStatus: 'waiting' | 'active'
      lastPayoutTime: Date | null
      currentCycle: number
      failedAttempts: number
      lastPayoutError: string | null
    }
  >()

  for (const doc of docs) {
    const timerStatus: 'waiting' | 'active' =
      doc.timerStatus === 'active' ? 'active' : 'waiting'
    const entry = {
      timerStatus,
      lastPayoutTime: doc.lastPayoutTime ?? null,
      currentCycle: doc.currentCycle ?? 0,
      failedAttempts: doc.failedAttempts ?? 0,
      lastPayoutError: doc.lastPayoutError ?? null,
    }
    if (doc.key === 'payout_timer') {
      map.set('_legacy', entry)
    } else if (doc.key.endsWith(':payout_timer')) {
      map.set(doc.key.replace(':payout_timer', ''), entry)
    }
  }
  return map
}

/** Attach live pot size and lifetime payout volume to catalog listings. */
export async function enrichCatalogTenants(
  tenants: PublicTenantSummary[]
): Promise<PublicTenantSummary[]> {
  if (tenants.length === 0) return tenants

  const [solPrice, volumeByKey, generatedByKey, timerByKey] = await Promise.all([
    getSolPrice(),
    fetchPayoutVolumesByTenantKey(),
    fetchGeneratedVolumesByTenantKey(),
    fetchPayoutTimerByTenantKey(),
  ])

  const uniqueAddresses = Array.from(
    new Set(tenants.map(t => t.payoutWalletAddress?.trim()).filter(Boolean) as string[])
  )

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
    const generated = generatedByKey.get(payoutKey) ?? { total_sol: 0, total_usd: 0 }
    const timer = timerByKey.get(payoutKey)
    const payoutTimerStatus = timer?.timerStatus ?? 'waiting'
    const payoutIntervalMinutes = tenant.payoutIntervalMinutes ?? 15
    const effectiveInterval = timer
      ? getEffectivePayoutIntervalMinutes(payoutIntervalMinutes, timer.failedAttempts)
      : payoutIntervalMinutes
    const payoutSecondsRemaining = timer
      ? computePayoutSecondsRemaining({
          timerStatus: timer.timerStatus,
          lastPayoutTime: timer.lastPayoutTime,
          payoutIntervalMinutes: effectiveInterval,
        })
      : null

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
      total_generated_volume_sol: generated.total_sol,
      total_generated_volume_usd: generated.total_usd,
      total_generated_volume_usd_formatted: formatUsd(generated.total_usd),
      payout_timer_status: payoutTimerStatus,
      payout_seconds_remaining: payoutSecondsRemaining,
      payout_current_cycle: timer?.currentCycle ?? 0,
    }
  })
}
