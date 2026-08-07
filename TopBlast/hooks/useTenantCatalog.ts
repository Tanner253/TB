'use client'

import { useEffect, useState } from 'react'
import type { PublicTenantSummary } from '@/lib/tenant/types'

export function useTenantCatalog() {
  const [tenants, setTenants] = useState<PublicTenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tenants')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setTenants(json.data.tenants || [])
        } else {
          setError(json.error || 'Failed to load listings')
        }
      })
      .catch(() => setError('Failed to load listings'))
      .finally(() => setLoading(false))
  }, [])

  return { tenants, loading, error }
}
