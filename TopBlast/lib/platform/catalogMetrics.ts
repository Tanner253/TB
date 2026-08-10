import 'server-only'

import connectDB from '@/lib/db'
import { CurrentRankings, Payout, TimerState } from '@/lib/db/models'
import { aggregateSuccessfulPayoutTotals } from '@/lib/payout/payoutTotals'
import { getSolPrice, formatCompactUsd, formatCompactSol } from '@/lib/solana/price'
import { getWalletSolBalance } from '@/lib/solana/transfer'
import { buildLivePoolBalance } from '@/lib/payout/poolBalance'
import { isPoolFundedForPayout } from '@/lib/payout/poolMinimum'
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

async function fetchPayoutTotalsByTenantKey(): Promise<Map<string, CatalogPayoutVolume>> {
  await connectDB()

  const payouts = await Payout.find({ status: 'success' })
    .select('tenantSlug rank amount amountTokens status')
    .lean()

  const map = new Map<string, CatalogPayoutVolume>()
  for (const p of payouts) {
    const key = p.tenantSlug || '_legacy'
    const entry = map.get(key) ?? { total_sol: 0, total_usd: 0 }
    const totals = aggregateSuccessfulPayoutTotals([p])
    entry.total_usd += totals.total_usd
    entry.total_sol += totals.total_sol
    map.set(key, entry)
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

async function fetchRankingsEligibilityByTenantKey(): Promise<
  Map<string, { eligibleCount: number; rankedCount: number }>
> {
  await connectDB()

  const docs = await CurrentRankings.find({ key: /current_rankings$/ })
    .select('key eligibleCount rankings')
    .lean()

  const map = new Map<string, { eligibleCount: number; rankedCount: number }>()
  for (const doc of docs) {
    const rankedCount = Array.isArray(doc.rankings) ? doc.rankings.length : 0
    const entry = {
      eligibleCount: doc.eligibleCount ?? 0,
      rankedCount,
    }
    if (doc.key === 'current_rankings') {
      map.set('_legacy', entry)
    } else if (doc.key.endsWith(':current_rankings')) {
      map.set(doc.key.replace(':current_rankings', ''), entry)
    }
  }
  return map
}

/** Attach live pot size and lifetime payout volume to catalog listings. */
export async function enrichCatalogTenants(
  tenants: PublicTenantSummary[]
): Promise<PublicTenantSummary[]> {
  if (tenants.length === 0) return tenants

  const [solPrice, paidOutByKey, timerByKey, eligibilityByKey] = await Promise.all([
    getSolPrice(),
    fetchPayoutTotalsByTenantKey(),
    fetchPayoutTimerByTenantKey(),
    fetchRankingsEligibilityByTenantKey(),
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
    const paidOut = paidOutByKey.get(payoutKey) ?? { total_sol: 0, total_usd: 0 }
    const timer = timerByKey.get(payoutKey)
    const eligibility = eligibilityByKey.get(payoutKey)
    const rawTimerStatus = timer?.timerStatus ?? 'waiting'
    const payoutIntervalMinutes = tenant.payoutIntervalMinutes ?? 15
    const effectiveInterval = timer
      ? getEffectivePayoutIntervalMinutes(payoutIntervalMinutes, timer.failedAttempts)
      : payoutIntervalMinutes
    const rawSecondsRemaining = timer
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
      total_distributed_sol: paidOut.total_sol,
      total_distributed_usd: paidOut.total_usd,
      total_distributed_usd_formatted: formatCompactUsd(paidOut.total_usd),
      total_generated_volume_sol: paidOut.total_sol,
      total_generated_volume_usd: paidOut.total_usd,
      total_generated_volume_usd_formatted: formatCompactUsd(paidOut.total_usd),
      total_generated_volume_sol_formatted: formatCompactSol(paidOut.total_sol),
      payout_timer_status: rawTimerStatus,
      payout_seconds_remaining: rawSecondsRemaining,
      payout_current_cycle: timer?.currentCycle ?? 0,
      payout_eligible_count: eligibility?.eligibleCount ?? 0,
      payout_ranked_count: eligibility?.rankedCount ?? 0,
      payout_pool_funded: pool ? isPoolFundedForPayout(pool) : false,
    }
  })
}
