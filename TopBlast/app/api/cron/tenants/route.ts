import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { listActiveTenantSlugs, runForTenantSlug } from '@/lib/tenant/service'
import { runAutomatedTenantCycle } from '@/lib/payout/tenantCycle'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === config.cronSecret
}

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
  if (!verifyCronSecret(request) && config.isProd) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runForAllTenants()
}

export async function GET(request: NextRequest) {
  if (config.isProd) {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return runForAllTenants()
}
