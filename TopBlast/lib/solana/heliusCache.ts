/**
 * Short-lived in-memory cache for Helius DAS + Enhanced API (serverless-safe).
 * Prevents leaderboard polling from re-fetching the same holders/txs every few seconds.
 */

import type { ParsedTransaction } from '@/lib/solana/helius'
import { tenantCacheKey } from '@/lib/tenant/tenantCacheKey'

type CacheEntry<T> = { value: T; expiresAt: number }
type HolderRow = { wallet: string; balance: number }

declare global {
  // eslint-disable-next-line no-var
  var _heliusHolderCache: Map<string, CacheEntry<HolderRow[]>> | undefined
  // eslint-disable-next-line no-var
  var _heliusHolderStale: Map<string, HolderRow[]> | undefined
  // eslint-disable-next-line no-var
  var _heliusHolderLastFetch: Map<string, number> | undefined
  // eslint-disable-next-line no-var
  var _heliusTxCache: Map<string, CacheEntry<ParsedTransaction[]>> | undefined
  // eslint-disable-next-line no-var
  var _heliusIndexThrottle: Map<string, number> | undefined
}

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** DAS getTokenAccounts — serve cached holder list without re-fetching Helius. */
export const HOLDER_LIST_TTL_MS = parsePositiveMs(
  process.env.HELIUS_HOLDER_CACHE_TTL_MS,
  3 * 60 * 1000
)

/** Minimum gap between Helius holder-list network fetches per mint (any cause). */
export const HOLDER_HELIUS_MIN_FETCH_MS = parsePositiveMs(
  process.env.HELIUS_HOLDER_MIN_FETCH_MS,
  60 * 1000
)

/** Cooldown for manual ?refresh=1 cache busts (prevents button spam). */
export const HOLDER_FORCE_REFRESH_COOLDOWN_MS = parsePositiveMs(
  process.env.HELIUS_HOLDER_FORCE_REFRESH_COOLDOWN_MS,
  60 * 1000
)

/** Enhanced wallet history — cache 10 minutes per tenant+wallet+mint. */
export const WALLET_TX_TTL_MS = 10 * 60 * 1000

/** Minimum gap between full re-index attempts per tenant mint. */
export const INDEX_THROTTLE_MS = 3 * 60 * 1000

function holderCache() {
  if (!global._heliusHolderCache) global._heliusHolderCache = new Map()
  return global._heliusHolderCache
}

function staleHolderCache() {
  if (!global._heliusHolderStale) global._heliusHolderStale = new Map()
  return global._heliusHolderStale
}

function holderLastFetchMap() {
  if (!global._heliusHolderLastFetch) global._heliusHolderLastFetch = new Map()
  return global._heliusHolderLastFetch
}

function txCache() {
  if (!global._heliusTxCache) global._heliusTxCache = new Map()
  return global._heliusTxCache
}

function indexThrottle() {
  if (!global._heliusIndexThrottle) global._heliusIndexThrottle = new Map()
  return global._heliusIndexThrottle
}

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

export function getCachedTokenHolders(mint: string): HolderRow[] | null {
  return read(holderCache(), tenantCacheKey('holders', mint))
}

/** Last good holder list — used when fetch cooldown blocks a new Helius call. */
export function getStaleTokenHolders(mint: string): HolderRow[] | null {
  const key = tenantCacheKey('holders', mint)
  return getCachedTokenHolders(mint) ?? staleHolderCache().get(key) ?? null
}

export function setCachedTokenHolders(
  mint: string,
  holders: HolderRow[],
  ttlMs = HOLDER_LIST_TTL_MS
) {
  const key = tenantCacheKey('holders', mint)
  write(holderCache(), key, holders, ttlMs)
  staleHolderCache().set(key, holders)
  markHolderFetch(mint)
}

export function markHolderFetch(mint: string) {
  holderLastFetchMap().set(tenantCacheKey('holders-fetch', mint), Date.now())
}

export function getHolderFetchCooldownRemaining(mint: string): number {
  const last = holderLastFetchMap().get(tenantCacheKey('holders-fetch', mint)) ?? 0
  return Math.max(0, HOLDER_HELIUS_MIN_FETCH_MS - (Date.now() - last))
}

export function getHolderLastFetchAt(mint: string): number | null {
  return holderLastFetchMap().get(tenantCacheKey('holders-fetch', mint)) ?? null
}

export function getHolderCacheExpiresAt(mint: string): number | null {
  const key = tenantCacheKey('holders', mint)
  const hit = holderCache().get(key)
  return hit?.expiresAt ?? null
}

export interface HolderRefreshAttempt {
  allowed: boolean
  retryAfterMs: number
}

/** Manual refresh — bust holder cache only if force-refresh cooldown elapsed. */
export function tryInvalidateTokenHoldersCache(mint: string): HolderRefreshAttempt {
  const forceKey = tenantCacheKey('holders-force', mint)
  const lastForce = indexThrottle().get(forceKey) ?? 0
  const elapsed = Date.now() - lastForce
  if (elapsed < HOLDER_FORCE_REFRESH_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterMs: HOLDER_FORCE_REFRESH_COOLDOWN_MS - elapsed,
    }
  }
  holderCache().delete(tenantCacheKey('holders', mint))
  indexThrottle().set(forceKey, Date.now())
  return { allowed: true, retryAfterMs: 0 }
}

export function invalidateTokenHoldersCache(mint: string) {
  holderCache().delete(tenantCacheKey('holders', mint))
}

export function getCachedWalletTransactions(wallet: string, mint: string): ParsedTransaction[] | null {
  return read(txCache(), tenantCacheKey('tx', mint, wallet))
}

export function setCachedWalletTransactions(
  wallet: string,
  mint: string,
  txs: ParsedTransaction[],
  ttlMs = WALLET_TX_TTL_MS
) {
  write(txCache(), tenantCacheKey('tx', mint, wallet), txs, ttlMs)
}

export function shouldThrottleFullReindex(tenantKey: string): boolean {
  const last = indexThrottle().get(tenantCacheKey('reindex', tenantKey)) ?? 0
  return Date.now() - last < INDEX_THROTTLE_MS
}

export function markFullReindex(tenantKey: string) {
  indexThrottle().set(tenantCacheKey('reindex', tenantKey), Date.now())
}

export function invalidateWalletTxCache(wallet: string, mint: string) {
  txCache().delete(tenantCacheKey('tx', mint, wallet))
}

export function invalidateWalletTxCaches(wallets: string[], mint: string) {
  for (const wallet of wallets) {
    invalidateWalletTxCache(wallet, mint)
  }
}
