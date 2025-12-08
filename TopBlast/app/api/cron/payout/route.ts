/**
 * Manual Payout Trigger Endpoint
 * Can be called manually or via webhook
 * Uses the same executor as the automatic timer
 */

import { NextRequest, NextResponse } from 'next/server'
import { executePayout, canExecutePayout } from '@/lib/payout/executor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify auth header for manual triggers
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Allow if no secret configured (dev) or if matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if we can execute
    if (!canExecutePayout()) {
      return NextResponse.json({
        success: false,
        error: 'Payout cannot be executed now (already in progress or too soon)',
      }, { status: 429 })
    }

    // Execute payout
    const result = await executePayout()

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

// Also support GET for testing
export async function GET(request: NextRequest) {
  return POST(request)
}
