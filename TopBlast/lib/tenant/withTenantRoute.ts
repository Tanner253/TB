import { NextResponse } from 'next/server'
import { runWithTenant } from './context'
import { resolveTenantRuntime } from './service'

export async function withTenantRoute<T>(
  slug: string,
  handler: () => Promise<T>
): Promise<T | NextResponse> {
  const runtime = await resolveTenantRuntime(slug)
  if (!runtime) {
    return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
  }
  return runWithTenant(runtime, handler)
}
