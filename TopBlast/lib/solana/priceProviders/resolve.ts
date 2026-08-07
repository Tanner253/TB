import type { ResolvedTokenPrice } from './types'
import { fetchDexScreenerPrice } from './dexscreener'
import { fetchJupiterPrice } from './jupiter'
import { fetchHeliusPrice } from './helius'

/** Fresh price fetch for server-side eligibility / cron — no TTL cache. */
export async function resolveTokenPrice(mint: string): Promise<ResolvedTokenPrice | null> {
  const normalizedMint = mint.trim()
  if (!normalizedMint) return null

  const dex = await fetchDexScreenerPrice(normalizedMint)
  if (dex) return dex

  const jup = await fetchJupiterPrice(normalizedMint)
  if (jup) return jup

  return fetchHeliusPrice(normalizedMint)
}
