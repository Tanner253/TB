/**
 * Single source of truth for reward pool size — payout wallet SOL balance on-chain.
 */

import { getPayoutWalletBalance, getPayoutWalletAddressFromKey } from '@/lib/solana/transfer'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { maxDistributableSol } from '@/lib/payout/payoutSecurity'
import { clearTenantCacheEntries, tenantCacheKey } from '@/lib/tenant/tenantCacheKey'

export interface LivePoolBalance {
  payoutWalletAddress: string | null
  walletSol: number
  poolSol: number
  poolUsd: number
  solPrice: number
  poolUsdFormatted: string
  poolSolFormatted: string
  /** @deprecated use poolSol — kept for API field compatibility */
  walletEth: number
  poolEth: number
  ethPrice: number
  poolEthFormatted: string
  minLossUsd: number
  minLossUsdFormatted: string
  available: boolean
  /** True when address is known but on-chain balance could not be fetched */
  balanceLookupFailed?: boolean
}

/** Short TTL so leaderboard polls do not RPC-getBalance on every request. */
const POOL_BALANCE_CACHE_TTL_MS = 45 * 1000

declare global {
  // eslint-disable-next-line no-var
  var _livePoolBalanceCacheByKey: Map<string, { value: LivePoolBalance; expiresAt: number }> | undefined
}

function poolBalanceCacheKey(walletAddress: string | null): string {
  return tenantCacheKey('pool', walletAddress ?? 'none')
}

function getCacheMap(): Map<string, { value: LivePoolBalance; expiresAt: number }> {
  if (!global._livePoolBalanceCacheByKey) {
    global._livePoolBalanceCacheByKey = new Map()
  }
  return global._livePoolBalanceCacheByKey
}

function readPoolBalanceCache(cacheKey: string): LivePoolBalance | null {
  const hit = getCacheMap().get(cacheKey)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    getCacheMap().delete(cacheKey)
    return null
  }
  return hit.value
}

function writePoolBalanceCache(cacheKey: string, value: LivePoolBalance) {
  getCacheMap().set(cacheKey, {
    value,
    expiresAt: Date.now() + POOL_BALANCE_CACHE_TTL_MS,
  })
}

export function invalidateLivePoolBalanceCache(tenantSlug?: string) {
  clearTenantCacheEntries(global._livePoolBalanceCacheByKey, tenantSlug)
}

/** Shared pot math for leaderboard, catalog, and stats. */
export function buildLivePoolBalance(
  walletSol: number,
  payoutWalletAddress: string | null,
  solPrice: number,
  options?: { available?: boolean; balanceLookupFailed?: boolean }
): LivePoolBalance {
  const poolSol = maxDistributableSol(walletSol)
  const poolUsd = poolSol * solPrice
  const minLossUsd = poolUsd * (config.minLossThresholdPct / 100)
  const available = options?.available ?? true

  return {
    payoutWalletAddress,
    walletSol,
    poolSol,
    poolUsd,
    solPrice,
    poolUsdFormatted: formatUsd(poolUsd),
    poolSolFormatted: poolSol.toFixed(4),
    walletEth: walletSol,
    poolEth: poolSol,
    ethPrice: solPrice,
    poolEthFormatted: poolSol.toFixed(4),
    minLossUsd,
    minLossUsdFormatted: formatUsd(minLossUsd),
    available,
    balanceLookupFailed: options?.balanceLookupFailed ?? false,
  }
}

export async function getLivePoolBalance(options?: {
  bypassCache?: boolean
}): Promise<LivePoolBalance> {
  const payoutWalletAddress = getPayoutWalletAddressFromKey()
  const cacheKey = poolBalanceCacheKey(payoutWalletAddress)

  if (!options?.bypassCache) {
    const cached = readPoolBalanceCache(cacheKey)
    if (cached) return cached
  }

  const solPrice = (await getSolPrice()) ?? 0
  const walletBalance = await getPayoutWalletBalance()

  if (!walletBalance) {
    const result = buildLivePoolBalance(0, null, solPrice, { available: false })
    writePoolBalanceCache(cacheKey, result)
    return result
  }

  if (walletBalance.rpcError) {
    const result = buildLivePoolBalance(0, walletBalance.address, solPrice, {
      available: false,
      balanceLookupFailed: true,
    })
    writePoolBalanceCache(cacheKey, result)
    return result
  }

  const result = buildLivePoolBalance(walletBalance.sol, walletBalance.address, solPrice)
  writePoolBalanceCache(cacheKey, result)
  return result
}
