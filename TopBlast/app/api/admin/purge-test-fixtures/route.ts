/**
 * Remove Jest test fixture tenants (bonk/pepe/fake mints) and their scoped data.
 * POST with Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { purgeAllJestFixtureTenants } from '@/lib/admin/purgeJestFixtures'
import { verifyCronSecret } from '@/lib/security/cronAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const purged = await purgeAllJestFixtureTenants()

    if (purged.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Jest test fixture tenants found',
        purged: [],
      })
    }

    return NextResponse.json({
      success: true,
      message: `Purged ${purged.length} test fixture tenant(s)`,
      slugs: purged.map(p => p.slug),
      purged,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Purge failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
