/**
 * Manual Payout Trigger Endpoint
 * Can be called manually or via webhook
 * Uses the same executor as the automatic timer
 */

import { NextRequest, NextResponse } from 'next/server'
import { executePayout, canExecutePayout } from '@/lib/payout/executor'
import { runAuthorizedPayout } from '@/lib/payout/payoutAuthContext'
import { verifyCronSecret } from '@/lib/security/cronAuth'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (config.isProd && !verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canExecutePayout()) {
      return NextResponse.json({
        success: false,
        error: 'Payout cannot be executed now (already in progress or too soon)',
      }, { status: 429 })
    }

    const result = await runAuthorizedPayout(() => executePayout())

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error: any) {
    console.error('[Cron/Payout] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Payout failed',
    }, { status: 500 })
  }
}

// GET only in development — production must use POST + CRON_SECRET
export async function GET(request: NextRequest) {
  if (config.isProd) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }
  return POST(request)
}
