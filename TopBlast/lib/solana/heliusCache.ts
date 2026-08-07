/**
 * Short-lived in-memory cache for Helius DAS + Enhanced API (serverless-safe).
 * Prevents leaderboard polling from re-fetching the same holders/txs every few seconds.
 */

import type { ParsedTransaction } from '@/lib/solana/helius'

type CacheEntry<T> = { value: T; expiresAt: number }

declare global {
  // eslint-disable-next-line no-var
  var _heliusHolderCache: Map<string, CacheEntry<{ wallet: string; balance: number }[]>> | undefined
  // eslint-disable-next-line no-var
  var _heliusTxCache: Map<string, CacheEntry<ParsedTransaction[]>> | undefined
  // eslint-disable-next-line no-var
  var _heliusIndexThrottle: Map<string, number> | undefined
}

function holderCache() {
  if (!global._heliusHolderCache) global._heliusHolderCache = new Map()
  return global._heliusHolderCache
}

function txCache() {
  if (!global._heliusTxCache) global._heliusTxCache = new Map()
  return global._heliusTxCache
}

function indexThrottle() {
  if (!global._heliusIndexThrottle) global._heliusIndexThrottle = new Map()
  return global._heliusIndexThrottle
}

/** DAS getTokenAccounts — cache 2 minutes per mint. */
export const HOLDER_LIST_TTL_MS = 2 * 60 * 1000

/** Enhanced wallet history — cache 10 minutes per wallet+mint. */
export const WALLET_TX_TTL_MS = 10 * 60 * 1000

/** Minimum gap between full re-index attempts per tenant mint. */
export const INDEX_THROTTLE_MS = 3 * 60 * 1000

function read<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    map.delete(key)
    return null
  }
  return hit.value
}

function write<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function getCachedTokenHolders(mint: string): { wallet: string; balance: number }[] | null {
  return read(holderCache(), `holders:${mint}`)
}

export function setCachedTokenHolders(
  mint: string,
  holders: { wallet: string; balance: number }[],
  ttlMs = HOLDER_LIST_TTL_MS
) {
  write(holderCache(), `holders:${mint}`, holders, ttlMs)
}

export function getCachedWalletTransactions(wallet: string, mint: string): ParsedTransaction[] | null {
  return read(txCache(), `tx:${mint}:${wallet}`)
}

export function setCachedWalletTransactions(
  wallet: string,
  mint: string,
  txs: ParsedTransaction[],
  ttlMs = WALLET_TX_TTL_MS
) {
  write(txCache(), `tx:${mint}:${wallet}`, txs, ttlMs)
}

export function shouldThrottleFullReindex(tenantKey: string): boolean {
  const last = indexThrottle().get(tenantKey) ?? 0
  return Date.now() - last < INDEX_THROTTLE_MS
}

export function markFullReindex(tenantKey: string) {
  indexThrottle().set(tenantKey, Date.now())
}

export function invalidateWalletTxCache(wallet: string, mint: string) {
  txCache().delete(`tx:${mint}:${wallet}`)
}
