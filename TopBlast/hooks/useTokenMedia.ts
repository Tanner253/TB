'use client'

import { useEffect, useState } from 'react'
import {
  mediaFromDexScreenerTokenResponse,
  type DexScreenerTokenMedia,
} from '@/lib/solana/dexscreenerMedia'
import { DEXSCREENER_TOKEN_API } from '@/lib/solana/dexscreenerShared'

/**
 * Browser → DexScreener (CORS open) so paid `info.header` banners load even when
 * the server-side Dex fetch is rate-limited / empty. Falls back to `/api/token-media`
 * for Pump.fun icons when Dex has no art.
 */
async function fetchClientDexMedia(mint: string): Promise<DexScreenerTokenMedia | null> {
  const res = await fetch(`${DEXSCREENER_TOKEN_API}/${mint}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return mediaFromDexScreenerTokenResponse(data, mint)
}

async function fetchServerTokenMedia(mint: string): Promise<DexScreenerTokenMedia | null> {
  const res = await fetch(`/api/token-media?mint=${encodeURIComponent(mint)}`, {
    cache: 'no-store',
  })
  const json = await res.json()
  if (json?.success && json.data) return json.data as DexScreenerTokenMedia
  return null
}

function mergeMedia(
  primary: DexScreenerTokenMedia | null,
  fallback: DexScreenerTokenMedia | null
): DexScreenerTokenMedia | null {
  if (!primary && !fallback) return null
  if (!primary) return fallback
  if (!fallback) return primary
  return {
    iconUrl: primary.iconUrl || fallback.iconUrl,
    bannerUrl: primary.bannerUrl || fallback.bannerUrl,
    dexProfilePaid: primary.dexProfilePaid || fallback.dexProfilePaid,
    dexUrl: primary.dexUrl || fallback.dexUrl,
  }
}

export function useTokenMedia(mint: string | null | undefined) {
  const [media, setMedia] = useState<DexScreenerTokenMedia | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const normalized = mint?.trim()
    if (!normalized) {
      setMedia(null)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const dexMedia = await fetchClientDexMedia(normalized).catch(() => null)
        if (cancelled) return

        // Paid Dex header is authoritative — show it immediately.
        if (dexMedia?.bannerUrl || dexMedia?.iconUrl) {
          setMedia(dexMedia)
          // Fill missing icon from server (Pump) without waiting to paint the banner.
          if (!dexMedia.iconUrl) {
            const serverMedia = await fetchServerTokenMedia(normalized).catch(() => null)
            if (!cancelled && serverMedia) {
              setMedia(mergeMedia(dexMedia, serverMedia))
            }
          }
          return
        }

        const serverMedia = await fetchServerTokenMedia(normalized).catch(() => null)
        if (!cancelled) setMedia(serverMedia)
      } catch {
        if (!cancelled) setMedia(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mint])

  return { media, loading }
}
