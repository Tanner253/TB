import 'server-only'

import { formatUnits, type Address } from 'viem'
import { ERC20_ABI, publicClient } from './contracts'
import { isEvmAddress } from './session'

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
    const raw = await publicClient().readContract({
      address: mint as Address,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
    })
    const supply = Number(formatUnits(raw as bigint, decimals))
    return Number.isFinite(supply) && supply > 0 ? supply : null
  } catch {
    return null
  }
}
