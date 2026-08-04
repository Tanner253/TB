/**
 * Force a fresh deployment reset (holders, rankings, timer, history).
 * POST with Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { resetDeploymentState } from '@/lib/payout/resetDeployment'

export const dynamic = 'force-dynamic'

function verifySecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return config.isDev
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await resetDeploymentState()
    console.log('[Admin] Deployment reset:', result)

    return NextResponse.json({
      success: true,
      message: 'Database reset for fresh deployment',
      data: result,
    })
  } catch (error: any) {
    console.error('[Admin] Reset failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Reset failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
