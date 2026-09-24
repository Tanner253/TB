import 'server-only'

import { formatUnits, type Address } from 'viem'
import { ERC20_ABI, publicClient } from './contracts'
import { isEvmAddress } from './session'
import { withRpcRetry } from '@/lib/evm/retry'

/**
 * Circulating supply, read from the token itself.
 *
 * Used to size the per-payout supply cap, so it has to be the live number
 * rather than a launch-time constant — burns reduce it, and the cap should
 * follow.
 */
export async function totalTokenSupply(mint: string, decimals: number): Promise<number | null> {
  if (!isEvmAddress(mint)) return null
  try {
    const raw = await withRpcRetry(() =>
      publicClient().readContract({
        address: mint as Address,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      })
    )
    const supply = Number(formatUnits(raw as bigint, decimals))
    return Number.isFinite(supply) && supply > 0 ? supply : null
  } catch (err) {
    console.warn('[supply] totalSupply read failed:', err instanceof Error ? err.message.split(String.fromCharCode(10))[0] : err)
    return null
  }
}

const SUPPLY_TTL_MS = 5 * 60_000
const supplyCache = new Map<string, { supply: number; at: number }>()

/**
 * `totalTokenSupply` behind a short cache, for display paths that run on every
 * poll. Supply only moves on a burn, so a few minutes stale is invisible in a
 * market cap, and a failed read falls back to the last good value rather than
 * blanking the figure.
 */
export async function cachedTotalTokenSupply(mint: string, decimals: number): Promise<number | null> {
  const key = mint.toLowerCase()
  const hit = supplyCache.get(key)
  if (hit && Date.now() - hit.at < SUPPLY_TTL_MS) return hit.supply
  const supply = await totalTokenSupply(mint, decimals)
  if (supply == null) return hit?.supply ?? null
  supplyCache.set(key, { supply, at: Date.now() })
  return supply
}
