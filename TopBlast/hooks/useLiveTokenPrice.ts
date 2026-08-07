'use client'

import { useEffect, useState, useRef } from 'react'
import type { LivePriceConnection } from '@/lib/solana/clientPriceStream'
import { startLivePriceStream } from '@/lib/solana/clientPriceStream'
import type { LivePriceSnapshot } from '@/lib/solana/dexscreenerShared'

function statsPath(tenantSlug?: string): string {
  return tenantSlug ? `/api/t/${tenantSlug}/stats` : '/api/stats'
}

/**
 * Live token price via browser WebSocket (DexScreener) with 1s REST fallback.
 * Does not hit Helius RPC. Does not use server-side caching.
 */
export function useLiveTokenPrice(tenantSlug?: string, mintOverride?: string) {
  const [price, setPrice] = useState<number | null>(null)
  const [marketCap, setMarketCap] = useState<number | null>(null)
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null)
  const [migrationStage, setMigrationStage] = useState<string | null>(null)
  const [priceSource, setPriceSource] = useState<string | null>(null)
  const [connection, setConnection] = useState<LivePriceConnection>('connecting')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mint, setMint] = useState<string | null>(mintOverride?.trim() || null)

  const streamRef = useRef<ReturnType<typeof startLivePriceStream> | null>(null)

  useEffect(() => {
    if (mintOverride?.trim()) {
      setMint(mintOverride.trim())
      return
    }

    let cancelled = false
    fetch(statsPath(tenantSlug), { cache: 'no-store' })
      .then(res => res.json())
      .then(json => {
        if (cancelled) return
        const resolvedMint = json?.data?.token?.mint
        if (resolvedMint) setMint(resolvedMint)
        else setError('Token mint not configured for this listing')
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load token mint')
      })

    return () => {
      cancelled = true
    }
  }, [tenantSlug, mintOverride])

  useEffect(() => {
    if (!mint) return

    streamRef.current?.close()
    setLoading(true)
    setError(null)

    streamRef.current = startLivePriceStream(mint, {
      onUpdate: (snap: LivePriceSnapshot) => {
        setPrice(snap.price)
        setMarketCap(snap.marketCap)
        setPriceChange24h(snap.priceChange24h)
        setMigrationStage(snap.migrationStage)
        setPriceSource(snap.source)
        setLastUpdate(new Date())
        setLoading(false)
        setError(null)
      },
      onConnectionChange: setConnection,
      onError: msg => {
        setError(msg)
        setLoading(false)
      },
    })

    return () => {
      streamRef.current?.close()
      streamRef.current = null
    }
  }, [mint])

  return {
    price,
    marketCap,
    priceChange24h,
    migrationStage,
    priceSource,
    connection,
    isLive: connection === 'websocket' || connection === 'polling',
    loading,
    lastUpdate,
    error,
    mint,
  }
}
