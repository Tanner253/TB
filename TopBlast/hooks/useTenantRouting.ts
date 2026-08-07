'use client'

import { useParams } from 'next/navigation'

export function useTenantRouting() {
  const params = useParams()
  const slug = typeof params?.slug === 'string' ? params.slug : undefined
  const basePath = slug ? `/${slug}` : ''

  function apiPath(endpoint: string): string {
    if (slug) {
      return `/api/t/${slug}/${endpoint.replace(/^\//, '')}`
    }
    return `/api/${endpoint.replace(/^\//, '')}`
  }

  return { slug, basePath, apiPath }
}
