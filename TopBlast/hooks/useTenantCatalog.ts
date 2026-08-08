'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicTenantSummary } from '@/lib/tenant/types'

const CATALOG_POLL_MS = 15_000

export function useTenantCatalog() {
  const [tenants, setTenants] = useState<PublicTenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        setTenants(json.data.tenants || [])
        setError(null)
      } else {
        setError(json.error || 'Failed to load listings')
      }
    } catch {
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTenants()
    const interval = setInterval(fetchTenants, CATALOG_POLL_MS)
    return () => clearInterval(interval)
  }, [fetchTenants])

  return { tenants, loading, error, refresh: fetchTenants }
}
