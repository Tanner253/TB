import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { listActiveTenantSlugs, runForTenantSlug } from '@/lib/tenant/service'
import { runAutomatedTenantCycle } from '@/lib/payout/tenantCycle'
import { runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import { verifyCronSecret } from '@/lib/security/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function runForAllTenants() {
  const slugs = await listActiveTenantSlugs()
  const results: Array<{
    slug: string
    success: boolean
    cycle?: Awaited<ReturnType<typeof runAutomatedTenantCycle>>
    error?: string
  }> = []

  for (const slug of slugs) {
    try {
      const cycle = await runForTenantSlug(slug, () => runAutomatedTenantCycle())
      results.push({ slug, success: true, cycle })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.push({ slug, success: false, error: message })
    }
  }

  return NextResponse.json({
    success: true,
    data: { processed: results.length, results },
  })
}

export async function POST(request: NextRequest) {
  if (config.isProd && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runAuthorizedPayout(() => runForAllTenants())
}

export async function GET(request: NextRequest) {
  if (config.isProd) {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return runAuthorizedPayout(() => runForAllTenants())
}
