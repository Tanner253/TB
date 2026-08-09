import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { verifyCronSecret } from '@/lib/security/cronAuth'
import { workerOwnsIndexing } from '@/lib/platform/workerMode'

export const dynamic = 'force-dynamic'

/** Auth-only ping — no indexing, payouts, or Helius. Use before enabling worker mode on prod. */
export async function GET(request: NextRequest) {
  if (config.isProd && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    worker_owns_indexing: workerOwnsIndexing(),
    execute_payouts: process.env.EXECUTE_PAYOUTS === 'true',
    timestamp: new Date().toISOString(),
  })
}
