'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLiveTokenPrice } from '@/hooks/useLiveTokenPrice'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseRealtimeOptions {
  onTransaction?: (tx: unknown) => void
  onPriceUpdate?: (price: number) => void
  onError?: (error: Error) => void
  autoReconnect?: boolean
}

export function useRealtime(_options: UseRealtimeOptions = {}) {
  return {
    connectionState: 'connected' as ConnectionState,
    connect: () => {},
    disconnect: () => {},
    isConnected: true,
  }
}

function apiPath(tenantSlug: string | undefined, endpoint: string): string {
  if (tenantSlug) {
    return `/api/t/${tenantSlug}/${endpoint.replace(/^\//, '')}`
  }
  return `/api/${endpoint.replace(/^\//, '')}`
}

/** Live DexScreener WebSocket + 1s browser REST fallback — no Helius, no server cache. */
export function useRealtimePrice(_pollInterval?: number, tenantSlug?: string) {
  const live = useLiveTokenPrice(tenantSlug)
  return {
    price: live.price,
    supply: live.marketCap && live.price ? live.marketCap / live.price : null,
    marketCap: live.marketCap,
    priceSource: live.priceSource,
    migrationStage: live.migrationStage,
    connection: live.connection,
    isLive: live.isLive,
    loading: live.loading,
    lastUpdate: live.lastUpdate,
    error: live.error,
    mint: live.mint,
    refresh: () => {},
  }
}

export { useLiveTokenPrice } from '@/hooks/useLiveTokenPrice'

export function useRealtimeLeaderboard(pollInterval = 10000, tenantSlug?: string) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [timerStatus, setTimerStatus] = useState<'waiting' | 'active'>('waiting')
  const countdownRef = useRef<number | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(apiPath(tenantSlug, 'leaderboard'), { cache: 'no-store' })
      const json = await res.json()

      if (json.success) {
        setData(json.data)

        if (json.data.timer_status) {
          setTimerStatus(json.data.timer_status)
        }

        if (json.data.timer_status === 'waiting') {
          countdownRef.current = null
          setCountdown(null)
        } else if (
          json.data.seconds_remaining !== undefined &&
          json.data.seconds_remaining !== null
        ) {
          const serverCountdown = json.data.seconds_remaining
          const localCountdown = countdownRef.current

          if (localCountdown === null || Math.abs(serverCountdown - localCountdown) > 5) {
            countdownRef.current = serverCountdown
            setCountdown(serverCountdown)
          }
        }

        setLastUpdate(new Date())
        setError(null)
      } else {
        setError(json.error)
      }
    } catch {
      setError('Failed to fetch leaderboard')
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, pollInterval)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, pollInterval, tenantSlug])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null
        const newVal = Math.max(0, prev - 1)
        countdownRef.current = newVal
        return newVal
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return {
    data,
    loading,
    error,
    lastUpdate,
    countdown,
    timerStatus,
    refresh: fetchLeaderboard,
  }
}

export function useTimeSince(date: Date | null) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    if (!date) return

    const update = () => {
      setSecondsAgo(Math.floor((Date.now() - date.getTime()) / 1000))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [date])

  return secondsAgo
}
