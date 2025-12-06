'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseRealtimeOptions {
  onTransaction?: (tx: any) => void
  onPriceUpdate?: (price: number) => void
  onError?: (error: Error) => void
  autoReconnect?: boolean
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    // Don't reconnect if already connected or connecting
    if (eventSourceRef.current?.readyState === EventSource.OPEN ||
        eventSourceRef.current?.readyState === EventSource.CONNECTING) {
      return
    }

    setConnectionState('connecting')

    try {
      const eventSource = new EventSource('/api/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setConnectionState('connected')
        reconnectAttempts.current = 0
      }

      eventSource.addEventListener('connected', () => {
        setConnectionState('connected')
      })

      eventSource.addEventListener('transaction', (event) => {
        try {
          const data = JSON.parse(event.data)
          options.onTransaction?.(data)
        } catch {}
      })

      eventSource.addEventListener('price', (event) => {
        try {
          const data = JSON.parse(event.data)
          options.onPriceUpdate?.(data.price)
        } catch {}
      })

      eventSource.addEventListener('ping', () => {
        // Keep-alive received, connection is healthy
      })

      eventSource.onerror = () => {
        setConnectionState('error')
        eventSource.close()
        eventSourceRef.current = null

        // Exponential backoff reconnect
        if (options.autoReconnect !== false && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectAttempts.current++
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    } catch (error) {
      setConnectionState('error')
      options.onError?.(error as Error)
    }
  }, [options])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnectionState('disconnected')
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, []) // Only run once on mount

  return {
    connectionState,
    connect,
    disconnect,
    isConnected: connectionState === 'connected',
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
export function useRealtimeLeaderboard(pollInterval = 15000) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(3600)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const json = await res.json()
      
      if (json.success) {
        setData(json.data)
        setCountdown(json.data.seconds_remaining)
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
      setCountdown((prev) => (prev <= 0 ? 3600 : prev - 1))
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
