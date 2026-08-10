/**
 * Birdeye token holder snapshots — one paginated call per 100 wallets (by CA).
 * @see https://docs.birdeye.so/reference/get-defi-v3-token-holder
 */

import axios from 'axios'
import { mapBirdeyeWalletHolderRow, type BirdeyeWalletHolderRow } from '@/lib/solana/birdeyeHolderMapping'

const BASE_URL = 'https://public-api.birdeye.so'

export function isBirdeyeHolderSourceEnabled(): boolean {
  return Boolean(process.env.BIRDEYE_API_KEY?.trim())
}

function getApiKey(): string {
  const key = process.env.BIRDEYE_API_KEY?.trim()
  if (!key) throw new Error('BIRDEYE_API_KEY is required')
  return key
}

export interface BirdeyeHolderSnapshot {
  wallet: string
  balance: number
  vwap: number | null
  firstBuyTimestamp: number | null
  hasSold: boolean
  hasTransferIn: boolean
  drawdownPct: number | null
  lossUsd: number | null
}

export interface FetchBirdeyeHoldersResult {
  holders: BirdeyeHolderSnapshot[]
  apiCalls: number
  totalReported: number | null
}

const REPORTED_HOLDER_COUNT_CACHE_TTL_MS = 5 * 60 * 1000

declare global {
  // eslint-disable-next-line no-var
  var _birdeyeReportedHolderCountCache: Map<string, { count: number; expiresAt: number }> | undefined
}

function reportedHolderCountCache() {
  if (!global._birdeyeReportedHolderCountCache) {
    global._birdeyeReportedHolderCountCache = new Map()
  }
  return global._birdeyeReportedHolderCountCache
}

/** True CA holder count from Birdeye — one lightweight call (limit=1), cached 5 min. */
export async function fetchBirdeyeReportedHolderCount(mint: string): Promise<number | null> {
  if (!isBirdeyeHolderSourceEnabled()) return null
  const normalized = mint.trim()
  if (!normalized) return null

  const cached = reportedHolderCountCache().get(normalized)
  if (cached && Date.now() < cached.expiresAt) return cached.count

  try {
    const response = await axios.get(`${BASE_URL}/defi/v3/token/holder`, {
      params: {
        address: normalized,
        mode: 'wallet',
        offset: 0,
        limit: 1,
        ui_amount_mode: 'scaled',
      },
      headers: {
        'X-API-KEY': getApiKey(),
        'x-chain': 'solana',
      },
      timeout: 15000,
      validateStatus: s => s === 200 || s === 429,
    })

    if (response.status !== 200) return cached?.count ?? null

    const count = response.data?.data?.holder
    if (typeof count === 'number' && count > 0) {
      reportedHolderCountCache().set(normalized, {
        count,
        expiresAt: Date.now() + REPORTED_HOLDER_COUNT_CACHE_TTL_MS,
      })
      return count
    }
  } catch (err) {
    console.warn('[Birdeye] Failed to fetch reported holder count:', (err as Error).message)
  }

  return cached?.count ?? null
}

/** Legacy Mongo rows stored indexed batch size (50) in totalHolders — not the CA total. */
export function isStaleReportedHolderCount(dbRankings: {
  reportedHolderCount?: number
  totalHolders?: number
  rankings?: unknown[]
} | null): boolean {
  if (!dbRankings) return true
  const ranked = dbRankings.rankings?.length ?? 0
  const reported = dbRankings.reportedHolderCount ?? 0
  if (reported > ranked) return false
  return true
}

export async function resolveReportedHolderCount(
  mint: string,
  dbRankings: {
    reportedHolderCount?: number
    totalHolders?: number
    rankings?: unknown[]
  } | null
): Promise<number> {
  const ranked = dbRankings?.rankings?.length ?? 0
  const fromDb = dbRankings?.reportedHolderCount ?? 0
  if (fromDb > ranked) return fromDb

  if (isBirdeyeHolderSourceEnabled() && mint.trim()) {
    const live = await fetchBirdeyeReportedHolderCount(mint)
    if (live != null) return live
  }

  if (fromDb > 0) return fromDb
  return dbRankings?.totalHolders ?? ranked
}

export async function fetchBirdeyeTokenHolders(
  mint: string,
  options?: {
    maxHolders?: number
    tokenPrice?: number | null
    pageDelayMs?: number
  }
): Promise<FetchBirdeyeHoldersResult> {
  const apiKey = getApiKey()
  const maxHolders = options?.maxHolders ?? 500
  const pageDelayMs = options?.pageDelayMs ?? 0
  const holders: BirdeyeHolderSnapshot[] = []
  let offset = 0
  let apiCalls = 0
  let totalReported: number | null = null

  while (holders.length < maxHolders) {
    const response = await axios.get(`${BASE_URL}/defi/v3/token/holder`, {
      params: {
        address: mint,
        mode: 'wallet',
        offset,
        limit: 100,
        ui_amount_mode: 'scaled',
      },
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
      timeout: 25000,
      validateStatus: s => s === 200 || s === 429,
    })

    apiCalls++

    if (response.status === 429) {
      console.warn('[Birdeye] Rate limited on token/holder')
      break
    }

    if (response.status !== 200) {
      throw new Error(`Birdeye token/holder HTTP ${response.status}`)
    }

    const data = response.data?.data
    const items = (data?.items ?? []) as BirdeyeWalletHolderRow[]
    if (totalReported == null && typeof data?.holder === 'number') {
      totalReported = data.holder
    }

    if (items.length === 0) break

    for (const row of items) {
      const mapped = mapBirdeyeWalletHolderRow(row, options?.tokenPrice ?? null)
      if (!mapped.wallet) continue

      const hasTransferIn = !mapped.vwap && mapped.balance > 0
      holders.push({
        wallet: mapped.wallet,
        balance: mapped.balance,
        vwap: mapped.vwap,
        firstBuyTimestamp: mapped.firstBuyTimestamp,
        hasSold: mapped.hasSold,
        hasTransferIn,
        drawdownPct: mapped.drawdownPct,
        lossUsd: mapped.lossUsd,
      })
    }

    offset += items.length
    if (items.length < 100) break
    if (pageDelayMs > 0) {
      await new Promise(r => setTimeout(r, pageDelayMs))
    }
  }

  return {
    holders: holders.slice(0, maxHolders),
    apiCalls,
    totalReported,
  }
}
