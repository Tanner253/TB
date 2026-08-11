'use client'

import { useEffect, useState } from 'react'
import type { DexScreenerTokenMedia } from '@/lib/solana/dexscreenerMedia'

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

    fetch(`/api/token-media?mint=${encodeURIComponent(normalized)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        if (json?.success && json.data) {
          setMedia(json.data as DexScreenerTokenMedia)
        } else {
          setMedia(null)
        }
      })
      .catch(() => {
        if (!cancelled) setMedia(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mint])

  return { media, loading }
}
