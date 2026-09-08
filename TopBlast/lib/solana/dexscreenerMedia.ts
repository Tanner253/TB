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
const PUMP_COIN_API = 'https://frontend-api-v3.pump.fun/coins'

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

/** Prefer a Solana pair that actually has icon/banner metadata. */
export function selectBestSolanaPairForMedia(
  pairs: DexScreenerPairWithInfo[],
  mint: string
): DexScreenerPairWithInfo | null {
  const withArt = pairs.filter(p => {
    if (p.chainId !== 'solana') return false
    const info = p.info
    return Boolean(info?.imageUrl?.trim() || info?.header?.trim() || info?.openGraph?.trim())
  })

  if (withArt.length > 0) {
    return (
      selectBestSolanaPair(withArt, mint) ??
      withArt.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    )
  }

  return selectBestSolanaPair(pairs, mint)
}

async function fetchDexScreenerOnly(mint: string): Promise<DexScreenerTokenMedia | null> {
  try {
    const response = await fetch(`${DEXSCREENER_TOKEN_API}/${mint}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null

    const data = (await response.json()) as { pairs?: DexScreenerPairWithInfo[] }
    const best = selectBestSolanaPairForMedia(data.pairs ?? [], mint)
    if (!best) return null
    return mediaFromDexScreenerPair(best)
  } catch {
    return null
  }
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

  mediaCache().set(normalized, { media, expiresAt: Date.now() + CACHE_TTL_MS })
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
