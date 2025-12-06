'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseRealtimeOptions {
  onTransaction?: (tx: any) => void
  onPriceUpdate?: (price: number) => void
  onError?: (error: Error) => void
  autoReconnect?: boolean
}

/**
 * Real-time connection hook
 * NOTE: SSE/WebSocket disabled for serverless compatibility
 * Uses polling via useRealtimeLeaderboard and useRealtimePrice instead
 */
export function useRealtime(options: UseRealtimeOptions = {}) {
  // Always return "connected" since we're using polling
  // SSE/WebSocket don't work on Vercel serverless
  return {
    connectionState: 'connected' as ConnectionState,
    connect: () => {},
    disconnect: () => {},
    isConnected: true,
  }
}

// Hook for real-time price updates with polling
export function useRealtimePrice(pollInterval = 10000) {
  const [price, setPrice] = useState<number | null>(null)
  const [supply, setSupply] = useState<number | null>(null)
  const [marketCap, setMarketCap] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/realtime/price')
      const json = await res.json()
      
      if (json.success) {
        setPrice(json.data.price)
        setSupply(json.data.supply)
        setMarketCap(json.data.market_cap)
        setLastUpdate(new Date())
        setError(null)
      } else {
        setError(json.error)
      }
    } catch {
      setError('Failed to fetch price')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrice()
    const interval = setInterval(fetchPrice, pollInterval)
    return () => clearInterval(interval)
  }, [fetchPrice, pollInterval])

  return {
    price,
    supply,
    marketCap,
    loading,
    lastUpdate,
    error,
    refresh: fetchPrice,
  }
}

// Hook for real-time leaderboard data
export function useRealtimeLeaderboard(pollInterval = 10000) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(300) // 5 minutes default

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const json = await res.json()
      
      if (json.success) {
        setData(json.data)
        if (json.data.seconds_remaining !== undefined) {
          setCountdown(json.data.seconds_remaining)
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
  }, [])

  // Fetch data on interval
  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, pollInterval)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, pollInterval])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 300 : prev - 1)) // Reset to 5 min
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return {
    data,
    loading,
    error,
    lastUpdate,
    countdown,
    refresh: fetchLeaderboard,
  }
}

// Hook to track time since last update
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
