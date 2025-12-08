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
// Polls at fixed interval, countdown runs locally between syncs
export function useRealtimeLeaderboard(pollInterval = 10000) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<number | null>(null) // Track countdown without re-renders
  const lastServerCountdown = useRef<number | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const json = await res.json()
      
      if (json.success) {
        // Only update data if rankings actually changed (prevents re-renders)
        setData((prev: any) => {
          // If no previous data, set it
          if (!prev) return json.data
          
          // Check if rankings changed (compare wallet addresses)
          const prevWallets = prev.rankings?.map((r: any) => r.wallet).join(',') || ''
          const newWallets = json.data.rankings?.map((r: any) => r.wallet).join(',') || ''
          
          // Only update if something meaningful changed
          if (prevWallets !== newWallets || 
              prev.status !== json.data.status ||
              prev.eligible_count !== json.data.eligible_count) {
            return json.data
          }
          
          // Update non-visual fields without causing re-render of rankings
          return { ...prev, ...json.data, rankings: prev.rankings }
        })
        
        // Sync countdown from server - only if significantly different (>5 seconds)
        // This prevents small timing drifts from causing jumps
        if (json.data.seconds_remaining !== undefined) {
          const serverCountdown = json.data.seconds_remaining
          const localCountdown = countdownRef.current
          
          // First sync or significant drift (>5 seconds difference)
          if (localCountdown === null || Math.abs(serverCountdown - localCountdown) > 5) {
            countdownRef.current = serverCountdown
            setCountdown(serverCountdown)
            lastServerCountdown.current = serverCountdown
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
  }, [])

  // Initial fetch and fixed polling interval
  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, pollInterval)
    return () => clearInterval(interval)
  }, [fetchLeaderboard, pollInterval])

  // Local countdown timer - decrements every second, syncs from server periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
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
    countdown: countdown ?? 0,
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
