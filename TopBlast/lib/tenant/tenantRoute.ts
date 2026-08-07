import { NextRequest, NextResponse } from 'next/server'
import { withTenantRoute } from '@/lib/tenant/withTenantRoute'

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<NextResponse>

export function tenantRoute(handler: RouteHandler) {
  return async (request: NextRequest, context: { params: { slug: string } }) => {
    const result = await withTenantRoute(context.params.slug, () =>
      handler(request, context)
    )
    return result as NextResponse
  }
}
