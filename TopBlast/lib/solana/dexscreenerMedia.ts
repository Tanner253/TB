import axios from 'axios'
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
  const iconUrl = info?.imageUrl?.trim() || null
  const bannerUrl = info?.header?.trim() || null
  const dexProfilePaid = Boolean(bannerUrl) || (pair.boosts?.active ?? 0) > 0

  return {
    iconUrl,
    bannerUrl,
    dexProfilePaid,
    dexUrl: pair.url?.trim() || null,
  }
}

/** Icon + banner from DexScreener's best Solana pair for a mint (cached ~5 min). */
export async function fetchDexScreenerTokenMedia(
  mint: string
): Promise<DexScreenerTokenMedia | null> {
  const normalized = mint.trim()
  if (!normalized) return null

  const hit = mediaCache().get(normalized)
  if (hit && Date.now() < hit.expiresAt) return hit.media

  try {
    const response = await axios.get(`${DEXSCREENER_TOKEN_API}/${normalized}`, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    })

    const pairs = (response.data?.pairs ?? []) as DexScreenerPairWithInfo[]
    const best = selectBestSolanaPair(pairs, normalized)
    if (!best) return null

    const media = mediaFromDexScreenerPair(best as DexScreenerPairWithInfo)
    mediaCache().set(normalized, { media, expiresAt: Date.now() + CACHE_TTL_MS })
    return media
  } catch {
    return null
  }
}

export async function fetchDexScreenerMediaBatch(
  mints: string[]
): Promise<Map<string, DexScreenerTokenMedia>> {
  const unique = [...new Set(mints.map(m => m.trim()).filter(Boolean))]
  const map = new Map<string, DexScreenerTokenMedia>()

  await Promise.all(
    unique.map(async mint => {
      const media = await fetchDexScreenerTokenMedia(mint)
      if (media) map.set(mint, media)
    })
  )

  return map
}

export function emptyDexScreenerTokenMedia(): DexScreenerTokenMedia {
  return { ...EMPTY_MEDIA }
}
