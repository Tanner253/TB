/**
 * Liquidity pool / AMM addresses must never rank or receive loss-mining payouts.
 * Sources: Pump.fun bonding-curve PDA, DexScreener pair addresses for the mint.
 */

import axios from 'axios'
import { PublicKey } from '@solana/web3.js'
import {
  DEXSCREENER_TOKEN_API,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

/** Pump.fun program (mainnet) */
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

const CACHE_TTL_MS = 15 * 60 * 1000
const LIQUIDITY_POOL_REASON = 'Liquidity pool excluded'

type PoolCacheEntry = {
  addresses: Set<string>
  fetchedAt: number
}

const poolCacheByMint = new Map<string, PoolCacheEntry>()

export function getLiquidityPoolExclusionReason(): string {
  return LIQUIDITY_POOL_REASON
}

/** Pump.fun bonding-curve PDA for a mint (pre-migration pool). */
export function derivePumpBondingCurveAddress(mint: string): string | null {
  try {
    const mintPk = new PublicKey(mint.trim())
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPk.toBuffer()],
      PUMP_PROGRAM_ID
    )
    return bondingCurve.toBase58()
  } catch {
    return null
  }
}

export async function refreshLiquidityPoolAddresses(mint: string): Promise<Set<string>> {
  const normalizedMint = mint.trim()
  const addresses = new Set<string>()

  const bondingCurve = derivePumpBondingCurveAddress(normalizedMint)
  if (bondingCurve) {
    addresses.add(bondingCurve)
  }

  try {
    const response = await axios.get(`${DEXSCREENER_TOKEN_API}/${normalizedMint}`, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    })
    const pairs: DexScreenerPairLike[] = response.data?.pairs ?? []
    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue
      if (pair.pairAddress) {
        addresses.add(pair.pairAddress)
      }
    }
  } catch {
    // DexScreener optional — bonding-curve PDA still applies for Pump tokens
  }

  poolCacheByMint.set(normalizedMint, { addresses, fetchedAt: Date.now() })
  return addresses
}

export function getCachedLiquidityPoolAddresses(mint: string): Set<string> {
  return poolCacheByMint.get(mint.trim())?.addresses ?? new Set()
}

export async function ensureLiquidityPoolAddresses(mint: string): Promise<Set<string>> {
  const normalizedMint = mint.trim()
  const cached = poolCacheByMint.get(normalizedMint)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.addresses
  }
  return refreshLiquidityPoolAddresses(normalizedMint)
}

export function isLiquidityPoolWallet(wallet: string, mint?: string): boolean {
  if (!wallet) return false

  if (mint) {
    return getCachedLiquidityPoolAddresses(mint).has(wallet)
  }

  for (const entry of poolCacheByMint.values()) {
    if (entry.addresses.has(wallet)) return true
  }
  return false
}

export function resetLiquidityPoolCache(mint?: string): void {
  if (mint) {
    poolCacheByMint.delete(mint.trim())
    return
  }
  poolCacheByMint.clear()
}
