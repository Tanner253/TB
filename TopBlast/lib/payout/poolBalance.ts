/**
 * Single source of truth for reward pool size — payout wallet SOL balance on-chain.
 */

import { getPayoutWalletBalance } from '@/lib/solana/transfer'
import { getSolPrice, formatUsd } from '@/lib/solana/price'
import { config } from '@/lib/config'
import { maxDistributableSol } from '@/lib/payout/payoutSecurity'

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
  var _livePoolBalanceCache: { value: LivePoolBalance; expiresAt: number } | undefined
}

function readPoolBalanceCache(): LivePoolBalance | null {
  const hit = global._livePoolBalanceCache
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    global._livePoolBalanceCache = undefined
    return null
  }
  return hit.value
}

function writePoolBalanceCache(value: LivePoolBalance) {
  global._livePoolBalanceCache = {
    value,
    expiresAt: Date.now() + POOL_BALANCE_CACHE_TTL_MS,
  }
}

export function invalidateLivePoolBalanceCache() {
  global._livePoolBalanceCache = undefined
}

export async function getLivePoolBalance(options?: {
  bypassCache?: boolean
}): Promise<LivePoolBalance> {
  if (!options?.bypassCache) {
    const cached = readPoolBalanceCache()
    if (cached) return cached
  }

  const solPrice = (await getSolPrice()) || 150
  const walletBalance = await getPayoutWalletBalance()

  if (!walletBalance) {
    const result: LivePoolBalance = {
      payoutWalletAddress: null,
      walletSol: 0,
      poolSol: 0,
      poolUsd: 0,
      solPrice,
      poolUsdFormatted: formatUsd(0),
      poolSolFormatted: '0.0000',
      walletEth: 0,
      poolEth: 0,
      ethPrice: solPrice,
      poolEthFormatted: '0.0000',
      minLossUsd: 0,
      minLossUsdFormatted: formatUsd(0),
      available: false,
      balanceLookupFailed: false,
    }
    writePoolBalanceCache(result)
    return result
  }

  if (walletBalance.rpcError) {
    const result: LivePoolBalance = {
      payoutWalletAddress: walletBalance.address,
      walletSol: 0,
      poolSol: 0,
      poolUsd: 0,
      solPrice,
      poolUsdFormatted: formatUsd(0),
      poolSolFormatted: '0.0000',
      walletEth: 0,
      poolEth: 0,
      ethPrice: solPrice,
      poolEthFormatted: '0.0000',
      minLossUsd: 0,
      minLossUsdFormatted: formatUsd(0),
      available: false,
      balanceLookupFailed: true,
    }
    writePoolBalanceCache(result)
    return result
  }

  const walletSol = walletBalance.sol
  const poolSol = maxDistributableSol(walletSol)
  const poolUsd = poolSol * solPrice
  const minLossUsd = poolUsd * (config.minLossThresholdPct / 100)

  const result: LivePoolBalance = {
    payoutWalletAddress: walletBalance.address,
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
    available: true,
    balanceLookupFailed: false,
  }
  writePoolBalanceCache(result)
  return result
}
