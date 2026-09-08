/**
 * Token icon/banner resolution: DexScreener first, Pump.fun image_uri fallback.
 */

import {
  DEXSCREENER_TOKEN_API,
  selectBestSolanaPair,
  type DexScreenerPairLike,
} from '@/lib/solana/dexscreenerShared'

export interface DexScreenerTokenMedia {
  iconUrl: string | null
  bannerUrl: string | null
  /** Custom DexScreener header / boost — indicates a paid or enhanced profile. */
  dexProfilePaid: boolean
  dexUrl: string | null
}

interface DexScreenerPairInfo {
  imageUrl?: string
  header?: string
  openGraph?: string
}

interface DexScreenerPairWithInfo extends DexScreenerPairLike {
  info?: DexScreenerPairInfo
  boosts?: { active?: number }
}

const EMPTY_MEDIA: DexScreenerTokenMedia = {
  iconUrl: null,
  bannerUrl: null,
  dexProfilePaid: false,
  dexUrl: null,
}

const CACHE_TTL_MS = 5 * 60 * 1000
/** When Dex fetch fails we may still have a Pump icon — retry Dex soon so paid headers appear. */
const DEX_MISS_CACHE_TTL_MS = 30 * 1000
const PUMP_COIN_API = 'https://frontend-api-v3.pump.fun/coins'
const DEX_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'TopBlast/1.0 (+https://topblasted.fun)',
} as const

declare global {
  // eslint-disable-next-line no-var
  var _dexMediaCache: Map<string, { media: DexScreenerTokenMedia; expiresAt: number }> | undefined
}

function mediaCache() {
  if (!global._dexMediaCache) global._dexMediaCache = new Map()
  return global._dexMediaCache
}

export function mediaFromDexScreenerPair(pair: DexScreenerPairWithInfo): DexScreenerTokenMedia {
  const info = pair.info
  const iconUrl = info?.imageUrl?.trim() || info?.openGraph?.trim() || null
  const bannerUrl = info?.header?.trim() || null
  const dexProfilePaid = Boolean(bannerUrl) || (pair.boosts?.active ?? 0) > 0

  return {
    iconUrl,
    bannerUrl,
    dexProfilePaid,
    dexUrl: pair.url?.trim() || null,
  }
}

function pickBestAmong(
  candidates: DexScreenerPairWithInfo[],
  mint: string
): DexScreenerPairWithInfo | null {
  if (candidates.length === 0) return null
  return (
    selectBestSolanaPair(candidates, mint) ??
    candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
  )
}

/** Prefer paid header art, then any icon/OG art, then best priced Solana pair. */
export function selectBestSolanaPairForMedia(
  pairs: DexScreenerPairWithInfo[],
  mint: string
): DexScreenerPairWithInfo | null {
  const solana = pairs.filter(p => p.chainId === 'solana')

  const withHeader = solana.filter(p => Boolean(p.info?.header?.trim()))
  const withHeaderPick = pickBestAmong(withHeader, mint)
  if (withHeaderPick) return withHeaderPick

  const withArt = solana.filter(p => {
    const info = p.info
    return Boolean(info?.imageUrl?.trim() || info?.openGraph?.trim())
  })
  const withArtPick = pickBestAmong(withArt, mint)
  if (withArtPick) return withArtPick

  return selectBestSolanaPair(pairs, mint)
}

/** Parse DexScreener `/tokens/{mint}` JSON into icon + banner (browser-safe). */
export function mediaFromDexScreenerTokenResponse(
  data: { pairs?: DexScreenerPairWithInfo[] } | null | undefined,
  mint: string
): DexScreenerTokenMedia | null {
  const best = selectBestSolanaPairForMedia(data?.pairs ?? [], mint)
  if (!best) return null
  const media = mediaFromDexScreenerPair(best)
  if (!media.iconUrl && !media.bannerUrl) return null
  return media
}

async function fetchDexScreenerOnlyOnce(mint: string): Promise<DexScreenerTokenMedia | null> {
  try {
    const response = await fetch(`${DEXSCREENER_TOKEN_API}/${mint}`, {
      headers: { ...DEX_FETCH_HEADERS },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!response.ok) return null

    const data = (await response.json()) as { pairs?: DexScreenerPairWithInfo[] }
    return mediaFromDexScreenerTokenResponse(data, mint)
  } catch {
    return null
  }
}

async function fetchDexScreenerOnly(mint: string): Promise<DexScreenerTokenMedia | null> {
  const first = await fetchDexScreenerOnlyOnce(mint)
  if (first) return first
  // Brief retry — Vercel often gets transient Dex empty/429 responses.
  await new Promise(resolve => setTimeout(resolve, 250))
  return fetchDexScreenerOnlyOnce(mint)
}

/** Pump.fun coin image when DexScreener has no profile art. */
export async function fetchPumpFunTokenIcon(mint: string): Promise<string | null> {
  try {
    const response = await fetch(`${PUMP_COIN_API}/${mint}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { image_uri?: string; imageUri?: string }
    const uri = data.image_uri?.trim() || data.imageUri?.trim() || null
    return uri || null
  } catch {
    return null
  }
}

/** Icon + banner: DexScreener profile, then Pump.fun image_uri for the icon. */
export async function fetchDexScreenerTokenMedia(
  mint: string
): Promise<DexScreenerTokenMedia | null> {
  const normalized = mint.trim()
  if (!normalized) return null

  const hit = mediaCache().get(normalized)
  if (hit && Date.now() < hit.expiresAt) return hit.media

  const dex = await fetchDexScreenerOnly(normalized)
  let media: DexScreenerTokenMedia = dex
    ? { ...dex }
    : { ...EMPTY_MEDIA, dexUrl: `https://pump.fun/coin/${normalized}` }

  if (!media.iconUrl) {
    const pumpIcon = await fetchPumpFunTokenIcon(normalized)
    if (pumpIcon) {
      media = {
        ...media,
        iconUrl: pumpIcon,
        dexUrl: media.dexUrl || `https://pump.fun/coin/${normalized}`,
      }
    }
  }

  if (!media.iconUrl && !media.bannerUrl) {
    return null
  }

  // Never stick a Dex miss (Pump-only icon, no header) in cache for the full TTL —
  // paid Dex banners would stay missing for minutes after a transient API failure.
  const ttlMs = dex ? CACHE_TTL_MS : DEX_MISS_CACHE_TTL_MS
  mediaCache().set(normalized, { media, expiresAt: Date.now() + ttlMs })
  return media
}

export async function fetchDexScreenerMediaBatch(
  mints: string[]
): Promise<Map<string, DexScreenerTokenMedia>> {
  const unique = Array.from(new Set(mints.map(m => m.trim()).filter(Boolean)))
  const map = new Map<string, DexScreenerTokenMedia>()

  await Promise.all(
    unique.map(async mint => {
      const media = await fetchDexScreenerTokenMedia(mint)
      if (media && (media.iconUrl || media.bannerUrl)) map.set(mint, media)
    })
  )

  return map
}

export function emptyDexScreenerTokenMedia(): DexScreenerTokenMedia {
  return { ...EMPTY_MEDIA }
}
