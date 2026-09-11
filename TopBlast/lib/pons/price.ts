import { getV1Launch, V3_ABI } from './v1'
import 'server-only'
import axios from 'axios'
import { formatUnits } from 'viem'
import { config } from '@/lib/config'
import { ERC20_ABI, publicClient } from './contracts'
import { getCurveState, getPonsLaunch } from './launch'
import type { ResolvedTokenPrice } from '@/lib/solana/priceProviders/types'
let nativeCache: { price: number; at: number } | null = null
export function cachedEthPrice() { return nativeCache?.price ?? null }
export async function ethPrice(): Promise<number | null> {
  if (nativeCache && Date.now() - nativeCache.at < 60_000) return nativeCache.price
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', { params: { ids: 'ethereum', vs_currencies: 'usd' }, timeout: 10_000 })
    const price = Number(data?.ethereum?.usd)
    if (price > 0 && Number.isFinite(price)) { nativeCache = { price, at: Date.now() }; return price }
  } catch {}
  return null
}
export async function resolvedPrice(mint = config.tokenMint): Promise<ResolvedTokenPrice | null> {
  const launch = await getPonsLaunch(mint)
  if (!launch) {
    const v1 = await getV1Launch(mint)
    if (!v1?.nativeQuote) return null
    const [slot, eth, decimals, supply] = await Promise.all([
      publicClient().readContract({ address: v1.pool, abi: V3_ABI, functionName: 'slot0' }), ethPrice(),
      publicClient().readContract({ address: v1.token, abi: ERC20_ABI, functionName: 'decimals' }),
      publicClient().readContract({ address: v1.token, abi: ERC20_ABI, functionName: 'totalSupply' }),
    ])
    if (!eth || slot[0] <= 0n) return null
    const ratio = (Number(slot[0]) / 2 ** 96) ** 2
    const price = (v1.isToken0 ? ratio : 1 / ratio) * 10 ** (Number(decimals) - 18) * eth
    return { mint, price, marketCap: price * Number(formatUnits(supply, decimals)), volume24h: null, priceChange24h: null,
      source: 'pons', pair: null, fetchedAt: Date.now() }
  }
  if (!launch.nativeQuote) return null
  if (launch.onCurve) {
    const [state, eth, decimals, supply] = await Promise.all([
      getCurveState(launch.curve), ethPrice(),
      publicClient().readContract({ address: launch.token, abi: ERC20_ABI, functionName: 'decimals' }),
      publicClient().readContract({ address: launch.token, abi: ERC20_ABI, functionName: 'totalSupply' }),
    ])
    if (!state || !eth || state.tokenReserve <= 0n) return null
    const price = Number(formatUnits(state.quoteReserve, 18)) / Number(formatUnits(state.tokenReserve, decimals)) * eth
    return { mint, price, marketCap: price * Number(formatUnits(supply, decimals)), volume24h: null, priceChange24h: null, source: 'pons', pair: null, fetchedAt: Date.now() }
  }
  const { data } = await axios.get('https://api.dexscreener.com/latest/dex/tokens/' + mint, { timeout: 10_000 })
  const pair = (data?.pairs ?? []).filter((p: any) => p.chainId === 'robinhood' && p.baseToken?.address?.toLowerCase() === mint.toLowerCase() && Number(p.priceUsd) > 0)
    .sort((a: any,b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
  if (!pair) return null
  return { mint, price: Number(pair.priceUsd), marketCap: pair.marketCap ?? null, volume24h: pair.volume?.h24 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null, source: 'dexscreener', pair: null, fetchedAt: Date.now() }
}
